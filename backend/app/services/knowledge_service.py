"""Servicio de base de conocimiento — extracción, chunking, embeddings y búsqueda."""

import io
import logging
import uuid
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import KnowledgeDocument, KnowledgeChunk

logger = logging.getLogger(__name__)
settings = get_settings()

EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_MAX_CHARS = 2000  # ~500 tokens
CHUNK_OVERLAP_CHARS = 200  # ~50 tokens


# ═══════════════════════════════════════
# TEXT EXTRACTION
# ═══════════════════════════════════════

def extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Extrae texto plano de PDF, DOCX o TXT."""
    if mime_type == "application/pdf" or mime_type == "application/x-pdf":
        return _extract_pdf(file_bytes)
    elif mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return _extract_docx(file_bytes)
    elif mime_type and mime_type.startswith("text/"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Tipo de archivo no soportado: {mime_type}")


def _extract_pdf(file_bytes: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    result = "\n\n".join(pages)
    if len(result.strip()) < 50:
        raise ValueError("El PDF no contiene texto extraíble (puede ser escaneado/imagen)")
    return result


def _extract_docx(file_bytes: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    result = "\n\n".join(paragraphs)
    if len(result.strip()) < 50:
        raise ValueError("El documento DOCX no contiene texto suficiente")
    return result


# ═══════════════════════════════════════
# CHUNKING
# ═══════════════════════════════════════

def chunk_text(text: str) -> list[str]:
    """Divide texto en chunks de ~500 tokens con overlap."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > CHUNK_MAX_CHARS:
            if current:
                chunks.append(current.strip())
                # Overlap: keep tail of previous chunk
                current = current[-CHUNK_OVERLAP_CHARS:] + "\n\n" + para if len(current) > CHUNK_OVERLAP_CHARS else para
            else:
                # Single paragraph larger than max — split by sentences
                for sentence_chunk in _split_long_text(para):
                    chunks.append(sentence_chunk)
                current = ""
        else:
            current = current + "\n\n" + para if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks


def _split_long_text(text: str) -> list[str]:
    """Split long text into sentence-based chunks."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""
    for s in sentences:
        if len(current) + len(s) + 1 > CHUNK_MAX_CHARS:
            if current:
                chunks.append(current.strip())
            current = s
        else:
            current = current + " " + s if current else s
    if current.strip():
        chunks.append(current.strip())
    return chunks


# ═══════════════════════════════════════
# EMBEDDINGS
# ═══════════════════════════════════════

async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Genera embeddings con OpenAI text-embedding-3-small."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    all_embeddings = []

    # Batch in groups of 100
    for i in range(0, len(texts), 100):
        batch = texts[i:i + 100]
        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
        )
        for item in response.data:
            all_embeddings.append(item.embedding)

    return all_embeddings


# ═══════════════════════════════════════
# DOCUMENT PROCESSING (Background Task)
# ═══════════════════════════════════════

async def process_document(db_factory, document_id: str, file_bytes: bytes, mime_type: str):
    """Procesa un documento: extract → chunk → embed → store. Corre como background task."""
    async with db_factory() as db:
        try:
            # Get document
            result = await db.execute(
                select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                logger.error(f"Documento {document_id} no encontrado")
                return

            # Extract text
            logger.info(f"Extrayendo texto de {doc.original_filename}...")
            text = extract_text(file_bytes, mime_type)

            # Chunk
            logger.info(f"Dividiendo en chunks...")
            chunks = chunk_text(text)
            if not chunks:
                raise ValueError("No se generaron chunks del texto extraído")

            logger.info(f"Generados {len(chunks)} chunks, generando embeddings...")

            # Generate embeddings
            embeddings = await generate_embeddings(chunks)

            # Delete any existing chunks for this document (in case of reprocessing)
            await db.execute(
                delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
            )

            # Store chunks
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                db.add(KnowledgeChunk(
                    document_id=doc.id,
                    tenant_id=doc.tenant_id,
                    chunk_index=i,
                    content=chunk,
                    embedding=embedding,
                    token_count=len(chunk) // 4,
                ))

            # Update document status
            doc.status = "ready"
            doc.chunk_count = len(chunks)
            doc.error_message = None

            await db.commit()
            logger.info(f"Documento {doc.original_filename} procesado: {len(chunks)} chunks")

        except Exception as e:
            logger.error(f"Error procesando documento {document_id}: {e}")
            try:
                result = await db.execute(
                    select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
                )
                doc = result.scalar_one_or_none()
                if doc:
                    doc.status = "error"
                    doc.error_message = str(e)[:500]
                    await db.commit()
            except Exception:
                pass


# ═══════════════════════════════════════
# SEMANTIC SEARCH
# ═══════════════════════════════════════

async def search_knowledge(
    db: AsyncSession,
    tenant_id: str,
    query: str,
    top_k: int = 5,
    min_similarity: float = 0.3,
) -> list[dict]:
    """Busca chunks relevantes por similitud coseno."""
    # Check if tenant has any documents
    result = await db.execute(
        select(KnowledgeChunk.id).where(KnowledgeChunk.tenant_id == tenant_id).limit(1)
    )
    if not result.scalar_one_or_none():
        return []

    # Embed query
    embeddings = await generate_embeddings([query])
    query_embedding = embeddings[0]

    # Cosine similarity search using pgvector SQLAlchemy operators
    distance = KnowledgeChunk.embedding.cosine_distance(query_embedding)
    stmt = (
        select(KnowledgeChunk.content, distance.label("distance"))
        .where(KnowledgeChunk.tenant_id == tenant_id)
        .order_by(distance)
        .limit(top_k)
    )
    result = await db.execute(stmt)

    chunks = []
    for content, distance_val in result.all():
        similarity = 1 - float(distance_val)
        if similarity >= min_similarity:
            chunks.append({"content": content, "similarity": similarity})

    return chunks
