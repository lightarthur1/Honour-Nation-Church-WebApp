from io import BytesIO

from app.core.config import settings
from app.services import drive_service, storage_service


class ExistingFolder:
    def list(self, **_kwargs):
        return self

    def execute(self):
        return {"files": [{"id": "test-folder-id"}]}


class MockDriveService:
    def files(self):
        return ExistingFolder()


class MockR2Client:
    def __init__(self):
        self.objects = {}

    def upload_file(self, filename, bucket, key):
        from pathlib import Path

        self.objects[(bucket, key)] = Path(filename).read_bytes()

    def get_object(self, *, Bucket, Key):
        return {"Body": BytesIO(self.objects[(Bucket, Key)])}


def test_check_connection_reports_drive_disabled(monkeypatch):
    monkeypatch.setattr(settings, "DRIVE_ENABLED", False)

    assert drive_service.check_connection() == {
        "enabled": False,
        "configured": False,
        "folder_name": None,
        "error": None,
    }


def test_disabled_drive_mock_uses_r2_when_configured(monkeypatch, tmp_path):
    client = MockR2Client()
    source = tmp_path / "edited.zip"
    source.write_bytes(b"edited archive")
    monkeypatch.setattr(settings, "DRIVE_ENABLED", False)
    monkeypatch.setattr(settings, "MEDIA_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(storage_service, "_client", lambda: client)

    result = drive_service.upload_zip(source, "edited.zip", event_id=19)

    assert result.file_id == "mock-event-19"
    assert list(drive_service.stream_file(result.file_id, event_id=19)) == [b"edited archive"]


def test_check_connection_reports_accessible_oauth_folder(monkeypatch):
    monkeypatch.setattr(settings, "DRIVE_ENABLED", True)
    monkeypatch.setattr(settings, "DRIVE_AUTH", "oauth")
    monkeypatch.setattr(settings, "GOOGLE_DRIVE_FOLDER_NAME", "Test Gallery")
    monkeypatch.setattr(drive_service, "_client", MockDriveService)

    assert drive_service.check_connection() == {
        "enabled": True,
        "configured": True,
        "folder_name": "Test Gallery",
        "error": None,
    }


def test_check_connection_surfaces_drive_auth_errors(monkeypatch):
    monkeypatch.setattr(settings, "DRIVE_ENABLED", True)

    def failing_client():
        raise drive_service.DriveError("Drive authorization failed")

    monkeypatch.setattr(drive_service, "_client", failing_client)

    result = drive_service.check_connection()

    assert result["enabled"] is True
    assert result["configured"] is False
    assert result["error"] == "Drive authorization failed"
