from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..posthog_client import get_posthog_client
from ..security import hash_password, verify_password

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import jwt
from jwt import PyJWKClient

router = APIRouter(prefix="/api/auth", tags=["auth"])


# Initialize Security Scheme
security = HTTPBearer(auto_error=True)
optional_security = HTTPBearer(auto_error=False)

# Fetch Secret from environment
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")


# Define Supabase URL
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obnbgnmdrpxoutfuenoi.supabase.co")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# PyJWKClient automatically fetches and caches the public keys using the Key ID (kid)
jwks_client = PyJWKClient(JWKS_URL)


def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    token = credentials.credentials

    # Allow simple numeric tokens for legacy demo testing
    if token.isdigit():
        return {"sub": f"demo-{token}", "email": f"demo{token}@app.com"}

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> models.Person:
    """
    Handles both Demo Tokens (numeric IDs) and Supabase JWTs seamlessly.
    """
    token = credentials.credentials

    # 1. Fallback for Demo Account Logins (e.g., token="1", "2")
    if token.isdigit():
        person = db.query(models.Person).filter(models.Person.id == int(token)).first()
        if person:
            return person

    # 2. Decode Supabase JWT Token
    payload = verify_supabase_token(credentials)
    supabase_user_id = payload.get("sub")
    email = payload.get("email")

    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token payload."
        )

    # Look up user in database
    person = (
        db.query(models.Person)
        .filter(
            or_(
                models.Person.supabase_user_id == supabase_user_id,
                models.Person.email == email,
            )
        )
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User authenticated with Supabase, but profile missing in database.",
        )

    return person


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

@router.get("/login", response_model=schemas.PersonOut)
def sync_supabase_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
):
    """
    Called by the frontend after Supabase Login.
    Verifies the JWT, creates the local SQLite record if it doesn't exist,
    tracks analytics, and returns the Person profile.
    """
    payload = verify_supabase_token(credentials)
    supabase_user_id = payload.get("sub")
    email = payload.get("email")

    if not supabase_user_id:
        raise HTTPException(status_code=401, detail="Malformed token")

    # 1. Look up existing user
    person = db.query(models.Person).filter(
        or_(
            models.Person.supabase_user_id == supabase_user_id,
            models.Person.email == email
        )
    ).first()

    now = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)

    # 2. If user exists, link ID if missing & update login metrics
    if person:
        if not person.supabase_user_id:
            person.supabase_user_id = supabase_user_id
        handle_successful_login(person, db, client_ip)
        client = get_posthog_client()
        if client:
            client.capture("login_completed", properties={"login_method": "supabase"})

    # 3. If first-time Supabase user, auto-create in SQLite DB!
    else:
        person = models.Person(
            supabase_user_id=supabase_user_id,
            email=email,
            name=email.split("@")[0] if email else "User",
            role_primary="family",
            roles="family",
            profile_code="PENDING",
            login_count=1,
            failed_login_count=0,
            current_login_at=now,
            last_login_at=now,
            last_login_ip=client_ip,
        )
        db.add(person)
        db.flush()
        person.profile_code = f"L21-{person.id:05d}"
        db.commit()
        db.refresh(person)

        client = get_posthog_client()
        if client:
            client.capture("account_created", properties={"signup_method": "supabase"})

    identify_person(person)
    return schemas.PersonOut.model_validate(person)


# @router.post("/signup", response_model=schemas.DemoLoginOut)
# def signup(body: schemas.SignupIn, request: Request, db: Session = Depends(get_db)):
#     email = (body.email or "").strip().lower() or None
#     phone = (body.phone or "").strip() or None

#     existing = None
#     if email:
#         existing = db.query(models.Person).filter(models.Person.email == email).first()
#     if not existing and phone:
#         existing = db.query(models.Person).filter(models.Person.phone == phone).first()
#     if existing:
#         raise HTTPException(
#             status_code=409, detail="An account with that email or phone already exists"
#         )

#     now = datetime.now(timezone.utc)
#     client_ip = get_client_ip(request)

#     person = models.Person(
#         email=email,
#         phone=phone,
#         name=body.name.strip(),
#         role_primary="family",
#         roles="family",
#         password_hash=hash_password(body.password),
#         profile_code="PENDING",
#         # Initialize login tracking metrics on account creation
#         login_count=1,
#         failed_login_count=0,
#         current_login_at=now,
#         last_login_at=now,
#         last_login_ip=client_ip,
#     )
#     db.add(person)
#     db.flush()
#     person.profile_code = f"L21-{person.id:05d}"
#     db.commit()
#     db.refresh(person)

#     identify_person(person)
#     client = get_posthog_client()
#     if client:
#         client.capture("account_created", properties={"signup_method": "password"})

#     return schemas.DemoLoginOut(
#         person=schemas.PersonOut.model_validate(person),
#         token=str(person.id),
#     )


# @router.post("/login", response_model=schemas.DemoLoginOut)
# def login(body: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
#     identifier = body.identifier.strip().lower()
#     person = (
#         db.query(models.Person)
#         .filter(
#             or_(
#                 models.Person.email == identifier,
#                 models.Person.phone == body.identifier.strip(),
#             )
#         )
#         .first()
#     )

#     # 1. Check if account is currently locked out
#     now = datetime.now(timezone.utc)
#     if person and person.locked_until and person.locked_until > now:
#         raise HTTPException(
#             status_code=403,
#             detail="Account temporarily locked due to multiple failed login attempts. Please try again later.",
#         )

#     # 2. Verify password credentials
#     if not person or not verify_password(body.password, person.password_hash):
#         handle_failed_login(person, db)
#         raise HTTPException(status_code=401, detail="Wrong email/phone or password")

#     # 3. Successful login
#     client_ip = get_client_ip(request)
#     handle_successful_login(person, db, client_ip)

#     identify_person(person)
#     client = get_posthog_client()
#     if client:
#         client.capture("login_completed", properties={"login_method": "password"})

#     return schemas.DemoLoginOut(
#         person=schemas.PersonOut.model_validate(person),
#         token=str(person.id),
#     )
