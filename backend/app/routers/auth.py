from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password, verify_password

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
        token=str(person.id),
    )


@router.post("/signup", response_model=schemas.DemoLoginOut)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)):
    email = (body.email or "").strip().lower() or None
    phone = (body.phone or "").strip() or None

    existing = None
    if email:
        existing = db.query(models.Person).filter(models.Person.email == email).first()
    if not existing and phone:
        existing = db.query(models.Person).filter(models.Person.phone == phone).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email or phone already exists")

    person = models.Person(
        email=email,
        phone=phone,
        name=body.name.strip(),
        role_primary="family",
        roles="family",
        password_hash=hash_password(body.password),
        profile_code="PENDING",
    )
    db.add(person)
    db.flush()
    person.profile_code = f"L21-{person.id:05d}"
    db.commit()
    db.refresh(person)

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )


@router.post("/login", response_model=schemas.DemoLoginOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    identifier = body.identifier.strip().lower()
    person = (
        db.query(models.Person)
        .filter(or_(models.Person.email == identifier, models.Person.phone == body.identifier.strip()))
        .first()
    )
    if not person or not verify_password(body.password, person.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email/phone or password")
    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )
