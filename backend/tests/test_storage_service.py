from io import BytesIO
from pathlib import Path

import pytest
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services import storage_service


class FakeObjectStorage:
    def __init__(self):
        self.objects = {}

    def upload_file(self, filename, bucket, key):
        self.objects[(bucket, key)] = Path(filename).read_bytes()

    def put_object(self, *, Bucket, Key, Body):
        self.objects[(Bucket, Key)] = Body

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise ClientError(
                {"ResponseMetadata": {"HTTPStatusCode": 404}},
                "HeadObject",
            )
        return {}

    def get_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise ClientError(
                {"ResponseMetadata": {"HTTPStatusCode": 404}},
                "GetObject",
            )
        return {"Body": BytesIO(self.objects[(Bucket, Key)])}

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)


@pytest.fixture
def r2_storage(monkeypatch):
    client = FakeObjectStorage()
    monkeypatch.setattr(settings, "MEDIA_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(storage_service, "_client", lambda: client)
    return client


def test_r2_store_read_stream_and_delete(r2_storage, tmp_path):
    source = tmp_path / "source.pdf"
    source.write_bytes(b"private media")
    destination = settings.documents_dir / "document-test.pdf"

    storage_service.store_file(source, destination)

    assert r2_storage.objects[("test-bucket", "documents/document-test.pdf")] == b"private media"
    assert storage_service.exists(destination)
    assert storage_service.read_bytes(destination) == b"private media"
    assert b"".join(storage_service.iter_file(destination)) == b"private media"
    storage_service.delete(destination)
    assert not storage_service.exists(destination)


def test_r2_store_bytes_and_reject_traversal(r2_storage):
    storage_service.store_bytes(b"preview", "previews/1/00001.jpg")

    assert storage_service.read_bytes("previews/1/00001.jpg") == b"preview"
    with pytest.raises(storage_service.StorageError, match="Invalid object storage key"):
        storage_service.read_bytes("previews/../private.txt")


def test_local_storage_rejects_paths_outside_storage(monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_STORAGE_BACKEND", "local")

    with pytest.raises(storage_service.InvalidStorageKey):
        storage_service.response_for_file(
            "previews/../../backend/.env",
            "text/plain",
        )
