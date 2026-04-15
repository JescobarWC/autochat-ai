from app.utils import validate_webhook_url
"""Endpoints del panel de administración — CRUD tenants, conversations, leads, auth."""

import json
import logging
from datetime import datetime, timedelta, date

import httpx
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from jose import jwt
import bcrypt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db, get_current_admin, get_redis
from app.models import AdminUser, Tenant, Conversation, Lead, UsageMetric
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)
settings = get_settings()
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

router = APIRouter(prefix="/v1/admin", tags=["Admin"])


# === Schemas ===

class LoginRequest(BaseModel):
    email: str
    password: str


class TenantCreate(BaseModel):
    slug: str
    name: str
    allowed_domains: list[str] = []
    config: dict = {}
    inventory_api_config: dict = {"type": "mock"}
    billing_plan: str = "trial"
    monthly_message_limit: int = 1000


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_domains: Optional[list[str]] = None
    config: Optional[dict] = None
    inventory_api_config: Optional[dict] = None
    billing_plan: Optional[str] = None
    monthly_message_limit: Optional[int] = None


# === Auth ===

@router.post("/auth/login", summary="Login de administrador")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminUser).where(AdminUser.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    token = jwt.encode(
        {
            "sub": user.email,
            "role": user.role,
            "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return {"token": token, "user": {"email": user.email, "full_name": user.full_name, "role": user.role}}



# === Settings ===
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/settings/change-password", summary="Cambiar contrase\u00f1a del admin")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if not bcrypt.checkpw(body.current_password.encode("utf-8"), admin.password_hash.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Contrase\u00f1a actual incorrecta")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contrase\u00f1a debe tener al menos 8 caracteres")
    new_hash = bcrypt.hashpw(body.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    admin.password_hash = new_hash
    await db.commit()
    return {"ok": True}



# === Users ===
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "admin"  # "superadmin" or "admin"
    tenant_id: Optional[UUID] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    tenant_id: Optional[UUID] = None

@router.get("/users", summary="Listar usuarios admin")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede gestionar usuarios")
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "tenant_id": str(u.tenant_id) if u.tenant_id else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]

@router.post("/users", status_code=201, summary="Crear usuario admin")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede crear usuarios")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="La contrase\u00f1a debe tener al menos 8 caracteres")
    # Check duplicate
    existing = await db.execute(select(AdminUser).where(AdminUser.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email")
    
    pw_hash = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = AdminUser(
        email=body.email,
        password_hash=pw_hash,
        full_name=body.full_name,
        role=body.role,
        tenant_id=body.tenant_id if body.role in ("admin", "user") else None,
    )
    db.add(user)
    await db.commit()
    return {"id": str(user.id), "email": user.email}

@router.patch("/users/{user_id}", summary="Actualizar usuario")
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede editar usuarios")
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    return {"ok": True}

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.post("/users/{user_id}/reset-password", summary="Resetear contrase\u00f1a de un usuario")
async def reset_user_password(
    user_id: UUID,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede resetear contrase\u00f1as")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contrase\u00f1a debe tener al menos 8 caracteres")
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.password_hash = bcrypt.hashpw(body.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db.commit()
    return {"ok": True}

@router.delete("/users/{user_id}", summary="Eliminar usuario")
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    if admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede eliminar usuarios")
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

# === Tenants ===

@router.get("/tenants", summary="Listar todos los tenants")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    query = select(Tenant).order_by(Tenant.created_at.desc())
    if admin.role != "superadmin" and admin.tenant_id:
        query = query.where(Tenant.id == admin.tenant_id)
    result = await db.execute(query)
    tenants = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "slug": t.slug,
            "name": t.name,
            "is_active": t.is_active,
            "billing_plan": t.billing_plan,
            "billing_status": t.billing_status,
            "messages_used": t.messages_used,
            "monthly_message_limit": t.monthly_message_limit,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tenants
    ]


@router.post("/tenants", summary="Crear nuevo tenant", status_code=201)
async def create_tenant(
    body: TenantCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    # Verificar slug único
    existing = await db.execute(select(Tenant).where(Tenant.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya existe un tenant con ese slug")

    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    logger.info(f"Tenant creado: {tenant.slug} ({tenant.id})")
    return {"id": str(tenant.id), "slug": tenant.slug, "name": tenant.name}


@router.get("/tenants/{tenant_id}", summary="Detalle de un tenant")
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    return {
        "id": str(tenant.id),
        "slug": tenant.slug,
        "name": tenant.name,
        "is_active": tenant.is_active,
        "allowed_domains": tenant.allowed_domains,
        "config": tenant.config,
        "inventory_api_config": tenant.inventory_api_config,
        "billing_plan": tenant.billing_plan,
        "billing_status": tenant.billing_status,
        "messages_used": tenant.messages_used,
        "monthly_message_limit": tenant.monthly_message_limit,
        "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None,
    }


@router.patch("/tenants/{tenant_id}", summary="Actualizar tenant")
async def update_tenant(
    tenant_id: UUID,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
    tenant.updated_at = datetime.utcnow()

    await db.commit()
    logger.info(f"Tenant actualizado: {tenant.slug}")
    return {"status": "ok", "id": str(tenant.id)}


@router.delete("/tenants/{tenant_id}", summary="Eliminar tenant")
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    await db.delete(tenant)
    await db.commit()
    logger.info(f"Tenant eliminado: {tenant.slug}")
    return {"status": "deleted"}


# === Conversations ===

@router.get("/conversations", summary="Listar conversaciones")
async def list_conversations(
    tenant_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    query = select(Conversation).order_by(Conversation.last_message_at.desc())
    if tenant_id:
        query = query.where(Conversation.tenant_id == tenant_id)
    if status:
        query = query.where(Conversation.status == status)
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    convos = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "tenant_id": str(c.tenant_id),
            "session_id": c.session_id,
            "status": c.status,
            "messages_count": c.messages_count,
            "lead_captured": c.lead_captured,
            "page_context": c.page_context,
            "started_at": c.started_at.isoformat() if c.started_at else None,
            "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
        }
        for c in convos
    ]


@router.get("/conversations/{conv_id}/messages", summary="Mensajes de una conversación")
async def get_conversation_messages(
    conv_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    # Intentar primero Redis (mensajes en tiempo real)
    redis_key = f"tenant:{conv.tenant_id}:session:{conv.session_id}"
    raw = await redis.get(redis_key)

    if raw:
        history = json.loads(raw)
        messages = []
        for msg in history:
            role = msg.get("role")
            if role not in ("user", "assistant"):
                continue
            content = msg.get("content", "")
            if not content:
                continue
            messages.append({
                "role": role,
                "content": content,
                "timestamp": msg.get("timestamp"),
            })
        return messages

    # Fallback: leer de PostgreSQL (mensajes persistidos)
    if conv.messages_json:
        return conv.messages_json

    return []


# === Leads ===

@router.get("/leads", summary="Listar leads capturados")
async def list_leads(
    tenant_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    query = select(Lead).order_by(Lead.created_at.desc())
    if admin.role != "superadmin" and admin.tenant_id:
        query = query.where(Lead.tenant_id == admin.tenant_id)
    if tenant_id:
        query = query.where(Lead.tenant_id == tenant_id)
    if status:
        query = query.where(Lead.status == status)
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    leads = result.scalars().all()

    return [
        {
            "id": str(l.id),
            "tenant_id": str(l.tenant_id),
            "name": l.name,
            "phone": l.phone,
            "email": l.email,
            "postal_code": l.postal_code,
            "financing_needed": l.financing_needed,
            "vehicle_interest_id": l.vehicle_interest_id,
            "interest_type": l.interest_type,
            "notes": l.notes,
            "status": l.status,
            "created_at": l.created_at.isoformat(),
                "utm_data": l.utm_data if hasattr(l, "utm_data") else None if l.created_at else None,
        }
        for l in leads
    ]


@router.post("/leads/{lead_id}/send-to-crm", summary="Enviar lead al CRM manualmente")
async def send_lead_to_crm(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    try:
        result = await db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead no encontrado")

        result2 = await db.execute(select(Tenant).where(Tenant.id == lead.tenant_id))
        tenant = result2.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")

        cfg = tenant.config or {}
        webhook_url = (cfg.get("webhook_url") or "").strip()
        try:
            validate_webhook_url(webhook_url)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=f"URL de webhook no válida: {ve}")
        if not webhook_url:
            raise HTTPException(status_code=400, detail="No hay webhook_url configurado en este tenant")

        # Acceder a los campos con getattr por si la columna aún no existe en BD
        lead_data: dict = {
            "name": lead.name or "",
            "phone": lead.phone or "",
            "email": lead.email or "",
            "postal_code": getattr(lead, "postal_code", None) or "",
            "financing_needed": getattr(lead, "financing_needed", None) if getattr(lead, "financing_needed", None) is not None else False,
            "vehicle_interest_id": lead.vehicle_interest_id or "",
            "interest_type": lead.interest_type or "",
            "notes": lead.notes or "",
            "created_at": lead.created_at.isoformat() if lead.created_at else "",
        }

        # Enriquecer con datos del vehículo (sin Redis — lee directo si es necesario)
        if lead.vehicle_interest_id:
            try:
                from app.services.inventory_adapter import InventoryAdapter
                inv_config = tenant.inventory_api_config or {}
                adapter = InventoryAdapter(config=inv_config, redis=None, tenant_id=str(lead.tenant_id))
                vehicle = await adapter.get_vehicle_details(lead.vehicle_interest_id)
                if vehicle:
                    company_website = ((cfg.get("company_info") or {}).get("website") or "").rstrip("/")
                    detail_url = vehicle.get("detail_url", "")
                    lead_data.update({
                        "vehicle_brand": vehicle.get("brand", ""),
                        "vehicle_model": vehicle.get("model", ""),
                        "vehicle_brand_model": f"{vehicle.get('brand', '')} {vehicle.get('model', '')}".strip(),
                        "vehicle_title": vehicle.get("title", ""),
                        "vehicle_year": vehicle.get("year", ""),
                        "vehicle_price": vehicle.get("price", ""),
                        "vehicle_price_str": str(vehicle.get("price", "")),
                        "vehicle_plate": vehicle.get("plate", ""),
                        "vehicle_url": f"{company_website}{detail_url}" if company_website else detail_url,
                        "vehicle_km": vehicle.get("km", ""),
                        "vehicle_fuel": vehicle.get("fuel", ""),
                    })
            except Exception as ve:
                logger.warning(f"Enriquecimiento de vehículo omitido: {ve}")

        field_mapping = cfg.get("webhook_field_mapping") or {}
        if field_mapping and isinstance(field_mapping, dict):
            mapped = {}
            for our_key, crm_key in field_mapping.items():
                if crm_key and our_key in lead_data:
                    val = lead_data[our_key]
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
            if cfg.get("webhook_lead_string"):
                import json as _json
                payload = {"lead": _json.dumps(lead_data, ensure_ascii=False)}
            else:
                payload = {"event": "lead_captured", "tenant_id": str(lead.tenant_id), "lead": lead_data}

        headers = {"Content-Type": "application/json"}
        custom_headers = cfg.get("webhook_headers") or {}
        if isinstance(custom_headers, dict):
            headers.update(custom_headers)

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload, headers=headers)
        return {"ok": True, "status_code": resp.status_code, "payload_sent": payload}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en send_lead_to_crm: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# === Analytics ===

@router.get("/analytics/overview", summary="Resumen de analytics")
async def analytics_overview(
    tenant_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    query = select(UsageMetric)
    if tenant_id:
        query = query.where(UsageMetric.tenant_id == tenant_id)
    if date_from:
        query = query.where(UsageMetric.date >= date_from)
    if date_to:
        query = query.where(UsageMetric.date <= date_to)

    result = await db.execute(query)
    metrics = result.scalars().all()

    # Totales reales desde las tablas de conversaciones y leads
    conv_query = select(func.count()).select_from(Conversation).where(Conversation.messages_count > 0)
    if admin.role != "superadmin" and admin.tenant_id:
        query = query.where(UsageMetric.tenant_id == admin.tenant_id)
        conv_query = conv_query.where(Conversation.tenant_id == admin.tenant_id)
    leads_query = select(func.count()).select_from(Lead)
    if tenant_id:
        conv_query = conv_query.where(Conversation.tenant_id == tenant_id)
        leads_query = leads_query.where(Lead.tenant_id == tenant_id)

    real_convs = (await db.execute(conv_query)).scalar() or 0
    real_leads = (await db.execute(leads_query)).scalar() or 0

    totals = {
        "total_conversations": real_convs,
        "total_messages": sum(m.total_messages for m in metrics),
        "total_leads": real_leads,
        "tokens_input": sum(m.tokens_input for m in metrics),
        "tokens_output": sum(m.tokens_output for m in metrics),
    }

    daily = [
        {
            "date": m.date.isoformat(),
            "conversations": m.total_conversations,
            "messages": m.total_messages,
            "leads": m.total_leads,
            "tokens_input": m.tokens_input,
            "tokens_output": m.tokens_output,
        }
        for m in sorted(metrics, key=lambda x: x.date)
    ]

    return {"totals": totals, "daily": daily}


# === Inventory Cache ===

@router.post("/tenants/{tenant_id}/flush-inventory", summary="Limpiar caché de inventario")
async def flush_inventory_cache(
    tenant_id: UUID,
    redis: aioredis.Redis = Depends(get_redis),
    admin: AdminUser = Depends(get_current_admin),
):
    """Elimina la caché Redis del inventario para que se recargue en la próxima consulta."""
    keys_deleted = 0
    for prefix in ("rest", "feed"):
        key = f"{prefix}:{tenant_id}"
        deleted = await redis.delete(key)
        keys_deleted += deleted
    return {"ok": True, "keys_deleted": keys_deleted, "tenant_id": str(tenant_id)}


@router.post("/tenants/{tenant_id}/test-webhook", summary="Enviar payload de prueba al webhook")
async def test_webhook(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    cfg = tenant.config or {}
    webhook_url = (cfg.get("webhook_url") or "").strip()
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No hay webhook_url configurado")
    try:
        validate_webhook_url(webhook_url)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"URL de webhook no v\u00e1lida: {ve}")

    lead_data = {
        "name": "Carlos García (TEST)",
        "phone": "+34 612 345 678",
        "email": "carlos@ejemplo.com",
        "postal_code": "28001",
        "financing_needed": True,
        "vehicle_interest_id": "3361877",
        "interest_type": "compra",
        "notes": "Interesado en el Audi Q5. Quiere financiación.",
        "created_at": datetime.utcnow().isoformat(),
        # Campos de vehículo de ejemplo
        "vehicle_brand": "Audi",
        "vehicle_model": "Q5 2.0 TDI",
        "vehicle_brand_model": "Audi Q5 2.0 TDI",
        "vehicle_title": "Audi Q5 2.0 TDI Quattro",
        "vehicle_year": 2021,
        "vehicle_price": 32900,
        "vehicle_price_str": "32900",
        "vehicle_plate": "1234 ABC",
        "vehicle_km": 45000,
        "vehicle_fuel": "diesel",
        "vehicle_url": f"{((cfg.get('company_info') or {}).get('website') or '').rstrip('/')}/comprar-coches-ocasion/audi/q5/3361877",
    }

    # Aplicar mapeo de campos si está configurado
    field_mapping = cfg.get("webhook_field_mapping") or {}
    if field_mapping and isinstance(field_mapping, dict):
        mapped = {}
        for our_key, crm_key in field_mapping.items():
            if crm_key and our_key in lead_data:
                val = lead_data[our_key]
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
        if cfg.get("webhook_lead_string"):
            import json as _json
            payload = {"lead": _json.dumps(lead_data, ensure_ascii=False)}
        else:
            payload = {
                "event": "lead_captured",
                "tenant_id": str(tenant_id),
                "lead": lead_data,
            }

    # Cabeceras personalizadas
    headers = {"Content-Type": "application/json"}
    custom_headers = cfg.get("webhook_headers") or {}
    if isinstance(custom_headers, dict):
        headers.update(custom_headers)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload, headers=headers)
        return {"ok": True, "status_code": resp.status_code, "payload_sent": payload}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error enviando al webhook: {e}")


@router.get("/tenants/{tenant_id}/inventory-debug", summary="Diagnóstico del inventario parseado")
async def inventory_debug(
    tenant_id: UUID,
    limit: int = Query(500, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    admin: AdminUser = Depends(get_current_admin),
):
    """Devuelve los primeros vehículos tal como los parsea el adaptador, para diagnóstico."""
    from app.services.inventory_adapter import InventoryAdapter

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    inv_config = tenant.inventory_api_config or {}
    adapter = InventoryAdapter(config=inv_config, redis=redis, tenant_id=str(tenant_id))
    vehicles = await adapter._get_all_vehicles()

    return {
        "total": len(vehicles),
        "mode": inv_config.get("type", "mock"),
        "sample": vehicles[:limit],
    }


@router.post("/migrate", summary="Ejecuta migraciones de BD pendientes")
async def run_migrations(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Añade columnas nuevas a tablas existentes (idempotente)."""
    migrations = [
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS financing_needed BOOLEAN",
    ]
    results = []
    for sql in migrations:
        try:
            await db.execute(text(sql))
            results.append({"sql": sql, "ok": True})
        except Exception as e:
            results.append({"sql": sql, "ok": False, "error": "Error al ejecutar migracion"})
    await db.commit()
    return {"migrations": results}
