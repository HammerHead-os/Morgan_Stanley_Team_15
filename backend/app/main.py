import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db_supabase import get_supabase
from .posthog_client import initialize_posthog, shutdown_posthog
from .routers import supabase_backend


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

app.include_router(supabase_backend.router)


if os.getenv("ENABLE_LEGACY_DEMO_DB") == "1":
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


@app.get("/api/health")
def health():
    return {"ok": True, "service": "love21-supabase"}


@app.get("/api/supabase/health")
def supabase_health():
    get_supabase()
    return {"ok": True, "supabase_configured": True}


WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
if WEBSITE_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
