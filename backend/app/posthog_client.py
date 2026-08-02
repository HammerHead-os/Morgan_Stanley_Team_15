"""Application-wide PostHog client initialization for the FastAPI process."""

import atexit
import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from posthog import Posthog

from .settings import ENV_FILE

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Optional PostHog settings loaded from the environment."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    posthog_project_token: str | None = None
    posthog_host: str | None = None
    debug: bool = True


@lru_cache
def get_settings() -> Settings:
    """Return cached settings, allowing dependency overrides in tests."""
    return Settings()


posthog_client: Posthog | None = None


def init_posthog() -> Posthog | None:
    """Create the process-wide client once, or remain a production no-op if unconfigured."""
    global posthog_client
    if posthog_client is not None:
        return posthog_client

    settings = get_settings()
    missing = (
        "POSTHOG_PROJECT_TOKEN" if not settings.posthog_project_token else None
    ) or ("POSTHOG_HOST" if not settings.posthog_host else None)
    if missing:
        # PostHog is optional: log a warning and run without analytics rather
        # than crashing the whole API at startup when no token is configured.
        logger.warning(
            "%s variable required by PostHog is missing or un-configured; "
            "running without PostHog analytics. Configure POSTHOG_PROJECT_TOKEN "
            "and POSTHOG_HOST (e.g. in backend/.env) to enable event capture.",
            missing,
        )
        return None

    assert settings.posthog_project_token is not None
    assert settings.posthog_host is not None
    posthog_client = Posthog(
        project_api_key=settings.posthog_project_token,
        host=settings.posthog_host,
        enable_exception_autocapture=True,
    )
    atexit.register(posthog_client.shutdown)
    return posthog_client


def shutdown_posthog() -> None:
    """Flush and close the shared client during application shutdown."""
    if posthog_client is not None:
        posthog_client.flush()
        posthog_client.shutdown()


def get_posthog_client() -> Posthog | None:
    """Return the initialized client for route handlers and dependencies."""
    return posthog_client
