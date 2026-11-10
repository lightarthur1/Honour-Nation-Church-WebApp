from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db.models import Notice
from app.db.session import SessionLocal
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@churchgallery.org", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_notice_board_hides_drafts_and_expired_notices_and_pins_first():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        assert client.get("/api/notices/admin").status_code == 401
        assert client.post(
            "/api/notices",
            json={"title": "Unauthorised", "content": "Not allowed"},
        ).status_code == 401

        draft = client.post(
            "/api/notices",
            headers=headers,
            json={"title": "Private notice", "content": "This draft is not public."},
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]

        normal = client.post(
            "/api/notices",
            headers=headers,
            json={
                "title": "Service schedule",
                "content": "Please check the updated service time.",
                "category": "service",
                "status": "published",
                "expires_on": str(date.today() + timedelta(days=5)),
            },
        )
        assert normal.status_code == 201, normal.text
        normal_id = normal.json()["id"]

        pinned = client.post(
            "/api/notices",
            headers=headers,
            json={
                "title": "Important reminder",
                "content": "Please register before the deadline.",
                "category": "registration",
                "status": "published",
                "is_pinned": True,
            },
        )
        assert pinned.status_code == 201, pinned.text
        pinned_id = pinned.json()["id"]

        expired = client.post(
            "/api/notices",
            headers=headers,
            json={
                "title": "Expiring notice",
                "content": "This notice will be hidden after its expiry date.",
                "status": "published",
            },
        )
        assert expired.status_code == 201, expired.text
        expired_id = expired.json()["id"]

        try:
            with SessionLocal() as db:
                expired_notice = db.get(Notice, expired_id)
                assert expired_notice
                expired_notice.expires_on = date.today() - timedelta(days=1)
                db.commit()

            public_response = client.get("/api/notices")
            assert public_response.status_code == 200
            public_notices = public_response.json()
            public_ids = [notice["id"] for notice in public_notices]
            assert draft_id not in public_ids
            assert expired_id not in public_ids
            assert public_ids.index(pinned_id) < public_ids.index(normal_id)
            assert public_notices[0]["category"] == "registration"

            admin_notices = client.get("/api/notices/admin", headers=headers)
            assert admin_notices.status_code == 200
            admin_ids = [notice["id"] for notice in admin_notices.json()]
            assert {draft_id, expired_id, normal_id, pinned_id}.issubset(set(admin_ids))

            updated = client.put(
                f"/api/notices/{draft_id}",
                headers=headers,
                json={
                    "title": "Published reminder",
                    "content": "The notice is now public.",
                    "category": "reminder",
                    "status": "published",
                    "expires_on": str(date.today() + timedelta(days=2)),
                },
            )
            assert updated.status_code == 200, updated.text
            assert draft_id in [notice["id"] for notice in client.get("/api/notices").json()]

            for notice_id in (draft_id, normal_id, pinned_id, expired_id):
                assert client.delete(f"/api/notices/{notice_id}", headers=headers).status_code == 204
        finally:
            for notice_id in (draft_id, normal_id, pinned_id, expired_id):
                client.delete(f"/api/notices/{notice_id}", headers=headers)


def test_notice_rejects_blank_content_and_past_expiry():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        blank = client.post(
            "/api/notices",
            headers=headers,
            json={"title": "   ", "content": " "},
        )
        assert blank.status_code == 422

        past_date = client.post(
            "/api/notices",
            headers=headers,
            json={
                "title": "Past expiry",
                "content": "An expiry date cannot be in the past.",
                "expires_on": str(date.today() - timedelta(days=1)),
            },
        )
        assert past_date.status_code == 422
