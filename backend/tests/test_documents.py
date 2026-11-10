from app.core.config import settings
from app.db.models import ChurchDocument
from app.db.session import SessionLocal


def _admin_headers(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@churchgallery.org", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, title, *, filename="resource.pdf", content=b"%PDF-1.7\nsample", status="draft"):
    return client.post(
        "/api/documents",
        headers=headers,
        data={
            "title": title,
            "description": "A shared church resource.",
            "category": "bible_study",
            "status": status,
        },
        files={"file": (filename, content, "application/pdf")},
    )


def test_document_upload_publish_download_replace_and_delete(client):
    headers = _admin_headers(client)
    assert client.get("/api/documents/admin").status_code == 401
    assert _upload(client, {}, "Unauthorized").status_code == 401

    invalid_extension = _upload(client, headers, "Wrong extension", filename="resource.txt")
    assert invalid_extension.status_code == 415
    invalid_content = _upload(client, headers, "Not a PDF", content=b"not a pdf")
    assert invalid_content.status_code == 400

    draft = _upload(client, headers, "Private study guide")
    assert draft.status_code == 201, draft.text
    draft_id = draft.json()["id"]

    published = _upload(client, headers, "Sunday study guide", status="published")
    assert published.status_code == 201, published.text
    published_id = published.json()["id"]

    try:
        public_docs = client.get("/api/documents")
        assert public_docs.status_code == 200
        assert [doc["id"] for doc in public_docs.json()] == [published_id]
        assert draft_id not in [doc["id"] for doc in public_docs.json()]

        downloaded = client.get(f"/api/documents/{published_id}/download")
        assert downloaded.status_code == 200
        assert downloaded.content == b"%PDF-1.7\nsample"
        assert "attachment" in downloaded.headers["content-disposition"]
        assert downloaded.headers["content-type"] == "application/pdf"

        admin_docs = client.get("/api/documents/admin", headers=headers)
        assert admin_docs.status_code == 200
        assert {doc["id"] for doc in admin_docs.json()} == {draft_id, published_id}

        update = client.put(
            f"/api/documents/{draft_id}",
            headers=headers,
            json={
                "title": "Published study guide",
                "description": "Now available to the congregation.",
                "category": "newsletter",
                "status": "published",
            },
        )
        assert update.status_code == 200, update.text
        assert draft_id in [doc["id"] for doc in client.get("/api/documents").json()]

        replacement = client.post(
            f"/api/documents/{published_id}/file",
            headers=headers,
            files={"file": ("revised.pdf", b"%PDF-1.7\nrevised", "application/pdf")},
        )
        assert replacement.status_code == 200, replacement.text
        assert replacement.json()["original_filename"] == "revised.pdf"
        assert client.get(f"/api/documents/{published_id}/download").content == b"%PDF-1.7\nrevised"

        assert client.delete(f"/api/documents/{published_id}", headers=headers).status_code == 204
        assert client.get(f"/api/documents/{published_id}/download").status_code == 404
        assert client.delete(f"/api/documents/{draft_id}", headers=headers).status_code == 204
    finally:
        for document_id in (draft_id, published_id):
            client.delete(f"/api/documents/{document_id}", headers=headers)


def test_document_upload_rejects_files_over_20_mb(client):
    headers = _admin_headers(client)
    too_large = b"%PDF-1.7\n" + b"x" * (20 * 1024 * 1024)
    response = _upload(client, headers, "Too large", content=too_large)
    assert response.status_code == 413, response.text


def test_deleting_document_with_missing_file_still_removes_record(client):
    headers = _admin_headers(client)
    created = _upload(client, headers, "Missing file cleanup")
    assert created.status_code == 201, created.text
    document_id = created.json()["id"]
    with SessionLocal() as db:
        document = db.get(ChurchDocument, document_id)
        assert document
        path = settings.documents_dir / document.storage_filename
    try:
        path.unlink(missing_ok=True)
        assert client.delete(f"/api/documents/{document_id}", headers=headers).status_code == 204
        assert document_id not in [doc["id"] for doc in client.get("/api/documents/admin", headers=headers).json()]
    finally:
        client.delete(f"/api/documents/{document_id}", headers=headers)
