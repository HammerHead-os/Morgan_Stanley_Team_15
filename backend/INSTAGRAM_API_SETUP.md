# Connect the Instagram feed

The website reads Instagram through the FastAPI backend. Never put an Instagram token in `docs/` or browser JavaScript.

## 1. Prepare Meta and Instagram

1. Confirm the Instagram account is **Professional** (`Business` or `Creator`).
2. In [Meta for Developers](https://developers.facebook.com/apps/), create a Business app and add **Instagram API with Instagram Login**.
3. Open **Instagram → API setup with Instagram Login**, add the Love 21 account as a tester, accept the invitation from that Instagram account, and generate an access token with `instagram_business_basic` permission.
4. Copy the Instagram user ID and access token. Keep the token private and renew/rotate it before it expires.

Meta references: [Instagram API overview](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) and the [official Meta Postman collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

## 2. Configure this backend

Open the existing `backend/.env` and add the following values. If the file does not exist, create it from `.env.example` first; do not overwrite an existing file because it may contain other backend keys.

```dotenv
INSTAGRAM_ACCESS_TOKEN=your_private_access_token
INSTAGRAM_USER_ID=your_instagram_user_id
INSTAGRAM_USERNAME=love21foundation
INSTAGRAM_API_VERSION=v22.0
```

Optional: set `INSTAGRAM_PINNED_MEDIA_IDS` to three comma-separated media IDs in display order. Instagram's media feed does not expose the profile's pinned state, so without this setting the website keeps the three curated pinned cards already in the HTML.

## 3. Run and verify

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
curl http://127.0.0.1:8000/api/instagram/posts
```

Open `http://127.0.0.1:8000/pages/about.html`. The Recent posts row will use the latest API results; if the API is unavailable, the static cards remain visible.

For a separately hosted frontend, set the `love21-api-base` meta tag in `docs/pages/about.html` to the public HTTPS URL of this backend. GitHub Pages cannot safely hold the access token or call Meta directly.
