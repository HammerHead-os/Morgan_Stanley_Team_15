from datetime import datetime, timezone, timedelta
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..posthog_client import get_posthog_client
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# --- Helper Functions for Login Tracking ---


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP, preferring reverse proxy headers if available."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def handle_successful_login(
    person: models.Person, db: Session, client_ip: Optional[str]
) -> None:
    """Updates counters and login timestamps on successful authentication."""
    now = datetime.now(timezone.utc)

    # Cycle current -> last login timestamp
    person.last_login_at = person.current_login_at or now
    person.current_login_at = now

    # Increment counter & reset failures/locks
    person.login_count = (person.login_count or 0) + 1
    person.failed_login_count = 0
    person.locked_until = None
    person.last_login_ip = client_ip

    print(person.login_count)

    db.commit()


def handle_failed_login(person: Optional[models.Person], db: Session) -> None:
    """Increments failed attempt counters and locks account if threshold is met."""
    if not person:
        return

    now = datetime.now(timezone.utc)
    person.failed_login_count = (person.failed_login_count or 0) + 1

    # Lock account for 15 minutes after 5 consecutive failures
    if person.failed_login_count >= 5:
        person.locked_until = now + timedelta(minutes=15)

    db.commit()


def identify_person(person: models.Person) -> None:
    """Set safe person properties when authentication establishes an identity."""
    client = get_posthog_client()
    if client is None:
        return

    client.identify_context(str(person.id))
    client.set(
        distinct_id=str(person.id),
        properties={
            "email": person.email,
            "name": person.name,
            "role_primary": person.role_primary,
            "roles": person.roles,
            "language": person.language,
        },
    )


DEMO_ACCOUNTS = {
    "carer@chen.demo": "Jamie · Mom (family + volunteer + donor)",
    "dad@chen.demo": "Chris · Dad (family + donor)",
    "alex@chen.demo": "Alex · Child member",
    "donor@demo.love21": "Sam · Donor + volunteer",
    "volunteer@demo.love21": "Taylor · Volunteer + donor",
}


@router.get("/demo-accounts")
def list_demo_accounts():
    return [{"email": email, "label": label} for email, label in DEMO_ACCOUNTS.items()]


@router.post("/demo-login", response_model=schemas.DemoLoginOut)
def demo_login(
    body: schemas.DemoLoginIn, request: Request, db: Session = Depends(get_db)
):
    person = db.query(models.Person).filter(models.Person.email == body.email).first()
    if not person:
        raise HTTPException(status_code=404, detail="Demo account not found")

    # Track login data
    client_ip = get_client_ip(request)
    handle_successful_login(person, db, client_ip)

    identify_person(person)
    client = get_posthog_client()
    if client:
        client.capture(
            "demo_login_completed", properties={"login_method": "demo_account"}
        )

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )


@router.post("/signup", response_model=schemas.DemoLoginOut)
def signup(body: schemas.SignupIn, request: Request, db: Session = Depends(get_db)):
    email = (body.email or "").strip().lower() or None
    phone = (body.phone or "").strip() or None

    existing = None
    if email:
        existing = db.query(models.Person).filter(models.Person.email == email).first()
    if not existing and phone:
        existing = db.query(models.Person).filter(models.Person.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="An account with that email or phone already exists"
        )

    now = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)

    person = models.Person(
        email=email,
        phone=phone,
        name=body.name.strip(),
        role_primary="family",
        roles="family",
        password_hash=hash_password(body.password),
        profile_code="PENDING",
        # Initialize login tracking metrics on account creation
        login_count=1,
        failed_login_count=0,
        current_login_at=now,
        last_login_at=now,
        last_login_ip=client_ip,
    )
    db.add(person)
    db.flush()
    person.profile_code = f"L21-{person.id:05d}"

    # Every account gets its own household immediately — joining a
    # different one later happens via an invite code, not by starting
    # without one (see /api/family/join).
    household = models.Household(
        name=f"{person.name}'s household", carer_person_id=person.id
    )
    db.add(household)
    db.flush()
    person.household_id = household.id

    # Without this, PATCH /api/prefs 404s forever for this account — there's
    # no row to update — and email opt-outs/reminders can't be honored.
    db.add(
        models.CommPreferences(
            person_id=person.id,
            email_on=True,
            sms_on=False,
            whatsapp_on=False,
            opt_out_token=secrets.token_urlsafe(16),
        )
    )

    db.commit()
    db.refresh(person)

    identify_person(person)
    client = get_posthog_client()
    if client:
        client.capture("account_created", properties={"signup_method": "password"})

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )


@router.post("/login", response_model=schemas.DemoLoginOut)
def login(body: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
    identifier = body.identifier.strip().lower()
    person = (
        db.query(models.Person)
        .filter(
            or_(
                models.Person.email == identifier,
                models.Person.phone == body.identifier.strip(),
            )
        )
        .first()
    )

    # 1. Check if account is currently locked out
    now = datetime.now(timezone.utc)
    if person and person.locked_until and person.locked_until > now:
        raise HTTPException(
            status_code=403,
            detail="Account temporarily locked due to multiple failed login attempts. Please try again later.",
        )

    # 2. Verify password credentials
    if not person or not verify_password(body.password, person.password_hash):
        handle_failed_login(person, db)
        raise HTTPException(status_code=401, detail="Wrong email/phone or password")

    # 3. Successful login
    client_ip = get_client_ip(request)
    handle_successful_login(person, db, client_ip)

    identify_person(person)
    client = get_posthog_client()
    if client:
        client.capture("login_completed", properties={"login_method": "password"})

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )


@router.post("/claim", response_model=schemas.DemoLoginOut)
def claim_account(
    body: schemas.ClaimAccountIn, request: Request, db: Session = Depends(get_db)
):
    """Activate login on a person record created via 'Add someone' — for
    someone who didn't have their own account yet when a household member
    added them. Sets a password on the existing Person row; never creates a
    new one."""
    invite = (
        db.query(models.HouseholdInvite)
        .filter(models.HouseholdInvite.code == body.code)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != "pending":
        raise HTTPException(status_code=409, detail="This invite has already been used")
    if invite.expires_at < datetime.utcnow():
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=409, detail="This invite has expired")
    if not invite.invited_person_id:
        raise HTTPException(
            status_code=400, detail="This invite isn't for creating a new account"
        )

    person = db.get(models.Person, invite.invited_person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Account not found")
    if person.password_hash:
        raise HTTPException(
            status_code=409, detail="This account is already active — log in instead"
        )

    now = datetime.now(timezone.utc)
    person.password_hash = hash_password(body.password)
    person.login_count = (person.login_count or 0) + 1
    person.current_login_at = now
    person.last_login_at = now
    person.last_login_ip = get_client_ip(request)
    invite.status = "accepted"
    invite.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(person)

    identify_person(person)
    client = get_posthog_client()
    if client:
        client.capture("account_claimed")

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )
