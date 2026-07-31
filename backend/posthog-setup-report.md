# PostHog setup report

PostHog was initialized for the FastAPI backend, with request-scoped attribution, 14 successful-mutation event definitions, exception autocapture, and a starter dashboard.

## Installed and initialized

- The existing `requirements.txt` already declares `posthog>=6.9.3`; the review installed requirements successfully and resolved PostHog 7.35.4. No dependency-manifest edit was needed.
- `app/posthog_client.py` is the shared initialization point. It reads `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from the environment, creates one SDK client, enables `enable_exception_autocapture=True`, and flushes/shuts down during application shutdown.
- `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` were configured in `.env` and documented in `.env.example`.
- `app/main.py` opens a fresh request context and applies `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` when supplied by the caller.

## Events instrumented

These captures are placed after successful Supabase mutations in `app/routers/supabase_backend.py`. The run did not exercise the application or observe events arriving in PostHog, so ingestion is **unconfirmed**.

| Event | What it measures | File |
|---|---|---|
| `participant_created` | Participant profile creation | `app/routers/supabase_backend.py` |
| `participant_updated` | Participant profile update | `app/routers/supabase_backend.py` |
| `participant_activity_added` | Activity added to a participant | `app/routers/supabase_backend.py` |
| `participant_deleted` | Participant profile deletion | `app/routers/supabase_backend.py` |
| `volunteer_created` | Volunteer profile creation | `app/routers/supabase_backend.py` |
| `volunteer_updated` | Volunteer profile update | `app/routers/supabase_backend.py` |
| `volunteer_activity_added` | Activity added to a volunteer | `app/routers/supabase_backend.py` |
| `volunteer_deleted` | Volunteer profile deletion | `app/routers/supabase_backend.py` |
| `donor_created` | Donor profile creation | `app/routers/supabase_backend.py` |
| `donor_updated` | Donor profile update | `app/routers/supabase_backend.py` |
| `donation_record_added` | Donation record added to a donor | `app/routers/supabase_backend.py` |
| `donor_deleted` | Donor profile deletion | `app/routers/supabase_backend.py` |
| `admin_added` | Administrator added | `app/routers/supabase_backend.py` |
| `admin_removed` | Administrator removed | `app/routers/supabase_backend.py` |

## Identification and attribution

Identification was wired through request context rather than per-event IDs. Active Supabase routes inherit the browser tracing headers when present. The active routes do not independently resolve a server-verified authenticated identity, so requests without those headers remain intentionally personless. The legacy demo login retains stable `Person.id` identification when that optional router is enabled.

### Unresolved issue

Frontend tracing-header configuration is not verified by this run. If clients do not send `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to the backend, the 14 active-route events will lack stable person/session attribution, reducing the usefulness of user-level funnels and lifecycle analysis.

## Error tracking

Global uncaught-exception capture is configured by the SDK through `enable_exception_autocapture=True` in `app/posthog_client.py`. No manual exception handlers were added. Runtime error delivery was not exercised or observed.

## Dashboard

[Analytics basics (wizard)](https://us.posthog.com/project/536850/dashboard/1936674)

The dashboard contains four tagged insights covering participant lifecycle trends, volunteer and donor activity trends, participant engagement, and administration changes. The dashboard definitions were created successfully using the exact planned event names, but they may remain empty until events are actually ingested.

## Verification and conflicts

- `pip3 install -r requirements.txt` completed successfully; PostHog 7.35.4 satisfied the declared requirement.
- `python3 -m compileall app/posthog_client.py app/main.py app/routers/supabase_backend.py` compiled all changed Python files successfully.
- No build, typecheck, or lint configuration was present. Tests were not run.
- No runtime request was made, no event arrival was observed, and PostHog delivery was not runtime-exercised.
- No build conflict was reported. The full dependency/build outcome was successful installation plus successful Python compilation; this does not prove production behavior or event flow.

## Next steps

1. Configure the frontend/browser client to send PostHog tracing headers for this backend hostname.
2. Exercise each relevant Supabase mutation in a deployed or local environment and confirm the corresponding events arrive in PostHog.
3. Confirm the dashboard populates and that distinct IDs/session IDs are attributed as intended.
4. Run the full production/deployment checks and test suite before merging.

## Before you merge

- [ ] Run a full production build or deployment validation and fix any lint/type errors introduced by `app/posthog_client.py`, `app/main.py`, or `app/routers/supabase_backend.py`.
- [ ] Run the test suite; update mocks or fixtures for captures in `app/routers/supabase_backend.py` if needed.
- [ ] Verify `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from `.env.example` are set in every deploy environment, not only local `.env`.
- [ ] Configure and verify tracing headers at the frontend/backend integration boundary used by `app/main.py` (the `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` reads around lines 40–41).
- [ ] Trigger representative successful mutations and confirm events arrive in PostHog; compilation alone does not verify capture delivery.
