# Love 21 — static site + Part 2 API

## Quick start (recommended)

One process serves the website **and** the API:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://127.0.0.1:8000 · API docs http://127.0.0.1:8000/docs

## Part 2 — Disconnected Journeys (backend)

SQLite + FastAPI covering:

- Activity Finder + register / waitlist + reminders log
- My Love21 Passport (family · achievement · impact · volunteer)
- Donor commitments (pause / change / renew) + receipts
- Volunteer shifts, claims, onboarding, hours
- Email-first prefs + one-click opt-out token

Demo accounts: see `backend/README.md`.

## Front-end pages

| Path | Purpose |
|------|---------|
| `index.html` | Role chooser → journey CTA |
| `pages/my-love21.html` | Passport (live API) |
| `pages/activity-finder.html` | Family register / waitlist |
| `pages/volunteer.html` | Claim shifts |
| `pages/impact.html` | Start HKD 300 monthly |