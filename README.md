# Smart Church Media Gallery

React + Tailwind frontend, FastAPI + SQLite backend. The database stores metadata only
(names, roles, statuses, Drive IDs/URLs). Image bytes live on disk (raw ZIPs, full-resolution
edited originals, and <300 KB previews) or as edited ZIPs in Google Drive.

## Run it

Backend (http://localhost:8000):

    cd backend
    python -m venv .venv
    .venv\Scripts\activate          (Windows; on Linux/macOS: source .venv/bin/activate)
    pip install -r requirements.txt
    copy .env.example .env          (then set SECRET_KEY and the admin password)
    uvicorn app.main:app --reload

Frontend (http://localhost:5173):

    cd frontend
    npm install
    npm run dev

The first semantic photo search downloads the configured CLIP model (about 600 MB)
from Hugging Face and caches it under `STORAGE_DIR/models`. Model inference runs on
the backend CPU; photo previews are not sent to an AI provider. Existing galleries
are indexed in the background after startup, and new galleries are indexed as needed.
Search is available while indexing continues, with progress shown in the gallery.

First login uses BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD from `.env`. Change that password.
`STORAGE_DIR` defaults to `backend/storage`; keep it on persistent storage because it contains raw uploads,
full-resolution edited images, and previews.

## Lifecycle
1. Admin creates an event, uploads the raw ZIP, assigns an Editor.
2. Editor downloads the raw ZIP, edits locally, uploads the edited ZIP.
3. Backend builds <300 KB previews (Pillow), keeps full-resolution edited images on the server for individual downloads, then pushes the ZIP to Google Drive.
4. Admin deletes the raw ZIP from the server (allowed only after the Drive sync succeeds).
5. Common users browse previews and request download access; Admin approves or denies. Approved users can download individual originals from the lightbox; only staff can download the complete edited ZIP.

## Church announcements
Admins can create, edit, pin, publish, and delete announcements from the Announcements tab in the admin panel.
Drafts are private; published announcements appear on the home page and at `/feed`. New installations
create the announcements table automatically when the backend starts.

## Church events
The public Events page at `/events` lists upcoming published gatherings and a past-events archive.
Admins schedule these in the Church events tab, separately from the gallery-processing workflow, with
optional times, venue, event details, and an uploaded poster. A scheduled event can optionally link to
a gallery event that already has public preview photos; deleting that gallery safely removes the link
without deleting the scheduled event. Poster uploads accept JPEG, PNG, or WebP up to 8 MB and are
re-encoded as optimized WebP images. Draft event listings remain private.

## Live streaming and videos
Admins can add live meeting links and recordings from the Live & videos tab. The first release
supports Zoom, with YouTube and Facebook URLs available for future use. Only published links are
shown on Home and at `/watch`; publishing a Zoom participant join link makes it available to every
site visitor. Do not publish host links or account credentials. Links must use HTTPS and match the
selected platform.

## Notice board
Admins can publish practical notices in the Notice board tab, choose a category, pin important
notices, and set an optional expiry date. Only published notices that have not expired appear at
`/notices`; drafts and expired notices remain available only in the admin panel.

## Church documents
Admins can upload and manage church PDFs from the Documents tab. Uploads are limited to 20 MB,
checked for a PDF signature, and stored under `STORAGE_DIR/documents` with generated filenames.
Only published documents appear in the searchable, category-filtered library at `/documents`;
visitors can download the original PDF. Drafts remain private in the admin panel.

## Plan your visit
The public `/visit` page gathers the church's existing service schedule and location, with a Google
Maps directions link and a short first-visit introduction. The page is linked from the main
navigation, homepage visit section, and footer.

## Contact and location
The public `/contact` page shares the confirmed church location, Google Maps directions, and weekly
service schedule. Phone, email, and social contact links are omitted until the church provides
official details.

## Google Drive (free Gmail, OAuth)
`DRIVE_ENABLED=false` (default) keeps the "Drive" copy in `backend/storage/drive_mock`.
To go live, as the church's Google account:
1. Google Cloud project -> enable Google Drive API.
2. OAuth consent screen: External, add the church Gmail as a test user, then Publish app (so the token does not expire after 7 days).
3. Credentials -> Create OAuth client ID -> Desktop app -> download JSON -> save as `backend/credentials/oauth-client.json`.
4. `cd backend && python scripts/get_drive_token.py` and sign in with the church account (creates `credentials/drive-token.json`).
5. Set `DRIVE_ENABLED=true` in `.env`, restart. Files go to a folder named "Church Media Gallery" in that account.
Files stay private; approved users download through the backend. For Google Workspace Shared Drives, set `DRIVE_AUTH=service_account`.

The semantic model can be changed with `VISUAL_SEARCH_MODEL`. Keep the same model
between deployments so saved photo embeddings remain compatible. The model weights
are downloaded once per storage directory and remain local after download.

## Tests

    cd backend
    python -m pytest tests/test_flow.py
