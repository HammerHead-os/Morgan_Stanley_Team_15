import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db_supabase import get_supabase
from .posthog_client import get_posthog, initialize_posthog, shutdown_posthog
from .routers import app_supabase, supabase_backend


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_posthog()
    yield
    shutdown_posthog()


app = FastAPI(
    title="Love 21 Supabase API",
    description="Backend functions for the Supabase community schema.",
    version="1.0.0",
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
async def posthog_request_context(request: Request, call_next):
    """Bind client-provided analytics identity to the lifetime of a request."""
    posthog_client = get_posthog()
    distinct_id = request.headers.get("X-POSTHOG-DISTINCT-ID")
    session_id = request.headers.get("X-POSTHOG-SESSION-ID")

    if posthog_client is None:
        return await call_next(request)

    with posthog_client.new_context(fresh=True):
        if distinct_id:
            posthog_client.identify_context(distinct_id)
        if session_id:
            posthog_client.set_context_session(session_id)
        return await call_next(request)


app.include_router(supabase_backend.router)

print("testing output")
if os.getenv("ENABLE_LEGACY_DEMO_DB") == "1":
    print("using Legacy DB")
    from .routers import (  # noqa: PLC0415
        achievements,
        activities,
        auth,
        family,
        hire,
        impact,
        prefs,
        profile,
        volunteers,
    )
    from .seed import init_db  # noqa: PLC0415

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
else:
    app.include_router(app_supabase.router)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "love21-supabase"}


@app.get("/api/supabase/health")
def supabase_health():
    supabase_client = get_supabase()
    return {"ok": True, "supabase_configured": True, "client": str(supabase_client)}


WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
if WEBSITE_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
