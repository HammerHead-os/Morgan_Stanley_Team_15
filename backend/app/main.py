from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path


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


# Serve the static site (docs/ for GitHub Pages) in production/demo
WEBSITE_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
if WEBSITE_DIR.is_dir():
    app.mount("/", NoCacheStaticFiles(directory=str(WEBSITE_DIR), html=True), name="site")
