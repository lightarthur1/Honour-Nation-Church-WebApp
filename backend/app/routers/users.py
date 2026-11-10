from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.db.models import Role, User
from app.schemas.api import RoleIn, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/{user_id}/role", response_model=UserOut)
def set_role(user_id: int, body: RoleIn, db: Session = Depends(get_db),
             admin: User = Depends(require_role(Role.admin))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and body.role != Role.admin:
        raise HTTPException(400, "You cannot remove your own admin role")
    user.role = body.role
    db.commit()
    return user
