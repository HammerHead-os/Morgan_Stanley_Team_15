import asyncio
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import Response

from app import schemas
from app.routers import instagram
from app.routers.instagram import _fetch_feed, _normalise_media, _split_feed, posts
from app.settings import settings


class InstagramFeedTests(unittest.TestCase):
    def test_carousel_uses_first_child_image(self):
        post = _normalise_media(
            {
                "id": "carousel-1",
                "caption": "A carousel",
                "media_type": "CAROUSEL_ALBUM",
                "media_url": "https://example.com/parent.jpg",
                "permalink": "https://www.instagram.com/p/example/",
                "timestamp": "2026-08-01T08:00:00+0000",
                "username": "love21foundation",
                "children": {
                    "data": [
                        {
                            "media_type": "IMAGE",
                            "media_url": "https://example.com/first.jpg",
                        }
                    ]
                },
            }
        )

        self.assertIsNotNone(post)
        self.assertEqual(post.image_url, "https://example.com/first.jpg")

    def test_configured_pinned_order_is_preserved(self):
        original = settings.instagram_pinned_media_ids
        settings.instagram_pinned_media_ids = "post-2,post-1"
        try:
            posts = [
                schemas.InstagramPostOut(
                    id=f"post-{index}",
                    caption=f"Post {index}",
                    media_type="IMAGE",
                    image_url=f"https://example.com/{index}.jpg",
                    permalink=f"https://www.instagram.com/p/{index}/",
                    timestamp=datetime(2026, 8, index, tzinfo=timezone.utc),
                    username="love21foundation",
                )
                for index in (1, 2, 3)
            ]

            pinned, recent = _split_feed(posts)

            self.assertEqual([post.id for post in pinned], ["post-2", "post-1"])
            self.assertEqual([post.id for post in recent], ["post-3"])
        finally:
            settings.instagram_pinned_media_ids = original

    def test_fetch_feed_normalises_meta_response(self):
        payload = {
            "data": [
                {
                    "id": "post-10",
                    "caption": "Latest post",
                    "media_type": "VIDEO",
                    "media_url": "https://example.com/video.mp4",
                    "thumbnail_url": "https://example.com/cover.jpg",
                    "permalink": "https://www.instagram.com/p/latest/",
                    "timestamp": "2026-08-01T08:00:00+0000",
                    "username": "love21foundation",
                }
            ]
        }
        with patch.object(settings, "instagram_access_token", "test-token"), patch.object(
            settings, "instagram_user_id", "12345"
        ), patch.object(instagram, "_request_json", return_value=payload):
            feed = asyncio.run(_fetch_feed())

        self.assertTrue(feed.connected)
        self.assertEqual(feed.recent[0].image_url, "https://example.com/cover.jpg")

    def test_endpoint_is_safe_when_not_configured(self):
        with patch.object(settings, "instagram_access_token", None), patch.object(
            settings, "instagram_user_id", None
        ):
            response = Response()
            feed = asyncio.run(posts(response))

        self.assertFalse(feed.connected)
        self.assertEqual(feed.recent, [])
        self.assertEqual(response.headers["Cache-Control"], "public, max-age=300")


if __name__ == "__main__":
    unittest.main()
