import hashlib
import re
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import BASE_DIR, settings


def safe_filename(name: str) -> str:
    name = Path(name or "upload.zip").name
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .") or "upload.zip"
    return name[:150]


async def stream_to_disk(file: UploadFile, dest: Path) -> int:
    """Write an upload in 1 MB chunks, enforcing the size cap as it streams."""
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    written = 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(dest, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > limit:
                    raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")
                out.write(chunk)
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    return written


def rel(path: Path) -> str:
    return str(Path("storage") / path.relative_to(settings.STORAGE_DIR))


def abs_path(relative: str) -> Path:
    path = Path(relative)
    if path.parts[:1] == ("storage",):
        return settings.STORAGE_DIR.parent / path
    return BASE_DIR / path


def edited_image_path(event_id: int, filename: str) -> Path:
    digest = hashlib.sha256(filename.casefold().encode("utf-8")).hexdigest()
    return settings.edited_images_dir / str(event_id) / f"{digest}{Path(filename).suffix.lower()}"


def remove_tree(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)
