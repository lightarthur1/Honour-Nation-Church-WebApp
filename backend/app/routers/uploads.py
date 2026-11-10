from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import uuid4

from app.core.config import settings
from app.core.deps import get_db, get_user_via_query_token, require_role
from app.db.models import (EditedArchive, EditedStatus, RawArchive, RawStatus, Role, User)
from app.routers.events import get_event_or_404
from app.schemas.api import DownloadLinkOut, EventOut
from app.services import drive_service, storage_service, zip_service
from app.services.events_view import can_manage_media, event_out
from app.tasks import pipeline

router = APIRouter(prefix="/api/events", tags=["media"])


def _require_zip_name(file: UploadFile) -> None:
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(400, "Please upload a .zip file")


# ---------- RAW (Admin uploads, Admin + assigned Editor download) ----------

@router.post("/{event_id}/raw", response_model=EventOut, status_code=201)
async def upload_raw(event_id: int, file: UploadFile, db: Session = Depends(get_db),
                     _: User = Depends(require_role(Role.admin))):
    e = get_event_or_404(db, event_id)
    _require_zip_name(file)
    dest = settings.raw_dir / str(event_id) / f"{uuid4().hex}-{storage_service.safe_filename(file.filename)}"
    size = await storage_service.stream_to_disk(file, dest)
    try:
        zip_service.validate_zip_file(dest, include_camera_raw=True)
    except zip_service.UnsafeZip as ex:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(ex))

    previous_path = e.raw_archive.stored_path if e.raw_archive else None
    try:
        storage_service.store_file(dest, dest, remove_source=True)
        if e.raw_archive:
            db.delete(e.raw_archive)
            db.flush()
        db.add(RawArchive(event_id=e.id, original_name=storage_service.safe_filename(file.filename),
                          stored_path=storage_service.rel(dest), size_bytes=size))
        db.commit()
    except storage_service.StorageError as ex:
        db.rollback()
        dest.unlink(missing_ok=True)
        raise HTTPException(502, "Could not save raw archive to media storage") from ex
    except Exception:
        db.rollback()
        storage_service.delete(dest)
        dest.unlink(missing_ok=True)
        raise
    if previous_path:
        storage_service.delete(previous_path)
    db.refresh(e)
    return event_out(db, e)


@router.get("/{event_id}/raw/file")
def download_raw(event_id: int, db: Session = Depends(get_db),
                 user: User = Depends(get_user_via_query_token)):
    e = get_event_or_404(db, event_id)
    if not can_manage_media(user, e):
        raise HTTPException(403, "Not allowed")
    raw = e.raw_archive
    if not raw or raw.status != RawStatus.available:
        raise HTTPException(404, "Raw archive is not available")
    try:
        return storage_service.response_for_file(
            raw.stored_path, "application/zip", filename=raw.original_name,
        )
    except FileNotFoundError as ex:
        raise HTTPException(404, "Raw file is missing from media storage") from ex
    except storage_service.StorageError as ex:
        raise HTTPException(502, "Could not retrieve raw archive from media storage") from ex


@router.delete("/{event_id}/raw", response_model=EventOut)
def delete_raw(event_id: int, db: Session = Depends(get_db),
               _: User = Depends(require_role(Role.admin))):
    """Free server space. Only allowed once the edited ZIP is safely in Drive."""
    e = get_event_or_404(db, event_id)
    if not e.raw_archive or e.raw_archive.status == RawStatus.deleted:
        raise HTTPException(404, "No raw archive to delete")
    if not e.edited_archive or e.edited_archive.status != EditedStatus.synced:
        raise HTTPException(409, "Edited ZIP must be synced to Drive before raw files can be deleted")
    try:
        storage_service.delete(e.raw_archive.stored_path)
    except storage_service.StorageError as ex:
        raise HTTPException(502, "Could not delete raw archive from media storage") from ex
    e.raw_archive.status = RawStatus.deleted
    db.commit()
    return event_out(db, e)


# ---------- EDITED (assigned Editor / Admin) ----------

@router.post("/{event_id}/edited", response_model=EventOut, status_code=202)
async def upload_edited(event_id: int, file: UploadFile, background: BackgroundTasks,
                        db: Session = Depends(get_db),
                        user: User = Depends(require_role(Role.admin, Role.editor))):
    e = get_event_or_404(db, event_id)
    if not can_manage_media(user, e):
        raise HTTPException(403, "You are not assigned to this event")
    _require_zip_name(file)
    if e.edited_archive and e.edited_archive.status == EditedStatus.processing:
        raise HTTPException(409, "An upload is already being processed for this event")

    dest = pipeline.edited_tmp_path(event_id)
    size = await storage_service.stream_to_disk(file, dest)
    try:
        count = zip_service.validate_zip_file(dest)
    except zip_service.UnsafeZip as ex:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(ex))

    archive_path = settings.edited_tmp_dir / str(event_id) / f"{uuid4().hex}.zip"
    archive_key = storage_service.rel(archive_path)
    try:
        storage_service.store_file(dest, archive_path)
    except storage_service.StorageError as ex:
        dest.unlink(missing_ok=True)
        raise HTTPException(502, "Could not save edited archive to media storage") from ex

    if e.edited_archive:
        db.delete(e.edited_archive)
        db.flush()
    db.add(EditedArchive(event_id=e.id, uploaded_by=user.id, size_bytes=size, image_count=count,
                         original_name=storage_service.safe_filename(file.filename),
                         status=EditedStatus.processing, storage_key=archive_key))
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage_service.delete(archive_key)
        dest.unlink(missing_ok=True)
        raise
    db.refresh(e)
    background.add_task(pipeline.run_pipeline, event_id)
    return event_out(db, e)


@router.post("/{event_id}/edited/sync", response_model=EventOut, status_code=202)
def resync_drive(event_id: int, background: BackgroundTasks, db: Session = Depends(get_db),
                 user: User = Depends(require_role(Role.admin, Role.editor))):
    e = get_event_or_404(db, event_id)
    if not can_manage_media(user, e):
        raise HTTPException(403, "You are not assigned to this event")
    a = e.edited_archive
    if not a:
        raise HTTPException(404, "No edited archive uploaded yet")
    if a.status == EditedStatus.processing:
        raise HTTPException(409, "Already processing")
    if a.status == EditedStatus.synced:
        raise HTTPException(409, "Already synced to Drive")
    archive_key = a.storage_key or storage_service.edited_archive_path(event_id)
    if not storage_service.exists(archive_key):
        raise HTTPException(409, "Stored edited ZIP is gone. Upload it again")
    a.status = EditedStatus.processing
    db.commit()
    background.add_task(pipeline.run_drive_sync, event_id)
    return event_out(db, e)


@router.get("/{event_id}/edited/link", response_model=DownloadLinkOut)
def edited_link(event_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_user_via_query_token)):
    e = get_event_or_404(db, event_id)
    a = e.edited_archive
    if not a or a.status != EditedStatus.synced or not a.drive_file_id:
        raise HTTPException(404, "High-res download is not available yet")
    if not can_manage_media(user, e):
        raise HTTPException(403, "Full edited ZIP downloads are for staff only")
    return DownloadLinkOut(url=f"/api/events/{event_id}/edited/file")


@router.get("/{event_id}/edited/file")
def edited_file(event_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_user_via_query_token)):
    """Streams the edited ZIP from Drive to approved users. Drive files stay private."""
    e = get_event_or_404(db, event_id)
    a = e.edited_archive
    if not a or a.status != EditedStatus.synced or not a.drive_file_id:
        raise HTTPException(404, "Not available")
    if not can_manage_media(user, e):
        raise HTTPException(403, "Full edited ZIP downloads are for staff only")
    return StreamingResponse(
        drive_service.stream_file(a.drive_file_id, event_id), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{a.original_name}"',
                 "Content-Length": str(a.size_bytes)})
