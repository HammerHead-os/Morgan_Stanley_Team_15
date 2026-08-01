# Love 21 Part 2 API

FastAPI + SQLite backend for **Disconnected Journeys / Love 21 Profile**.

## Run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open http://127.0.0.1:8000 (serves the website + API) or http://127.0.0.1:8000/docs

## Demo accounts

| Email | Role |
|-------|------|
| `carer@chen.demo` | Family carer |
| `alex@chen.demo` | Member |
| `donor@demo.love21` | Supporter |
| `volunteer@demo.love21` | Volunteer |

Login: `POST /api/auth/demo-login` `{ "email": "..." }` → send `X-Demo-Token: <person_id>` on later requests.

Staff account for admin/testing:

| Email | Password |
|-------|----------|
| `staff@love21.org` | `changeme123` |

Authentication header scheme changed: use `Authorization: Bearer <jwt>` for authenticated endpoints. Tokens are returned from `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/google`, and `POST /api/auth/demo-login`.

## Key endpoints

- `GET /api/activities` — Activity Finder filters
- `POST /api/family/register` — register / waitlist + reminder journey event
- `GET /api/profile` — aggregate My Love21
- `POST /api/achievements/goals` — member goals
- `POST /api/impact/commitments` — start monthly gift
- `PATCH /api/impact/commitments/{id}` — pause / change / renew
- `GET /api/volunteers/shifts` · `POST /api/volunteers/claims`
- `PATCH /api/prefs` · `POST /api/prefs/opt-out/{token}`
