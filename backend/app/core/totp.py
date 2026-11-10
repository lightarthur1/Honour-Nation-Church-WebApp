import pyotp


def make_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str | None, code: str) -> bool:
    if not secret:
        return False
    try:
        return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)
    except Exception:
        return False


def totp_uri(email: str, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Church Media Gallery")
