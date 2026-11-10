import logging
import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_optional_user, get_user_via_query_token
from app.db.models import AccessRequest, EditedStatus, Event, PreviewImage, User
from app.schemas.api import GalleryEventOut, ImageOut, VisualSearchOut
from app.services import originals_service, storage_service
from app.services.events_view import can_download_edited, can_manage_media, preview_url
from app.services.visual_search import VisualSearchError, index_status, search_images
from app.tasks.pipeline import edited_tmp_path

router = APIRouter(prefix="/api/gallery", tags=["gallery"])
log = logging.getLogger("gallery")


def _status_for(db: Session, user: User | None, e: Event) -> str:
    if not user:
        return "none"
    if can_manage_media(user, e):
        return "staff"
    req = db.query(AccessRequest).filter_by(event_id=e.id, user_id=user.id).first()
    return req.status.value if req else "none"


@router.get("/events", response_model=list[GalleryEventOut])
def gallery_events(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    out = []
    for e in db.query(Event).order_by(Event.event_date.desc(), Event.id.desc()):
        previews = db.query(PreviewImage).filter_by(event_id=e.id).order_by(PreviewImage.id).all()
        if not previews:
            continue  # hide events that have no published previews yet
        out.append(GalleryEventOut(
            id=e.id, title=e.title, description=e.description, event_date=e.event_date,
            image_count=len(previews), cover_url=preview_url(previews[0]),
            access_status=_status_for(db, user, e),
        ))
    return out


@router.get("/search", response_model=VisualSearchOut)
def search_gallery_photos(
    q: str = Query(min_length=2, max_length=200),
    limit: int = Query(default=24, ge=1, le=48),
    db: Session = Depends(get_db),
):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(422, "Search phrase must contain at least two non-space characters")
    status = index_status(db)
    if status["indexed_count"] == 0:
        return VisualSearchOut(images=[], **status)
    try:
        images = search_images(db, query, limit)
    except VisualSearchError as exc:
        log.exception("Visual photo search failed")
        raise HTTPException(503, str(exc)) from exc
    return VisualSearchOut(images=images, **index_status(db))


@router.get("/events/{event_id}", response_model=GalleryEventOut)
def gallery_event(event_id: int, db: Session = Depends(get_db),
                  user: User | None = Depends(get_optional_user)):
    e = db.get(Event, event_id)
    previews = db.query(PreviewImage).filter_by(event_id=event_id).order_by(PreviewImage.id).all()
    if not e or not previews:
        raise HTTPException(404, "Event not found")
    return GalleryEventOut(id=e.id, title=e.title, description=e.description,
                           event_date=e.event_date, image_count=len(previews),
                           cover_url=preview_url(previews[0]), access_status=_status_for(db, user, e))


@router.get("/events/{event_id}/images", response_model=list[ImageOut])
def gallery_images(event_id: int, db: Session = Depends(get_db)):
    if not db.get(Event, event_id):
        raise HTTPException(404, "Event not found")
    rows = db.query(PreviewImage).filter_by(event_id=event_id).order_by(PreviewImage.id).all()
    if not rows:
        raise HTTPException(404, "No images for this event")
    return [ImageOut(id=p.id, file_name=p.file_name, url=preview_url(p),
                     width=p.width, height=p.height) for p in rows]


@router.get("/events/{event_id}/images/{image_id}/download")
def download_original_image(
    event_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_via_query_token),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if not can_download_edited(db, user, event):
        raise HTTPException(403, "Download access has not been approved")

    image = db.query(PreviewImage).filter_by(id=image_id, event_id=event_id).first()
    if not image:
        raise HTTPException(404, "Image not found")
    archive = event.edited_archive
    if not archive or archive.status != EditedStatus.synced:
        raise HTTPException(409, "Full-resolution images are not available yet")

    image_path = storage_service.edited_image_path(event_id, image.file_name)
    if not storage_service.exists(image_path):
        try:
            originals_service.ensure_event_originals(
                event_id,
                {row.file_name for row in db.query(PreviewImage).filter_by(event_id=event_id).all()},
                local_zip=edited_tmp_path(event_id),
                drive_file_id=archive.drive_file_id,
            )
        except originals_service.OriginalsUnavailable as e:
            raise HTTPException(409, str(e)) from e
        except originals_service.OriginalsStorageError as e:
            raise HTTPException(502, "Could not retrieve the original image from storage") from e

    media_type = mimetypes.guess_type(image.file_name)[0] or "application/octet-stream"
    try:
        return storage_service.response_for_file(
            image_path, media_type, filename=storage_service.safe_filename(image.file_name),
        )
    except FileNotFoundError as ex:
        raise HTTPException(404, "Full-resolution image is missing") from ex
    except storage_service.StorageError as ex:
        raise HTTPException(502, "Could not retrieve the original image from storage") from ex
