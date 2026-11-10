from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.db.models import AccessRequest, EditedStatus, Event, RequestStatus, Role, User
from app.schemas.api import AccessRequestOut, DecisionIn

router = APIRouter(prefix="/api", tags=["access"])


def _out(db: Session, r: AccessRequest) -> AccessRequestOut:
    ev, u = db.get(Event, r.event_id), db.get(User, r.user_id)
    return AccessRequestOut(id=r.id, event_id=r.event_id, event_title=ev.title if ev else "(deleted)",
                            user_id=r.user_id, user_name=u.full_name, user_email=u.email,
                            status=r.status, created_at=r.created_at, decided_at=r.decided_at)


@router.post("/events/{event_id}/access-requests", response_model=AccessRequestOut, status_code=201)
def request_access(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    if user.role != Role.user:
        raise HTTPException(400, "Staff already have access")
    if not e.edited_archive or e.edited_archive.status != EditedStatus.synced:
        raise HTTPException(409, "High-res files are not available for this event yet")
    existing = db.query(AccessRequest).filter_by(event_id=event_id, user_id=user.id).first()
    if existing:
        if existing.status == RequestStatus.denied:  # allow asking again after a denial
            existing.status, existing.decided_at = RequestStatus.pending, None
            existing.created_at = datetime.now(timezone.utc)
            db.commit()
        return _out(db, existing)
    r = AccessRequest(event_id=event_id, user_id=user.id)
    db.add(r)
    db.commit()
    return _out(db, r)


@router.get("/access-requests", response_model=list[AccessRequestOut])
def list_requests(status: RequestStatus | None = None, db: Session = Depends(get_db),
                  _: User = Depends(require_role(Role.admin))):
    q = db.query(AccessRequest).order_by(AccessRequest.created_at.desc())
    if status:
        q = q.filter_by(status=status)
    return [_out(db, r) for r in q]


@router.post("/access-requests/{request_id}/decision", response_model=AccessRequestOut)
def decide(request_id: int, body: DecisionIn, db: Session = Depends(get_db),
           _: User = Depends(require_role(Role.admin))):
    r = db.get(AccessRequest, request_id)
    if not r:
        raise HTTPException(404, "Request not found")
    r.status = RequestStatus.approved if body.approve else RequestStatus.denied
    r.decided_at = datetime.now(timezone.utc)
    db.commit()
    return _out(db, r)
