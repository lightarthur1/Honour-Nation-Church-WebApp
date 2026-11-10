"""Edited-ZIP pipeline: previews -> Google Drive -> DB.

Step 1 (previews) and step 2 (Drive) are separate so an Editor can retry just
the Drive sync if it failed, without regenerating previews.
"""
import logging
import zipfile
from pathlib import Path

from app.core.config import settings
from app.db.models import EditedArchive, EditedStatus, PreviewImage
from app.db.session import SessionLocal
from app.services import drive_service, preview_service, storage_service, zip_service

log = logging.getLogger("pipeline")


def edited_tmp_path(event_id: int) -> Path:
    return settings.edited_tmp_dir / f"event_{event_id}.zip"


def run_pipeline(event_id: int) -> None:
    db = SessionLocal()
    try:
        archive = db.query(EditedArchive).filter_by(event_id=event_id).one()
        zip_path = edited_tmp_path(event_id)
        try:
            _make_previews(db, event_id, zip_path, archive)
            _push_to_drive(db, event_id, zip_path, archive)
        except (zip_service.UnsafeZip, zipfile.BadZipFile) as e:
            _fail(db, archive, f"Invalid archive: {e}")
        except drive_service.DriveError as e:
            _fail(db, archive, f"Drive sync failed (previews are live, retry sync): {e}")
        except Exception as e:  # noqa: BLE001 - last-resort so status never sticks on 'processing'
            log.exception("Pipeline crashed for event %s", event_id)
            _fail(db, archive, f"Unexpected error: {e}")
    finally:
        db.close()


def run_drive_sync(event_id: int) -> None:
    """Editor-triggered retry of just the Drive step."""
    db = SessionLocal()
    try:
        archive = db.query(EditedArchive).filter_by(event_id=event_id).one()
        archive.status, archive.error = EditedStatus.processing, ""
        db.commit()
        try:
            _push_to_drive(db, event_id, edited_tmp_path(event_id), archive)
        except drive_service.DriveError as e:
            _fail(db, archive, f"Drive sync failed: {e}")
        except Exception as e:  # noqa: BLE001
            log.exception("Drive sync crashed for event %s", event_id)
            _fail(db, archive, f"Unexpected error: {e}")
    finally:
        db.close()


def _make_previews(db, event_id: int, zip_path: Path, archive: EditedArchive) -> None:
    out_dir = settings.previews_dir / str(event_id)
    originals_dir = settings.edited_images_dir / str(event_id)
    storage_service.remove_tree(out_dir)
    storage_service.remove_tree(originals_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    originals_dir.mkdir(parents=True, exist_ok=True)
    db.query(PreviewImage).filter_by(event_id=event_id).delete()

    count = 0
    with zipfile.ZipFile(zip_path) as zf:
        members = zip_service.inspect_zip(zf)
        for i, m in enumerate(sorted(members, key=lambda x: x.safe_name.lower()), start=1):
            try:
                raw = zf.read(m.info)  # bounded by MAX_UNCOMPRESSED check above
                prev = preview_service.make_preview(raw)
                storage_service.edited_image_path(event_id, m.safe_name).write_bytes(raw)
            except Exception as e:  # noqa: BLE001 - skip corrupt images, keep going
                log.warning("Skipping %s: %s", m.safe_name, e)
                continue
            dest = out_dir / f"{i:05d}.jpg"
            dest.write_bytes(prev.data)
            db.add(PreviewImage(
                event_id=event_id, file_name=m.safe_name,
                relative_path=storage_service.rel(dest),
                width=prev.width, height=prev.height, size_bytes=len(prev.data),
            ))
            count += 1
    if count == 0:
        raise zip_service.UnsafeZip("None of the images could be read")
    archive.image_count = count
    db.commit()


def _push_to_drive(db, event_id: int, zip_path: Path, archive: EditedArchive) -> None:
    if not zip_path.exists():
        raise drive_service.DriveError("Local edited ZIP is gone; upload it again")
    result = drive_service.upload_zip(zip_path, f"event_{event_id}_{archive.original_name}", event_id)
    archive.drive_file_id = result.file_id
    archive.drive_download_url = result.download_url
    archive.status, archive.error = EditedStatus.synced, ""
    db.commit()
    zip_path.unlink(missing_ok=True)  # Drive now holds the master copy


def _fail(db, archive: EditedArchive, message: str) -> None:
    db.rollback()
    archive = db.merge(archive)
    archive.status, archive.error = EditedStatus.failed, message[:1000]
    db.commit()
