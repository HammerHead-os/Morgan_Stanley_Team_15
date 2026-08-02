# Love 21 / Morgan Stanley Code to Give — Full repository guide

This document explains **what this repository is**, **how the pieces fit together**, and **what lives in each major area**. It is meant for teammates, judges reading the codebase, and anyone who needs to run or extend the project.

**Live static site (GitHub Pages):** https://hammerhead-os.github.io/Morgan_Stanley_Team_15/  
**Local full stack (site + API):** http://127.0.0.1:8000  

Related shorter docs (do not duplicate everything here):

| Doc | Role |
|-----|------|
| `README.md` | One-page intro |
| `backend/README.md` | How to run the API + demo accounts |
| `backend/db_structure.md` | Database ER-style overview |
| `backend/INSTAGRAM_API_SETUP.md` | Meta Instagram Graph setup |
| `PROFILE_DATABASE_FRONTEND_MAPPING.md` | Profile UI ↔ `GET /api/profile` field map |
| `docs/PITCH_SLIDES.md` | Pitch / judging narrative |
| `docs/README.md` | Notes on publishing `docs/` |

---

## 1. What this project is

This is **Team 15’s Code to Give build for Love 21 Foundation** (San Po Kong, Hong Kong). Love 21 runs free sport, nutrition, and family programmes for neurodiverse people and their families, under the public line **#Somuchability**.

The product problem the brief targets roughly:

1. **Viewer → supporter transition** — browsing should lead into donating, volunteering, booking, or hiring, not dead-end pages.
2. **Education + empathy** — especially on About (story + sensory experience), not only brochure copy.
3. **Immersive / lightly gamified** — scroll storytelling, volunteer points and rewards, passport-style Profile.
4. **Visibility into use** — PostHog on the client (and optional server-side), plus `journey_events` in the database.

The technical shape is:

- A **static front end** in `docs/` (GitHub Pages–ready HTML/CSS/JS).
- A **FastAPI + SQLite backend** in `backend/` that owns auth, data, email, Instagram proxy, AI agent, and (when run locally) also **serves** the `docs/` site on port **8000**.

Hackathon / demo authenticity level: end-to-end journeys work with **seeded demo accounts**. Auth uses a demo-friendly `X-Demo-Token` (person id). Payments are **simulated**. Production hardening (real OAuth, payment gateway, hosted Postgres, etc.) is not the claim of this repo.

---

## 2. Top-level layout

```text
Morgan_Stanley/
├── README.md
├── REPO_GUIDE.md                 ← this file
├── PROFILE_DATABASE_FRONTEND_MAPPING.md
├── judging_criteria.pdf          ← official judging sheet (reference)
├── project_guide.pdf             ← hackathon / nonprofit brief materials
├── Love 21 Colorful Presentation.pdf
├── videoplayback.mp4             ← large media asset at repo root
├── .gitignore
├── .about-backup/                ← older About page snapshots (not served)
├── docs/                         ← FRONT END (GitHub Pages root)
│   ├── index.html                ← Home / role gate
│   ├── pages/                    ← About, Profile, hubs, admin, …
│   ├── js/                       ← client modules
│   ├── css/                      ← styles, About theme, a11y, agent
│   ├── img/                      ← story frames, turquoise theme images
│   ├── assets/media/             ← logos, programme photos, board portraits
│   ├── legacy/n8n-agent/         ← notes for old n8n chat widget
│   └── PITCH_SLIDES.md
└── backend/                      ← API + DB + local static mount
    ├── app/                      ← FastAPI application package
    ├── tests/
    ├── love21.db                 ← SQLite file (created / updated at runtime)
    ├── requirements.txt
    ├── run.sh
    ├── .env.example
    ├── README.md
    ├── db_structure.md
    └── INSTAGRAM_API_SETUP.md
```

**Important:** GitHub Pages publishes **`docs/` only**. API features (login, Profile aggregate, donations, volunteer claims, Instagram Graph, DeepSeek agent) need the **backend running**, typically via `backend/run.sh` on port 8000. On Pages alone, the UI still renders, but many actions show as offline or fail API calls unless `love21-api-base` is pointed at a hosted API.

---

## 3. How to run it

### 3.1 Recommended: one process for site + API

```bash
cd backend
python -m venv .venv          # first time
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
./run.sh                      # uvicorn on 127.0.0.1:8000 --reload
```

Then open **http://127.0.0.1:8000**.

What happens on boot (`backend/app/main.py` lifespan):

1. Optional PostHog server client init.
2. `init_db()` — create tables, light SQLite column migrations, seed demo data if needed.
3. APScheduler starts: reminder emails every **15 minutes**.
4. Static files from repo `docs/` are mounted at `/` with **no-cache** headers (so local iteration doesn’t fight browser cache).
5. OpenAPI docs: http://127.0.0.1:8000/docs  

Health check: `GET /api/health` → `{"ok": true, "service": "love21-part2"}`.

### 3.2 Front end only (static)

You can open `docs/` via any static server (or GitHub Pages). Client `api.js` will, on ports like `8765` / Vite-like ports / `file:`, aim API calls at `http://127.0.0.1:8000`. Same-origin (port 8000) uses relative `/api/...`.

### 3.3 Environment variables

Copy `backend/.env.example` → `backend/.env` and fill what you need.

| Area | Variables (as used in code) |
|------|-----------------------------|
| DeepSeek agent | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_TIMEOUT_SECONDS` |
| Instagram | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `INSTAGRAM_USERNAME`, `INSTAGRAM_API_VERSION`, `INSTAGRAM_PINNED_MEDIA_IDS`, `INSTAGRAM_CACHE_TTL_SECONDS` |
| PostHog (server) | `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` |
| SMTP email | `LOVE21_SMTP_HOST`, `LOVE21_SMTP_PORT`, `LOVE21_SMTP_USER`, `LOVE21_SMTP_PASSWORD`, `LOVE21_FROM_EMAIL`, `LOVE21_FROM_NAME` |
| Links in emails | `LOVE21_FRONTEND_BASE_URL` |

If SMTP or PostHog or DeepSeek keys are missing, the API **still starts**. Email logs what it would send; PostHog skips capture; the agent falls back to local demo answers.

**Security note:** Treat `.env` and any checked-in example files that ever contained real passwords or tokens as sensitive. Rotate credentials if they were shared. Do not commit real secrets.

Database URL is **not** configurable via env today — it is always SQLite at `backend/love21.db`.

---

## 4. Architecture (big picture)

```text
Browser (docs/)
  ├── gate / hubs / About / Profile UI
  ├── localStorage: love21_token, love21_person, love21_role, love21_a11y, …
  ├── PostHog JS (client analytics + session recording)
  └── fetch → /api/*  with header X-Demo-Token: <person.id>

FastAPI (backend/app)
  ├── Auth, family, impact, volunteers, profile, prefs, hire, agent, Instagram, …
  ├── SQLAlchemy → love21.db
  ├── email_client (SMTP or console log)
  ├── reminders scheduler
  └── Static mount of docs/ when running locally
```

**Auth model (demo):**

- After login / signup / demo-login, the API returns `{ person, token }`.
- `token` is the string form of `people.id`.
- The browser stores it and sends `X-Demo-Token` on API calls (`docs/js/api.js`, `backend/app/deps.py`).
- Passwords for real login use PBKDF2 (`backend/app/security.py`). Five failed logins lock the account for 15 minutes.

This is intentionally simple for judging demos, **not** production session security.

---

## 5. Front end (`docs/`)

### 5.1 Pages

| Path | Purpose |
|------|---------|
| `docs/index.html` | Home: full-bleed video, #Somuchability, “What are you looking for?” role gate |
| `pages/about.html` | Mission story (scrollytelling), sensory playground, finance charts, programmes, team, Instagram |
| `pages/activity-finder.html` | Filter / register / waitlist for classes |
| `pages/family.html` | Family hub: bookings, members, calendar (API when logged in) |
| `pages/contributor.html` | Hire members + short volunteer-style tasks |
| `pages/volunteer.html` | Volunteer shifts + onboarding |
| `pages/impact.html` | Giving, tax estimate UI, demo payment modal |
| `pages/explore.html` | Company marketplace: hire + needs + gifts |
| `pages/curious.html` | “Just looking” browse into other paths |
| `pages/opportunity.html` | “What we need right now” needs board |
| `pages/play.html` | Short quiz / “How Love 21 works” |
| `pages/profile.html` | Passport UI, calendar, family, gifts, prefs, roles (“My Love21”) |
| `pages/contact.html` | Contact + visit info |
| `pages/transparency.html` | Where money goes (editorial + API transparency demo) |
| `pages/claim-account.html` | Activate household invite (`?code=`) + set password |
| `pages/admin-hire.html` | Staff view of hire enquiries (admin role) |
| `pages/admin-dashboard.html` | Large admin data dashboard (mostly **browser localStorage** + XLSX import/export; not the same SQLite path as Profile) |
| `pages/stories.html` | Redirect → `play.html` |
| `pages/story.html` | Redirect → `about.html#pixel-story` |
| `pages/upload_supabase.html` | Standalone Supabase upload helper (not core Love 21 stack) |

### 5.2 Role gate: Home → hubs → Profile

`docs/js/gate.js` stores `localStorage.love21_role` and routes:

| Role key | Destination |
|----------|-------------|
| `family` | `pages/activity-finder.html` |
| `contributor` | `pages/contributor.html` |
| `volunteer` | `pages/volunteer.html` |
| `donor` | `pages/impact.html` |
| `company` | `pages/explore.html#marketplace` |
| `curious` | `pages/curious.html` |

Typical flow:

1. Visitor picks a role on Home.
2. Hub pages call `Love21.requireLogin` / `ensureLogin` when an action needs an account.
3. Successful actions often call `Love21.goToProfile(...)`.
4. Profile loads **`GET /api/profile`** and renders role-aware tabs, next actions, passport (“journal”), calendar, etc.

People can hold **multiple roles** (family + donor + volunteer). Backend helpers live in `backend/app/roles_util.py`; Profile can `PATCH /api/profile/roles`.

### 5.3 Core JavaScript modules

| File | Responsibility |
|------|----------------|
| `js/api.js` | `Love21` client: API base URL resolution, session storage, `X-Demo-Token` fetch wrapper, login/signup/demo-login, auth modal, toasts, `goToProfile` |
| `js/app.js` | Shared nav/footer, session paint, activity helpers, prefs wiring, admin link visibility |
| `js/gate.js` | IAM / role overlay and routing |
| `js/profile.js` | Profile page: actions, calendar, family, gifts, volunteer claims, role toggles from `/api/profile` |
| `js/journal.js` | Passport book UI derived from profile payload |
| `js/home.js` | Hire / needs / shift previews on contributor & explore |
| `js/family.js` | Family hub live data |
| `js/volunteer.js` | Shift list (API + offline fallback) |
| `js/about.js` | Finance canvas charts + Instagram card presentation |
| `js/story-dust.js` | Scroll-driven image → dust morph (`img/story/1–5.png`) on About |
| `js/about-sims.js` | “Walk the park” sensory simulation (levels, audio, interaction) |
| `js/a11y.js` | Accessibility prefs (`love21_a11y`) → `data-*` on `<html>` |
| `js/posthog.js` | Client PostHog init + session recording |
| `js/agent-config.js` | `LOVE21_AGENT_MODE`: `"deepseek"` (default) or `"n8n"` |
| `js/agent.js` | Floating chat → `POST /api/agent/chat` |
| `js/n8n-agent-legacy.js` | Preserved n8n webhook chat widget |
| `js/modal-kit.js` | Shared modal shell |
| `js/register-modal.js` | Class registration / waitlist (party size) |
| `js/claim-modal.js` | Extra attendees when claiming a volunteer shift |
| `js/payment-modal.js` | Demo PayMe / Apple / Google Pay → `POST /api/impact/commitments` |
| `js/hire-modal.js` | Creator hire enquiry |
| `js/onboard-modal.js` | Volunteer skills / languages / availability |
| `js/tax.js` | Tax-relief estimate helper on Impact |
| `js/play.js` | Quiz steps on Learn / play page |
| `js/hub-demo.js` | Spotlight tour via `data-tour` |
| `js/i18n.js` | EN / Traditional Chinese strings + switcher |

**API base resolution** (`api.js`):

1. Optional `<meta name="love21-api-base" content="…">`
2. Else if port is `5173` / `4173` / `8765` or `file:` → `http://127.0.0.1:8000`
3. Else → `""` (same origin)

### 5.4 About page (immersion + empathy)

`pages/about.html` is the public education surface.

- **Scrollytelling** (`#pixel-story`): beats for who we are / work / aim / hire / volunteer; sticky stage; `story-dust.js` morphs story images as you scroll.
- **Sensory playground** (`#try`, “Walk the park”): opt-in immersive simulation in `about-sims.js` (respects reduced motion / a11y image-fx where wired).
- **Finance / transparency** (`#reports`): canvas donuts/bars from published-style figures in `about.js`.
- **Instagram** (`#instagram`): UI expects `GET /api/instagram/posts` (pinned + recent). Without tokens, API returns empty / not connected.
- **Theme:** `theme-turquoise.css` + `img/theme/turquoise/` ocean background wash; typography Source Serif 4 / IBM Plex Sans.
- **Accessibility:** About loads `a11y.css` / `a11y.js` (text size, contrast, wave motion, image transitions, link underlines, spacing). Controls sit in the **top nav** so they don’t collide with the chat widget.

### 5.5 CSS

| File | Role |
|------|------|
| `css/styles.css` | Global site chrome |
| `css/about.css`, `about-repo.css`, `about-philip-lower.css`, `about-instagram.css` | About layout pieces |
| `css/theme-turquoise.css` | Ocean theme for About |
| `css/story.css` | Story / scrolly stage |
| `css/a11y.css` | Accessibility panel + `data-*` effects |
| `css/agent.css` | Chat dock |
| `css/modal.css` | Modals |

### 5.6 Analytics (client)

`docs/js/posthog.js` initializes PostHog for page analytics and session recording (password fields masked). Most pages include this script in `<head>`.

This is **separate from** (but complementary to) optional **server-side** PostHog in `backend/app/posthog_client.py`, which can capture login, signup, claims, commitments, etc., when `POSTHOG_*` env vars are set.

### 5.7 AI agent (client)

- Default mode: DeepSeek via backend (`agent-config.js` → `agent.js` → `POST /api/agent/chat`).
- The browser never holds the DeepSeek API key.
- Access level is enforced on the server: **guest** / **member** / **admin** (admin can also attach admin-dashboard localStorage context).
- To restore the old n8n widget: set `LOVE21_AGENT_MODE = "n8n"` in `agent-config.js`.

---

## 6. Backend (`backend/`)

### 6.1 Package map

| Path | Role |
|------|------|
| `app/main.py` | FastAPI app, lifespan, middleware, router includes, static mount |
| `app/database.py` | Engine, `SessionLocal`, `get_db` |
| `app/models.py` | SQLAlchemy ORM models |
| `app/schemas.py` | Pydantic request/response models |
| `app/seed.py` | `create_all`, SQLite ALTERs, demo seed, idempotent showcase data |
| `app/security.py` | Password hash / verify |
| `app/deps.py` | `get_current_person`, admin checks from `X-Demo-Token` |
| `app/roles_util.py` | Multi-role helpers (`ensure_role`, etc.) |
| `app/labels.py` | Human labels for statuses / journey event types |
| `app/points.py` | Points from minutes + redeem catalogue |
| `app/email_client.py` | SMTP send, QR data URIs, frontend URL builder |
| `app/reminders.py` | ~24h class / in-person volunteer reminder job |
| `app/posthog_client.py` | Optional server PostHog |
| `app/settings.py` | DeepSeek + Instagram settings |
| `app/routers/*.py` | HTTP endpoints |

There is **no Alembic**. Schema changes for demos are handled by `Base.metadata.create_all` plus `_migrate_sqlite_columns()` in `seed.py` (ADD COLUMN style for SQLite).

### 6.2 Dependencies (`requirements.txt`)

- FastAPI, Uvicorn  
- SQLAlchemy 2.x  
- Pydantic / pydantic-settings  
- PostHog Python SDK  
- APScheduler  
- qrcode[pil] (invite / claim emails)

### 6.3 API surface (by router)

Prefix summary (exact paths live in each router file):

| Prefix | File | What it does |
|--------|------|----------------|
| `/api/auth` | `auth.py` | Demo accounts list, demo-login, signup, login, claim invite password |
| `/api/agent` | `agent.py` | Chat with DeepSeek or local fallback; role-scoped context |
| `/api/activities` | `activities.py` | Activity catalogue with filters |
| `/api/family` | `family.py` | Register/waitlist, feedback, cancel + promote, household members, invites, join |
| `/api/achievements` | `achievements.py` | Stamps, goals, share consent, coach approve |
| `/api/impact` | `impact.py` | Transparency demo, donation commitments, receipts |
| `/api/instagram` | `instagram.py` | Cached Graph API feed (pinned + recent) |
| `/api/volunteers` | `volunteers.py` | Shifts, onboard, claims, complete/cancel/reschedule, points, redeem |
| `/api/prefs` | `prefs.py` | Comm preferences + one-click opt-out token |
| `/api/profile` | `profile.py` | Aggregated “My Love21” + PATCH roles |
| `/api/hire` | `hire.py` | Creator hire enquiries (+ admin list) |
| `/api/health` | `main.py` | Liveness |

### 6.4 Database models (conceptual)

Full field-level detail: `backend/db_structure.md` and `backend/app/models.py`.

Core entities:

| Model | Table | Purpose |
|-------|-------|---------|
| `Person` | `people` | User identity, roles, household link, credentials |
| `Household` | `households` | Family unit + carer |
| `HouseholdInvite` | `household_invites` | Invite codes / status |
| `CommPreferences` | `comm_preferences` | Email/SMS/WhatsApp toggles + opt-out token |
| `Activity` | `activities` | Programme catalogue |
| `Registration` | `registrations` | Class booking / waitlist |
| `RegistrationAttendee` | `registration_attendees` | Party size on a registration |
| `Achievement` | `achievements` | Member stamps (pending / coach_approved / shared) |
| `Goal` | `goals` | Member goals |
| `ImpactBadge` | `impact_badges` | Donor badges |
| `DonationCommitment` | `donation_commitments` | Recurring / pledged gift |
| `DonationReceipt` | `donation_receipts` | Paid amount + **`story_back`** narrative |
| `VolunteerProfile` | `volunteer_profiles` | Skills, hours, points |
| `VolunteerShift` | `volunteer_shifts` | Open shifts / tasks |
| `VolunteerShiftClaim` | `volunteer_shift_claims` | Claims on shifts |
| `VolunteerClaimAttendee` | `volunteer_claim_attendees` | Party on a claim |
| `HireEnquiry` | `hire_enquiries` | Corporate / creator hire requests |
| `JourneyEvent` | `journey_events` | Audit / timeline of meaningful actions |

`JourneyEvent` is written from family, impact, volunteers, achievements, prefs, hire, profile, etc., and surfaces on the Profile timeline (last N events) and in member agent context.

### 6.5 Domain logic highlights

#### Family / programmes

- Register against an activity; if full → waitlist with position.
- Cancel can free a spot and **promote** waitlisted people.
- Household invites: TTL (days), email + QR linking to frontend claim/join URLs.
- Party size supported on registration attendees.

#### Donations / impact

- Starting a commitment creates commitment + immediate receipt with tiered **`story_back`** text (what the gift roughly funds).
- Impact badges / profile metrics include thresholds such as first gift, HKD 1k, regular months, HKD 5k (see profile metrics helpers and `PROFILE_DATABASE_FRONTEND_MAPPING.md`).
- Transparency endpoint returns a demo spend breakdown for the Impact / transparency UX.

#### Volunteers / points

- Onboarding gates some claims.
- Completing a claim awards points via `points_for_minutes` and bumps hours.
- Redeem catalogue (`points.py`): thank-you postcard, class credit, tote, guest swim pass (demo costs).
- Cancel / reschedule can notify party members via email helpers.

#### Profile aggregate

`GET /api/profile` is the main read model for the passport UI: person, prefs, family + metrics, achievements/goals, impact, volunteer summary, journey events, hire enquiries, calendar mash-up, `visible_tabs` / `home_tab` / `next_action`.

#### Email

- `email_client.send_email`: if SMTP creds missing → log and return false (no crash).
- Used for household invites, reminders (~23–25h window before sessions), volunteer party notifications.
- Reminder job skips children and respects `email_on` prefs.

#### Instagram

- Server-side Graph fetch; Bearer token never exposed to the browser.
- In-memory cache (default TTL 900s).
- Splits pinned media IDs (env) vs recent.

#### Agent

- Builds context by access level.
- DeepSeek if key present; else `_local_answer` demo responses.
- Read-oriented: helps navigate and explain; not a general write API.

---

## 7. Demo accounts and seed data

Password for seeded accounts: **`love21demo`**.

| Email | Typical use |
|-------|-------------|
| `carer@chen.demo` | Family carer (also multi-role showcase) |
| `dad@chen.demo` | Second carer |
| `alex@chen.demo` | Member / child in household |
| `donor@demo.love21` | Donor / supporter |
| `volunteer@demo.love21` | Volunteer |
| `admin@demo.love21` | Administrator |

Instant role switch (no password): `POST /api/auth/demo-login` with `{ "email": "..." }`.  
Normal login: `POST /api/auth/login` with identifier + password.  
Signup: `POST /api/auth/signup`.

Seed pipeline (`seed.init_db`): create tables → migrate missing columns → seed if empty → ensure admin → ensure profile showcase data (idempotent extras).

If the DB schema drifts badly during local hacking, delete `backend/love21.db` and restart `./run.sh` to reseed (you will lose local demo mutations).

---

## 8. Tests

Under `backend/tests/` (unittest style):

| File | Focus |
|------|-------|
| `test_agent.py` | Access levels / local answers |
| `test_instagram.py` | Normalize / pin / cache behaviour |
| `test_profile_metrics.py` | Family / impact / volunteer badge metrics |

Run from `backend/` with the venv active, e.g. `python -m pytest` or `python -m unittest discover`.

---

## 9. What is *not* the core product (but lives nearby)

| Path | Note |
|------|------|
| `.about-backup/` | Old About HTML/JS/CSS snapshots |
| `docs/legacy/n8n-agent/` | Documentation for switching back to n8n chat |
| `docs/pages/admin-dashboard.html` | Powerful localStorage dashboard; not the SQLite Profile source of truth |
| `docs/pages/upload_supabase.html` | Separate Supabase upload utility |
| Root PDFs / screenshots / large MP4s | Briefing and pitch media; not runtime code |
| `docs/PITCH_SLIDES.md` | Spoken / deck narrative for judging |

---

## 10. End-to-end journeys (how to “see” the system)

Use local **http://127.0.0.1:8000** with the API running.

1. **Family** — Home → Family → Activity Finder → register (login as `carer@chen.demo`) → Profile calendar / family passport.
2. **Donor** — Home → Donor / Impact → demo payment → receipt with story-back → Profile donor passport / commitments.
3. **Volunteer** — Home → Volunteer → onboard if needed → claim shift → complete → points / redeem path → Profile volunteer passport.
4. **Empathy / immersion** — About → scroll story morph → Walk the park → Instagram section (if tokens configured).
5. **Company / hire** — Explore / Contributor → hire modal → admin hire list as `admin@demo.love21`.
6. **Agent** — Chat dock: ask as guest, then after login as member/admin, compare what it can see.
7. **Household invite** — Family flow creates invite; claim via `claim-account.html?code=…` (email logged if SMTP off).

---

## 11. Judging criteria ↔ code surfaces (quick map)

Official criteria live in `judging_criteria.pdf`. Rough mapping used in pitch notes:

| Criterion | Where to look in the repo |
|-----------|---------------------------|
| Relevance | Role gate + Profile next actions; About empathy; points; PostHog / journey events |
| Effectiveness & feasibility | Working APIs + seed demos; static+FastAPI stack; SMTP optional |
| Technical design & completeness | Models, routers, Profile aggregate, Instagram proxy, agent levels, a11y |
| Creativity & innovation | story-dust morph, sensory sim, passport UI, story-back receipts, multi-role |
| Social / environmental (ESG framing in pitch) | Dignity-first About; programme access; finance transparency; prefs/opt-out; digital-first engagement |

Narrative version: `docs/PITCH_SLIDES.md`.

---

## 12. Conventions worth knowing before you edit

1. **Prefer same-origin on 8000** when developing API-backed pages — avoids CORS and base-URL confusion.
2. **Do not query SQLite from the browser.** Always go through `/api/...`.
3. **Profile mapping doc** (`PROFILE_DATABASE_FRONTEND_MAPPING.md`) is the field-level contract for passport UI work.
4. **Static cache:** local FastAPI serves `docs/` with `Cache-Control: no-cache`. On GitHub Pages, hard-refresh after CSS/JS changes.
5. **Multi-role is first-class** — avoid assuming a person has exactly one role.
6. **Demo payments and demo tokens** are intentional; replace carefully if you harden for production.
7. **Keep secrets in `backend/.env`**, never in front-end JS (Instagram, DeepSeek, SMTP). Client PostHog project keys are public-by-design for browser SDKs but should still be treated thoughtfully.

---

## 13. Suggested reading order for a new contributor

1. This file (orientation).  
2. `README.md` + `backend/README.md` (run it).  
3. Click Home → About → one hub → Profile with a demo login.  
4. `backend/app/models.py` + `db_structure.md`.  
5. `backend/app/routers/profile.py` + `docs/js/profile.js` + mapping doc.  
6. The router for the domain you will change (family / impact / volunteers / about assets).  
7. `docs/PITCH_SLIDES.md` if you need the product story for judges.

---

*Generated as a living overview of the repository as implemented. When behaviour and this doc disagree, trust the code — then update this guide.*
