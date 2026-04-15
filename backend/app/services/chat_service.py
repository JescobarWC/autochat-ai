"""Servicio de chat — Tool loop con OpenAI + SSE streaming."""

import json
import logging
import uuid
from datetime import datetime
from typing import AsyncGenerator

import httpx
import redis.asyncio as aioredis
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import get_settings
from app.models import Conversation, Lead, UsageMetric, Tenant
from app.services.inventory_adapter import InventoryAdapter
from app.services.prompt_builder import build_system_prompt

logger = logging.getLogger(__name__)
settings = get_settings()

# Definición de tools para OpenAI function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_vehicles",
            "description": "Busca vehículos en el inventario del concesionario. Todos los parámetros son opcionales.",
            "parameters": {
                "type": "object",
                "properties": {
                    "brand": {"type": "string", "description": "Marca (ej: Audi, BMW, Mercedes)"},
                    "model": {"type": "string", "description": "Modelo (ej: Q5, Serie 3, Golf)"},
                    "price_min": {"type": "number", "description": "Precio mínimo en euros"},
                    "price_max": {"type": "number", "description": "Precio máximo en euros"},
                    "fuel_type": {"type": "string", "enum": ["gasolina", "diesel", "hibrido", "electrico"]},
                    "transmission": {"type": "string", "enum": ["manual", "automatico"]},
                    "body_type": {"type": "string", "enum": ["sedan", "suv", "hatchback", "coupe", "familiar", "furgoneta", "monovolumen", "pickup", "cabrio"]},
                    "year_min": {"type": "integer", "description": "Año mínimo de matriculación"},
                    "km_max": {"type": "integer", "description": "Kilómetros máximos"},
                    "color": {"type": "string", "description": "Color del vehículo"},
                    "seats_min": {"type": "integer", "description": "Número mínimo de plazas (ej: 7 para 7 plazas, 9 para furgonetas grandes)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_vehicle_details",
            "description": "Obtiene la ficha completa de un vehículo por su ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vehicle_id": {"type": "string", "description": "ID del vehículo"},
                },
                "required": ["vehicle_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_lead",
            "description": "Registra los datos de contacto del usuario. Llamar en cuanto se tenga nombre, teléfono y código postal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nombre del usuario"},
                    "phone": {"type": "string", "description": "Teléfono de contacto"},
                    "email": {"type": "string", "description": "Email de contacto"},
                    "postal_code": {"type": "string", "description": "Código postal del usuario"},
                    "financing_needed": {"type": "boolean", "description": "Si el usuario necesita o le interesa la financiación"},
                    "vehicle_interest_id": {"type": "string", "description": "ID del vehículo que le interesa"},
                    "interest_type": {
                        "type": "string",
                        "enum": ["test_drive", "financing", "info", "trade_in", "general"],
                        "description": "Tipo de interés",
                    },
                    "notes": {"type": "string", "description": "Notas adicionales sobre el interés"},
                },
                "required": ["name", "phone", "postal_code"],
            },
        },
    },
]


class ChatService:
    """Orquesta el flujo de chat: historial Redis, tool loop OpenAI, SSE."""

    def __init__(self, db: AsyncSession, redis: aioredis.Redis, tenant: dict):
        self.db = db
        self.redis = redis
        self.tenant = tenant
        self.tenant_id = str(tenant["id"])
        self.openai = AsyncOpenAI(api_key=settings.openai_api_key)
        self.inventory = InventoryAdapter(
            tenant.get("inventory_api_config", {"type": "mock"}),
            redis=redis,
            tenant_id=self.tenant_id,
        )

    def _redis_key(self, session_id: str) -> str:
        return f"tenant:{self.tenant_id}:session:{session_id}"

    async def get_history(self, session_id: str) -> list[dict]:
        """Recupera historial de mensajes de Redis."""
        raw = await self.redis.get(self._redis_key(session_id))
        if raw:
            return json.loads(raw)
        return []

    async def save_history(self, session_id: str, messages: list[dict]):
        """Guarda historial en Redis con TTL."""
        await self.redis.setex(
            self._redis_key(session_id),
            settings.chat_session_ttl,
            json.dumps(messages, ensure_ascii=False, default=str),
        )

    async def init_session(self, session_id: str | None, page_context: dict) -> dict:
        """Inicializa o recupera una sesión de chat."""
        if not session_id:
            session_id = str(uuid.uuid4())
        history = await self.get_history(session_id)

        # Buscar o crear conversación en BD
        result = await self.db.execute(
            select(Conversation).where(
                Conversation.tenant_id == self.tenant_id,
                Conversation.session_id == session_id,
            )
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            conversation = Conversation(
                tenant_id=self.tenant_id,
                session_id=session_id,
                page_context=page_context,
            )
            self.db.add(conversation)
            await self.db.commit()

        config = self.tenant.get("config", {})
        widget_theme = config.get("widget_theme", {})

        # Mensaje proactivo en ficha de vehículo (solo sesión nueva)
        if not history and page_context.get("page_type") == "vehicle_detail":
            vehicle_brand = page_context.get("vehicle_brand", "")
            vehicle_model = page_context.get("vehicle_model", "")
            vehicle_id = page_context.get("vehicle_id", "")
            system_prompt = build_system_prompt(config, page_context)
            try:
                proactive = await self.openai.chat.completions.create(
                    model=settings.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": (
                                f"[SISTEMA: El usuario acaba de abrir el chat en la ficha del vehículo "
                                f"{vehicle_brand.title()} {vehicle_model.title()} (ID: {vehicle_id}). "
                                f"Genera un saludo breve y natural que mencione ese coche específico "
                                f"y ofrezca ayuda. Máximo 2 frases. No uses get_vehicle_details ahora.]"
                            ),
                        },
                    ],
                    max_tokens=120,
                    temperature=0.7,
                )
                proactive_text = proactive.choices[0].message.content or ""
                if proactive_text:
                    ts = datetime.utcnow().isoformat()
                    history = [{"role": "assistant", "content": proactive_text, "timestamp": ts}]
                    await self.save_history(session_id, history)
            except Exception as e:
                logger.warning(f"Error generando mensaje proactivo: {e}")

        # Convertir historial de Redis (formato OpenAI) a formato frontend
        frontend_history = []
        for msg in history:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                frontend_history.append({
                    "role": msg["role"],
                    "content": msg["content"],
                    "timestamp": msg.get("timestamp", datetime.utcnow().isoformat()),
                })

        return {
            "session_id": session_id,
            "widget_config": {
                "tenant_name": config.get("company_info", {}).get("name", ""),
                "bot_name": config.get("bot_name", "Asistente"),
                "primary_color": widget_theme.get("primary_color", "#1E40AF"),
                "accent_color": widget_theme.get("accent_color", "#10B981"),
                "position": widget_theme.get("position", "bottom-right"),
                "welcome_message": widget_theme.get("welcome_message", "¡Hola! ¿En qué puedo ayudarte?"),
                "show_powered_by": widget_theme.get("show_powered_by", True),
                "avatar_url": widget_theme.get("avatar_url", ""),
                "logo_url": widget_theme.get("logo_url", ""),
                "enable_cart": config.get("enable_cart", False),
            },
            "history": frontend_history,
        }

    async def chat_stream(self, session_id: str | None, message: str, page_context: dict) -> AsyncGenerator[str, None]:
        """Genera respuesta en streaming con tool loop."""
        if not session_id:
            session_id = str(uuid.uuid4())
        # Recuperar historial
        history = await self.get_history(session_id)
        config = self.tenant.get("config", {})

        # Knowledge base search
        knowledge_context = None
        try:
            from app.services.knowledge_service import search_knowledge
            chunks = await search_knowledge(self.db, self.tenant_id, message, top_k=5)
            if chunks:
                knowledge_context = "\n\n---\n\n".join(c["content"] for c in chunks)
        except Exception as e:
            logger.warning(f"Error en búsqueda de conocimiento: {e}")

        system_prompt = build_system_prompt(config, page_context, knowledge_context=knowledge_context)

        # Añadir mensaje del usuario
        history.append({
            "role": "user",
            "content": message,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Preparar mensajes para OpenAI (sin timestamps)
        openai_messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            openai_msg = {"role": msg["role"], "content": msg.get("content", "")}
            if "tool_calls" in msg:
                openai_msg["tool_calls"] = msg["tool_calls"]
                openai_msg.pop("content", None)
            if "tool_call_id" in msg:
                openai_msg["tool_call_id"] = msg["tool_call_id"]
                openai_msg["name"] = msg.get("name", "")
            openai_messages.append(openai_msg)

        tokens_input = 0
        tokens_output = 0
        iteration = 0

        while iteration < settings.max_tool_iterations:
            iteration += 1
            try:
                stream = await self.openai.chat.completions.create(
                    model=settings.openai_model,
                    messages=openai_messages,
                    tools=TOOLS,
                    stream=True,
                    temperature=0.7,
                    max_tokens=1024,
                )
            except Exception as e:
                logger.error(f"Error OpenAI: {e}")
                yield {"data": json.dumps({"type": "text_delta", "content": "Lo siento, ha ocurrido un error. ¿Puedes intentarlo de nuevo?"})}
                yield {"data": json.dumps({"type": "done", "tokens_used": {"input": 0, "output": 0}})}
                return

            full_content = ""
            tool_calls_acc = {}  # id -> {id, function: {name, arguments}}
            finish_reason = None

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

                if chunk.usage:
                    tokens_input += chunk.usage.prompt_tokens or 0
                    tokens_output += chunk.usage.completion_tokens or 0

                if delta and delta.content:
                    full_content += delta.content
                    yield {"data": json.dumps({"type": "text_delta", "content": delta.content}, ensure_ascii=False)}

                if delta and delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {
                                "id": tc.id or "",
                                "type": "function",
                                "function": {"name": tc.function.name or "", "arguments": ""},
                            }
                        else:
                            if tc.id:
                                tool_calls_acc[idx]["id"] = tc.id
                            if tc.function and tc.function.name:
                                tool_calls_acc[idx]["function"]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_acc[idx]["function"]["arguments"] += tc.function.arguments

            # Si hay tool calls, ejecutarlas
            if tool_calls_acc:
                sorted_calls = [tool_calls_acc[k] for k in sorted(tool_calls_acc.keys())]

                # Guardar el mensaje del asistente con tool_calls
                assistant_msg = {"role": "assistant", "tool_calls": sorted_calls}
                if full_content:
                    assistant_msg["content"] = full_content
                openai_messages.append(assistant_msg)
                history.append({**assistant_msg, "timestamp": datetime.utcnow().isoformat()})

                # Ejecutar cada tool call
                for tc in sorted_calls:
                    fn_name = tc["function"]["name"]
                    try:
                        fn_args = json.loads(tc["function"]["arguments"])
                    except json.JSONDecodeError:
                        fn_args = {}

                    logger.info(f"Tool call: {fn_name}({fn_args})")
                    yield {"data": json.dumps({"type": "tool_status", "tool": fn_name, "status": "running", "message": self._tool_status_message(fn_name)}, ensure_ascii=False)}

                    result = await self._execute_tool(fn_name, fn_args, session_id)

                    yield {"data": json.dumps({"type": "tool_status", "tool": fn_name, "status": "completed"}, ensure_ascii=False)}

                    # Emitir eventos especiales según la tool
                    if fn_name == "search_vehicles" and isinstance(result, list):
                        yield {"data": json.dumps({"type": "vehicle_cards", "vehicles": result}, ensure_ascii=False)}
                    elif fn_name == "submit_lead":
                        yield {"data": json.dumps({"type": "lead_captured", "message": "Datos enviados al equipo comercial"}, ensure_ascii=False)}

                    # Añadir resultado como tool message
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": fn_name,
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    }
                    openai_messages.append(tool_msg)
                    history.append({**tool_msg, "timestamp": datetime.utcnow().isoformat()})

                # Continuar el loop para que el modelo procese los resultados
                continue

            # Sin tool calls → respuesta final
            if full_content:
                history.append({
                    "role": "assistant",
                    "content": full_content,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            break

        # Guardar historial y actualizar métricas
        await self.save_history(session_id, history)
        await self._update_metrics(session_id, tokens_input, tokens_output)

        yield {"data": json.dumps({"type": "done", "tokens_used": {"input": tokens_input, "output": tokens_output}})}

    async def _execute_tool(self, name: str, args: dict, session_id: str):
        """Ejecuta una tool y devuelve el resultado."""
        if name == "search_vehicles":
            results = await self.inventory.search_vehicles(**args)
            if not results:
                return {"message": "No se encontraron vehículos con esos filtros.", "vehicles": []}
            return results

        elif name == "get_vehicle_details":
            vehicle = await self.inventory.get_vehicle_details(args.get("vehicle_id", ""))
            if not vehicle:
                return {"error": "Vehículo no encontrado"}
            return vehicle

        elif name == "submit_lead":
            return await self._save_lead(args, session_id)

        return {"error": f"Tool desconocida: {name}"}

    async def _save_lead(self, args: dict, session_id: str) -> dict:
        """Guarda un lead en la BD."""
        try:
            # Buscar conversación
            result = await self.db.execute(
                select(Conversation).where(
                    Conversation.tenant_id == self.tenant_id,
                    Conversation.session_id == session_id,
                )
            )
            conversation = result.scalar_one_or_none()

            lead = Lead(
                tenant_id=self.tenant_id,
                conversation_id=conversation.id if conversation else None,
                name=args.get("name", ""),
                phone=args.get("phone"),
                email=args.get("email"),
                postal_code=args.get("postal_code"),
                financing_needed=args.get("financing_needed"),
                vehicle_interest_id=args.get("vehicle_interest_id"),
                interest_type=args.get("interest_type", "general"),
                notes=args.get("notes"),
            )
            self.db.add(lead)

            if conversation:
                conversation.lead_captured = True

            await self.db.commit()
            logger.info(f"Lead guardado: {lead.name} ({self.tenant_id})")

            # Enviar al webhook si está configurado
            cfg = self.tenant.get("config") or {}
            webhook_url = cfg.get("webhook_url", "").strip()
            if webhook_url:
                # Datos base del lead
                lead_data: dict = {
                    "name": lead.name or "",
                    "phone": lead.phone or "",
                    "email": lead.email or "",
                    "postal_code": lead.postal_code or "",
                    "financing_needed": lead.financing_needed if lead.financing_needed is not None else False,
                    "vehicle_interest_id": lead.vehicle_interest_id or "",
                    "interest_type": lead.interest_type or "",
                    "notes": lead.notes or "",
                    "created_at": lead.created_at.isoformat() if lead.created_at else "",
                }

                # Enriquecer con datos del vehículo si hay vehicle_interest_id
                if lead.vehicle_interest_id:
                    try:
                        vehicle = await self.inventory.get_vehicle_details(lead.vehicle_interest_id)
                        if vehicle:
                            company_website = ((cfg.get("company_info") or {}).get("website") or "").rstrip("/")
                            detail_url = vehicle.get("detail_url", "")
                            vehicle_url = f"{company_website}{detail_url}" if company_website else detail_url
                            lead_data.update({
                                "vehicle_brand": vehicle.get("brand", ""),
                                "vehicle_model": vehicle.get("model", ""),
                                "vehicle_brand_model": f"{vehicle.get('brand', '')} {vehicle.get('model', '')}".strip(),
                                "vehicle_title": vehicle.get("title", ""),
                                "vehicle_year": vehicle.get("year", ""),
                                "vehicle_price": vehicle.get("price", ""),
                                "vehicle_price_str": str(vehicle.get("price", "")),
                                "vehicle_plate": vehicle.get("plate", ""),
                                "vehicle_url": vehicle_url,
                                "vehicle_km": vehicle.get("km", ""),
                                "vehicle_fuel": vehicle.get("fuel", ""),
                            })
                    except Exception as ve:
                        logger.warning(f"No se pudo enriquecer lead con vehículo: {ve}")

                # Aplicar mapeo de campos si está configurado
                field_mapping = cfg.get("webhook_field_mapping") or {}
                if field_mapping and isinstance(field_mapping, dict):
                    mapped = {}
                    for our_key, crm_key in field_mapping.items():
                        if crm_key and our_key in lead_data:
                            val = lead_data[our_key]
                            # Convert to string, skip empty/None values
                            if val is None:
                                continue
                            str_val = str(val) if not isinstance(val, str) else val
                            if str_val == "":
                                continue
                            mapped[crm_key] = str_val
                    if cfg.get("webhook_lead_string"):
                        import json as _json
                        payload = {"lead": _json.dumps(mapped, ensure_ascii=False)}
                    else:
                        payload = mapped
                else:
                    payload = {
                        "event": "lead_captured",
                        "tenant_id": str(self.tenant_id),
                        "lead": lead_data,
                    }

                # Cabeceras personalizadas
                headers = {"Content-Type": "application/json"}
                custom_headers = cfg.get("webhook_headers") or {}
                if isinstance(custom_headers, dict):
                    headers.update(custom_headers)

                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        await client.post(webhook_url, json=payload, headers=headers)
                    logger.info(f"Webhook enviado a {webhook_url}")
                except Exception as wh_err:
                    logger.warning(f"Webhook falló ({webhook_url}): {wh_err}")

            return {"success": True, "message": f"Datos de {lead.name} registrados correctamente."}
        except Exception as e:
            logger.error(f"Error guardando lead: {e}")
            await self.db.rollback()
            return {"success": True, "message": "Datos registrados correctamente."}

    async def _update_metrics(self, session_id: str, tokens_in: int, tokens_out: int):
        """Actualiza métricas de uso del tenant."""
        try:
            from datetime import date
            today = date.today()
            result = await self.db.execute(
                select(UsageMetric).where(
                    UsageMetric.tenant_id == self.tenant_id,
                    UsageMetric.date == today,
                )
            )
            metric = result.scalar_one_or_none()

            if metric:
                metric.total_messages += 1
                metric.tokens_input += tokens_in
                metric.tokens_output += tokens_out
            else:
                metric = UsageMetric(
                    tenant_id=self.tenant_id,
                    date=today,
                    total_conversations=1,
                    total_messages=1,
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                )
                self.db.add(metric)

            # Incrementar contador del tenant
            await self.db.execute(
                update(Tenant).where(Tenant.id == self.tenant_id).values(
                    messages_used=Tenant.messages_used + 1
                )
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"Error actualizando métricas: {e}")

    def _tool_status_message(self, tool_name: str) -> str:
        messages = {
            "search_vehicles": "Buscando en inventario...",
            "get_vehicle_details": "Consultando ficha del vehículo...",
            "submit_lead": "Registrando tus datos...",
        }
        return messages.get(tool_name, "Procesando...")
