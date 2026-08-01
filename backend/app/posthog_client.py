"""PostHog client lifecycle and configuration."""

import atexit
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from posthog import Posthog

load_dotenv()

_client: Optional[Posthog] = None
logger = logging.getLogger("uvicorn.error")


def initialize_posthog() -> Optional[Posthog]:
    """Create the process-wide PostHog client from environment configuration."""
    global _client
    token = os.getenv("POSTHOG_PROJECT_TOKEN")
    host = os.getenv("POSTHOG_HOST")

    if not token or not host:
        if os.getenv("ENVIRONMENT", "development").lower() != "production":
            logger.warning("PostHog is disabled because POSTHOG_PROJECT_TOKEN or POSTHOG_HOST is missing.")
        return None

    _client = Posthog(
        token,
        host=host,
        enable_exception_autocapture=True,
    )
    atexit.register(_client.shutdown)
    return _client


def get_posthog() -> Optional[Posthog]:
    """Return the initialized process-wide client for route dependencies."""
    return _client


def shutdown_posthog() -> None:
    """Flush and shut down the client during application shutdown."""
    if _client is not None:
        _client.shutdown()
