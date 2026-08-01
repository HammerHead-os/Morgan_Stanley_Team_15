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
