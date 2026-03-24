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

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(feed_url)
                resp.raise_for_status()
                xml_text = resp.text
        except Exception as e:
            logger.error(f"Error descargando feed XML: {e}")
            return []

        try:
            parsed = xmltodict.parse(xml_text)
            ads_root = parsed.get("standard", parsed)
            ads = ads_root.get("ad", [])
            if isinstance(ads, dict):
                ads = [ads]
        except Exception as e:
            logger.error(f"Error parseando feed XML: {e}")
            return []

        detail_pattern = self.config.get(
            "detail_url_pattern",
            "/comprar-coches-ocasion/{make}/{model}/{id}"
        )

        vehicles = [parse_ad(ad, detail_pattern) for ad in ads]
        logger.info(f"Feed XML parseado: {len(vehicles)} vehiculos")

        if self.redis and vehicles:
            await self.redis.setex(
                cache_key, FEED_CACHE_TTL,
                json.dumps(vehicles, ensure_ascii=False, default=str),
            )

        return vehicles

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
    ) -> list[dict]:
        all_vehicles = await self._get_all_vehicles()
        results = all_vehicles[:]

        if brand:
            results = [v for v in results if brand.lower() in v.get("brand", "").lower()]
        if model:
            results = [v for v in results if model.lower() in v.get("model", "").lower()]
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
            norm = normalize_body(body_type)
            filtered_strict = [v for v in results if v.get("body_type", "") == norm]
            if filtered_strict:
                results = filtered_strict
            else:
                # No hay coincidencias exactas — incluir vehículos sin body_type
                # (pueden ser tipos no mapeados aún, ej: industriales)
                results = [v for v in results if v.get("body_type", "") in (norm, "")]
        if year_min is not None:
            results = [v for v in results if v.get("year", 0) >= year_min]
        if km_max is not None:
            results = [v for v in results if v.get("km", 0) <= km_max]
        if color:
            results = [v for v in results if color.lower() in v.get("color", "").lower()]
        if seats_min is not None:
            results = [v for v in results if (v.get("seats") or 0) >= seats_min]

        logger.info(f"Busqueda ({self.mode}): {len(results)} resultados de {len(all_vehicles)} total")
        return results[:5]

    async def get_vehicle_details(self, vehicle_id: str) -> Optional[dict]:
        all_vehicles = await self._get_all_vehicles()
        for v in all_vehicles:
            if str(v.get("id", "")) == str(vehicle_id):
                return v
        return None
