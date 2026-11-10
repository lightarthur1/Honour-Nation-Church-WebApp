import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, require_role
from app.db.models import ChurchDocument, DocumentCategory, DocumentStatus, Role, User
from app.schemas.api import DocumentOut, DocumentUpdateIn
from app.services.storage_service import safe_filename

router = APIRouter(prefix="/api/documents", tags=["documents"])
log = logging.getLogger("documents")
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
PDF_HEADER_WINDOW = 1024


def _ordered_documents(db: Session):
    return db.query(ChurchDocument).order_by(
        ChurchDocument.created_at.desc(),
        ChurchDocument.id.desc(),
    )


def _document_or_404(db: Session, document_id: int) -> ChurchDocument:
    document = db.get(ChurchDocument, document_id)
    if not document:
        raise HTTPException(404, "Document not found")
    return document


def _validated_text(title: str, description: str) -> tuple[str, str]:
    title = title.strip()
    description = description.strip()
    if len(title) < 2:
        raise HTTPException(422, "Document title must contain at least two non-space characters")
    return title, description


async def _store_pdf(file: UploadFile) -> tuple[str, str, int]:
    original_filename = safe_filename(file.filename or "document.pdf")
    if Path(original_filename).suffix.lower() != ".pdf":
        raise HTTPException(415, "Only PDF documents are supported")

    storage_filename = f"document-{uuid4().hex}.pdf"
    temporary_path = settings.documents_dir / f"{storage_filename}.upload"
    final_path = settings.documents_dir / storage_filename
    size_bytes = 0
    header = bytearray()

    try:
        with temporary_path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > MAX_DOCUMENT_BYTES:
                    raise HTTPException(413, "Document must be 20 MB or smaller")
                if len(header) < PDF_HEADER_WINDOW:
                    header.extend(chunk[:PDF_HEADER_WINDOW - len(header)])
                output.write(chunk)

        if b"%PDF-" not in header:
            raise HTTPException(400, "The uploaded file is not a valid PDF")
        os.replace(temporary_path, final_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    return original_filename, storage_filename, size_bytes


def _document_file(document: ChurchDocument) -> Path:
    path = settings.documents_dir / document.storage_filename
    if not path.is_file():
        log.error("Stored document file is missing for document %s", document.id)
        raise HTTPException(404, "Document file is unavailable")
    return path


@router.get("", response_model=list[DocumentOut])
def public_documents(db: Session = Depends(get_db)):
    return _ordered_documents(db).filter_by(status=DocumentStatus.published).all()


@router.get("/admin", response_model=list[DocumentOut])
def admin_documents(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return _ordered_documents(db).all()


@router.post("", response_model=DocumentOut, status_code=201)
async def create_document(
    title: str = Form(..., min_length=2, max_length=200),
    description: str = Form(default="", max_length=2000),
    category: DocumentCategory = Form(default=DocumentCategory.other),
    status: DocumentStatus = Form(default=DocumentStatus.draft),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    title, description = _validated_text(title, description)
    original_filename, storage_filename, size_bytes = await _store_pdf(file)
    document = ChurchDocument(
        title=title,
        description=description,
        category=category,
        status=status,
        original_filename=original_filename,
        storage_filename=storage_filename,
        size_bytes=size_bytes,
        created_by=admin.id,
    )
    try:
        db.add(document)
        db.commit()
        db.refresh(document)
    except SQLAlchemyError:
        db.rollback()
        (settings.documents_dir / storage_filename).unlink(missing_ok=True)
        log.exception("Could not save uploaded document metadata")
        raise
    return document


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    body: DocumentUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    document = _document_or_404(db, document_id)
    title, description = _validated_text(body.title, body.description)
    document.title = title
    document.description = description
    document.category = body.category
    document.status = body.status
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return document


@router.post("/{document_id}/file", response_model=DocumentOut)
async def replace_document_file(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    document = _document_or_404(db, document_id)
    original_filename, storage_filename, size_bytes = await _store_pdf(file)
    previous_filename = document.storage_filename
    document.original_filename = original_filename
    document.storage_filename = storage_filename
    document.size_bytes = size_bytes
    document.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(document)
    except SQLAlchemyError:
        db.rollback()
        (settings.documents_dir / storage_filename).unlink(missing_ok=True)
        log.exception("Could not replace document file")
        raise
    try:
        (settings.documents_dir / previous_filename).unlink(missing_ok=True)
    except OSError:
        log.exception("Could not remove replaced document file %s", previous_filename)
    return document


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)):
    document = _document_or_404(db, document_id)
    if document.status != DocumentStatus.published:
        raise HTTPException(404, "Document not found")
    return FileResponse(
        _document_file(document),
        media_type="application/pdf",
        filename=document.original_filename,
        content_disposition_type="attachment",
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    document = _document_or_404(db, document_id)
    stored_path = settings.documents_dir / document.storage_filename
    db.delete(document)
    db.commit()
    try:
        stored_path.unlink(missing_ok=True)
    except OSError as exc:
        log.exception("Document record %s was deleted but its file could not be removed", document_id)
        raise HTTPException(500, "Document was removed, but its stored file could not be cleaned up") from exc
    return Response(status_code=204)
