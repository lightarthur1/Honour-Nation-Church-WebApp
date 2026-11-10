from app.core.config import settings
from app.services import drive_service


class ExistingFolder:
    def list(self, **_kwargs):
        return self

    def execute(self):
        return {"files": [{"id": "test-folder-id"}]}


class MockDriveService:
    def files(self):
        return ExistingFolder()


def test_check_connection_reports_drive_disabled(monkeypatch):
    monkeypatch.setattr(settings, "DRIVE_ENABLED", False)

    assert drive_service.check_connection() == {
        "enabled": False,
        "configured": False,
        "folder_name": None,
        "error": None,
    }


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
