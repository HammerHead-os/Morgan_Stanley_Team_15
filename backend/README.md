# Love 21 Part 2 API

FastAPI + SQLite backend for **Disconnected Journeys / Love 21 Profile**.

## Run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open http://127.0.0.1:8000 (serves the website + API) or http://127.0.0.1:8000/docs

## Connect the AI Agent

The assistant works without an external key in a clearly labelled local-tool
mode. To enable DeepSeek:

```bash
cp backend/.env.example backend/.env
```

Add the real key to `backend/.env`:

```text
AI_PROVIDER_ENABLED=true
DEEPSEEK_API_KEY=your_real_key
DEEPSEEK_MODEL=deepseek-v4-flash
```

Restart FastAPI after changing the file. `backend/.env` is ignored by Git;
`backend/.env.example` is the tracked, key-free template. Never place the key
inside `docs/`, JavaScript, HTML, or any committed file.

The separate `AI_PROVIDER_ENABLED` switch prevents an ambient shell variable
from activating an external provider unexpectedly.

With a key, the model receives the visitor's recent public conversation and a
verified read-only tool result. Without a key—or if the provider is
unavailable—the same endpoint returns the deterministic local result.

## Demo accounts

| Email | Role |
|-------|------|
| `carer@chen.demo` | Family carer |
| `alex@chen.demo` | Member |
| `donor@demo.love21` | Supporter |
| `volunteer@demo.love21` | Volunteer |

Login: `POST /api/auth/demo-login` `{ "email": "..." }` → send `X-Demo-Token: <person_id>` on later requests.

## Key endpoints

- `GET /api/activities` — Activity Finder filters
- `POST /api/family/register` — register / waitlist + reminder journey event
- `GET /api/profile` — aggregate My Love21
- `POST /api/achievements/goals` — member goals
- `POST /api/impact/commitments` — start monthly gift
- `PATCH /api/impact/commitments/{id}` — pause / change / renew
- `GET /api/volunteers/shifts` · `POST /api/volunteers/claims`
- `PATCH /api/prefs` · `POST /api/prefs/opt-out/{token}`
