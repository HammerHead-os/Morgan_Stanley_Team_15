# PostHog setup report

PostHog analytics, authenticated request identity, exception autocapture, 16 server-side event definitions, and a starter dashboard were added to the FastAPI backend.

## What was installed and initialized

- Added the `posthog` Python SDK to `backend/requirements.txt`; the run installed and verified PostHog 7.35.4 in the existing backend virtual environment.
- `backend/app/posthog_client.py` now owns a process-wide `Posthog` instance, reading `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from the environment, enabling `enable_exception_autocapture=True`, registering `atexit` shutdown, and exposing `get_posthog()`.
- `backend/app/main.py` initializes the client in FastAPI lifespan startup and flushes it during lifespan shutdown. The client loads the configured backend `.env` through `load_dotenv()`.
- The real environment keys were confirmed present in `backend/.env`; their values are intentionally not reproduced here.
- The review fixed the pre-existing `python-dotnev` dependency typo to `python-dotenv` and removed a duplicate PostHog requirement. The requirements install and `python3 -m compileall backend/app` both passed.

## Events instrumented

These are the 16 events recorded in `.posthog-wizard-cache/.posthog-events.json` and wired at successful server-side action points:

| Event name | What it measures | File |
|---|---|---|
| `demo_login_completed` | A demo account successfully signs in. | `backend/app/routers/auth.py` |
| `goal_created` | A household member goal is created. | `backend/app/routers/achievements.py` |
| `achievement_consent_updated` | Sharing consent for an achievement changes. | `backend/app/routers/achievements.py` |
| `achievement_approved` | An achievement receives coach approval. | `backend/app/routers/achievements.py` |
| `commitment_started` | A donor starts a giving commitment. | `backend/app/routers/impact.py` |
| `commitment_updated` | A donor changes an active giving commitment. | `backend/app/routers/impact.py` |
| `activity_registered` | A household member successfully registers for an activity. | `backend/app/routers/family.py` |
| `activity_waitlist_joined` | A household member joins an activity waitlist. | `backend/app/routers/family.py` |
| `session_feedback_submitted` | A household submits feedback after an activity. | `backend/app/routers/family.py` |
| `family_member_added` | A household adds a family member. | `backend/app/routers/family.py` |
| `volunteer_onboarded` | A volunteer completes onboarding. | `backend/app/routers/volunteers.py` |
| `shift_claimed` | A volunteer claims an available shift. | `backend/app/routers/volunteers.py` |
| `shift_completed` | A volunteer records a completed shift and receives points. | `backend/app/routers/volunteers.py` |
| `reward_redeemed` | A volunteer redeems a points reward. | `backend/app/routers/volunteers.py` |
| `communication_preferences_updated` | An authenticated person updates communication preferences. | `backend/app/routers/prefs.py` |
| `hire_enquiry_submitted` | A creator hire enquiry is submitted. | `backend/app/routers/hire.py` |

## Identity and attribution

User identification **was wired**. Requests with a valid `X-Demo-Token` resolve the existing database `Person` and establish a fresh PostHog context identified by the stable `Person.id`. Person properties (email, name, and roles) are set on the person rather than placed in event properties. Demo login establishes its own identified context after authentication succeeds.

The anonymous path for `hire_enquiry_submitted` intentionally remains personless when no authenticated token exists; no fabricated distinct ID was added. No `DISTINCT_ID` placeholders were reported by the run.

## Error tracking

Error tracking was already provided by the shared client setup: `Posthog(..., enable_exception_autocapture=True)` enables the SDK's global uncaught-exception mechanism. No duplicate manual exception handlers or route wrappers were added. The run did not exercise a runtime exception or observe an error event arriving in PostHog.

## Dashboard

[Analytics basics (wizard)](https://us.posthog.com/project/536850/dashboard/1936145)

The dashboard contains five tagged `(wizard)` insight tiles covering household engagement, volunteer activity, giving commitments, registration-to-feedback conversion, and demo login outcomes. The dashboard and insights were created successfully, but the run did not observe analytics events arriving, so tile data population remains unconfirmed.

## What the run verified—and did not verify

**Verified:** the SDK dependency installation; environment key presence; source compilation of `backend/app`; the lifespan initialization and shutdown wiring; static correspondence between all 16 capture calls and the event plan; non-PII event properties; and successful creation of the dashboard and five insights.

**Not verified:** live application startup, actual requests through the instrumented endpoints, event delivery into PostHog, identified-person attribution in received events, exception delivery, dashboard data population, or production deployment behavior. A passing compilation proves that the code compiles; it does not prove that events flow.

## Build conflict

The initial dependency install was blocked by the pre-existing misspelling `python-dotnev==1.2.2` in `backend/requirements.txt`. Review corrected it to `python-dotenv` and removed the duplicate PostHog requirement. A subsequent `pip3 install -r backend/requirements.txt` completed successfully. No unresolved integration conflict remains. Uvicorn runtime startup was not run because server commands were unavailable in this run.

## Next steps

1. Run the backend locally or in a staging environment with the configured `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`.
2. Exercise demo login and representative authenticated routes, then confirm the corresponding events appear in PostHog with the expected stable person identity.
3. Submit an anonymous hire enquiry and confirm the intentional personless event behavior is acceptable.
4. Trigger an uncaught application exception and confirm error tracking receives it.
5. Open the dashboard and verify that its five tiles populate after traffic arrives.

## Before you merge

- [ ] Run the full production/deployment build for the backend and fix any integration-related lint or type errors; the run only verified compilation with `python3 -m compileall backend/app`.
- [ ] Run the test suite and update any mocks or fixtures affected by the new PostHog client, lifespan, middleware context, or route captures (`backend/app/posthog_client.py`, `backend/app/main.py`, and the instrumented routers listed above).
- [ ] Confirm `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from `backend/.env.example` are configured in every deploy environment, not only locally; inspect `backend/.env.example` and deployment configuration before merging.
- [ ] Because authentication and identify are wired, exercise the returning-authenticated-user path and confirm it still establishes identity through the middleware in `backend/app/main.py` rather than fragmenting onto an anonymous distinct ID.
- [ ] Exercise representative capture paths and inspect received PostHog events; no event delivery was observed during this run (`backend/app/routers/auth.py`, `achievements.py`, `impact.py`, `family.py`, `volunteers.py`, `prefs.py`, and `hire.py`).
