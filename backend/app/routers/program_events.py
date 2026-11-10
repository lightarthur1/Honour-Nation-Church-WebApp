import io
import logging
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, require_role
from app.db.models import Event, PreviewImage, ProgramEvent, ProgramEventStatus, Role, User
from app.schemas.api import ProgramEventIn, ProgramEventOut

router = APIRouter(prefix="/api/program-events", tags=["program-events"])
log = logging.getLogger("program_events")
MAX_POSTER_BYTES = 8 * 1024 * 1024
MAX_POSTER_PIXELS = 24_000_000
MAX_POSTER_EDGE = 2400


def _ordered_events(db: Session):
    return db.query(ProgramEvent).order_by(ProgramEvent.start_date.desc(), ProgramEvent.id.desc())


def _event_or_404(db: Session, event_id: int) -> ProgramEvent:
    event = db.get(ProgramEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return event


def _validate_event(body: ProgramEventIn) -> tuple[str, str, str]:
    title = body.title.strip()
    description = body.description.strip()
    venue = body.venue.strip()
    if len(title) < 2:
        raise HTTPException(422, "Event title must contain at least two non-space characters")
    if body.end_date and body.end_date < body.start_date:
        raise HTTPException(422, "Event end date cannot be before its start date")
    if body.end_time and not body.start_time:
        raise HTTPException(422, "Add a start time before entering an end time")
    if body.end_date in (None, body.start_date) and body.start_time and body.end_time:
        if body.end_time <= body.start_time:
            raise HTTPException(422, "End time must be later than start time")
    return title, description, venue


def _validate_gallery_event(db: Session, gallery_event_id: int | None) -> None:
    if gallery_event_id is None:
        return
    if not db.get(Event, gallery_event_id):
        raise HTTPException(422, "The selected gallery event does not exist")
    if not db.query(PreviewImage.id).filter_by(event_id=gallery_event_id).first():
        raise HTTPException(422, "The selected gallery event has no published photos")


@router.get("", response_model=list[ProgramEventOut])
def public_program_events(db: Session = Depends(get_db)):
    return _ordered_events(db).filter_by(status=ProgramEventStatus.published).all()


@router.get("/admin", response_model=list[ProgramEventOut])
def admin_program_events(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return _ordered_events(db).all()


@router.get("/{event_id}", response_model=ProgramEventOut)
def public_program_event(event_id: int, db: Session = Depends(get_db)):
    event = _event_or_404(db, event_id)
    if event.status != ProgramEventStatus.published:
        raise HTTPException(404, "Event not found")
    return event


@router.post("", response_model=ProgramEventOut, status_code=201)
def create_program_event(
    body: ProgramEventIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    title, description, venue = _validate_event(body)
    _validate_gallery_event(db, body.gallery_event_id)
    event = ProgramEvent(
        title=title,
        description=description,
        start_date=body.start_date,
        end_date=body.end_date,
        start_time=body.start_time,
        end_time=body.end_time,
        venue=venue,
        status=body.status,
        gallery_event_id=body.gallery_event_id,
        created_by=admin.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=ProgramEventOut)
def update_program_event(
    event_id: int,
    body: ProgramEventIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    event = _event_or_404(db, event_id)
    title, description, venue = _validate_event(body)
    _validate_gallery_event(db, body.gallery_event_id)
    event.title = title
    event.description = description
    event.start_date = body.start_date
    event.end_date = body.end_date
    event.start_time = body.start_time
    event.end_time = body.end_time
    event.venue = venue
    event.status = body.status
    event.gallery_event_id = body.gallery_event_id
    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/poster", response_model=ProgramEventOut)
async def upload_event_poster(
    event_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    event = _event_or_404(db, event_id)
    data = await file.read(MAX_POSTER_BYTES + 1)
    if len(data) > MAX_POSTER_BYTES:
        raise HTTPException(413, "Event poster must be 8 MB or smaller")

    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(415, "Upload a JPEG, PNG, or WebP event poster")
            if image.width * image.height > MAX_POSTER_PIXELS:
                raise HTTPException(413, "Event poster dimensions are too large")
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image = image.convert("RGB")
            image.thumbnail((MAX_POSTER_EDGE, MAX_POSTER_EDGE), Image.Resampling.LANCZOS)
            filename = f"program-event-{event_id}-{uuid4().hex}.webp"
            destination = settings.event_posters_dir / filename
            temporary = destination.with_suffix(".tmp")
            image.save(temporary, format="WEBP", quality=84, method=6)
            os.replace(temporary, destination)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        log.info("Rejected invalid event poster for event %s", event_id)
        raise HTTPException(400, "The uploaded file is not a valid supported image") from exc

    previous_filename = event.poster_filename
    event.poster_filename = filename
    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)
    if previous_filename:
        (settings.event_posters_dir / previous_filename).unlink(missing_ok=True)
    return event


@router.delete("/{event_id}/poster", status_code=204)
def delete_event_poster(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    event = _event_or_404(db, event_id)
    if event.poster_filename:
        (settings.event_posters_dir / event.poster_filename).unlink(missing_ok=True)
        event.poster_filename = None
        event.updated_at = datetime.now(timezone.utc)
        db.commit()
    return Response(status_code=204)


@router.delete("/{event_id}", status_code=204)
def delete_program_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    event = _event_or_404(db, event_id)
    if event.poster_filename:
        (settings.event_posters_dir / event.poster_filename).unlink(missing_ok=True)
    db.delete(event)
    db.commit()
    return Response(status_code=204)
