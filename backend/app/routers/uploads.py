from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, settings
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
    dest = settings.raw_dir / str(event_id) / storage_service.safe_filename(file.filename)
    for old in dest.parent.glob("*") if dest.parent.exists() else []:
        old.unlink(missing_ok=True)
    size = await storage_service.stream_to_disk(file, dest)
    try:
        zip_service.validate_zip_file(dest, include_camera_raw=True)
    except zip_service.UnsafeZip as ex:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(ex))

    if e.raw_archive:
        db.delete(e.raw_archive)
        db.flush()
    db.add(RawArchive(event_id=e.id, original_name=dest.name,
                      stored_path=storage_service.rel(dest), size_bytes=size))
    db.commit()
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
    path = storage_service.abs_path(raw.stored_path)
    if not path.exists():
        raise HTTPException(404, "Raw file missing on server")
    return FileResponse(path, media_type="application/zip", filename=raw.original_name)


@router.delete("/{event_id}/raw", response_model=EventOut)
def delete_raw(event_id: int, db: Session = Depends(get_db),
               _: User = Depends(require_role(Role.admin))):
    """Free server space. Only allowed once the edited ZIP is safely in Drive."""
    e = get_event_or_404(db, event_id)
    if not e.raw_archive or e.raw_archive.status == RawStatus.deleted:
        raise HTTPException(404, "No raw archive to delete")
    if not e.edited_archive or e.edited_archive.status != EditedStatus.synced:
        raise HTTPException(409, "Edited ZIP must be synced to Drive before raw files can be deleted")
    storage_service.abs_path(e.raw_archive.stored_path).unlink(missing_ok=True)
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

    if e.edited_archive:
        db.delete(e.edited_archive)
        db.flush()
    db.add(EditedArchive(event_id=e.id, uploaded_by=user.id, size_bytes=size, image_count=count,
                         original_name=storage_service.safe_filename(file.filename),
                         status=EditedStatus.processing))
    db.commit()
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
    if not pipeline.edited_tmp_path(event_id).exists():
        raise HTTPException(409, "Local copy is gone. Upload the edited ZIP again")
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
