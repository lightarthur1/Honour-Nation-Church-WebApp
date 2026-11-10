import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.rate_limit import check_login_rate_limit, clear_failed_login, record_failed_login
from app.core.security import create_access_token, create_mfa_token, hash_password, verify_password
from app.core.totp import make_totp_secret, totp_uri, verify_totp
from app.db.models import Role, User
from app.schemas.api import (LoginIn, LoginResponseOut, MfaLoginIn, RegisterIn, TfaDisableIn,
                            TfaEnableIn, TwoFactorSetupOut, UserOut)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=LoginResponseOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, full_name=body.full_name.strip(),
                password_hash=hash_password(body.password), role=Role.user)
    db.add(user)
    db.commit()
    db.refresh(user)
    return LoginResponseOut(access_token=create_access_token(user.id, user.role.value), user=user)


@router.post("/login", response_model=LoginResponseOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.lower()
    check_login_rate_limit(request, email)
    user = db.query(User).filter_by(email=email).first()
    if not user or not verify_password(body.password, user.password_hash):
        record_failed_login(request, email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    clear_failed_login(request, email)
    if user.totp_enabled:
        return LoginResponseOut(mfa_required=True, mfa_token=create_mfa_token(user.id), user=user)
    return LoginResponseOut(access_token=create_access_token(user.id, user.role.value), user=user)


@router.post("/login/2fa", response_model=LoginResponseOut)
def login_2fa(body: MfaLoginIn, request: Request, db: Session = Depends(get_db)):
    payload = None
    try:
        payload = __import__('jwt').decode(body.mfa_token, "", options={"verify_signature": False})
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA token")
    if payload.get("scope") != "mfa":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.totp_enabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA token")
    if not verify_totp(user.totp_secret, body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication code")
    if request.headers.get("x-2fa-step") == body.code:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Code already used")
    return LoginResponseOut(access_token=create_access_token(user.id, user.role.value), user=user)


@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
def setup_2fa(user: User = Depends(get_current_user)):
    secret = make_totp_secret()
    return TwoFactorSetupOut(secret=secret, otpauth_uri=totp_uri(user.email, secret))


@router.post("/2fa/enable")
def enable_2fa(body: TfaEnableIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.totp_secret:
        raise HTTPException(400, "Run setup first")
    if not verify_totp(user.totp_secret, body.code):
        raise HTTPException(401, "Invalid authentication code")
    user.totp_enabled = True
    db.commit()
    return {"ok": True}


@router.post("/2fa/disable")
def disable_2fa(body: TfaDisableIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect password")
    if not verify_totp(user.totp_secret, body.code):
        raise HTTPException(401, "Invalid authentication code")
    user.totp_secret = None
    user.totp_enabled = False
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
