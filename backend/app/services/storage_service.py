import hashlib
import logging
import re
import shutil
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Iterator
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.core.config import settings

log = logging.getLogger("storage")
CHUNK_SIZE = 1024 * 1024


class StorageError(Exception):
    pass


class InvalidStorageKey(StorageError):
    pass


def safe_filename(name: str) -> str:
    name = Path(name or "upload.zip").name
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .") or "upload.zip"
    return name[:150]


def _key(target: Path | str) -> str:
    if isinstance(target, str):
        normalized = target.replace("\\", "/").lstrip("/")
        if normalized.startswith("storage/"):
            normalized = normalized[len("storage/"):]
        parts = PurePosixPath(normalized).parts
        if not parts or any(part in {"", ".", ".."} for part in parts):
            raise InvalidStorageKey("Invalid object storage key")
        return "/".join(parts)

    path = target.resolve()
    try:
        key = path.relative_to(settings.STORAGE_DIR.resolve()).as_posix()
        if key == ".":
            raise StorageError("Object storage key cannot be empty")
        return key
    except ValueError as exc:
        raise StorageError(f"File is outside the configured storage directory: {target}") from exc


def _local_path(target: Path | str) -> Path:
    if isinstance(target, Path) and target.is_absolute():
        path = target.resolve()
    else:
        normalized = str(target).replace("\\", "/")
        if normalized.startswith("storage/"):
            normalized = normalized[len("storage/"):]
        path = (settings.STORAGE_DIR / Path(normalized)).resolve()
    root = settings.STORAGE_DIR.resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise InvalidStorageKey("File path is outside the configured storage directory") from exc
    return path


@lru_cache(maxsize=1)
def _client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


async def stream_to_disk(file, dest: Path) -> int:
    """Write an upload in bounded chunks, enforcing its size limit as it streams."""
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    written = 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(dest, "wb") as out:
            while chunk := await file.read(CHUNK_SIZE):
                written += len(chunk)
                if written > limit:
                    raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")
                out.write(chunk)
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    return written


def rel(path: Path) -> str:
    return str(Path("storage") / path.resolve().relative_to(settings.STORAGE_DIR.resolve()))


def abs_path(relative: str) -> Path:
    return _local_path(relative)


def edited_image_path(event_id: int, filename: str) -> Path:
    digest = hashlib.sha256(filename.casefold().encode("utf-8")).hexdigest()
    return settings.edited_images_dir / str(event_id) / f"{digest}{Path(filename).suffix.lower()}"


def edited_archive_path(event_id: int) -> Path:
    return settings.edited_tmp_dir / f"event_{event_id}.zip"


def store_file(source: Path, destination: Path | str, *, remove_source: bool = False) -> None:
    if settings.MEDIA_STORAGE_BACKEND == "r2":
        try:
            _client().upload_file(str(source), settings.R2_BUCKET_NAME, _key(destination))
        except Exception as exc:
            log.exception("R2 upload failed for object %s", _key(destination))
            raise StorageError("Could not save uploaded file to object storage") from exc
        if remove_source:
            source.unlink(missing_ok=True)
        return

    path = _local_path(destination)
    if source.resolve() != path.resolve():
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)
    if remove_source and source.resolve() != path.resolve():
        source.unlink(missing_ok=True)


def store_bytes(data: bytes, destination: Path | str) -> None:
    if settings.MEDIA_STORAGE_BACKEND == "r2":
        try:
            _client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=_key(destination),
                Body=data,
            )
        except Exception as exc:
            log.exception("R2 upload failed for object %s", _key(destination))
            raise StorageError("Could not save file to object storage") from exc
        return

    path = _local_path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def exists(target: Path | str) -> bool:
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        return _local_path(target).is_file()
    from botocore.exceptions import ClientError

    try:
        _client().head_object(Bucket=settings.R2_BUCKET_NAME, Key=_key(target))
        return True
    except ClientError as exc:
        if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404:
            return False
        raise StorageError(f"Could not check object storage for {_key(target)}") from exc
    except Exception as exc:
        log.exception("R2 existence check failed for object %s", _key(target))
        raise StorageError("Could not check object storage") from exc


def read_bytes(target: Path | str) -> bytes:
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        return _local_path(target).read_bytes()
    try:
        response = _client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=_key(target))
        with response["Body"] as body:
            return body.read()
    except Exception as exc:
        log.exception("R2 download failed for object %s", _key(target))
        raise StorageError("Could not read file from object storage") from exc


def iter_file(target: Path | str) -> Iterator[bytes]:
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        with _local_path(target).open("rb") as file:
            while chunk := file.read(CHUNK_SIZE):
                yield chunk
        return

    try:
        response = _client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=_key(target))
        body = response["Body"]
        try:
            while chunk := body.read(CHUNK_SIZE):
                yield chunk
        finally:
            body.close()
    except Exception as exc:
        log.exception("R2 stream failed for object %s", _key(target))
        raise StorageError("Could not stream file from object storage") from exc


def copy_to_local(target: Path | str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("wb") as output:
            for chunk in iter_file(target):
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def response_for_file(
    target: Path | str,
    media_type: str,
    *,
    filename: str | None = None,
    disposition: str = "attachment",
):
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        path = _local_path(target)
        if not path.is_file():
            raise FileNotFoundError(path)
        return FileResponse(
            path,
            media_type=media_type,
            filename=filename,
            content_disposition_type=disposition,
        )

    if not exists(target):
        raise FileNotFoundError(_key(target))
    headers = {}
    if filename:
        headers["Content-Disposition"] = (
            f"{disposition}; filename=\"{quote(filename, safe=' .-_')}\""
        )
    return StreamingResponse(iter_file(target), media_type=media_type, headers=headers)


def delete(target: Path | str) -> None:
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        _local_path(target).unlink(missing_ok=True)
        return
    try:
        _client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=_key(target))
    except Exception as exc:
        log.exception("R2 delete failed for object %s", _key(target))
        raise StorageError("Could not delete file from object storage") from exc


def remove_tree(target: Path) -> None:
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        shutil.rmtree(_local_path(target), ignore_errors=True)
        return

    prefix = f"{_key(target).rstrip('/')}/"
    client = _client()
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
            objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if objects:
                client.delete_objects(
                    Bucket=settings.R2_BUCKET_NAME,
                    Delete={"Objects": objects, "Quiet": True},
                )
    except Exception as exc:
        log.exception("R2 prefix delete failed for %s", prefix)
        raise StorageError("Could not delete files from object storage") from exc
