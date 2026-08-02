from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .roles_util import has_role


def get_current_person(
    x_demo_token: str | None = Header(default=None, alias="X-Demo-Token"),
    db: Session = Depends(get_db),
) -> models.Person:
    """Hackathon auth: token is the person id (from POST /api/auth/demo-login)."""
    if not x_demo_token:
        raise HTTPException(status_code=401, detail="Missing X-Demo-Token header")
    try:
        person_id = int(x_demo_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(status_code=401, detail="Unknown user")
    return person


def optional_person(
    x_demo_token: str | None = Header(default=None, alias="X-Demo-Token"),
    db: Session = Depends(get_db),
) -> models.Person | None:
    if not x_demo_token:
        return None
    try:
        person_id = int(x_demo_token)
    except ValueError:
        return None
    return db.get(models.Person, person_id)


def require_admin(
    person: models.Person = Depends(get_current_person),
) -> models.Person:
    if not has_role(person, "admin"):
        raise HTTPException(status_code=403, detail="Staff access only")
    return person
