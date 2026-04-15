"""Adaptador de inventario — Mock, XML Feed (inventario.pro), REST."""

import json
import logging
import re
from typing import Optional
from unicodedata import normalize

import httpx
import xmltodict
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

FEED_CACHE_TTL = 900  # 15 minutos

FUEL_MAP = {
    "diesel": "diesel", "diésel": "diesel", "gasóleo": "diesel",
    "gasolina": "gasolina", "petrol": "gasolina",
    "eléctrico": "electrico", "electrico": "electrico", "electric": "electrico",
    "híbrido": "hibrido", "hibrido": "hibrido", "hybrid": "hibrido",
    "híbrido enchufable": "hibrido", "phev": "hibrido",
    "glp": "glp", "gas": "glp",
}

BODY_MAP = {
    "suv": "suv", "todoterreno": "suv", "4x4": "suv",
    "berlina": "sedan", "sedan": "sedan", "sedán": "sedan",
    "compacto": "hatchback", "hatchback": "hatchback", "utilitario": "hatchback",
    "familiar": "familiar", "estate": "familiar",
    "coupé": "coupe", "coupe": "coupe",
    "cabrio": "cabrio", "cabriolet": "cabrio",
    "monovolumen": "monovolumen", "mpv": "monovolumen",
    "pick-up": "pickup", "pickup": "pickup",
    "furgoneta": "furgoneta", "van": "furgoneta", "industrial": "furgoneta",
}

TRANS_MAP = {
    "manual": "manual",
    "automático": "automatico", "automatico": "automatico",
    "automática": "automatico", "automatic": "automatico",
}


def slugify(text: str) -> str:
    text = normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")


def safe_int(val, default=0):
    try:
        return int(float(str(val).replace(".", "").replace(",", ".")))
    except (ValueError, TypeError):
        return default


def safe_float(val, default=0.0):
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return default


def format_price(price: int) -> str:
    return f"{price:,.0f} €".replace(",", ".")


def normalize_fuel(raw: str) -> str:
    return FUEL_MAP.get(raw.lower().strip(), raw.lower().strip()) if raw else ""


def normalize_body(raw: str) -> str:
    return BODY_MAP.get(raw.lower().strip(), raw.lower().strip()) if raw else ""


def normalize_trans(raw: str) -> str:
    return TRANS_MAP.get(raw.lower().strip(), raw.lower().strip()) if raw else ""


def parse_ad(ad: dict, detail_url_pattern: str) -> dict:
    """Convierte un <ad> del XML a formato estandar."""
    vehicle_id = str(ad.get("id", ""))
    make = str(ad.get("make", ""))
    model_name = str(ad.get("model", ""))
    version = str(ad.get("version", ""))
    title = str(ad.get("title", f"{make} {model_name}"))
    price = safe_int(ad.get("price", 0))
    financed_price = safe_int(ad.get("financed_price", 0))
    monthly_fee_raw = safe_float(ad.get("monthly_financing_fee", 0))
    monthly_fee = round(monthly_fee_raw) if monthly_fee_raw < 10000 else round(monthly_fee_raw / 100)

    # Imagen principal
    pictures = ad.get("pictures", {})
    pic_list = pictures.get("picture", []) if isinstance(pictures, dict) else []
    if isinstance(pic_list, dict):
        pic_list = [pic_list]
    if isinstance(pic_list, str):
        pic_list = [{"picture_url": pic_list}]

    image_url = ""
    if pic_list:
        first_pic = pic_list[0]
        if isinstance(first_pic, dict):
            image_url = first_pic.get("picture_url", "")
        else:
            image_url = str(first_pic)
    if not image_url:
        image_url = f"https://placehold.co/400x250/1a1a2e/ffffff?text={make}+{model_name}"

    # Equipment
    equip_serie = ad.get("equipment_serie", {}) or {}
    equipment = {}
    for key in ["equipment_exterior", "equipment_interior", "equipment_confort", "equipment_seguridad", "equipment_motor"]:
        val = equip_serie.get(key, "")
        if val:
            equipment[key.replace("equipment_", "")] = str(val)
    equip_extra = ad.get("equipment_extra", "")
    if equip_extra:
        equipment["extra"] = str(equip_extra)

    full_model = f"{model_name} {version}".strip() if version else model_name

    detail_url = detail_url_pattern.format(
        make=slugify(make),
        model=slugify(model_name),
        id=vehicle_id,
    )

    return {
        "id": vehicle_id,
        "brand": make,
        "model": full_model,
        "title": title,
        "year": safe_int(ad.get("year")),
        "km": safe_int(ad.get("kms")),
        "fuel": normalize_fuel(str(ad.get("fuel", ""))),
        "transmission": normalize_trans(str(ad.get("transmission", ""))),
        "body_type": normalize_body(str(ad.get("bodytype", ""))),
        "color": str(ad.get("color", "")),
        "price": price,
        "price_formatted": format_price(price),
        "financed_price": financed_price,
        "financed_price_formatted": format_price(financed_price) if financed_price else None,
        "monthly_fee": monthly_fee,
        "monthly_fee_formatted": f"{monthly_fee:,} €/mes".replace(",", ".") if monthly_fee else None,
        "image_url": image_url,
        "detail_url": detail_url,
        "power": str(ad.get("power", "")),
        "seats": safe_int(ad.get("seats")),
        "doors": safe_int(ad.get("doors")),
        "guarantee": str(ad.get("guarantee", "")),
        "city": str(ad.get("city", "")),
        "store": str(ad.get("store", "")),
        "plate": str(ad.get("plate", "") or ad.get("registration", "") or ad.get("matricula", "") or ""),
        "equipment": equipment,
    }


# Mock fallback
MOCK_INVENTORY = [
    {"id": "3361877", "brand": "Audi", "model": "Q5 2.0 TDI Quattro", "title": "Audi Q5", "year": 2021, "km": 45000, "fuel": "diesel", "transmission": "automatico", "body_type": "suv", "color": "Blanco", "price": 32900, "price_formatted": "32.900 €", "financed_price": 29610, "financed_price_formatted": "29.610 €", "monthly_fee": 575, "monthly_fee_formatted": "575 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Audi+Q5", "detail_url": "/comprar-coches-ocasion/audi/q5/3361877", "equipment": {}},
    {"id": "3361878", "brand": "BMW", "model": "Serie 3 320d xDrive", "title": "BMW Serie 3", "year": 2022, "km": 28000, "fuel": "diesel", "transmission": "automatico", "body_type": "sedan", "color": "Negro", "price": 35500, "price_formatted": "35.500 €", "financed_price": 31950, "financed_price_formatted": "31.950 €", "monthly_fee": 620, "monthly_fee_formatted": "620 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=BMW+Serie+3", "detail_url": "/comprar-coches-ocasion/bmw/serie-3/3361878", "equipment": {}},
    {"id": "3361879", "brand": "Mercedes", "model": "GLC 300d 4Matic", "title": "Mercedes GLC", "year": 2020, "km": 62000, "fuel": "diesel", "transmission": "automatico", "body_type": "suv", "color": "Gris", "price": 38900, "price_formatted": "38.900 €", "financed_price": 35010, "financed_price_formatted": "35.010 €", "monthly_fee": 680, "monthly_fee_formatted": "680 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Mercedes+GLC", "detail_url": "/comprar-coches-ocasion/mercedes/glc/3361879", "equipment": {}},
    {"id": "3361883", "brand": "Toyota", "model": "RAV4 2.5 Hybrid AWD", "title": "Toyota RAV4", "year": 2022, "km": 25000, "fuel": "hibrido", "transmission": "automatico", "body_type": "suv", "color": "Gris", "price": 34900, "price_formatted": "34.900 €", "financed_price": 31410, "financed_price_formatted": "31.410 €", "monthly_fee": 609, "monthly_fee_formatted": "609 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Toyota+RAV4", "detail_url": "/comprar-coches-ocasion/toyota/rav4/3361883", "equipment": {}},
    {"id": "3361885", "brand": "Tesla", "model": "Model 3 Long Range", "title": "Tesla Model 3", "year": 2022, "km": 30000, "fuel": "electrico", "transmission": "automatico", "body_type": "sedan", "color": "Blanco", "price": 36900, "price_formatted": "36.900 €", "financed_price": 33210, "financed_price_formatted": "33.210 €", "monthly_fee": 644, "monthly_fee_formatted": "644 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Tesla+Model+3", "detail_url": "/comprar-coches-ocasion/tesla/model-3/3361885", "equipment": {}},
    {"id": "3361890", "brand": "Volkswagen", "model": "Golf 2.0 TDI DSG", "title": "Volkswagen Golf", "year": 2021, "km": 38000, "fuel": "diesel", "transmission": "automatico", "body_type": "hatchback", "color": "Azul", "price": 24900, "price_formatted": "24.900 €", "financed_price": 22410, "financed_price_formatted": "22.410 €", "monthly_fee": 435, "monthly_fee_formatted": "435 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=VW+Golf", "detail_url": "/comprar-coches-ocasion/volkswagen/golf/3361890", "equipment": {}},
    {"id": "3361891", "brand": "Seat", "model": "Leon 1.5 TSI FR", "title": "Seat Leon", "year": 2022, "km": 20000, "fuel": "gasolina", "transmission": "manual", "body_type": "hatchback", "color": "Rojo", "price": 21900, "price_formatted": "21.900 €", "financed_price": 19710, "financed_price_formatted": "19.710 €", "monthly_fee": 382, "monthly_fee_formatted": "382 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Seat+Leon", "detail_url": "/comprar-coches-ocasion/seat/leon/3361891", "equipment": {}},
    {"id": "3361892", "brand": "Ford", "model": "Kuga 2.5 PHEV AWD", "title": "Ford Kuga", "year": 2021, "km": 42000, "fuel": "hibrido", "transmission": "automatico", "body_type": "suv", "color": "Negro", "price": 27900, "price_formatted": "27.900 €", "financed_price": 25110, "financed_price_formatted": "25.110 €", "monthly_fee": 487, "monthly_fee_formatted": "487 €/mes", "image_url": "https://placehold.co/400x250/1a1a2e/ffffff?text=Ford+Kuga", "detail_url": "/comprar-coches-ocasion/ford/kuga/3361892", "equipment": {}},
]


class InventoryAdapter:
    """Adaptador de inventario. Soporta mock, xml_feed y REST."""

    def __init__(self, config: dict, redis: aioredis.Redis | None = None, tenant_id: str = ""):
        self.config = config
        self.mode = config.get("type", "mock")
        self.redis = redis
        self.tenant_id = tenant_id
        self._vehicles_cache: list[dict] | None = None
        logger.info(f"InventoryAdapter inicializado en modo: {self.mode}")

    async def _get_feed_vehicles(self) -> list[dict]:
        """Descarga, cachea y parsea el feed XML."""
        cache_key = f"feed:{self.tenant_id}"

        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(f"Feed XML desde cache Redis ({cache_key})")
                return json.loads(cached)

        feed_url = self.config.get("feed_url", "")
        if not feed_url:
            logger.error("xml_feed configurado pero sin feed_url")
            return []

        xml_text = ""
        # If URL points to local uploads, read from disk directly
        if "/uploads/feeds/" in feed_url:
            import os
            filename = feed_url.split("/uploads/feeds/")[-1].split("?")[0]
            local_path = f"/app/uploads/feeds/{filename}"
            if os.path.exists(local_path):
                with open(local_path, "r", encoding="utf-8") as f:
                    xml_text = f.read()
                logger.info(f"Feed XML le\u00eddo desde disco: {local_path} ({len(xml_text)} chars)")

        if not xml_text:
            try:
                async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                    resp = await client.get(feed_url)
                    resp.raise_for_status()
                    xml_text = resp.text
            except Exception as e:
                logger.error(f"Error descargando feed XML: {e}")
                return []

        try:
            parsed = xmltodict.parse(xml_text)

            # Detectar estructura del XML autom\u00e1ticamente
            ads = []
            if "standard" in parsed:
                # Feed estándar de coches (inventario.pro, coches.net)
                ads_root = parsed["standard"]
                ads = ads_root.get("ad", [])
            elif "catalogo" in parsed:
                # Catálogo en español (bodegas, enotecas, etc.)
                products = parsed["catalogo"].get("producto", [])
                ads = products if isinstance(products, list) else [products]
            elif "catalog" in parsed:
                # Catálogo genérico (ecommerce, bodegas, etc.)
                products = parsed["catalog"].get("products", {})
                ads = products.get("product", [])
            else:
                # Intentar encontrar el array de items
                for key in parsed:
                    root = parsed[key]
                    if isinstance(root, dict):
                        for subkey in root:
                            if isinstance(root[subkey], (list, dict)):
                                ads = root[subkey] if isinstance(root[subkey], list) else [root[subkey]]
                                break
                    elif isinstance(root, list):
                        ads = root
                    if ads:
                        break

            if isinstance(ads, dict):
                ads = [ads]
        except Exception as e:
            logger.error(f"Error parseando feed XML: {e}")
            return []

        detail_pattern = self.config.get(
            "detail_url_pattern",
            "/comprar-coches-ocasion/{make}/{model}/{id}"
        )

        vehicles = [self._parse_generic_item(ad, detail_pattern) for ad in ads]
        vehicles = [v for v in vehicles if v.get("id")]  # Filtrar items inv\u00e1lidos
        logger.info(f"Feed XML parseado: {len(vehicles)} items")

        if self.redis and vehicles:
            await self.redis.setex(
                cache_key, FEED_CACHE_TTL,
                json.dumps(vehicles, ensure_ascii=False, default=str),
            )

        return vehicles

    def _parse_generic_item(self, item: dict, detail_pattern: str) -> dict:
        """Parsea un item gen\u00e9rico de XML (coches, vinos, productos)."""
        # Intentar extraer campos comunes de cualquier estructura
        # Handle nested structures (info_basica, comercial, media, etc.)
        info = item.get("info_basica", {}) or {}
        if not isinstance(info, dict): info = {}
        comercial = item.get("comercial", {}) or {}
        if not isinstance(comercial, dict): comercial = {}
        media = item.get("media", {}) or {}
        if not isinstance(media, dict): media = {}
        caract = item.get("caracteristicas", {}) or {}
        if not isinstance(caract, dict): caract = {}
        nota_cata = item.get("nota_de_cata", {}) or {}
        if not isinstance(nota_cata, dict): nota_cata = {}

        item_id = str(item.get("@id", "") or item.get("id", "") or item.get("sku", "") or comercial.get("ean13", ""))
        name = str(info.get("nombre", "") or item.get("name", "") or item.get("title", "") or item.get("nombre", ""))
        url = str(media.get("url", "") or item.get("url", "") or item.get("link", "") or "")

        # Precio: puede estar en pricing.price, price, precio
        price = 0
        pricing = item.get("pricing", {})
        if isinstance(pricing, dict):
            price = safe_float(pricing.get("price", 0))
        if not price:
            price = safe_float(comercial.get("precio_pvpr", 0) or item.get("price", 0) or item.get("precio", 0))

        # Descripci\u00f3n
        descs = item.get("descriptions", {})
        description = ""
        if isinstance(descs, dict):
            description = str(descs.get("full_description", "") or descs.get("short_description", ""))
        if not description:
            description = str(item.get("description", "") or item.get("descripcion", ""))

        # Wine-specific: build rich description from structured data
        bodega = str(info.get("bodega", "") or item.get("bodega", "") or "")
        denominacion = str(info.get("denominacion", "") or item.get("denominacion", "") or "")
        cosecha = str(info.get("cosecha", "") or item.get("cosecha", "") or "")
        pais = str(info.get("pais", "") or "")
        alcohol_val = str(caract.get("alcohol", "") or item.get("alcohol", "") or "")
        volumen_val = str(caract.get("volumen", "") or item.get("volumen", "") or "")
        maridaje = str(item.get("maridaje", "") or "")
        elaboracion = str(item.get("elaboracion", "") or "")
        vinedo = str(item.get("vinedo", "") or "")
        temp_servicio = str(item.get("temperatura_servicio", "") or "")

        # Uvas
        uvas_data = caract.get("uvas", {})
        uvas = []
        if isinstance(uvas_data, dict):
            u = uvas_data.get("uva", [])
            if isinstance(u, list):
                uvas = [str(x) for x in u if x]
            elif u:
                uvas = [str(u)]
        uvas_str = ", ".join(uvas) if uvas else ""

        # Nota de cata
        cata_parts = []
        if nota_cata.get("vista"):
            cata_parts.append(f"Vista: {nota_cata['vista']}")
        if nota_cata.get("aroma"):
            cata_parts.append(f"Aroma: {nota_cata['aroma']}")
        if nota_cata.get("boca"):
            cata_parts.append(f"Boca: {nota_cata['boca']}")
        nota_cata_str = ". ".join(cata_parts)

        # Enrich description
        wine_info = []
        if bodega: wine_info.append(f"Bodega: {bodega}")
        if denominacion: wine_info.append(f"DO: {denominacion}")
        if cosecha: wine_info.append(f"Cosecha: {cosecha}")
        if uvas_str: wine_info.append(f"Uvas: {uvas_str}")
        if alcohol_val: wine_info.append(f"Alcohol: {alcohol_val}%")
        if volumen_val: wine_info.append(f"Volumen: {volumen_val}")
        if pais: wine_info.append(f"Pa\u00eds: {pais}")
        if maridaje: wine_info.append(f"Maridaje: {maridaje}")
        if nota_cata_str: wine_info.append(f"Nota de cata: {nota_cata_str}")
        if elaboracion and elaboracion != description: wine_info.append(f"Elaboraci\u00f3n: {elaboracion}")
        if vinedo and vinedo != description: wine_info.append(f"Vi\u00f1edo: {vinedo}")
        if temp_servicio: wine_info.append(f"Temperatura: {temp_servicio}")

        if wine_info:
            description = description + " | " + " | ".join(wine_info) if description else " | ".join(wine_info)

        # Categor\u00eda
        cats = item.get("categorization", {})
        category = ""
        if isinstance(cats, dict):
            category = str(cats.get("category", "") or cats.get("type", ""))
        if not category:
            category = str(info.get("categoria", "") or info.get("tipo_producto", "") or item.get("category", "") or item.get("type", "") or item.get("@tipo", ""))
        # Enrich category with denomination
        if denominacion and denominacion not in category:
            category = f"{category} > {denominacion}" if category else denominacion

        # Imagen
        image_url = str(media.get("imagen", "") or "")
        if not image_url:
            images = item.get("images", {})
            if isinstance(images, dict):
                img = images.get("image", "")
                if isinstance(img, list):
                    image_url = str(img[0].get("#text", "") if isinstance(img[0], dict) else img[0])
                elif isinstance(img, dict):
                    image_url = str(img.get("#text", "") or img.get("@src", ""))
                else:
                    image_url = str(img)
        if not image_url:
            image_url = str(item.get("image_url", "") or item.get("image", "") or item.get("imagen", ""))
        if not image_url:
            image_url = f"https://placehold.co/400x250/1a1a2e/ffffff?text={name[:20]}"

        # Extra fields (from CSV conversion)
        extra = item.get("extra", {})
        if isinstance(extra, dict) and extra:
            extra_parts = []
            for k, v in extra.items():
                if isinstance(v, str) and v and v.lower() not in ("", "nan", "none", "null"):
                    extra_parts.append(f"{k}: {v}")
                elif isinstance(v, dict) and v.get("#text"):
                    extra_parts.append(f"{k}: {v['#text']}")
            if extra_parts:
                description = description + " | " + " | ".join(extra_parts) if description else " | ".join(extra_parts)

        # Stock
        stock_val = comercial.get("stock", "") or ""
        if not stock_val:
            stock_info = item.get("stock", {})
            if isinstance(stock_info, dict):
                stock_val = str(stock_info.get("status", "in_stock"))
            else:
                stock_val = str(stock_info) if stock_info else "in_stock"
        else:
            stock_val = str(stock_val)
        in_stock = stock_val not in ("0", "out_of_stock", "false", "False", "")

        # Para coches: intentar campos espec\u00edficos
        brand = str(bodega or info.get("bodega", "") or item.get("brand", "") or item.get("marca", "") or item.get("make", "") or category)
        model = str(item.get("model", "") or item.get("modelo", ""))
        year = safe_int(cosecha or item.get("year", 0) or item.get("anyo", 0) or item.get("ano", 0))
        km = safe_int(item.get("km", 0) or item.get("kilometers", 0))
        fuel = str(item.get("fuel", "") or item.get("combustible", ""))
        transmission = str(item.get("transmission", "") or item.get("cambio", ""))

        # URL de detalle
        if url:
            detail_url = url
        else:
            detail_url = detail_pattern.format(
                make=slugify(brand) if brand else slugify(name),
                model=slugify(model) if model else "",
                id=item_id,
                slug=slugify(name),
            )

        return {
            "id": item_id,
            "brand": brand or category,
            "model": model or name,
            "title": name,
            "year": year,
            "km": km,
            "fuel": fuel,
            "transmission": transmission,
            "body_type": category,
            "color": str(item.get("color", "")),
            "price": round(price) if price else 0,
            "price_formatted": f"{price:,.2f} \u20ac".replace(",", ".") if price else "0 \u20ac",
            "image_url": image_url,
            "detail_url": detail_url,
            "description": description[:2000],
            "in_stock": in_stock,
            "country": pais,
            "equipment": {},
        }

    def _parse_rest_vehicle(self, v: dict, detail_pattern: str) -> dict:
        """Convierte un vehículo de la API REST de Worldcars al formato estándar."""
        vehicle_id = str(v.get("id", ""))
        brand = str(v.get("marca", ""))
        model = str(v.get("modelo", ""))
        nombre = str(v.get("nombre", f"{brand} {model}")).strip()

        price = safe_int(v.get("precio_contado", 0))
        financed = safe_int(v.get("precio_financiado", 0))
        cuota = safe_float(v.get("cuota", 0))
        cuota_fmt = v.get("cuota_formatted", "")

        # Combustible: "Diésel", "Gasolina", "Eléctrico", "Híbrido"...
        fuel_raw = str(v.get("combustible", ""))
        fuel = normalize_fuel(fuel_raw)

        # Cambio: 0=Manual, 1=Automático
        cambio = v.get("cambio", 0)
        transmission = "automatico" if cambio == 1 else "manual"

        # Tipo de carrocería desde campo `tipo` (entero)
        tipo_map = {
            1: "sedan", 2: "hatchback", 3: "familiar", 4: "coupe",
            5: "sedan", 6: "suv", 7: "suv", 8: "cabrio", 9: "monovolumen",
            10: "furgoneta", 11: "furgoneta", 12: "furgoneta", 24: "hatchback",
        }
        body_type = tipo_map.get(v.get("tipo", 0), "")
        # Fallback: si el tipo entero no está mapeado, intentar con campo de texto
        if not body_type:
            tipo_texto = (
                v.get("tipo_nombre") or v.get("carroceria") or
                v.get("categoria") or v.get("tipo_carroceria") or ""
            )
            if tipo_texto:
                body_type = normalize_body(str(tipo_texto))
                if not body_type:
                    body_type = str(tipo_texto).lower().strip()
                logger.debug(f"body_type desde texto '{tipo_texto}' → '{body_type}' (tipo={v.get('tipo')})")
            else:
                logger.warning(f"tipo={v.get('tipo')} sin mapeo conocido, id={v.get('id')}")

        image_url = str(v.get("imagen_principal", "") or "").strip()
        if image_url and not image_url.startswith("http"):
            # URL relativa — construir base desde api_url del tenant
            api_url = self.config.get("api_url", "")
            from urllib.parse import urlparse, urljoin
            base = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(api_url))
            image_url = urljoin(base + "/", image_url.lstrip("/"))
        if not image_url:
            image_url = f"https://placehold.co/400x250/e5e7eb/9ca3af?text={brand}+{model}"

        detail_url = detail_pattern.format(
            make=slugify(brand),
            model=slugify(model),
            id=vehicle_id,
        )

        monthly_fee_fmt = f"{cuota_fmt} €/mes" if cuota_fmt and cuota_fmt != "0" else None

        return {
            "id": vehicle_id,
            "brand": brand,
            "model": model,
            "title": nombre,
            "year": safe_int(v.get("anyo")),
            "km": safe_int(v.get("km")),
            "fuel": fuel,
            "transmission": transmission,
            "body_type": body_type,
            "color": str(v.get("color", "")),
            "price": price,
            "price_formatted": format_price(price),
            "financed_price": financed if financed else None,
            "financed_price_formatted": format_price(financed) if financed else None,
            "monthly_fee": round(cuota) if cuota else None,
            "monthly_fee_formatted": monthly_fee_fmt,
            "image_url": image_url,
            "detail_url": detail_url,
            "power": str(v.get("potencia", "")),
            "seats": safe_int(v.get("plazas")),
            "doors": safe_int(v.get("puertas")),
            "city": str(v.get("almacen", "")),
            "plate": str(v.get("matricula", "") or ""),
            "equipment": {},
            "_raw_tipo": v.get("tipo"),
            "_raw_plazas": v.get("plazas"),
        }

    async def _get_rest_vehicles(self) -> list[dict]:
        """Descarga y cachea el inventario desde la API REST."""
        cache_key = f"rest:{self.tenant_id}"

        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(f"REST API desde cache Redis ({cache_key})")
                return json.loads(cached)

        api_url = self.config.get("api_url", "")
        if not api_url:
            logger.error("rest configurado pero sin api_url")
            return []

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(api_url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error(f"Error descargando REST API: {e}")
            return []

        raw_vehicles = data if isinstance(data, list) else data.get("vehicles", data.get("data", []))
        if not isinstance(raw_vehicles, list):
            logger.error(f"Formato inesperado de la REST API: {type(raw_vehicles)}")
            return []

        detail_pattern = self.config.get(
            "detail_url_pattern",
            "/comprar-coches-ocasion/{make}/{model}/{id}"
        )

        vehicles = [self._parse_rest_vehicle(v, detail_pattern) for v in raw_vehicles]
        logger.info(f"REST API: {len(vehicles)} vehículos obtenidos")

        if self.redis and vehicles:
            await self.redis.setex(
                cache_key, FEED_CACHE_TTL,
                json.dumps(vehicles, ensure_ascii=False, default=str),
            )

        return vehicles

    async def _get_all_vehicles(self) -> list[dict]:
        if self.mode == "xml_feed":
            return await self._get_feed_vehicles()
        elif self.mode == "rest":
            return await self._get_rest_vehicles()
        elif self.mode == "mock":
            return MOCK_INVENTORY[:]
        return []

    async def search_vehicles(
        self,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        fuel_type: Optional[str] = None,
        transmission: Optional[str] = None,
        body_type: Optional[str] = None,
        year_min: Optional[int] = None,
        km_max: Optional[int] = None,
        color: Optional[str] = None,
        seats_min: Optional[int] = None,
        country: Optional[str] = None,
    ) -> list[dict] | dict:
        all_vehicles = await self._get_all_vehicles()
        results = all_vehicles[:]

        if brand:
            b = brand.lower()
            # First try title + brand + body_type + country (strong match)
            strong = [v for v in results if b in (v.get("brand","") + " " + v.get("title","") + " " + v.get("body_type","") + " " + (v.get("country","") or "")).lower()]
            if len(strong) >= 3:
                results = strong
            else:
                # Include description matches but only for wine products (not aceite, agua, etc.)
                desc_matches = [v for v in results if b in (v.get("description","")).lower()]
                # Filter: keep only items that are wine (body_type starts with "Vino" or "Pack" or "Bodega" or is empty)
                wine_cats = ("vino", "pack", "bodega", "champagne", "cava", "espumoso", "generoso", "dulce", "rosado")
                desc_matches = [v for v in desc_matches if not v.get("body_type") or any(v.get("body_type","").lower().startswith(wc) for wc in wine_cats)]
                results = strong + [v for v in desc_matches if v not in strong]
        if model:
            m = model.lower()
            results = [v for v in results if m in (v.get("model","") + " " + v.get("title","") + " " + v.get("brand","") + " " + v.get("description","")).lower()]
        if price_min is not None:
            results = [v for v in results if v.get("price", 0) >= price_min]
        if price_max is not None:
            results = [v for v in results if v.get("price", 0) <= price_max]
        if fuel_type:
            norm = normalize_fuel(fuel_type)
            results = [v for v in results if v.get("fuel", "") == norm]
        if transmission:
            norm = normalize_trans(transmission)
            results = [v for v in results if v.get("transmission", "") == norm]
        if body_type:
            bt = body_type.lower()
            norm = normalize_body(body_type)
            # Primero intenta match exacto normalizado
            filtered = [v for v in results if v.get("body_type", "") == norm]
            if not filtered:
                # Fallback: substring match (ej: "tinto" en "Vino Tinto")
                filtered = [v for v in results if bt in v.get("body_type", "").lower()]
            if not filtered:
                # Último recurso: incluir sin body_type
                filtered = [v for v in results if v.get("body_type", "") in (norm, "")]
            if filtered:
                results = filtered
        if year_min is not None:
            results = [v for v in results if v.get("year", 0) >= year_min]
        if km_max is not None:
            results = [v for v in results if v.get("km", 0) <= km_max]
        if color:
            results = [v for v in results if color.lower() in v.get("color", "").lower()]
        if seats_min is not None:
            results = [v for v in results if (v.get("seats") or 0) >= seats_min]
        if country:
            c = country.lower()
            results = [v for v in results if c in (v.get("country", "") or "").lower()]

        logger.info(f"Busqueda ({self.mode}): {len(results)} resultados de {len(all_vehicles)} total")
        if len(results) > 10:
            return {
                "total_encontrados": len(results),
                "mostrando": 5,
                "mensaje": f"Se encontraron {len(results)} productos que coinciden.",
                "productos": results[:5],
            }
        return results[:5]

    async def get_vehicle_details(self, vehicle_id: str) -> Optional[dict]:
        all_vehicles = await self._get_all_vehicles()
        for v in all_vehicles:
            if str(v.get("id", "")) == str(vehicle_id):
                return v
        return None
