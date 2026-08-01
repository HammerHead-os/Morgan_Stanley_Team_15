import datetime
import os

import bcrypt
import jwt

JWT_SECRET = os.environ.get("LOVE21_JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 14  # 2 weeks


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(person_id: int) -> str:
    payload = {
        "sub": str(person_id),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return int(payload["sub"])
    except Exception:
        return None
