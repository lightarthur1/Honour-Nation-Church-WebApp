from fastapi import APIRouter
from sqlalchemy import func

from app.core.deps import DB, AdminUser
from app.db.models import AccessRequest, AccessStatus, Event, RawArchive, Role, User
from app.services import drive_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/drive/status")
def drive_status(_admin: AdminUser):
    """Validates the Google Drive setup (key file, folder id, Shared Drive membership)."""
    return drive_service.check_connection()


@router.get("/stats")
def stats(db: DB, _admin: AdminUser):
    by_role = dict(db.query(User.role, func.count()).group_by(User.role).all())
    raw_bytes = (
        db.query(func.coalesce(func.sum(RawArchive.size_bytes), 0))
        .filter(RawArchive.deleted_at.is_(None))
        .scalar()
    )
    return {
        "users": {role.value: by_role.get(role, 0) for role in Role},
        "events": db.query(Event).count(),
        "raw_bytes_on_server": int(raw_bytes),
        "pending_access_requests": db.query(AccessRequest)
        .filter(AccessRequest.status == AccessStatus.PENDING)
        .count(),
    }
