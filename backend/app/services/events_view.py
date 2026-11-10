"""Shared helpers that turn ORM rows into API shapes and apply access rules."""
from pathlib import PurePosixPath

from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.db.models import (AccessRequest, EditedStatus, Event, PreviewImage,
                           RequestStatus, Role, User)
from app.schemas.api import EditedOut, EventOut, RawOut, UserOut
from app.services import drive_service


def preview_url(p: PreviewImage) -> str:
    rel = PurePosixPath(p.relative_path.replace("\\", "/")).relative_to("storage/previews")
    return f"/previews/{rel}"


def is_assigned_editor(user: User, event: Event) -> bool:
    return user.role == Role.editor and any(a.editor_id == user.id for a in event.assignments)


def can_manage_media(user: User, event: Event) -> bool:
    """Admin, or the Editor assigned to this event."""
    return user.role == Role.admin or is_assigned_editor(user, event)


def can_download_edited(db: Session, user: User, event: Event) -> bool:
    if can_manage_media(user, event):
        return True
    return db.query(AccessRequest).filter_by(
        event_id=event.id, user_id=user.id, status=RequestStatus.approved).first() is not None


def event_out(db: Session, e: Event) -> EventOut:
    previews = db.query(PreviewImage).filter_by(event_id=e.id).order_by(PreviewImage.id).all()
    edited = None
    if e.edited_archive:
        edited = EditedOut.model_validate(e.edited_archive)
        edited.synced = e.edited_archive.status == EditedStatus.synced
        edited.drive_progress = drive_service.PROGRESS.get(e.id)
    editors = [db.get(User, a.editor_id) for a in e.assignments]
    return EventOut(
        id=e.id, title=e.title, description=e.description, event_date=e.event_date,
        editors=[UserOut.model_validate(u) for u in editors if u],
        raw=RawOut.model_validate(e.raw_archive) if e.raw_archive else None,
        edited=edited, preview_count=len(previews),
        cover_url=preview_url(previews[0]) if previews else None,
    )
