from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_token


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return authorization


def get_current_person(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.Person:
    token = _extract_token(authorization)
    person_id = decode_token(token) if token else None
    if person_id is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(status_code=401, detail="Unknown user")
    return person


def optional_person(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.Person | None:
    token = _extract_token(authorization)
    person_id = decode_token(token) if token else None
    if person_id is None:
        return None
    return db.get(models.Person, person_id)


def require_staff(person: models.Person = Depends(get_current_person)) -> models.Person:
    if not person.is_staff:
        raise HTTPException(status_code=403, detail="Staff only")
    return person
