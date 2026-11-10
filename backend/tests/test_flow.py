"""End-to-end smoke test of the full media lifecycle (Drive in mock mode)."""
import io, os, tempfile, zipfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["DRIVE_ENABLED"] = "false"

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402


def make_zip(n=3, noisy=True, extra_files=True) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(n):
            arr = np.random.randint(0, 255, (2400, 3600, 3), dtype=np.uint8) if noisy else np.full((600, 800, 3), 90, np.uint8)
            b = io.BytesIO()
            Image.fromarray(arr).save(b, "JPEG", quality=95)
            zf.writestr(f"Final/photo_{i}.jpg", b.getvalue())
        if extra_files:
            zf.writestr("Final/notes.txt", "not an image")
            zf.writestr("__MACOSX/._x.jpg", "junk")
    return buf.getvalue()


def auth(client, email, password="Password123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_full_lifecycle():
    with TestClient(app) as c:
        admin = auth(c, "admin@churchgallery.org", "ChangeMe123!")

        # sign up two users; public sign-up can never create staff
        for email in ("editor@x.com", "member@x.com"):
            r = c.post("/api/auth/register", json={"email": email, "full_name": "Test Person", "password": "Password123"})
            assert r.status_code == 201 and r.json()["user"]["role"] == "user"
        users = {u["email"]: u for u in c.get("/api/users", headers=admin).json()}
        assert c.patch(f"/api/users/{users['editor@x.com']['id']}/role", json={"role": "editor"}, headers=admin).status_code == 200
        editor, member = auth(c, "editor@x.com"), auth(c, "member@x.com")

        # RBAC
        assert c.get("/api/users", headers=editor).status_code == 403
        assert c.post("/api/events", json={"title": "x", "event_date": "2026-01-01"}, headers=member).status_code == 403

        ev = c.post("/api/events", json={"title": "Easter Service", "event_date": "2026-04-05"}, headers=admin).json()
        eid = ev["id"]

        # editor not assigned -> cannot upload, cannot see
        assert c.post(f"/api/events/{eid}/edited", files={"file": ("e.zip", make_zip(1), "application/zip")}, headers=editor).status_code == 403
        assert c.get("/api/events", headers=editor).json() == []

        # raw upload
        r = c.post(f"/api/events/{eid}/raw", files={"file": ("raw.zip", make_zip(2), "application/zip")}, headers=admin)
        assert r.status_code == 201 and r.json()["raw"]["status"] == "available"

        # assign editor, editor sees + downloads raw
        r = c.put(f"/api/events/{eid}/editors", json={"editor_ids": [users["editor@x.com"]["id"]]}, headers=admin)
        assert r.status_code == 200
        assert len(c.get("/api/events", headers=editor).json()) == 1
        tok = editor["Authorization"].split()[1]
        d = c.get(f"/api/events/{eid}/raw/file?token={tok}")
        assert d.status_code == 200 and d.headers["content-type"] == "application/zip"
        assert c.get(f"/api/events/{eid}/raw/file").status_code == 401

        # cannot delete raw before sync
        assert c.delete(f"/api/events/{eid}/raw", headers=admin).status_code == 409

        # bad uploads rejected
        assert c.post(f"/api/events/{eid}/edited", files={"file": ("e.txt", b"hi")}, headers=editor).status_code == 400
        assert c.post(f"/api/events/{eid}/edited", files={"file": ("e.zip", b"not a zip")}, headers=editor).status_code == 400

        # edited upload -> background pipeline (TestClient runs it before returning)
        edited_zip = make_zip(3)
        r = c.post(f"/api/events/{eid}/edited", files={"file": ("final.zip", edited_zip, "application/zip")}, headers=editor)
        assert r.status_code == 202
        e = c.get(f"/api/events/{eid}", headers=editor).json()
        assert e["edited"]["status"] == "synced", e["edited"]
        assert e["edited"]["image_count"] == 3 and e["preview_count"] == 3

        # previews are public, < 300KB
        imgs = c.get(f"/api/gallery/events/{eid}/images").json()
        assert len(imgs) == 3
        for im in imgs:
            body = c.get(im["url"])
            assert body.status_code == 200 and len(body.content) <= 300 * 1024, len(body.content)

        # gallery listing, public + per-user status
        assert c.get("/api/gallery/events").json()[0]["access_status"] == "none"
        assert c.get("/api/gallery/events", headers=editor).json()[0]["access_status"] == "staff"

        # access request flow
        assert c.get(f"/api/events/{eid}/edited/link", headers=member).status_code == 403
        r = c.post(f"/api/events/{eid}/access-requests", headers=member)
        assert r.status_code == 201 and r.json()["status"] == "pending"
        assert c.get("/api/gallery/events", headers=member).json()[0]["access_status"] == "pending"
        assert c.get("/api/access-requests", headers=member).status_code == 403
        reqs = c.get("/api/access-requests?status=pending", headers=admin).json()
        assert len(reqs) == 1
        c.post(f"/api/access-requests/{reqs[0]['id']}/decision", json={"approve": False}, headers=admin)
        assert c.get(f"/api/events/{eid}/edited/link", headers=member).status_code == 403
        r = c.post(f"/api/events/{eid}/access-requests", headers=member)  # ask again after denial
        assert r.json()["status"] == "pending"
        c.post(f"/api/access-requests/{reqs[0]['id']}/decision", json={"approve": True}, headers=admin)
        assert c.get(f"/api/events/{eid}/edited/link", headers=member).status_code == 403
        mtok = member["Authorization"].split()[1]
        with zipfile.ZipFile(io.BytesIO(edited_zip)) as zf:
            expected_original = zf.read("Final/photo_0.jpg")
        image_download = c.get(
            f"/api/gallery/events/{eid}/images/{imgs[0]['id']}/download?token={mtok}"
        )
        assert image_download.status_code == 200
        assert image_download.content == expected_original
        assert c.get(f"/api/events/{eid}/edited/file?token={mtok}").status_code == 403

        # raw cleanup now allowed; second delete 404
        r = c.delete(f"/api/events/{eid}/raw", headers=admin)
        assert r.status_code == 200 and r.json()["raw"]["status"] == "deleted"
        assert c.delete(f"/api/events/{eid}/raw", headers=admin).status_code == 404

        # DB holds no binaries: every column is small text/number
        from sqlalchemy import LargeBinary
        from app.db.session import Base
        for t in Base.metadata.tables.values():
            assert not any(isinstance(col.type, LargeBinary) for col in t.columns), t.name


def test_zip_bomb_and_empty():
    with TestClient(app) as c:
        admin = auth(c, "admin@churchgallery.org", "ChangeMe123!")
        eid = c.post("/api/events", json={"title": "Bomb", "event_date": "2026-01-01"}, headers=admin).json()["id"]
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("readme.txt", "no images here")
        r = c.post(f"/api/events/{eid}/raw", files={"file": ("r.zip", buf.getvalue())}, headers=admin)
        assert r.status_code == 400 and "No images" in r.text
