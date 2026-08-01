from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    instagram_access_token: str | None = None
    instagram_user_id: str | None = None
    instagram_username: str = "love21foundation"
    instagram_api_version: str = "v22.0"
    instagram_pinned_media_ids: str = ""
    instagram_cache_ttl_seconds: int = 900

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def instagram_is_configured(self) -> bool:
        return bool(self.instagram_access_token and self.instagram_user_id)

    @property
    def pinned_media_ids(self) -> list[str]:
        return [
            media_id.strip()
            for media_id in self.instagram_pinned_media_ids.split(",")
            if media_id.strip()
        ][:3]


settings = Settings()
