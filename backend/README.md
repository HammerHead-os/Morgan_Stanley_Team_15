# Love 21 Supabase API

FastAPI backend functions for the Supabase schema in `supabase/migrations`.

## Run

Set Supabase credentials in `.env.local`, `backend/.env`, or your shell:

```bash
SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

`SUPABASE_SERVICE_ROLE_KEY` is preferred for server-side API routes. `SUPABASE_SECRET_KEY`
and `SUPABASE_KEY` are also accepted for local development.

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs.

## Supabase Endpoints

All migration-backed routes are under `/api/supabase`:

- `GET /api/supabase/me/{auth_id}` - combined participant, volunteer, donor, and admin profile lookup
- `GET|POST /api/supabase/participants`
- `GET|PATCH|DELETE /api/supabase/participants/{participant_id}`
- `GET|POST /api/supabase/participants/{participant_id}/activities`
- `PATCH|DELETE /api/supabase/participant-activities/{activity_id}`
- `GET|POST /api/supabase/volunteers`
- `GET|PATCH|DELETE /api/supabase/volunteers/{volunteer_id}`
- `GET|POST /api/supabase/volunteers/{volunteer_id}/activities`
- `PATCH|DELETE /api/supabase/volunteer-activities/{activity_id}`
- `GET|POST /api/supabase/donors`
- `GET|PATCH|DELETE /api/supabase/donors/{donor_id}`
- `GET|POST /api/supabase/donors/{donor_id}/records`
- `PATCH|DELETE /api/supabase/donor-records/{record_id}`
- `GET|POST /api/supabase/admins`
- `GET /api/supabase/admins/{user_id}/is-admin`
- `DELETE /api/supabase/admins/{user_id}`

The legacy SQLite demo routes are disabled by default. Set `ENABLE_LEGACY_DEMO_DB=1`
only if you need the old demo API.
