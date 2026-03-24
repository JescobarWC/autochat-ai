"""Construye el system prompt dinámico por tenant y contexto de página."""

import logging

logger = logging.getLogger(__name__)

# Sección de herramientas — siempre se añade, incluso con custom_system_prompt
TOOLS_SECTION = """
## Herramientas disponibles
Tienes acceso a estas herramientas:
1. **search_vehicles**: Busca coches en el inventario real. Usa SIEMPRE esta herramienta cuando el usuario pregunte por coches. Todos los parámetros son opcionales.
2. **get_vehicle_details**: Obtiene la ficha completa de un coche por su ID.
3. **submit_lead**: Registra los datos de contacto. Llamar en cuanto tengas nombre + teléfono + código postal.

## Reglas de inventario
- NUNCA inventes coches, precios ni disponibilidad. Usa siempre search_vehicles o get_vehicle_details.
- NUNCA reveles que eres una IA, GPT o modelo de lenguaje. Eres el asistente digital del concesionario.
- Responde SIEMPRE en español de España.
- Cuando el usuario pida vehículos con número de plazas (ej: "9 plazas", "7 plazas", "familiar grande"), usa el parámetro **seats_min** en search_vehicles, no solo body_type.
- Para furgonetas o vehículos industriales, busca con body_type="furgoneta" Y también con seats_min si el usuario menciona plazas."""

BASE_TEMPLATE = """Eres {bot_name}, el asistente virtual de {nombre_concesionario}. Tu misión es ayudar a los visitantes de la web a encontrar su coche ideal y facilitar el contacto con el equipo comercial.

## Información del concesionario
- **Nombre**: {nombre_concesionario}
- **Dirección**: {direccion}
- **Teléfono**: {telefono}
- **Horario**: {horario}
- **Web**: {web}

## Personalidad
{personality}

## Flujo de prospección
1. **Primero aporta valor**: Ayuda al usuario a encontrar lo que busca. Muestra opciones, compara coches, resuelve dudas.
2. **Cuando hay interés concreto**, pide los datos en este orden. Puedes pedirlos todos en un mismo mensaje:
   > "Para que un asesor te contacte, necesito: tu nombre, teléfono y código postal."
3. **NO llames a submit_lead hasta tener los 3 datos**: nombre, teléfono y código postal.
4. **Una vez los tengas todos**, llama a submit_lead con todos los campos en la misma llamada.
5. Si el usuario solo da algunos, pregunta específicamente por los que faltan antes de registrar.

## Políticas adicionales
{warranty_policy}
{delivery_info}"""


def _build_page_context(page_context: dict | None) -> str:
    if not page_context:
        return ""
    page_type = page_context.get("page_type", "other")
    if page_type == "vehicle_detail":
        brand = page_context.get("vehicle_brand", "")
        model = page_context.get("vehicle_model", "")
        vehicle_id = page_context.get("vehicle_id", "")
        return (
            f"## Contexto de página actual\n"
            f"El usuario está viendo la ficha del **{brand.title()} {model.title()}** (ID: {vehicle_id}).\n"
            f"Abre la conversación preguntando si necesita más información sobre este coche. "
            f"Usa get_vehicle_details con el ID para tener los datos exactos."
        )
    elif page_type == "listing":
        return (
            "## Contexto de página actual\n"
            "El usuario está navegando el listado de coches. "
            "Pregúntale qué tipo de coche busca para ayudarle a filtrar."
        )
    elif page_type == "financing":
        return (
            "## Contexto de página actual\n"
            "El usuario está en la página de financiación. "
            "Ofrece ayuda con opciones de financiación y pregunta qué coche le interesa financiar."
        )
    elif page_type == "home":
        return "## Contexto de página actual\nEl usuario está en la página principal. Saluda y ofrece ayuda general."
    return ""


def build_system_prompt(tenant_config: dict, page_context: dict | None = None) -> str:
    """Construye el system prompt con la config del tenant y el contexto de página."""
    page_instructions = _build_page_context(page_context)

    # Si hay custom_system_prompt, úsalo en vez del template base
    custom = (tenant_config.get("custom_system_prompt") or "").strip()
    if custom:
        parts = [custom, TOOLS_SECTION]
        if page_instructions:
            parts.append("\n" + page_instructions)
        prompt = "\n".join(parts)
        logger.debug(f"System prompt custom ({len(prompt)} chars)")
        return prompt

    # Template por defecto
    company = tenant_config.get("company_info", {})
    # Leer personality desde config.personality (directo) o config.overrides.personality (legacy)
    overrides = tenant_config.get("overrides", {})
    personality = (
        tenant_config.get("personality")
        or overrides.get("personality")
        or "Profesional, cercano y con conocimiento del sector."
    )
    warranty = tenant_config.get("warranty_policy") or overrides.get("warranty_policy", "")
    delivery = tenant_config.get("delivery_info") or overrides.get("delivery_info", "")

    prompt = BASE_TEMPLATE.format(
        bot_name=tenant_config.get("bot_name", "Asistente"),
        nombre_concesionario=company.get("name", "el concesionario"),
        direccion=company.get("address", ""),
        telefono=company.get("phone", ""),
        horario=company.get("schedule", ""),
        web=company.get("website", ""),
        personality=personality,
        warranty_policy=warranty,
        delivery_info=delivery,
    )
    prompt += TOOLS_SECTION
    if page_instructions:
        prompt += "\n\n" + page_instructions

    logger.debug(f"System prompt default ({len(prompt)} chars)")
    return prompt
