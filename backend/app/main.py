from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .routers import (
    achievements,
    activities,
    auth,
    family,
    hire,
    impact,
    profile,
    prefs,
    volunteers,
)
from .database import SessionLocal
from .models import Person
from .posthog_client import get_posthog, initialize_posthog, shutdown_posthog
from .seed import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_posthog()
    yield
    shutdown_posthog()

app = FastAPI(
    title="Love 21 API",
    description="Part 2 — Disconnected Journeys / Love 21 Profile",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def identify_posthog_request(request, call_next):
    """Bind authenticated request work, including errors, to the stable person ID."""
    posthog_client = get_posthog()
    person = _get_request_person(request.headers.get("X-Demo-Token"))

    if posthog_client is None or person is None:
        return await call_next(request)

    with posthog_client.new_context(fresh=True):
        posthog_client.identify_context(str(person.id))
        posthog_client.set(
            properties={
                "email": person.email,
                "name": person.name,
                "role_primary": person.role_primary,
                "roles": person.roles,
            }
        )
        return await call_next(request)


def _get_request_person(token: str | None) -> Person | None:
    """Resolve the authenticated demo account without trusting a process-wide identity."""
    if not token:
        return None

    try:
        person_id = int(token)
    except ValueError:
        return None

    db: Session = SessionLocal()
    try:
        return db.get(Person, person_id)
    finally:
        db.close()


app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(family.router)
app.include_router(achievements.router)
app.include_router(impact.router)
app.include_router(volunteers.router)
app.include_router(prefs.router)
app.include_router(profile.router)
app.include_router(hire.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"ok": True, "service": "love21-part2"}


# Serve the static site (docs/ for GitHub Pages) in production/demo
WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
if WEBSITE_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
