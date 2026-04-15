"""FastAPI app principal — AutoChat AI Backend."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.config import get_settings
from app.database import async_session
from app.dependencies import close_redis
from app.api.chat import router as chat_router
from app.api.admin import router as admin_router
from app.api.knowledge import router as knowledge_router

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


async def run_auto_migrations():
    """Aplica migraciones de columnas nuevas de forma idempotente al arrancar."""
    migrations = [
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS financing_needed BOOLEAN",
        "CREATE EXTENSION IF NOT EXISTS vector",
        """CREATE TABLE IF NOT EXISTS knowledge_documents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            filename VARCHAR(500) NOT NULL,
            original_filename VARCHAR(500) NOT NULL,
            file_size INTEGER DEFAULT 0,
            mime_type VARCHAR(100),
            status VARCHAR(50) DEFAULT 'processing',
            chunk_count INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1536),
            token_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""",
    ]
    try:
        async with async_session() as db:
            for sql in migrations:
                await db.execute(text(sql))
            await db.commit()
        logger.info("Migraciones aplicadas correctamente")
    except Exception as e:
        logger.warning(f"Error en migraciones automáticas: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AutoChat AI Backend arrancando...")
    await run_auto_migrations()
    yield
    logger.info("Cerrando conexiones...")
    await close_redis()


app = FastAPI(
    title="AutoChat AI",
    description="API backend para la plataforma SaaS de chatbots IA para concesionarios",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — dominios extra del .env + validación dinámica por tenant en dependencies.py
origins = [o.strip() for o in settings.cors_extra_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Routers
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(knowledge_router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
