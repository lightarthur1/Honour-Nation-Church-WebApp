from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import DefaultDict

from fastapi import HTTPException, Request

from app.core.config import settings

_LOCK = threading.Lock()
_FAILED_LOGINS: DefaultDict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    if settings.TRUST_PROXY and request.headers.get("x-forwarded-for"):
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _key(ip: str, email: str) -> str:
    return f"{ip}:{email.lower()}"


def check_login_rate_limit(request: Request, email: str) -> None:
    ip = _client_ip(request)
    key = _key(ip, email)
    now = time.time()
    window = 15 * 60
    with _LOCK:
        attempts = [ts for ts in _FAILED_LOGINS.get(key, []) if now - ts < window]
        if len(attempts) >= 5:
            retry_after = max(1, int(window - (now - attempts[0])))
            raise HTTPException(status_code=429, detail="Too many failed login attempts", headers={"Retry-After": str(retry_after)})
        _FAILED_LOGINS[key] = attempts


def record_failed_login(request: Request, email: str) -> None:
    ip = _client_ip(request)
    key = _key(ip, email)
    now = time.time()
    with _LOCK:
        attempts = [ts for ts in _FAILED_LOGINS.get(key, []) if now - ts < 15 * 60]
        attempts.append(now)
        _FAILED_LOGINS[key] = attempts


def clear_failed_login(request: Request, email: str | None = None) -> None:
    ip = _client_ip(request)
    with _LOCK:
        if email:
            _FAILED_LOGINS.pop(_key(ip, email), None)
        else:
            for key in list(_FAILED_LOGINS):
                if key.startswith(f"{ip}:"):
                    _FAILED_LOGINS.pop(key, None)
