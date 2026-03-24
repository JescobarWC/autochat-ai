"""Dependencias de inyección para FastAPI."""

import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models import Tenant, AdminUser
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)
settings = get_settings()

# Pool de Redis global
_redis_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_pool


async def close_redis():
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_tenant(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Valida y devuelve el tenant por su ID (header X-Tenant-ID)."""
    result = await db.execute(select(Tenant).where(Tenant.id == x_tenant_id))
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant desactivado")

    return {
        "id": str(tenant.id),
        "slug": tenant.slug,
        "name": tenant.name,
        "config": tenant.config or {},
        "inventory_api_config": tenant.inventory_api_config or {},
        "allowed_domains": tenant.allowed_domains or [],
        "monthly_message_limit": tenant.monthly_message_limit,
        "messages_used": tenant.messages_used,
    }


async def validate_origin(request: Request, tenant: dict = Depends(get_tenant)):
    """Valida que el Origin del request esté en los dominios permitidos del tenant."""
    origin = request.headers.get("origin", "")
    allowed = tenant.get("allowed_domains", [])

    if not origin or not allowed:
        return tenant

    from urllib.parse import urlparse
    hostname = urlparse(origin).hostname or ""

    if hostname not in allowed:
        logger.warning(f"Origin no permitido: {hostname} (tenant: {tenant['slug']})")
        raise HTTPException(status_code=403, detail="Origen no autorizado")

    return tenant


async def get_chat_service(
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    tenant: dict = Depends(validate_origin),
) -> ChatService:
    return ChatService(db=db, redis=redis, tenant=tenant)


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    """Extrae y valida el token JWT del header Authorization."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado")

    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o desactivado")

    return user
