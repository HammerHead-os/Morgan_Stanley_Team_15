from datetime import datetime, timezone, timedelta
from typing import Optional
import os

from fastapi import APIRouter, Depends, HTTPException, Request, Security, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..posthog_client import get_posthog_client

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Initialize Security Schemes
security = HTTPBearer(auto_error=True)
optional_security = HTTPBearer(auto_error=False)

# Environment configuration
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obnbgnmdrpxoutfuenoi.supabase.co")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# Dynamic JWKS Key Client (caches public keys automatically)
jwks_client = PyJWKClient(JWKS_URL)


def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Verifies incoming Supabase JWT against Supabase JWKS / Secret."""
    token = credentials.credentials

    # Legacy numeric token handler for demo testing
    if token.isdigit():
        return {"sub": f"demo-{token}", "email": f"demo{token}@app.com"}

    # 1. Primary verification using Supabase JWKS (RS256 / ES256)
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
    except Exception as primary_error:
        # 2. Fallback verification using static SUPABASE_JWT_SECRET (HS256)
        if SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_aud": True},
                )
                return payload
            except Exception:
                pass

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(primary_error)}",
        )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: Session = Depends(get_db),
) -> models.Person:
    """
    FastAPI dependency: Authenticates via Supabase JWT (Bearer) OR X-Demo-Token header,
    then resolves the local SQLite Person record.
    """
    # 1. Extract token from Header or Bearer Credentials
    demo_header = request.headers.get("X-Demo-Token")
    token = None

    if demo_header:
        token = demo_header
    elif credentials and credentials.credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization credentials.",
        )

    # 2. Handle numeric demo tokens (e.g. X-Demo-Token: 1 or Bearer 1)
    if token.isdigit():
        person = db.query(models.Person).filter(models.Person.id == int(token)).first()
        if not person:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo user not found in local database.",
            )
        return person

    # 3. Verify Supabase JWT Payload
    auth_credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    payload = verify_supabase_token(auth_credentials)
    supabase_user_id = payload.get("sub")
    email = payload.get("email")

    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token payload."
        )

    # 4. Look up user profile in SQLite DB
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
            detail="User authenticated with Supabase, but profile missing in SQLite database.",
        )

    return person


# --- Login Tracking & Analytics Helpers ---


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def handle_successful_login(
    person: models.Person, db: Session, client_ip: Optional[str]
) -> None:
    """Updates counters and login timestamps in SQLite on successful auth."""
    now = datetime.now(timezone.utc)
    person.last_login_at = person.current_login_at or now
    person.current_login_at = now
    person.login_count = (person.login_count or 0) + 1
    person.failed_login_count = 0
    person.locked_until = None
    person.last_login_ip = client_ip
    db.commit()


def identify_person(person: models.Person) -> None:
    """Identify user for PostHog analytics if available."""
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


@router.get("/api/auth/login")
def sync_supabase_user(
    authorization: str = Header(None), 
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer header")
    
    token = authorization.split(" ")[1]
    
    try:
        # Decode Supabase JWT payload without signature verification for local sync
        # (or verify using SUPABASE_JWT_SECRET if configured)
        payload = jwt.decode(token, options={"verify_signature": False})
        email = payload.get("email")
        name = payload.get("user_metadata", {}).get("name", "New User")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token payload: missing email")
            
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Supabase JWT: {str(e)}")

    # Look up existing Person in SQLite DB by email
    person = db.query(models.Person).filter(models.Person.email == email).first()

    # If not found, provision a new Person record in SQLite (gets auto-increment ID!)
    if not person:
        # Generate next profile code
        count = db.query(models.Person).count()
        profile_code = f"L21-HK-{3000 + count}"

        person = models.Person(
            email=email,
            name=name,
            role_primary="family",
            roles="family",
            language="en",
            profile_code=profile_code,
        )
        db.add(person)
        db.commit()
        db.refresh(person)

        # Add default communication preferences
        comm_pref = models.CommPreferences(
            person_id=person.id,
            email_on=True,
            sms_on=False,
            whatsapp_on=False,
        )
        db.add(comm_pref)
        db.commit()

    return person
