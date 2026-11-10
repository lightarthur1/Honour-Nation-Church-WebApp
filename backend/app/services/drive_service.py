"""Google Drive storage for the final edited ZIPs.

DRIVE_AUTH=oauth            upload as the church's Google account (free Gmail works).
                            Files go in a folder this app creates in that account.
DRIVE_AUTH=service_account  upload into a Shared Drive folder (needs Google Workspace).
DRIVE_ENABLED=false         local stand-in in storage/drive_mock for development.

Files stay private in Drive; approved users download through the backend.
"""
import logging
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from app.core.config import BASE_DIR, settings
from app.services import storage_service

log = logging.getLogger("drive")
PROGRESS: dict[int, int] = {}  # event_id -> % of the Drive upload (in memory)
MOCK_DIR = settings.STORAGE_DIR / "drive_mock"
OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
SA_SCOPES = ["https://www.googleapis.com/auth/drive"]


@dataclass
class DriveResult:
    file_id: str
    download_url: str  # private Drive link, for staff reference


class DriveError(Exception):
    pass


def _path(p: str) -> Path:
    path = Path(p)
    return path if path.is_absolute() else BASE_DIR / path


def _client():
    from googleapiclient.discovery import build

    if settings.DRIVE_AUTH == "service_account":
        from google.oauth2 import service_account
        f = _path(settings.GOOGLE_SERVICE_ACCOUNT_FILE)
        if not f.exists():
            raise DriveError(f"Service account file not found: {f}")
        creds = service_account.Credentials.from_service_account_file(str(f), scopes=SA_SCOPES)
    else:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        f = _path(settings.GOOGLE_OAUTH_TOKEN_FILE)
        if not f.exists():
            raise DriveError("Drive is not authorised yet. Run: python scripts/get_drive_token.py")
        creds = Credentials.from_authorized_user_file(str(f), OAUTH_SCOPES)
        if not creds.valid:
            try:
                creds.refresh(Request())
                f.write_text(creds.to_json())
            except Exception as e:  # noqa: BLE001
                raise DriveError(f"Drive authorisation expired or was revoked. Re-run get_drive_token.py ({e})") from e
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _parent_folder(svc) -> str:
    if settings.DRIVE_AUTH == "service_account":
        if not settings.GOOGLE_DRIVE_FOLDER_ID:
            raise DriveError("GOOGLE_DRIVE_FOLDER_ID is not set")
        return settings.GOOGLE_DRIVE_FOLDER_ID
    name = settings.GOOGLE_DRIVE_FOLDER_NAME.replace("'", "\\'")
    q = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    found = svc.files().list(q=q, fields="files(id)", pageSize=1).execute().get("files", [])
    if found:
        return found[0]["id"]
    made = svc.files().create(body={"name": settings.GOOGLE_DRIVE_FOLDER_NAME,
                                    "mimeType": "application/vnd.google-apps.folder"}, fields="id").execute()
    return made["id"]


def check_connection() -> dict[str, bool | str | None]:
    result: dict[str, bool | str | None] = {
        "enabled": settings.DRIVE_ENABLED,
        "configured": False,
        "folder_name": None,
        "error": None,
    }
    if not settings.DRIVE_ENABLED:
        return result

    from google.auth.exceptions import GoogleAuthError
    from googleapiclient.errors import HttpError

    try:
        svc = _client()
        folder_id = _parent_folder(svc)
        if settings.DRIVE_AUTH == "service_account":
            folder = svc.files().get(
                fileId=folder_id, fields="name,mimeType", supportsAllDrives=True,
            ).execute()
            if folder.get("mimeType") != "application/vnd.google-apps.folder":
                raise DriveError("GOOGLE_DRIVE_FOLDER_ID is not a Drive folder")
            result["folder_name"] = folder.get("name")
        else:
            result["folder_name"] = settings.GOOGLE_DRIVE_FOLDER_NAME
        result["configured"] = True
    except (DriveError, GoogleAuthError, HttpError, OSError, ValueError) as e:
        log.warning("Google Drive connection check failed: %s", e)
        result["error"] = str(e)
    return result


def upload_zip(local_path: Path, drive_name: str, event_id: int) -> DriveResult:
    if not settings.DRIVE_ENABLED:
        if settings.MEDIA_STORAGE_BACKEND == "r2":
            storage_service.store_file(local_path, f"drive_mock/event_{event_id}.zip")
        else:
            MOCK_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(local_path, MOCK_DIR / f"event_{event_id}.zip")
        return DriveResult(f"mock-event-{event_id}", f"mock://event_{event_id}")

    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    try:
        svc = _client()
        media = MediaFileUpload(str(local_path), mimetype="application/zip",
                                resumable=True, chunksize=8 * 1024 * 1024)  # streamed in 8 MB chunks
        req = svc.files().create(
            body={"name": drive_name, "parents": [_parent_folder(svc)]},
            media_body=media, fields="id", supportsAllDrives=True)
        response = None
        last = -1
        PROGRESS[event_id] = 0
        log.warning("Drive upload started for event %s (%.0f MB)", event_id, local_path.stat().st_size / 1e6)
        while response is None:
            status, response = req.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                PROGRESS[event_id] = pct
                if pct // 5 != last // 5:
                    log.warning("Drive upload event %s: %d%%", event_id, pct)
                last = pct
        file_id = response["id"]
        log.warning("Drive upload finished for event %s", event_id)
    except HttpError as e:
        raise DriveError(f"Google Drive rejected the upload: {e.reason or e}") from e
    except OSError as e:
        raise DriveError(f"Network error talking to Google Drive: {e}") from e
    finally:
        PROGRESS.pop(event_id, None)
    return DriveResult(file_id, f"https://drive.google.com/file/d/{file_id}/view")


def stream_file(file_id: str, event_id: int) -> Iterator[bytes]:
    """Yield the stored ZIP in chunks so large files never sit fully in memory."""
    if not settings.DRIVE_ENABLED:
        if settings.MEDIA_STORAGE_BACKEND == "r2":
            yield from storage_service.iter_file(f"drive_mock/event_{event_id}.zip")
            return
        with open(MOCK_DIR / f"event_{event_id}.zip", "rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk
        return

    import io
    from googleapiclient.http import MediaIoBaseDownload

    svc = _client()
    buf = io.BytesIO()
    dl = MediaIoBaseDownload(buf, svc.files().get_media(fileId=file_id, supportsAllDrives=True),
                             chunksize=4 * 1024 * 1024)
    done = False
    while not done:
        _, done = dl.next_chunk()
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
