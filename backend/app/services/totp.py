import pyotp


def generate_secret() -> str:
    return pyotp.random_base32()


def get_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Moneto")


def verify_code(secret: str, code: str) -> bool:
    """Accepts current and adjacent windows (±30 s) to handle clock skew."""
    return pyotp.TOTP(secret).verify(code, valid_window=1)
