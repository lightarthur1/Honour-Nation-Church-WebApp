import json
from datetime import date

from app.db.models import Event, PreviewImage, User
from app.db.session import SessionLocal
from app.services import visual_search


def test_visual_search_returns_images_ranked_by_similarity(client, monkeypatch):
    db = SessionLocal()
    try:
        user = db.query(User).first()
        event = Event(title="Sunday Service", description="", event_date=date(2026, 10, 25), created_by=user.id)
        db.add(event)
        db.flush()
        for name, vector in (
            ("prayer.jpg", [1.0] + [0.0] * 511),
            ("worship.jpg", [0.0, 1.0] + [0.0] * 510),
        ):
            db.add(
                PreviewImage(
                    event_id=event.id,
                    file_name=name,
                    relative_path=f"storage/previews/{event.id}/{name}",
                    width=640,
                    height=480,
                    size_bytes=1000,
                    embedding=json.dumps(vector),
                )
            )
        db.commit()
        event_id = event.id
    finally:
        db.close()

    monkeypatch.setattr(visual_search, "encode_text", lambda _query: [1.0] + [0.0] * 511)
    monkeypatch.setattr(visual_search, "start_indexing", lambda: None)

    try:
        response = client.get("/api/gallery/search", params={"q": "people praying"})

        assert response.status_code == 200, response.text
        body = response.json()
        assert [image["file_name"] for image in body["images"]] == ["prayer.jpg"]
        assert body["images"][0]["event_id"] == event_id
        assert body["images"][0]["url"] == f"/previews/{event_id}/prayer.jpg"
        assert body["indexed_count"] >= 2
        assert body["total_count"] >= body["indexed_count"]
    finally:
        db = SessionLocal()
        try:
            db.query(PreviewImage).filter_by(event_id=event_id).delete()
            db.query(Event).filter_by(id=event_id).delete()
            db.commit()
        finally:
            db.close()


def test_visual_search_rejects_whitespace_query(client):
    response = client.get("/api/gallery/search", params={"q": "  "})

    assert response.status_code == 422
