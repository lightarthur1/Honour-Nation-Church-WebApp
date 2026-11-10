from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

ALGO = "HS256"
USED_DOWNLOAD_TICKETS: set[str] = set()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_access_token(user_id: int, role: str) -> str:
    minutes = settings.ADMIN_TOKEN_MINUTES if role == "admin" else settings.EDITOR_TOKEN_MINUTES if role == "editor" else settings.USER_TOKEN_MINUTES
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, settings.SECRET_KEY, ALGO)


def create_mfa_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.MFA_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "scope": "mfa", "exp": exp}, settings.SECRET_KEY, ALGO)


def create_download_ticket(event_id: int, kind: str, user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(seconds=60)
    payload = {"sub": str(user_id), "scope": "download", "event_id": event_id, "kind": kind, "exp": exp}
    return jwt.encode(payload, settings.SECRET_KEY, ALGO)


def verify_download_ticket(token: str) -> dict:
    if token in USED_DOWNLOAD_TICKETS:
        raise ValueError("Download ticket has already been used")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid download ticket") from exc
    if payload.get("scope") != "download":
        raise ValueError("Invalid download ticket")
    if payload.get("kind") not in {"raw", "edited"}:
        raise ValueError("Invalid download ticket")
    USED_DOWNLOAD_TICKETS.add(token)
    return payload


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
