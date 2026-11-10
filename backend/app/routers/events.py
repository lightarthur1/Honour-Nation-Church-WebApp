from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_role
from app.db.models import EditorAssignment, Event, Role, User
from app.schemas.api import EditorsIn, EventIn, EventOut
from app.services import storage_service
from app.services.events_view import can_manage_media, event_out

router = APIRouter(prefix="/api/events", tags=["events"])


def get_event_or_404(db: Session, event_id: int) -> Event:
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    return e


@router.post("", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db),
                 admin: User = Depends(require_role(Role.admin))):
    e = Event(title=body.title.strip(), description=body.description.strip(),
              event_date=body.event_date, created_by=admin.id)
    db.add(e)
    db.commit()
    return event_out(db, e)


@router.get("", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db),
                user: User = Depends(require_role(Role.admin, Role.editor))):
    q = db.query(Event).order_by(Event.event_date.desc(), Event.id.desc())
    events = q.all()
    if user.role == Role.editor:
        events = [e for e in events if can_manage_media(user, e)]
    return [event_out(db, e) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db),
              user: User = Depends(require_role(Role.admin, Role.editor))):
    e = get_event_or_404(db, event_id)
    if not can_manage_media(user, e):
        raise HTTPException(403, "You are not assigned to this event")
    return event_out(db, e)


@router.put("/{event_id}/editors", response_model=EventOut)
def assign_editors(event_id: int, body: EditorsIn, db: Session = Depends(get_db),
                   _: User = Depends(require_role(Role.admin))):
    e = get_event_or_404(db, event_id)
    ids = set(body.editor_ids)
    valid = {u.id for u in db.query(User).filter(User.id.in_(ids), User.role == Role.editor)} if ids else set()
    if valid != ids:
        raise HTTPException(400, "All assigned users must have the Editor role")
    e.assignments.clear()
    db.flush()
    for uid in ids:
        e.assignments.append(EditorAssignment(editor_id=uid))
    db.commit()
    db.refresh(e)
    return event_out(db, e)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db),
                 _: User = Depends(require_role(Role.admin))):
    e = get_event_or_404(db, event_id)
    storage_service.remove_tree(settings.previews_dir / str(e.id))
    storage_service.remove_tree(settings.raw_dir / str(e.id))
    storage_service.remove_tree(settings.edited_images_dir / str(e.id))
    (settings.edited_tmp_dir / f"event_{e.id}.zip").unlink(missing_ok=True)
    db.delete(e)
    db.commit()
