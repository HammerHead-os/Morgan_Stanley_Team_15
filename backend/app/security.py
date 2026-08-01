"""Password hashing — stdlib PBKDF2, no extra dependency."""

import hashlib
import hmac
import secrets

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or "$" not in stored:
        return False
    salt, _, hex_digest = stored.partition("$")
    try:
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS)
    except ValueError:
        return False
    return hmac.compare_digest(digest.hex(), hex_digest)
