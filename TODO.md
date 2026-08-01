# Fix Backend Startup Crash (Missing POSTHOG_PROJECT_TOKEN)

## Steps
- [x] 1. Make PostHog optional in `backend/app/posthog_client.py` (warning + return None instead of RuntimeError)
- [x] 2. Document `POSTHOG_PROJECT_TOKEN` / `POSTHOG_HOST` in `backend/.env.example`
- [x] 3. Add a PostHog note to `backend/README.md`
- [ ] 4. Restart the server and verify `/api/health` returns 200 OK

