"""PostHog client lifecycle and configuration."""

import atexit
import os
from typing import Optional

from dotenv import load_dotenv
from posthog import Posthog

load_dotenv()

_client: Optional[Posthog] = None


def initialize_posthog() -> Optional[Posthog]:
    """Create the process-wide PostHog client from environment configuration."""
    global _client
    token = os.getenv("POSTHOG_PROJECT_TOKEN")
    host = os.getenv("POSTHOG_HOST")

    if not token or not host:
        if os.getenv("ENVIRONMENT", "development").lower() != "production":
            missing = "POSTHOG_PROJECT_TOKEN" if not token else "POSTHOG_HOST"
            raise RuntimeError(
                f"{missing} variable required by PostHog is missing or un-configured, "
                f"this causes events to be silently missed. This error stops appearing "
                f"once {missing} is configured"
            )
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
    """Flush the client during application shutdown."""
    if _client is not None:
        _client.flush()
