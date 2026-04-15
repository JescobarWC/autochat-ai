"""Endpoints de chat — SSE streaming + inicialización de sesión."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.dependencies import get_chat_service
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/chat", tags=["Chat"])


class PageContext(BaseModel):
    page_type: str = "other"
    page_url: str = ""
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_id: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., max_length=2000)
    page_context: Optional[PageContext] = None


class InitRequest(BaseModel):
    session_id: Optional[str] = None
    page_context: Optional[PageContext] = None


@router.post("", summary="Enviar mensaje al chatbot (SSE streaming)")
async def chat(
    body: ChatRequest,
    service: ChatService = Depends(get_chat_service),
):
    """Endpoint principal de chat. Devuelve respuesta en SSE streaming con
    text_delta, tool_status, vehicle_cards, lead_captured y done."""
    page_ctx = body.page_context.model_dump() if body.page_context else {}

    async def event_generator():
        async for event in service.chat_stream(body.session_id, body.message, page_ctx):
            yield event

    return EventSourceResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/init", summary="Inicializar sesión de chat")
async def init_session(
    body: InitRequest,
    service: ChatService = Depends(get_chat_service),
):
    """Devuelve config del widget, historial de mensajes y session_id."""
    page_ctx = body.page_context.model_dump() if body.page_context else {}
    return await service.init_session(body.session_id, page_ctx)
