import io
from datetime import date, timedelta

from fastapi.testclient import TestClient
from PIL import Image

from app.db.models import PreviewImage
from app.db.session import SessionLocal
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@churchgallery.org", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _poster_bytes() -> bytes:
    image = Image.new("RGB", (480, 640), color=(25, 45, 80))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_program_events_are_admin_managed_and_public_only_when_published():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        assert client.get("/api/program-events/admin").status_code == 401
        assert client.post(
            "/api/program-events",
            json={"title": "Unauthorized event", "start_date": str(date.today())},
        ).status_code == 401

        draft = client.post(
            "/api/program-events",
            json={"title": "Private event draft", "start_date": str(date.today() + timedelta(days=2))},
            headers=headers,
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]

        published = client.post(
            "/api/program-events",
            json={
                "title": "Church gathering",
                "description": "A gathering for worship and fellowship.",
                "start_date": str(date.today() + timedelta(days=7)),
                "end_date": str(date.today() + timedelta(days=8)),
                "start_time": "18:00",
                "end_time": "20:00",
                "venue": "University of Ghana Miracle Centre",
                "status": "published",
            },
            headers=headers,
        )
        assert published.status_code == 201, published.text
        published_id = published.json()["id"]

        try:
            public_events = client.get("/api/program-events")
            assert public_events.status_code == 200
            assert [event["id"] for event in public_events.json()] == [published_id]
            assert client.get(f"/api/program-events/{draft_id}").status_code == 404

            poster = client.post(
                f"/api/program-events/{published_id}/poster",
                headers=headers,
                files={"file": ("event.png", _poster_bytes(), "image/png")},
            )
            assert poster.status_code == 200, poster.text
            poster_url = poster.json()["poster_url"]
            assert poster_url.endswith(".webp")
            assert client.get(poster_url).status_code == 200

            invalid_poster = client.post(
                f"/api/program-events/{published_id}/poster",
                headers=headers,
                files={"file": ("fake.png", b"not an image", "image/png")},
            )
            assert invalid_poster.status_code == 400

            assert client.delete(f"/api/program-events/{published_id}/poster", headers=headers).status_code == 204
            assert client.get(poster_url).status_code == 404
            assert client.delete(f"/api/program-events/{draft_id}", headers=headers).status_code == 204
            assert client.delete(f"/api/program-events/{published_id}", headers=headers).status_code == 204
        finally:
            for event_id in (draft_id, published_id):
                client.delete(f"/api/program-events/{event_id}", headers=headers)


def test_program_event_rejects_invalid_date_range():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        response = client.post(
            "/api/program-events",
            headers=headers,
            json={
                "title": "Invalid date range",
                "start_date": str(date.today() + timedelta(days=3)),
                "end_date": str(date.today() + timedelta(days=2)),
            },
        )
        assert response.status_code == 422
        missing_start_time = client.post(
            "/api/program-events",
            headers=headers,
            json={
                "title": "Missing start time",
                "start_date": str(date.today() + timedelta(days=3)),
                "end_time": "20:00",
            },
        )
        assert missing_start_time.status_code == 422


def test_program_event_can_link_to_gallery_and_link_clears_when_gallery_is_deleted():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        gallery = client.post(
            "/api/events",
            headers=headers,
            json={"title": "Related photo gallery", "event_date": str(date.today() - timedelta(days=1))},
        )
        assert gallery.status_code == 201, gallery.text
        gallery_id = gallery.json()["id"]

        no_photos = client.post(
            "/api/program-events",
            headers=headers,
            json={
                "title": "Event without photos",
                "start_date": str(date.today()),
                "gallery_event_id": gallery_id,
            },
        )
        assert no_photos.status_code == 422

        with SessionLocal() as db:
            db.add(PreviewImage(
                event_id=gallery_id,
                file_name="cover.jpg",
                relative_path=f"storage/previews/{gallery_id}/cover.jpg",
                width=640,
                height=480,
                size_bytes=1234,
            ))
            db.commit()

        program_event = client.post(
            "/api/program-events",
            headers=headers,
            json={
                "title": "Event with a gallery",
                "start_date": str(date.today()),
                "status": "published",
                "gallery_event_id": gallery_id,
            },
        )
        assert program_event.status_code == 201, program_event.text
        program_event_id = program_event.json()["id"]

        try:
            assert program_event.json()["gallery_event_title"] == "Related photo gallery"
            assert client.delete(f"/api/events/{gallery_id}", headers=headers).status_code == 204
            public_event = client.get(f"/api/program-events/{program_event_id}")
            assert public_event.status_code == 200
            assert public_event.json()["gallery_event_id"] is None
            assert public_event.json()["gallery_event_title"] is None
        finally:
            client.delete(f"/api/program-events/{program_event_id}", headers=headers)
            client.delete(f"/api/events/{gallery_id}", headers=headers)
