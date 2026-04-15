"""Configuración centralizada del backend AutoChat AI."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"

    # JWT
    jwt_secret: str = "cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120

    # Base de datos
    database_url: str = "postgresql+asyncpg://autochat:autochat_dev@localhost:5432/autochat"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Servidor
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False

    # CORS
    cors_extra_origins: str = "http://localhost:8080,http://localhost:3000"

    # Email / SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "notificaciones@eaistudio.es"
    smtp_from_name: str = "AutoChat AI"

    # Chat
    max_tool_iterations: int = 5
    chat_session_ttl: int = 1800  # 30 minutos en segundos

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
