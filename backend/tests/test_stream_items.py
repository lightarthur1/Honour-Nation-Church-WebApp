from fastapi.testclient import TestClient

from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@churchgallery.org", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_stream_links_are_private_until_published_and_admin_managed():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        assert client.get("/api/stream-items/admin").status_code == 401
        assert client.post(
            "/api/stream-items",
            json={
                "title": "Unauthorised stream",
                "provider": "zoom",
                "kind": "live",
                "url": "https://zoom.us/j/123456789",
            },
        ).status_code == 401

        draft = client.post(
            "/api/stream-items",
            headers=headers,
            json={
                "title": "Private Zoom draft",
                "provider": "zoom",
                "kind": "live",
                "url": "https://us02web.zoom.us/j/123456789?pwd=example",
                "scheduled_at": "2026-11-02T18:00:00+02:00",
            },
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]
        assert draft.json()["scheduled_at"] == "2026-11-02T16:00:00Z"

        published = client.post(
            "/api/stream-items",
            headers=headers,
            json={
                "title": "Sunday service recording",
                "description": "Watch the recorded service.",
                "provider": "youtube",
                "kind": "recording",
                "url": "https://youtu.be/AbCdEf12345",
                "status": "published",
            },
        )
        assert published.status_code == 201, published.text
        published_id = published.json()["id"]

        try:
            public_items = client.get("/api/stream-items")
            assert public_items.status_code == 200
            assert [item["id"] for item in public_items.json()] == [published_id]
            assert draft_id in [item["id"] for item in client.get("/api/stream-items/admin", headers=headers).json()]

            publish_draft = client.put(
                f"/api/stream-items/{draft_id}",
                headers=headers,
                json={
                    "title": "Join our Zoom service",
                    "provider": "zoom",
                    "kind": "live",
                    "url": "https://zoom.us/j/123456789",
                    "status": "published",
                },
            )
            assert publish_draft.status_code == 200, publish_draft.text
            assert draft_id in [item["id"] for item in client.get("/api/stream-items").json()]

            assert client.delete(f"/api/stream-items/{draft_id}", headers=headers).status_code == 204
            assert client.delete(f"/api/stream-items/{published_id}", headers=headers).status_code == 204
        finally:
            for item_id in (draft_id, published_id):
                client.delete(f"/api/stream-items/{item_id}", headers=headers)


def test_stream_link_must_use_https_and_match_selected_provider():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        invalid_urls = [
            "http://zoom.us/j/123456789",
            "https://notzoom.us/j/123456789",
            "javascript:alert(1)",
            "https://youtube.com/watch?v=123",
        ]
        for url in invalid_urls:
            response = client.post(
                "/api/stream-items",
                headers=headers,
                json={
                    "title": "Invalid provider link",
                    "provider": "zoom",
                    "kind": "live",
                    "url": url,
                },
            )
            assert response.status_code == 422, (url, response.text)

        naive_datetime = client.post(
            "/api/stream-items",
            headers=headers,
            json={
                "title": "Timezone required",
                "provider": "zoom",
                "kind": "live",
                "url": "https://zoom.us/j/987654321",
                "scheduled_at": "2026-11-02T18:00:00",
            },
        )
        assert naive_datetime.status_code == 422
