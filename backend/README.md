# Love 21 Part 2 API

FastAPI + SQLite backend for **Disconnected Journeys / Love 21 Profile**.

## Run

First time:

```bash
cd backend
pip install -r requirements.txt
```

Every time after that (kills anything already on 8000, then starts):

```bash
cd backend
./run.sh
```

Leave that terminal open. Open **http://127.0.0.1:8000** (site + API). Docs: http://127.0.0.1:8000/docs

If the site says Offline, you're on GitHub Pages or the API isn't running — use the local URL above.

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| `carer@chen.demo` | Family carer | `love21demo` |
| `dad@chen.demo` | Family carer | `love21demo` |
| `alex@chen.demo` | Member | `love21demo` |
| `donor@demo.love21` | Supporter | `love21demo` |
| `volunteer@demo.love21` | Volunteer | `love21demo` |

Two ways to authenticate:

- **Instant demo switch** (no password, for quickly previewing a role): `POST /api/auth/demo-login` `{ "email": "..." }`
- **Real login**, works for the demo accounts above too: `POST /api/auth/login` `{ "identifier": "email-or-phone", "password": "..." }`
- **Sign up** a brand-new account: `POST /api/auth/signup` `{ "name", "password", "email" or "phone" }`

All three return `{ person, token }` — send `X-Demo-Token: <token>` on later requests.

## Key endpoints

- `GET /api/activities` — Activity Finder filters
- `POST /api/family/register` — register / waitlist + reminder journey event
- `GET /api/profile` — aggregate My Love21
- `POST /api/achievements/goals` — member goals
- `POST /api/impact/commitments` — start monthly gift
- `PATCH /api/impact/commitments/{id}` — pause / change / renew
- `GET /api/volunteers/shifts` · `POST /api/volunteers/claims`
- `PATCH /api/prefs` · `POST /api/prefs/opt-out/{token}`

## Instagram feed

See `INSTAGRAM_API_SETUP.md`. Endpoint: `GET /api/instagram/posts`.

## PostHog analytics (optional)

The backend uses PostHog to capture server-side events (logins, signups,
volunteer claims, impact commitments, etc.). It is **optional** — if
`POSTHOG_PROJECT_TOKEN` / `POSTHOG_HOST` are not set in `backend/.env`, the API
starts normally and simply logs a warning, skipping event capture.

To enable it, copy `.env.example` to `.env` and fill in the PostHog values:

```
POSTHOG_PROJECT_TOKEN=<server-side project API key>
POSTHOG_HOST=https://us.i.posthog.com
```

