"""Endpoints de base de conocimiento — upload, listado y eliminación de documentos."""

import asyncio
import logging
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_admin
from app.database import async_session
from app.models import AdminUser, KnowledgeDocument, KnowledgeChunk
from app.services.knowledge_service import process_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/admin", tags=["Knowledge"])

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/x-pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "text/markdown": ".md",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/tenants/{tenant_id}/knowledge/upload", summary="Subir documento a la base de conocimiento")
async def upload_document(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES and not content_type.startswith("text/"):
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no soportado: {content_type}. Usa PDF, DOCX o TXT.")

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 10 MB")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Generate unique filename
    ext = ALLOWED_TYPES.get(content_type, ".txt")
    filename = f"{uuid.uuid4().hex}{ext}"

    # Save to disk
    upload_dir = f"/app/uploads/{tenant_id}"
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)

    # Create document record
    doc = KnowledgeDocument(
        tenant_id=tenant_id,
        filename=filename,
        original_filename=file.filename or "documento",
        file_size=len(file_bytes),
        mime_type=content_type,
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    doc_id = str(doc.id)

    # Process in background
    background_tasks.add_task(process_document, async_session, doc_id, file_bytes, content_type)

    logger.info(f"Documento subido: {file.filename} ({len(file_bytes)} bytes) → procesando...")

    return {
        "id": doc_id,
        "filename": file.filename,
        "status": "processing",
        "file_size": len(file_bytes),
    }


@router.get("/tenants/{tenant_id}/knowledge", summary="Listar documentos de la base de conocimiento")
async def list_documents(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.tenant_id == tenant_id)
        .order_by(KnowledgeDocument.created_at.desc())
    )
    docs = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "original_filename": d.original_filename,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "error_message": d.error_message,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.delete("/tenants/{tenant_id}/knowledge/{doc_id}", summary="Eliminar documento")
async def delete_document(
    tenant_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == doc_id,
            KnowledgeDocument.tenant_id == tenant_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Delete file from disk
    filepath = f"/app/uploads/{tenant_id}/{doc.filename}"
    if os.path.exists(filepath):
        os.remove(filepath)

    # Delete from DB (chunks cascade)
    await db.delete(doc)
    await db.commit()

    logger.info(f"Documento eliminado: {doc.original_filename}")
    return {"status": "deleted"}
