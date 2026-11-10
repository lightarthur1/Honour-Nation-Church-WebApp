import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.db.models import Role, StreamItem, StreamStatus, User
from app.schemas.api import StreamItemIn, StreamItemOut

router = APIRouter(prefix="/api/stream-items", tags=["live-streams-and-videos"])
log = logging.getLogger("stream_items")


def _ordered_items(db: Session):
    return db.query(StreamItem).order_by(
        StreamItem.scheduled_at.desc(),
        StreamItem.created_at.desc(),
    )


def _item_or_404(db: Session, item_id: int) -> StreamItem:
    item = db.get(StreamItem, item_id)
    if not item:
        raise HTTPException(404, "Live stream or video not found")
    return item


def _validated_values(body: StreamItemIn) -> tuple[str, str]:
    title = body.title.strip()
    description = body.description.strip()
    if len(title) < 2:
        raise HTTPException(422, "Title must contain at least two non-space characters")
    return title, description


@router.get("", response_model=list[StreamItemOut])
def public_stream_items(db: Session = Depends(get_db)):
    return _ordered_items(db).filter_by(status=StreamStatus.published).all()


@router.get("/admin", response_model=list[StreamItemOut])
def admin_stream_items(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return _ordered_items(db).all()


@router.post("", response_model=StreamItemOut, status_code=201)
def create_stream_item(
    body: StreamItemIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    title, description = _validated_values(body)
    item = StreamItem(
        title=title,
        description=description,
        provider=body.provider,
        kind=body.kind,
        url=body.url,
        scheduled_at=body.scheduled_at.astimezone(timezone.utc) if body.scheduled_at else None,
        status=body.status,
        created_by=admin.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=StreamItemOut)
def update_stream_item(
    item_id: int,
    body: StreamItemIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    item = _item_or_404(db, item_id)
    title, description = _validated_values(body)
    item.title = title
    item.description = description
    item.provider = body.provider
    item.kind = body.kind
    item.url = body.url
    item.scheduled_at = body.scheduled_at.astimezone(timezone.utc) if body.scheduled_at else None
    item.status = body.status
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_stream_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    item = _item_or_404(db, item_id)
    db.delete(item)
    db.commit()
    log.info("Deleted streaming item %s", item_id)
    return Response(status_code=204)
