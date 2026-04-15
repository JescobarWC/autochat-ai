"""Endpoints públicos (sin autenticación) con rate limiting."""

import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from uuid import UUID as PyUUID
from app.models import Lead

# Tenant por defecto para leads de la landing page
LANDING_TENANT_ID = "1ce2d20d-2b38-47e7-b592-867fe8f913a3"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/public", tags=["Public"])

# Rate limit simple en memoria (por IP)
_contact_attempts: dict[str, list[float]] = {}
RATE_LIMIT = 5  # max requests
RATE_WINDOW = 300  # per 5 minutes


def _check_rate_limit(ip: str):
    import time
    now = time.time()
    attempts = _contact_attempts.get(ip, [])
    attempts = [t for t in attempts if now - t < RATE_WINDOW]
    if len(attempts) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Inténtalo más tarde.")
    attempts.append(now)
    _contact_attempts[ip] = attempts


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=20)
    company: str = Field(default="", max_length=200)
    stock_size: str = Field(default="", max_length=20)
    message: str = Field(default="", max_length=1000)
    # Honeypot — si tiene valor, es spam
    website: str = Field(default="")


PHONE_RE = re.compile(r"^[\d\s\+\-\(\)]{6,20}$")


@router.post("/contact", summary="Formulario de contacto público")
async def public_contact(body: ContactRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Rate limit
    client_ip = request.headers.get("x-real-ip", request.client.host if request.client else "unknown")
    _check_rate_limit(client_ip)

    # Honeypot check
    if body.website:
        # Silently accept but don't save (bot trap)
        return {"ok": True}

    # Validate phone format
    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=422, detail="Formato de teléfono no válido")

    # Build notes
    notes_parts = []
    if body.company:
        notes_parts.append(f"Concesionario: {body.company}")
    if body.stock_size:
        notes_parts.append(f"Stock: {body.stock_size}")
    if body.message:
        notes_parts.append(body.message)

    lead = Lead(
        tenant_id=PyUUID(LANDING_TENANT_ID),
        name=body.name,
        email=body.email,
        phone=body.phone,
        interest_type="demo_request",
        status="new",
        notes=" | ".join(notes_parts) if notes_parts else None,
    )
    db.add(lead)
    await db.commit()

    logger.info(f"Lead de contacto recibido: {body.name} ({body.email})")
    return {"ok": True}
