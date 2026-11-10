"""End-to-end test of the media lifecycle and the role/permission matrix."""

from pathlib import Path

import pytest
from PIL import Image

from app.core.config import settings
from app.services import drive_service
from tests.helpers import auth, login, make_zip, noisy_jpeg

ADMIN = ("admin@example.com", "Admin-Pass-123")


@pytest.fixture(scope="module")
def world(client):
    """Admin, an assigned editor, an unassigned editor, a common user, and one event."""
    admin = login(client, *ADMIN)
    for email, name, role in [
        ("editor@example.com", "Edith Editor", "editor"),
        ("other-editor@example.com", "Otto Other", "editor"),
    ]:
        r = client.post(
            "/api/users",
            headers=auth(admin),
            json={"email": email, "full_name": name, "password": "Password-123", "role": role},
        )
        assert r.status_code == 201, r.text
    r = client.post(
        "/api/auth/register",
        json={"email": "member@example.com", "full_name": "Mary Member", "password": "Password-123"},
    )
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "user"  # self-registration can never create staff

    editor = login(client, "editor@example.com", "Password-123")
    other = login(client, "other-editor@example.com", "Password-123")
    member = r.json()["access_token"]

    users = {u["email"]: u["id"] for u in client.get("/api/users", headers=auth(admin)).json()}
    ev = client.post(
        "/api/events",
        headers=auth(admin),
        json={"title": "Easter Service 2026", "event_date": "2026-04-05"},
    )
    assert ev.status_code == 201
    event_id = ev.json()["id"]
    r = client.put(
        f"/api/events/{event_id}/editors",
        headers=auth(admin),
        json={"editor_ids": [users["editor@example.com"]]},
    )
    assert r.status_code == 200
    return dict(admin=admin, editor=editor, other=other, member=member, event_id=event_id, users=users)


def test_previews_stay_under_300kb():
    from app.services.preview_service import build_preview

    prev = build_preview(noisy_jpeg(3000, 2000))
    assert len(prev.data) <= 300 * 1024
    assert max(prev.width, prev.height) <= 1600


def test_roles_are_enforced(client, world):
    eid = world["event_id"]
    raw = make_zip({"a.cr2": b"x" * 100})
    # Only admins upload raw ZIPs.
    for who in ("editor", "member"):
        r = client.post(
            f"/api/events/{eid}/raw", headers=auth(world[who]),
            files={"file": ("raw.zip", raw, "application/zip")},
        )
        assert r.status_code == 403, who
    # Anonymous / common users cannot reach staff or admin endpoints.
    assert client.get("/api/events").status_code == 401
    assert client.get("/api/events", headers=auth(world["member"])).status_code == 403
    assert client.get("/api/users", headers=auth(world["editor"])).status_code == 403
    assert client.get("/api/access-requests", headers=auth(world["editor"])).status_code == 403
    # Unassigned editor can't see the event (404, not 403: existence is not leaked).
    assert client.get(f"/api/events/{eid}", headers=auth(world["other"])).status_code == 404
    assert client.get("/api/events", headers=auth(world["other"])).json() == []
    # Admin cannot lock themselves out.
    me = client.get("/api/auth/me", headers=auth(world["admin"])).json()
    r = client.patch(f"/api/users/{me['id']}", headers=auth(world["admin"]), json={"role": "user"})
    assert r.status_code == 400


def test_unsafe_uploads_rejected(client, world):
    eid = world["event_id"]
    h = auth(world["admin"])
    evil = make_zip({"../../evil.jpg": b"x"})
    r = client.post(f"/api/events/{eid}/raw", headers=h, files={"file": ("x.zip", evil)})
    assert r.status_code == 422 and "unsafe" in r.json()["detail"]

    r = client.post(f"/api/events/{eid}/raw", headers=h, files={"file": ("x.zip", b"not a zip")})
    assert r.status_code == 422
    r = client.post(f"/api/events/{eid}/raw", headers=h, files={"file": ("x.txt", b"hello")})
    assert r.status_code == 422

    # Edited ZIPs must contain viewable images.
    r = client.post(
        f"/api/events/{eid}/edited", headers=auth(world["editor"]),
        files={"file": ("e.zip", make_zip({"notes.txt": b"hi"}))},
    )
    assert r.status_code == 422
    r = client.post(
        f"/api/events/{eid}/edited", headers=auth(world["editor"]),
        files={"file": ("e.zip", make_zip({"IMG_1.CR2": b"raw camera data"}))},
    )
    assert r.status_code == 422


def test_full_lifecycle(client, world, monkeypatch):
    eid, admin, editor = world["event_id"], auth(world["admin"]), auth(world["editor"])

    # 1. Admin uploads the raw ZIP.
    raw_zip = make_zip({f"IMG_{i}.cr2": b"raw" * 1000 for i in range(5)})
    r = client.post(f"/api/events/{eid}/raw", headers=admin, files={"file": ("raw.zip", raw_zip)})
    assert r.status_code == 201, r.text
    raw_id = r.json()["id"]
    assert r.json()["file_count"] == 5

    # 2. Editor downloads it through a short-lived link; a stranger cannot.
    r = client.post(f"/api/events/{eid}/raw/{raw_id}/download-link", headers=editor)
    assert r.status_code == 200
    url = r.json()["url"]
    got = client.get(url)
    assert got.status_code == 200 and got.content == raw_zip
    assert client.post(f"/api/events/{eid}/raw/{raw_id}/download-link", headers=auth(world["other"])).status_code == 404
    assert client.get("/api/downloads/raw/garbage").status_code == 403

    # 3. Raw files cannot be deleted before an edited ZIP is live.
    r = client.delete(f"/api/events/{eid}/raw/{raw_id}", headers=admin)
    assert r.status_code == 409

    # 4. Editor uploads the edited ZIP (one corrupt image is skipped, not fatal).
    edited = make_zip(
        {
            "final/IMG_1.jpg": noisy_jpeg(2400, 1600),
            "final/IMG_2.jpg": noisy_jpeg(1600, 2400),
            "final/IMG_10.jpg": noisy_jpeg(800, 600),
            "final/broken.jpg": b"this is not a jpeg",
            "__MACOSX/final/._IMG_1.jpg": b"junk",
        }
    )
    r = client.post(f"/api/events/{eid}/edited", headers=editor, files={"file": ("edited.zip", edited)})
    assert r.status_code == 202, r.text
    archive_id = r.json()["id"]
    assert r.json()["image_count"] == 4  # junk excluded

    # TestClient runs background tasks before returning, so the pipeline has finished.
    a = client.get(f"/api/events/{eid}/edited", headers=editor).json()[0]
    assert a["preview_status"] == "done"
    assert a["preview_count"] == 3
    assert a["drive_status"] == "skipped"  # Drive disabled in tests
    assert "skipped" in a["error_message"]

    # 5. Public gallery: no login, previews only, natural filename order.
    page = client.get("/api/gallery/events").json()
    assert page["total"] == 1 and page["items"][0]["photo_count"] == 3
    detail = client.get(f"/api/gallery/events/{eid}").json()
    assert detail["access"] == "anonymous" and detail["download_ready"] is False
    assert [i["name"] for i in detail["images"]] == ["IMG_1.jpg", "IMG_2.jpg", "IMG_10.jpg"]
    for img in detail["images"]:
        resp = client.get(img["url"])
        assert resp.status_code == 200
        assert len(resp.content) <= 300 * 1024
        assert "max-age" in resp.headers["cache-control"]
    assert "drive" not in str(detail).lower()  # the public payload never carries Drive links

    # 6. Download access request flow.
    member, member_h = world["member"], auth(world["member"])
    assert client.get(f"/api/gallery/events/{eid}/download").status_code == 401
    assert client.get(f"/api/gallery/events/{eid}/download", headers=member_h).status_code == 403
    assert client.get(f"/api/gallery/events/{eid}", headers=member_h).json()["access"] == "none"

    r = client.post("/api/access-requests", headers=member_h, json={"event_id": eid, "message": "For the bulletin"})
    assert r.status_code == 201
    req_id = r.json()["id"]
    assert client.post("/api/access-requests", headers=member_h, json={"event_id": eid}).status_code == 409
    assert client.get(f"/api/gallery/events/{eid}", headers=member_h).json()["access"] == "pending"
    assert client.get("/api/access-requests/pending-count", headers=admin).json() == {"pending": 1}
    assert client.get(f"/api/gallery/events/{eid}/download", headers=member_h).status_code == 403

    # Members cannot approve themselves.
    assert client.post(f"/api/access-requests/{req_id}/approve", headers=member_h).status_code == 403
    r = client.post(f"/api/access-requests/{req_id}/approve", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.get(f"/api/gallery/events/{eid}", headers=member_h).json()["access"] == "approved"
    # Approved, but there is no final ZIP in Drive yet.
    assert client.get(f"/api/gallery/events/{eid}/download", headers=member_h).status_code == 409

    # 7. Editor triggers the Drive sync (Drive is faked: no network in tests).
    uploaded = {}

    def fake_upload(local_path: Path, drive_name: str):
        assert Path(local_path).is_file()
        uploaded["name"] = drive_name
        return drive_service.DriveFile("drive123", drive_name, "https://drive.test/dl/drive123", "https://drive.test/view/drive123")

    monkeypatch.setattr(settings, "drive_enabled", True)
    monkeypatch.setattr(drive_service, "upload_zip", fake_upload)
    r = client.post(f"/api/edited/{archive_id}/sync-drive", headers=editor)
    assert r.status_code == 202
    a = client.get(f"/api/events/{eid}/edited", headers=editor).json()[0]
    assert a["drive_status"] == "synced"
    assert a["drive_download_url"] == "https://drive.test/dl/drive123"
    assert "Easter Service 2026" in uploaded["name"]

    # The local staging copy was removed once the ZIP was safely in Drive.
    staged = list((settings.edited_dir / str(eid)).glob("*.zip"))
    assert staged == []
    assert client.post(f"/api/edited/{archive_id}/sync-drive", headers=editor).status_code == 409

    # 8. Now the approved member gets the link; an unapproved user still does not.
    r = client.get(f"/api/gallery/events/{eid}/download", headers=member_h)
    assert r.status_code == 200 and r.json()["download_url"] == "https://drive.test/dl/drive123"
    stranger = client.post(
        "/api/auth/register",
        json={"email": "s@example.com", "full_name": "Stan Stranger", "password": "Password-123"},
    ).json()["access_token"]
    assert client.get(f"/api/gallery/events/{eid}/download", headers=auth(stranger)).status_code == 403

    # Revoking takes the access away again.
    client.post(f"/api/access-requests/{req_id}/revoke", headers=admin)
    assert client.get(f"/api/gallery/events/{eid}/download", headers=member_h).status_code == 403

    # 9. Admin frees disk space: raw ZIP can go now that the edited ZIP is live.
    raw_file = next((settings.raw_dir / str(eid)).glob("*.zip"))
    r = client.delete(f"/api/events/{eid}/raw/{raw_id}", headers=admin)
    assert r.status_code == 200 and r.json()["is_available"] is False
    assert not raw_file.exists()
    assert client.post(f"/api/events/{eid}/raw/{raw_id}/download-link", headers=editor).status_code == 410


def test_new_edited_zip_replaces_gallery(client, world, monkeypatch):
    """Uploading a second edited ZIP supersedes the first in the gallery (no duplicates)."""
    eid, editor = world["event_id"], auth(world["editor"])
    monkeypatch.setattr(settings, "drive_enabled", False)
    zip2 = make_zip({"v2/A.jpg": noisy_jpeg(900, 600), "v2/B.jpg": noisy_jpeg(900, 600)})
    r = client.post(f"/api/events/{eid}/edited", headers=editor, files={"file": ("v2.zip", zip2)})
    assert r.status_code == 202
    detail = client.get(f"/api/gallery/events/{eid}").json()
    assert detail["photo_count"] == 2
    assert [i["name"] for i in detail["images"]] == ["A.jpg", "B.jpg"]
    statuses = [a["preview_status"] for a in client.get(f"/api/events/{eid}/edited", headers=editor).json()]
    assert statuses == ["superseded", "done"]


def test_event_delete_cleans_up(client, world):
    admin = auth(world["admin"])
    eid = client.post("/api/events", headers=admin, json={"title": "Temp"}).json()["id"]
    client.post(f"/api/events/{eid}/raw", headers=admin, files={"file": ("r.zip", make_zip({"a.cr2": b"1"}))})
    assert (settings.raw_dir / str(eid)).exists()
    assert client.delete(f"/api/events/{eid}", headers=admin).status_code == 204
    assert not (settings.raw_dir / str(eid)).exists()
    assert client.get(f"/api/events/{eid}", headers=admin).status_code == 404
