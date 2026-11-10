from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.security import hash_password
from app.db.models import PreviewImage, Role, User
from app.db.session import SessionLocal
from app.services.events_view import preview_url
from tests.helpers import auth, login


@pytest.mark.parametrize(
    "relative_path",
    [
        "storage/previews/12/00001.jpg",
        r"storage\previews\12\00001.jpg",
    ],
)
def test_preview_url_handles_platform_path_separators(relative_path):
    assert preview_url(SimpleNamespace(relative_path=relative_path)) == "/previews/12/00001.jpg"


def test_event_list_serializes_windows_preview_path(client):
    email = f"preview-test-{uuid4().hex}@example.com"
    password = "test-password-123"
    db = SessionLocal()
    try:
        db.add(
            User(
                email=email,
                full_name="Preview Test Admin",
                password_hash=hash_password(password),
                role=Role.admin,
            )
        )
        db.commit()
    finally:
        db.close()

    token = login(client, email, password)
    response = client.post(
        "/api/events",
        headers=auth(token),
        json={"title": "Windows path regression", "event_date": "2026-10-26"},
    )
    assert response.status_code == 201, response.text
    event_id = response.json()["id"]

    db = SessionLocal()
    try:
        db.add(
            PreviewImage(
                event_id=event_id,
                file_name="00001.jpg",
                relative_path=rf"storage\previews\{event_id}\00001.jpg",
                width=1,
                height=1,
                size_bytes=1,
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/events", headers=auth(token))
    assert response.status_code == 200, response.text
    event = next(item for item in response.json() if item["id"] == event_id)
    assert event["cover_url"] == f"/previews/{event_id}/00001.jpg"
