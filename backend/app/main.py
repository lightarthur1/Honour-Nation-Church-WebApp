import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.db_migration import ensure_columns
from app.core.security import hash_password
from app.db import models  # noqa: F401  (register tables)
from app.db.models import EditedArchive, EditedStatus, Role, User
from app.db.session import Base, SessionLocal, engine
from app.routers import announcements, access_requests, auth, documents, events, gallery, notices, program_events, stream_items, uploads, users
from app.services.visual_search import start_indexing


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    ensure_columns()
    if settings.ENV == "production":
        if len(settings.SECRET_KEY) < 32 or settings.SECRET_KEY == "dev-only-change-me":
            raise RuntimeError("SECRET_KEY is not configured for production")
        if settings.BOOTSTRAP_ADMIN_PASSWORD == "ChangeMe123!":
            raise RuntimeError("Bootstrap admin password must be changed in production")
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add(User(email=settings.BOOTSTRAP_ADMIN_EMAIL.lower(), full_name="Administrator",
                        password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD), role=Role.admin))
        # A crash mid-pipeline would leave rows stuck on 'processing'
        for a in db.query(EditedArchive).filter_by(status=EditedStatus.processing):
            a.status, a.error = EditedStatus.failed, "Server restarted during processing. Upload again or retry sync."
        db.commit()
    finally:
        db.close()
    start_indexing()
    yield


logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Smart Church Media Gallery", lifespan=lifespan)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("x-content-type-options", "nosniff")
    response.headers.setdefault("x-frame-options", "DENY")
    response.headers.setdefault("referrer-policy", "same-origin")
    if request.url.scheme == "https":
        response.headers.setdefault("strict-transport-security", "max-age=31536000; includeSubDomains")
    return response


app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth.router, users.router, events.router, uploads.router, gallery.router, access_requests.router,
          announcements.router, program_events.router, stream_items.router, notices.router, documents.router):
    app.include_router(r)

app.mount("/previews", StaticFiles(directory=settings.previews_dir), name="previews")
app.mount("/event-posters", StaticFiles(directory=settings.event_posters_dir), name="event-posters")


@app.get("/api/health")
def health():
    return {"ok": True, "drive_enabled": settings.DRIVE_ENABLED}
