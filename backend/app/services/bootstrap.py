import logging

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Role, User
from app.db.session import SessionLocal

log = logging.getLogger(__name__)


def ensure_first_admin() -> None:
    """Create the initial admin from env vars when the system has no admin yet."""
    if not settings.first_admin_email or not settings.first_admin_password:
        return
    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == Role.ADMIN).first():
            return
        email = settings.first_admin_email.strip().lower()
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.role = Role.ADMIN
        else:
            db.add(
                User(
                    email=email,
                    full_name=settings.first_admin_name,
                    hashed_password=hash_password(settings.first_admin_password),
                    role=Role.ADMIN,
                )
            )
        db.commit()
        log.warning("Created first admin %s. Change this password after logging in.", email)
    finally:
        db.close()
