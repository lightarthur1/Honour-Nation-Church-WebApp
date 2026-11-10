from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.db.models import Announcement, AnnouncementStatus, Role, User
from app.schemas.api import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


def _ordered_announcements(db: Session):
    return db.query(Announcement).order_by(
        Announcement.is_pinned.desc(),
        Announcement.published_at.desc(),
        Announcement.created_at.desc(),
    )


@router.get("", response_model=list[AnnouncementOut])
def public_announcements(db: Session = Depends(get_db)):
    return _ordered_announcements(db).filter_by(status=AnnouncementStatus.published).all()


@router.get("/admin", response_model=list[AnnouncementOut])
def admin_announcements(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return _ordered_announcements(db).all()


@router.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    body: AnnouncementIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    title = body.title.strip()
    content = body.content.strip()
    if len(title) < 2 or len(content) < 2:
        raise HTTPException(422, "Title and announcement content must contain at least two non-space characters")
    published_at = datetime.now(timezone.utc) if body.status == AnnouncementStatus.published else None
    announcement = Announcement(
        title=title,
        content=content,
        status=body.status,
        is_pinned=body.is_pinned,
        created_by=admin.id,
        published_at=published_at,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.put("/{announcement_id}", response_model=AnnouncementOut)
def update_announcement(
    announcement_id: int,
    body: AnnouncementIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(404, "Announcement not found")
    title = body.title.strip()
    content = body.content.strip()
    if len(title) < 2 or len(content) < 2:
        raise HTTPException(422, "Title and announcement content must contain at least two non-space characters")
    if announcement.status != AnnouncementStatus.published and body.status == AnnouncementStatus.published:
        announcement.published_at = datetime.now(timezone.utc)
    elif body.status == AnnouncementStatus.draft:
        announcement.published_at = None
    announcement.title = title
    announcement.content = content
    announcement.status = body.status
    announcement.is_pinned = body.is_pinned
    announcement.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}", status_code=204)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(404, "Announcement not found")
    db.delete(announcement)
    db.commit()
    return Response(status_code=204)
