"""Safe ZIP inspection. We never extract to disk by archive path, so zip-slip
is structurally impossible; members are read as streams and renamed by us."""
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.config import settings

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}
RAW_IMAGE_EXTS = {".cr2"}
MAX_RATIO = 200  # per-member compression ratio above this looks like a bomb


class UnsafeZip(Exception):
    pass


@dataclass
class ImageMember:
    info: zipfile.ZipInfo
    safe_name: str


def _is_junk(name: str) -> bool:
    p = PurePosixPath(name.replace("\\", "/"))
    return (
        name.endswith("/")
        or "__MACOSX" in p.parts
        or p.name.startswith(".")
        or p.name.lower() == "thumbs.db"
    )


def inspect_zip(zf: zipfile.ZipFile, *, include_camera_raw: bool = False) -> list[ImageMember]:
    infos = zf.infolist()
    if len(infos) > settings.MAX_FILES_PER_ZIP:
        raise UnsafeZip(f"Archive has more than {settings.MAX_FILES_PER_ZIP} entries")

    total = sum(i.file_size for i in infos)
    if total > settings.MAX_UNCOMPRESSED_MB * 1024 * 1024:
        raise UnsafeZip("Archive is too large when uncompressed")

    members: list[ImageMember] = []
    seen: set[str] = set()
    image_exts = IMAGE_EXTS | RAW_IMAGE_EXTS if include_camera_raw else IMAGE_EXTS
    for info in infos:
        if _is_junk(info.filename):
            continue
        if info.flag_bits & 0x1:
            raise UnsafeZip("Encrypted ZIPs are not supported")
        if info.compress_size and info.file_size / max(info.compress_size, 1) > MAX_RATIO and info.file_size > 10 * 1024 * 1024:
            raise UnsafeZip(f"Suspicious compression ratio on {info.filename}")
        name = PurePosixPath(info.filename.replace("\\", "/")).name
        if PurePosixPath(name).suffix.lower() not in image_exts:
            continue
        base, n = name, 1
        while name.lower() in seen:  # same filename in different subfolders
            stem = PurePosixPath(base).stem
            name = f"{stem}_{n}{PurePosixPath(base).suffix}"
            n += 1
        seen.add(name.lower())
        members.append(ImageMember(info, name))

    if not members:
        raise UnsafeZip("No images found in the archive")
    return members


def validate_zip_file(path, *, include_camera_raw: bool = False) -> int:
    """Quick structural check used right after upload. Returns image count."""
    try:
        with zipfile.ZipFile(path) as zf:
            return len(inspect_zip(zf, include_camera_raw=include_camera_raw))
    except zipfile.BadZipFile as e:
        raise UnsafeZip("File is not a valid ZIP archive") from e
