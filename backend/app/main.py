from contextlib import asynccontextmanager, nullcontext
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session


class NoCacheStaticFiles(StaticFiles):
    """Always revalidate with the browser instead of caching the site's HTML/JS/CSS.

    This is a locally-iterated demo, not a production CDN target — without this,
    browsers keep serving an old cached copy of e.g. gate.js after we ship a fix,
    and a normal reload doesn't notice because the cache is still "fresh".
    """

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response

from .routers import (
    achievements,
    activities,
    auth,
    family,
    hire,
    impact,
    instagram,
    profile,
    prefs,
    volunteers,
)
from .database import SessionLocal
from .posthog_client import get_posthog_client, init_posthog, shutdown_posthog
from .seed import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared services before serving requests and flush on shutdown."""
    init_posthog()
    init_db()
    yield
    shutdown_posthog()


class PostHogRequestContextMiddleware:
    """Bind the authenticated person to the shared PostHog client for each request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        client = get_posthog_client()
        person_id = self._authenticated_person_id(scope)
        context = client.new_context(fresh=True) if client else nullcontext()
        with context:
            if client and person_id is not None:
                client.identify_context(str(person_id))
            await self.app(scope, receive, send)

    @staticmethod
    def _authenticated_person_id(scope) -> int | None:
        headers = dict(scope.get("headers", []))
        token = headers.get(b"x-demo-token", b"").decode("utf-8")
        try:
            person_id = int(token)
        except (TypeError, ValueError):
            return None

        db: Session = SessionLocal()
        try:
            from .models import Person

            return person_id if db.get(Person, person_id) else None
        finally:
            db.close()


app = FastAPI(
    title="Love 21 API",
    description="Part 2 — Disconnected Journeys / Love 21 Profile",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(PostHogRequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(family.router)
app.include_router(achievements.router)
app.include_router(impact.router)
app.include_router(instagram.router)
app.include_router(volunteers.router)
app.include_router(prefs.router)
app.include_router(profile.router)
app.include_router(hire.router)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "love21-part2"}


# Serve the static site (docs/ for GitHub Pages) in production/demo
WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
if WEBSITE_DIR.is_dir():
    app.mount("/", NoCacheStaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
