import os
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

# 1. Force .env.local to take priority if it exists
env_local_path = Path(__file__).resolve().parents[2] / ".env.local"
if env_local_path.exists():
    load_dotenv(env_local_path, override=True)
load_dotenv()  # Fallback to standard .env for anything missing

logger = logging.getLogger("uvicorn.error")


@lru_cache
def get_supabase() -> Client:
    """Return the server-side Supabase client used by backend functions."""
    url = os.getenv("SUPABASE_URL")

    # Check explicitly for service role key variants first
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
        "SUPABASE_SECRET_KEY"
    )

    key = service_key or os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase credentials. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY."
        )

    # Log a warning if backend is running on the restricted anon key
    if not service_key:
        logger.warning(
            "⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY not found! "
            "Falling back to SUPABASE_KEY (anon key). RLS bypass will NOT work."
        )

    return create_client(url, key)


class SupabaseProxy:
    def __getattr__(self, name: str) -> Any:
        return getattr(get_supabase(), name)


supabase = SupabaseProxy()
