import asyncio
import json
from datetime import datetime, timezone
from time import monotonic
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response

from .. import schemas
from ..settings import settings


router = APIRouter(prefix="/api/instagram", tags=["instagram"])

MEDIA_FIELDS = (
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,"
    "children{media_type,media_url,thumbnail_url}"
)
FETCH_LIMIT = 50

_cache_lock = asyncio.Lock()
_cache_value: schemas.InstagramFeedOut | None = None
_cache_expires_at = 0.0


def _timestamp_value(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)

    normalised = value.strip()
    if normalised.endswith("Z"):
        normalised = normalised[:-1] + "+00:00"
    elif (
        len(normalised) >= 5
        and normalised[-5] in ("+", "-")
        and normalised[-2] != ":"
    ):
        # Convert +HHMM / -HHMM to +HH:MM for datetime.fromisoformat.
        normalised = normalised[:-2] + ":" + normalised[-2:]

    try:
        return datetime.fromisoformat(normalised)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _first_image(media: dict[str, Any]) -> str | None:
    media_type = media.get("media_type")
    if media_type == "CAROUSEL_ALBUM":
        children = media.get("children", {}).get("data", [])
        for child in children:
            image_url = child.get("thumbnail_url") or child.get("media_url")
            if image_url:
                return image_url
    if media_type == "VIDEO":
        return media.get("thumbnail_url") or media.get("media_url")
    return media.get("media_url") or media.get("thumbnail_url")


def _normalise_media(media: dict[str, Any]) -> schemas.InstagramPostOut | None:
    image_url = _first_image(media)
    permalink = media.get("permalink")
    media_id = media.get("id")
    if not image_url or not permalink or not media_id:
        return None
    return schemas.InstagramPostOut(
        id=str(media_id),
        caption=(media.get("caption") or "Instagram post").strip(),
        media_type=media.get("media_type") or "IMAGE",
        image_url=image_url,
        permalink=permalink,
        timestamp=_timestamp_value(media.get("timestamp")),
        username=media.get("username") or settings.instagram_username,
    )


def _split_feed(
    posts: list[schemas.InstagramPostOut],
) -> tuple[list[schemas.InstagramPostOut], list[schemas.InstagramPostOut]]:
    posts.sort(key=lambda post: post.timestamp, reverse=True)
    by_id = {post.id: post for post in posts}
    pinned = [
        by_id[media_id]
        for media_id in settings.pinned_media_ids
        if media_id in by_id
    ]
    pinned_ids = {post.id for post in pinned}
    recent = [post for post in posts if post.id not in pinned_ids][:3]
    return pinned, recent


def _request_json(request: Request) -> dict[str, Any]:
    with urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


async def _fetch_feed() -> schemas.InstagramFeedOut:
    api_version = settings.instagram_api_version.strip().lstrip("/")
    user_id = settings.instagram_user_id
    params = urlencode({"fields": MEDIA_FIELDS, "limit": FETCH_LIMIT})
    url = f"https://graph.instagram.com/{api_version}/{user_id}/media?{params}"
    request = Request(
        url,
        headers={"Authorization": f"Bearer {settings.instagram_access_token}"},
    )

    try:
        payload = await asyncio.to_thread(_request_json, request)
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = payload.get("error", {}).get("message")
        except (ValueError, AttributeError):
            message = None
        raise HTTPException(
            status_code=502,
            detail=message or "Instagram rejected the feed request.",
        ) from exc
    except (URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Instagram is temporarily unavailable.",
        ) from exc

    posts = [
        post
        for item in payload.get("data", [])
        if (post := _normalise_media(item)) is not None
    ]
    pinned, recent = _split_feed(posts)
    username = posts[0].username if posts else settings.instagram_username
    return schemas.InstagramFeedOut(
        connected=True,
        username=username,
        fetched_at=datetime.now(timezone.utc),
        pinned=pinned,
        recent=recent,
    )


@router.get("/posts", response_model=schemas.InstagramFeedOut)
async def posts(response: Response):
    global _cache_expires_at, _cache_value

    response.headers["Cache-Control"] = "public, max-age=300"
    if not settings.instagram_is_configured:
        return schemas.InstagramFeedOut(
            connected=False,
            username=settings.instagram_username,
            fetched_at=None,
            pinned=[],
            recent=[],
        )

    now = monotonic()
    if _cache_value is not None and now < _cache_expires_at:
        return _cache_value

    async with _cache_lock:
        now = monotonic()
        if _cache_value is not None and now < _cache_expires_at:
            return _cache_value
        feed = await _fetch_feed()
        _cache_value = feed
        _cache_expires_at = now + max(settings.instagram_cache_ttl_seconds, 60)
        return feed
