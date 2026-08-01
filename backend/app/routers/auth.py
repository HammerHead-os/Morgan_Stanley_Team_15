from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import create_token, hash_password, verify_password
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_ACCOUNTS = {
    "carer@chen.demo": "Jamie · Mom (family + volunteer + donor)",
    "dad@chen.demo": "Chris · Dad (family + donor)",
    "alex@chen.demo": "Alex · Child member",
    "donor@demo.love21": "Sam · Donor + volunteer",
    "volunteer@demo.love21": "Taylor · Volunteer + donor",
}


@router.get("/demo-accounts")
def list_demo_accounts():
    return [
        {"email": email, "label": label} for email, label in DEMO_ACCOUNTS.items()
    ]


@router.post("/demo-login", response_model=schemas.DemoLoginOut)
def demo_login(body: schemas.DemoLoginIn, db: Session = Depends(get_db)):
    person = db.query(models.Person).filter(models.Person.email == body.email).first()
    if not person:
        raise HTTPException(status_code=404, detail="Demo account not found")
    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=create_token(person.id),
    )


CONTEXT_ROLE = {"family": "family", "volunteer": "volunteer", "donor": "donor"}


def _new_profile_code(person_id: int) -> str:
    return f"L21-HK-{9000 + person_id}"


def _seed_prefs(db: Session, person_id: int) -> None:
    db.add(
        models.CommPreferences(
            person_id=person_id, email_on=True, sms_on=False, whatsapp_on=False,
            opt_out_token=secrets.token_urlsafe(16),
        )
    )


@router.post("/register", response_model=schemas.AuthOut)
def register_account(body: schemas.RegisterAccountIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.query(models.Person).filter(models.Person.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    role = CONTEXT_ROLE.get(body.context or "", "family")
    household_id = None
    if role == "family":
        household = models.Household(name=f"{body.name}'s household")
        db.add(household)
        db.flush()
        household_id = household.id

    person = models.Person(
        email=email, name=body.name, role_primary=role, language="both",
        phone=body.phone, password_hash=hash_password(body.password),
        auth_provider="password", household_id=household_id, profile_code="TEMP",
    )
    db.add(person)
    db.flush()
    person.profile_code = _new_profile_code(person.id)
    if household_id:
        db.get(models.Household, household_id).carer_person_id = person.id
    _seed_prefs(db, person.id)
    db.commit()
    db.refresh(person)
    return schemas.AuthOut(person=schemas.PersonOut.model_validate(person), token=create_token(person.id))


@router.post("/login", response_model=schemas.AuthOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    person = db.query(models.Person).filter(models.Person.email == body.email.strip().lower()).first()
    if not person or not verify_password(body.password, person.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return schemas.AuthOut(person=schemas.PersonOut.model_validate(person), token=create_token(person.id))


@router.post("/google", response_model=schemas.AuthOut)
def google_login(body: schemas.GoogleLoginIn, db: Session = Depends(get_db)):
    import os
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    client_id = os.environ.get("LOVE21_GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=501, detail="Google sign-in isn't configured on this server")
    try:
        info = google_id_token.verify_oauth2_token(body.credential, google_requests.Request(), audience=client_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in")

    email = (info.get("email") or "").lower()
    name = info.get("name") or email.split("@")[0]
    sub = info.get("sub")

    person = db.query(models.Person).filter(models.Person.email == email).first()
    if not person:
        household = models.Household(name=f"{name}'s household")
        db.add(household)
        db.flush()
        person = models.Person(
            email=email, name=name, role_primary="family", language="both",
            auth_provider="google", google_sub=sub, household_id=household.id, profile_code="TEMP",
        )
        db.add(person)
        db.flush()
        person.profile_code = _new_profile_code(person.id)
        household.carer_person_id = person.id
        _seed_prefs(db, person.id)
    elif not person.google_sub:
        person.google_sub = sub

    db.commit()
    db.refresh(person)
    return schemas.AuthOut(person=schemas.PersonOut.model_validate(person), token=create_token(person.id))
