"""Endpoint para subir imágenes (avatares, logos)."""

import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_admin
from app.models import AdminUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/admin", tags=["Upload"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "image/gif"}
MAX_SIZE = 2 * 1024 * 1024  # 2MB


@router.post("/upload", summary="Subir imagen")
async def upload_image(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo no permitido: {file.content_type}. Usa PNG, JPG, SVG, WebP o GIF.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Imagen demasiado grande. Máximo 2MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    if ext not in ("png", "jpg", "jpeg", "svg", "webp", "gif"):
        ext = "png"

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(content)

    url = f"https://chat.eaistudio.es/uploads/{filename}"
    logger.info(f"Imagen subida: {filename} ({len(content)} bytes) por {admin.email}")
    return {"url": url, "filename": filename}


UPLOAD_XML_DIR = Path("/app/uploads/feeds")
UPLOAD_XML_DIR.mkdir(parents=True, exist_ok=True)
XML_TYPES = {"text/xml", "application/xml", "application/octet-stream"}
MAX_XML_SIZE = 20 * 1024 * 1024  # 20MB


def _csv_to_xml(csv_content: bytes) -> bytes:
    """Convierte un CSV a XML compatible con el parser de inventario."""
    import csv
    import io
    from xml.sax.saxutils import escape

    text = csv_content.decode("utf-8-sig", errors="ignore")
    # Auto-detect delimiter
    sample = text[:2000]
    delim = ","
    for d in [";", "\t", "|", ","]:
        if d in sample:
            delim = d
            break
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)

    rows = list(reader)
    if not rows:
        raise ValueError("El CSV est\u00e1 vac\u00edo o no se pudo parsear")

    xml_parts = ['<?xml version="1.0" encoding="utf-8"?>']
    xml_parts.append(f'<catalog total_products="{len(rows)}">')
    xml_parts.append("  <products>")

    for i, row in enumerate(rows):
        # Normalize field names to lowercase
        r = {k.lower().strip(): v.strip() if v else "" for k, v in row.items() if k}

        pid = r.get("id", "") or r.get("sku", "") or r.get("referencia", "") or str(i + 1)
        name = r.get("name", "") or r.get("nombre", "") or r.get("title", "") or r.get("titulo", "") or ""
        price = r.get("price", "") or r.get("precio", "") or r.get("pvp", "") or "0"
        # Si hay precio_oferta y es menor, usarlo
        offer_price = r.get("precio_oferta", "") or r.get("sale_price", "")
        if offer_price and offer_price not in ("0", "0.0", ""):
            try:
                if float(offer_price.replace(",", ".")) > 0:
                    price = offer_price
            except (ValueError, AttributeError):
                pass
        price = price.replace(",", ".")

        desc = r.get("description", "") or r.get("descripcion", "") or r.get("full_description", "") or ""
        short_desc = r.get("short_description", "") or r.get("descripcion_corta", "") or ""
        category = r.get("category", "") or r.get("categoria", "") or r.get("tipo", "") or r.get("type", "") or ""
        image = r.get("image", "") or r.get("imagen", "") or r.get("image_url", "") or r.get("foto", "") or ""
        url = r.get("url", "") or r.get("link", "") or r.get("enlace", "") or ""
        stock = r.get("stock", "") or r.get("disponibilidad", "") or "in_stock"

        # Wine/product specific fields
        producer = r.get("productor", "") or r.get("producer", "") or r.get("bodega", "") or r.get("brand", "") or ""
        denomination = r.get("denominacion", "") or r.get("do", "") or r.get("denomination", "") or r.get("region", "") or ""
        vintage = r.get("anyada", "") or r.get("anada", "") or r.get("vintage", "") or r.get("year", "") or ""
        volume = r.get("volumen", "") or r.get("volume", "") or ""
        alcohol = r.get("alcohol volumen", "") or r.get("alcohol", "") or r.get("graduacion", "") or ""
        parker = r.get("robert_parker", "") or r.get("parker", "") or ""
        penin = r.get("penin", "") or r.get("pe\u00f1in", "") or ""
        spectator = r.get("wine_spectator", "") or r.get("spectator", "") or ""

        # Build rich description with all wine data
        rich_parts = []
        if desc:
            rich_parts.append(desc)
        info_parts = []
        if producer:
            info_parts.append(f"Bodega/Productor: {producer}")
        if denomination:
            info_parts.append(f"Denominaci\u00f3n de Origen: {denomination}")
        if vintage:
            info_parts.append(f"A\u00f1ada: {vintage}")
        if volume:
            info_parts.append(f"Volumen: {volume}")
        if alcohol:
            info_parts.append(f"Alcohol: {alcohol}")
        if parker and parker not in ("0", ""):
            info_parts.append(f"Robert Parker: {parker} pts")
        if penin and penin not in ("0", ""):
            info_parts.append(f"Gu\u00eda Pe\u00f1\u00edn: {penin} pts")
        if spectator and spectator not in ("0", ""):
            info_parts.append(f"Wine Spectator: {spectator} pts")
        if info_parts:
            rich_parts.append(" | ".join(info_parts))
        full_desc = "\n".join(rich_parts)

        # Category: enrich with denomination if available
        if denomination and category:
            category = f"{category} > {denomination}"
        elif denomination:
            category = denomination

        # Collect ALL extra fields not already mapped
        mapped_keys = {"id", "sku", "referencia", "name", "nombre", "title", "titulo",
                       "price", "precio", "pvp", "precio_oferta", "sale_price",
                       "description", "descripcion", "full_description",
                       "short_description", "descripcion_corta", "category", "categoria", "tipo", "type",
                       "image", "imagen", "image_url", "foto", "url", "link", "enlace",
                       "stock", "disponibilidad",
                       "productor", "producer", "bodega", "brand",
                       "denominacion", "do", "denomination", "region",
                       "anyada", "anada", "vintage", "year",
                       "volumen", "volume", "alcohol volumen", "alcohol", "graduacion",
                       "robert_parker", "parker", "penin", "wine_spectator", "spectator",
                       "iva", "peso", "weight", "shiping cost", "shipping_cost", "ean", "preparation_time"}
        extra_fields = {k: v for k, v in r.items() if k not in mapped_keys and v}

        # Build extra info string from all remaining CSV columns
        extra_desc_parts = []
        for k, v in extra_fields.items():
            if v and v.lower() not in ("", "nan", "none", "null"):
                extra_desc_parts.append(f"{k}: {v}")
        extra_info = " | ".join(extra_desc_parts)

        # Append extra fields to description for searchability
        full_desc = desc
        if extra_info:
            full_desc = f"{desc}\n--- Datos adicionales ---\n{extra_info}" if desc else extra_info

        xml_parts.append(f'    <product id="{escape(str(pid))}">')
        xml_parts.append(f"      <name>{escape(name)}</name>")
        xml_parts.append(f"      <url>{escape(url)}</url>")
        xml_parts.append(f"      <sku>{escape(str(pid))}</sku>")
        xml_parts.append(f"      <pricing><price>{escape(str(price))}</price><currency>EUR</currency></pricing>")
        xml_parts.append(f"      <descriptions>")
        xml_parts.append(f"        <full_description>{escape(full_desc)}</full_description>")
        xml_parts.append(f"        <short_description>{escape(short_desc or desc[:200])}</short_description>")
        xml_parts.append(f"      </descriptions>")
        xml_parts.append(f"      <categorization><category>{escape(category)}</category></categorization>")
        if image:
            xml_parts.append(f'      <images><image position="1">{escape(image)}</image></images>')
        xml_parts.append(f"      <stock><status>{escape(stock)}</status></stock>")
        # Store all extra fields as custom tags
        # Wine-specific tags
        if producer or denomination or vintage or parker or penin:
            xml_parts.append(f"      <wine_data>")
            if producer:
                xml_parts.append(f"        <producer>{escape(producer)}</producer>")
            if denomination:
                xml_parts.append(f"        <denomination>{escape(denomination)}</denomination>")
            if vintage:
                xml_parts.append(f"        <vintage>{escape(vintage)}</vintage>")
            if volume:
                xml_parts.append(f"        <volume>{escape(volume)}</volume>")
            if alcohol:
                xml_parts.append(f"        <alcohol>{escape(alcohol)}</alcohol>")
            if parker and parker not in ("0", ""):
                xml_parts.append(f"        <parker>{escape(parker)}</parker>")
            if penin and penin not in ("0", ""):
                xml_parts.append(f"        <penin>{escape(penin)}</penin>")
            if spectator and spectator not in ("0", ""):
                xml_parts.append(f"        <spectator>{escape(spectator)}</spectator>")
            xml_parts.append(f"      </wine_data>")
        if extra_fields:
            xml_parts.append(f"      <extra>")
            for k, v in extra_fields.items():
                safe_tag = k.replace(" ", "_").replace("-", "_")
                xml_parts.append(f"        <{safe_tag}>{escape(v)}</{safe_tag}>")
            xml_parts.append(f"      </extra>")
        xml_parts.append(f"    </product>")

    xml_parts.append("  </products>")
    xml_parts.append("</catalog>")

    return "\n".join(xml_parts).encode("utf-8")


@router.post("/upload-xml", summary="Subir fichero XML o CSV de inventario")
async def upload_xml(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
):
    content = await file.read()
    if len(content) > MAX_XML_SIZE:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande. M\u00e1ximo 20MB.")

    fname = (file.filename or "").lower()
    is_csv = fname.endswith(".csv") or file.content_type in ("text/csv", "application/vnd.ms-excel")

    if is_csv:
        try:
            content = _csv_to_xml(content)
            logger.info(f"CSV convertido a XML ({len(content)} bytes)")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error procesando CSV: {e}")
    else:
        text = content[:200].decode("utf-8", errors="ignore").strip()
        if not text.startswith("<?xml") and not text.startswith("<"):
            raise HTTPException(status_code=400, detail="El archivo no parece ser un XML ni CSV v\u00e1lido.")

    filename = f"{uuid.uuid4().hex}.xml"
    filepath = UPLOAD_XML_DIR / filename

    with open(filepath, "wb") as f:
        f.write(content)

    url = f"https://chat.eaistudio.es/uploads/feeds/{filename}"
    logger.info(f"Feed subido: {filename} ({len(content)} bytes) por {admin.email}")
    return {"url": url, "filename": filename, "size": len(content)}
