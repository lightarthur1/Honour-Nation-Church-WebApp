import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.db.models import Notice, NoticeStatus, Role, User
from app.schemas.api import NoticeIn, NoticeOut

router = APIRouter(prefix="/api/notices", tags=["notice-board"])
log = logging.getLogger("notices")


def _ordered_notices(db: Session):
    return db.query(Notice).order_by(
        Notice.is_pinned.desc(),
        Notice.created_at.desc(),
        Notice.id.desc(),
    )


def _notice_or_404(db: Session, notice_id: int) -> Notice:
    notice = db.get(Notice, notice_id)
    if not notice:
        raise HTTPException(404, "Notice not found")
    return notice


def _validated_text(body: NoticeIn) -> tuple[str, str]:
    title = body.title.strip()
    content = body.content.strip()
    if len(title) < 2 or len(content) < 2:
        raise HTTPException(422, "Notice title and content must contain at least two non-space characters")
    if body.expires_on and body.expires_on < date.today():
        raise HTTPException(422, "Expiry date cannot be in the past")
    return title, content


@router.get("", response_model=list[NoticeOut])
def public_notices(db: Session = Depends(get_db)):
    today = date.today()
    return _ordered_notices(db).filter(
        Notice.status == NoticeStatus.published,
        or_(Notice.expires_on.is_(None), Notice.expires_on >= today),
    ).all()


@router.get("/admin", response_model=list[NoticeOut])
def admin_notices(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return _ordered_notices(db).all()


@router.post("", response_model=NoticeOut, status_code=201)
def create_notice(
    body: NoticeIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    title, content = _validated_text(body)
    notice = Notice(
        title=title,
        content=content,
        category=body.category,
        status=body.status,
        is_pinned=body.is_pinned,
        expires_on=body.expires_on,
        created_by=admin.id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@router.put("/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: int,
    body: NoticeIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    notice = _notice_or_404(db, notice_id)
    title, content = _validated_text(body)
    notice.title = title
    notice.content = content
    notice.category = body.category
    notice.status = body.status
    notice.is_pinned = body.is_pinned
    notice.expires_on = body.expires_on
    notice.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notice)
    return notice


@router.delete("/{notice_id}", status_code=204)
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    notice = _notice_or_404(db, notice_id)
    db.delete(notice)
    db.commit()
    log.info("Deleted notice %s", notice_id)
    return Response(status_code=204)
