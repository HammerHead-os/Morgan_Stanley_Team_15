from fastapi import FastAPI
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
from .seed import init_db

app = FastAPI(
    title="Love 21 API",
    description="Part 2 — Disconnected Journeys / Love 21 Profile",
    version="0.2.0",
)

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


# Serve the static website from the same origin in production/demo
WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "website"
if WEBSITE_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
