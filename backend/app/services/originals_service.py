"""Local full-resolution copies used for approved, per-image downloads."""
import shutil
import tempfile
import threading
import zipfile
from pathlib import Path

from app.core.config import settings
from app.services import drive_service, storage_service, zip_service
from googleapiclient.errors import HttpError

_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


class OriginalsUnavailable(Exception):
    pass


class OriginalsStorageError(Exception):
    pass


def _lock_for_event(event_id: int) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(event_id, threading.Lock())


def ensure_event_originals(event_id: int, filenames: set[str], *,
                           local_zip: Path, drive_file_id: str | None) -> None:
    """Restore originals from Drive once for events uploaded before local copies existed."""
    with _lock_for_event(event_id):
        missing = {}
        for filename in filenames:
            path = storage_service.edited_image_path(event_id, filename)
            if not path.is_file():
                missing[filename] = path
        if not missing:
            return

        temporary_archive: Path | None = None
        try:
            archive_path = local_zip
            if not archive_path.is_file():
                if not drive_file_id:
                    raise OriginalsUnavailable("Full-resolution originals are not available for this event")
                settings.edited_tmp_dir.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(
                    mode="wb", prefix=f"restore_event_{event_id}_", suffix=".zip",
                    dir=settings.edited_tmp_dir, delete=False,
                ) as archive_file:
                    temporary_archive = Path(archive_file.name)
                    for chunk in drive_service.stream_file(drive_file_id, event_id):
                        archive_file.write(chunk)
                archive_path = temporary_archive

            with zipfile.ZipFile(archive_path) as zf:
                members = zip_service.inspect_zip(zf)
                for member in members:
                    destination = missing.get(member.safe_name)
                    if destination is None:
                        continue
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    temporary_image: Path | None = None
                    try:
                        with tempfile.NamedTemporaryFile(
                            mode="wb", prefix="original_", dir=destination.parent, delete=False,
                        ) as image_file:
                            temporary_image = Path(image_file.name)
                            with zf.open(member.info) as source:
                                shutil.copyfileobj(source, image_file, length=1024 * 1024)
                        temporary_image.replace(destination)
                    finally:
                        if temporary_image:
                            temporary_image.unlink(missing_ok=True)
                    missing.pop(member.safe_name, None)
            if missing:
                raise OriginalsUnavailable("Some full-resolution images could not be found in the edited archive")
        except zipfile.BadZipFile as e:
            raise OriginalsUnavailable("The stored edited archive is not a valid ZIP file") from e
        except zip_service.UnsafeZip as e:
            raise OriginalsUnavailable(str(e)) from e
        except (drive_service.DriveError, HttpError, OSError) as e:
            raise OriginalsStorageError("Could not retrieve full-resolution originals from storage") from e
        finally:
            if temporary_archive:
                temporary_archive.unlink(missing_ok=True)
