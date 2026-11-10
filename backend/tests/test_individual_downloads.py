import io
import zipfile

from PIL import Image

from app.core import config
from app.db.models import Role
from app.services import drive_service, storage_service
from tests.helpers import auth, login


def _jpeg_bytes():
    image = Image.new("RGB", (32, 24), color=(25, 100, 180))
    data = io.BytesIO()
    image.save(data, format="JPEG", quality=95)
    return data.getvalue()


def test_approved_user_downloads_individual_original_but_not_zip(client, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    monkeypatch.setattr(storage_service, "BASE_DIR", tmp_path)

    drive_copy = tmp_path / "drive-copy.zip"

    def fake_upload(local_path, drive_name, event_id):
        assert event_id > 0
        assert drive_name.endswith("edited.zip")
        drive_copy.write_bytes(local_path.read_bytes())
        return drive_service.DriveResult("test-drive-file", "https://drive.example/test")

    def fake_stream_file(file_id, event_id):
        assert file_id == "test-drive-file"
        assert event_id > 0
        with drive_copy.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                yield chunk

    monkeypatch.setattr(drive_service, "upload_zip", fake_upload)
    monkeypatch.setattr(drive_service, "stream_file", fake_stream_file)

    admin = auth(login(client, "admin@churchgallery.org", "ChangeMe123!"))
    editor_response = client.post(
        "/api/auth/register",
        json={"email": "image-editor@example.com", "full_name": "Image Editor", "password": "Password-123"},
    )
    assert editor_response.status_code == 201, editor_response.text
    editor_token = editor_response.json()["access_token"]
    editor_id = editor_response.json()["user"]["id"]
    assert client.patch(
        f"/api/users/{editor_id}/role", headers=admin, json={"role": Role.editor.value}
    ).status_code == 200
    editor = auth(login(client, "image-editor@example.com", "Password-123"))

    member_response = client.post(
        "/api/auth/register",
        json={"email": "image-member@example.com", "full_name": "Image Member", "password": "Password-123"},
    )
    assert member_response.status_code == 201, member_response.text
    member = auth(member_response.json()["access_token"])
    member_token = member_response.json()["access_token"]

    event_response = client.post(
        "/api/events",
        headers=admin,
        json={"title": "Individual download test", "event_date": "2026-10-27"},
    )
    assert event_response.status_code == 201, event_response.text
    event_id = event_response.json()["id"]
    assert client.put(
        f"/api/events/{event_id}/editors",
        headers=admin,
        json={"editor_ids": [editor_id]},
    ).status_code == 200

    original = _jpeg_bytes()
    archive_data = io.BytesIO()
    with zipfile.ZipFile(archive_data, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("edited/photo.jpg", original)
    zip_bytes = archive_data.getvalue()
    upload_response = client.post(
        f"/api/events/{event_id}/edited",
        headers=editor,
        files={"file": ("edited.zip", zip_bytes, "application/zip")},
    )
    assert upload_response.status_code == 202, upload_response.text
    event_response = client.get(f"/api/events/{event_id}", headers=editor)
    assert event_response.json()["edited"]["status"] == "synced", event_response.text

    image = client.get(f"/api/gallery/events/{event_id}/images").json()[0]
    download_path = f"/api/gallery/events/{event_id}/images/{image['id']}/download"
    assert client.get(download_path).status_code == 401
    assert client.get(download_path, headers=member).status_code == 403

    request_response = client.post(f"/api/events/{event_id}/access-requests", headers=member)
    assert request_response.status_code == 201, request_response.text
    request_id = request_response.json()["id"]
    assert client.post(
        f"/api/access-requests/{request_id}/decision",
        headers=admin,
        json={"approve": True},
    ).status_code == 200

    storage_service.remove_tree(config.settings.edited_images_dir / str(event_id))
    image_response = client.get(f"{download_path}?token={member_token}")
    assert image_response.status_code == 200
    assert image_response.content == original
    assert "photo.jpg" in image_response.headers["content-disposition"]

    assert client.get(f"/api/events/{event_id}/edited/link", headers=member).status_code == 403
    assert client.get(f"/api/events/{event_id}/edited/file?token={member_token}").status_code == 403
    assert client.get(
        f"/api/events/{event_id}/edited/file?token={editor_token}"
    ).content == zip_bytes
    assert client.delete(f"/api/events/{event_id}", headers=admin).status_code == 204
    assert not (config.settings.edited_images_dir / str(event_id)).exists()
