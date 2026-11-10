from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@churchgallery.org", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_announcements_are_admin_managed_and_only_published_are_public():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        assert client.get("/api/announcements/admin").status_code == 401

        draft = client.post(
            "/api/announcements",
            json={"title": "Private draft", "content": "This is not public yet."},
            headers=headers,
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]

        pinned = client.post(
            "/api/announcements",
            json={
                "title": "Pinned update",
                "content": "This published announcement should appear first.",
                "status": "published",
                "is_pinned": True,
            },
            headers=headers,
        )
        assert pinned.status_code == 201, pinned.text
        pinned_id = pinned.json()["id"]

        regular = client.post(
            "/api/announcements",
            json={"title": "Published update", "content": "This is visible to everyone.", "status": "published"},
            headers=headers,
        )
        assert regular.status_code == 201, regular.text
        regular_id = regular.json()["id"]

        try:
            public = client.get("/api/announcements")
            assert public.status_code == 200
            public_ids = [item["id"] for item in public.json()]
            assert draft_id not in public_ids
            assert public_ids.index(pinned_id) < public_ids.index(regular_id)

            admin_items = client.get("/api/announcements/admin", headers=headers)
            assert admin_items.status_code == 200
            assert draft_id in [item["id"] for item in admin_items.json()]

            updated = client.put(
                f"/api/announcements/{draft_id}",
                json={"title": "Now public", "content": "This draft is now published.", "status": "published"},
                headers=headers,
            )
            assert updated.status_code == 200, updated.text
            assert updated.json()["published_at"] is not None
            assert draft_id in [item["id"] for item in client.get("/api/announcements").json()]

            assert client.delete(f"/api/announcements/{draft_id}", headers=headers).status_code == 204
            assert client.delete(f"/api/announcements/{pinned_id}", headers=headers).status_code == 204
            assert client.delete(f"/api/announcements/{regular_id}", headers=headers).status_code == 204
        finally:
            for announcement_id in (draft_id, pinned_id, regular_id):
                client.delete(f"/api/announcements/{announcement_id}", headers=headers)


def test_announcement_writes_require_admin_and_reject_blank_content():
    with TestClient(app) as client:
        assert client.post(
            "/api/announcements",
            json={"title": "Unauthorized", "content": "Must not be created."},
        ).status_code == 401

        member_email = f"announcement-member-{uuid4().hex}@example.com"
        registered = client.post(
            "/api/auth/register",
            json={"email": member_email, "full_name": "Church Member", "password": "Password123"},
        )
        assert registered.status_code == 201
        member_headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
        assert client.get("/api/announcements/admin", headers=member_headers).status_code == 403
        assert client.post(
            "/api/announcements",
            json={"title": "Member post", "content": "Members cannot publish announcements."},
            headers=member_headers,
        ).status_code == 403

        headers = _admin_headers(client)
        blank = client.post(
            "/api/announcements",
            json={"title": "   ", "content": "  "},
            headers=headers,
        )
        assert blank.status_code == 422
