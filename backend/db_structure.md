Based on the models, foreign keys, and relationships referenced in `seed.py`, here is the database structure powering the application:

```
                          ┌──────────────────────┐
                          │      Household       │
                          ├──────────────────────┤
                          │ id (PK)              │
                          │ name                 │
                          │ notes                │
                          │ carer_person_id (FK) ────┐
                          └──────────┬───────────┘   │
                                     │ 1             │
                                     │               │
                                     │ N             │
┌─────────────────────────┐   ┌──────┴───────────────┐   ┌───────────────────────────┐
│     CommPreferences     │   │        Person        │   │        Achievement        │
├─────────────────────────┤   ├──────────────────────┤   ├───────────────────────────┤
│ id (PK)                 │ 1 │ id (PK)              │ 1 │ id (PK)                   │
│ person_id (FK) ─────────┼───┤ email                │───┼─► member_person_id (FK)   │
│ email_on                │   │ name                 │ N │ title, pillar, status     │
│ sms_on                  │   │ role_primary         │   │ share_consent, coach_name │
│ whatsapp_on             │   │ roles                │   │ approved_at               │
│ opt_out_token           │   │ language             │   └───────────────────────────┘
└─────────────────────────┘   │ household_id (FK)    │
                              │ household_role       │   ┌───────────────────────────┐
                              │ password_hash        │ 1 │           Goal            │
                              │ profile_code         │───┼───────────────────────────┤
                              └──────┬───────────────┘ N │ id (PK)                   │
                                     │                   │ member_person_id (FK)     │
                                     │ 1                 │ title, status, target_date│
                                     ├─────────────────┐ └───────────────────────────┘
                                     │ N               │ 1
                                     ▼                 ▼
                          ┌────────────────────┐ ┌─────┴─────────────────────┐
                          │    JourneyEvent    │ │     VolunteerProfile      │
                          ├────────────────────┤ ├───────────────────────────┤
                          │ id (PK)            │ │ id (PK)                   │
                          │ person_id (FK)     │ │ person_id (FK)            │
                          │ event_type         │ │ skills, languages         │
                          │ channel            │ │ availability, onboarded   │
                          │ payload            │ │ hours_logged              │
                          │ created_at         │ │ points_balance            │
                          └────────────────────┘ │ points_spent              │
                                                 └─────────────┬─────────────┘
                                                               │ 1
                                                               │
                                                               │ N
┌─────────────────────────┐   ┌────────────────────┐   ┌───────┴───────────────────┐
│        Activity         │   │    Registration    │   │    VolunteerShiftClaim    │
├─────────────────────────┤   ├────────────────────┤   ├───────────────────────────┤
│ id (PK)                 │ 1 │ id (PK)            │ N │ id (PK)                   │
│ title, description      │───┼─► activity_id (FK) │◄──┼─── shift_id (FK)          │
│ goal, age_band          │ N │ household_id (FK)  │   │ volunteer_profile_id (FK) │
│ day, support_need       │   │ member_person_id   │   │ status, hours, reflection │
│ language                │   │ status             │   │ completed_at              │
│ capacity, spots_left    │   │ reminder_channel   │   │ points_awarded            │
└─────────────────────────┘   │ session_date       │   └───────────────────────────┘
                              │ waitlist_position  │                 ▲
                              │ feedback           │                 │ N
                              └────────────────────┘                 │
                                                       ┌─────────────┴─────────────┐
                                                       │      VolunteerShift       │
┌─────────────────────────┐   ┌────────────────────┐   ├───────────────────────────┤
│   DonationCommitment    │   │  DonationReceipt   │   │ id (PK)                   │
├─────────────────────────┤   ├────────────────────┤   │ title, description        │
│ id (PK)                 │ 1 │ id (PK)            │   │ duration_min              │
│ supporter_person_id(FK) │───┼─►commitment_id (FK)│   │ skills_needed, language   │
│ amount_hkd              │ N │ amount_hkd         │   │ remote, spots_left        │
│ fund_category           │   │ paid_at            │   │ requires_onboarding       │
│ status, cadence         │   │ story_back         │   │ scheduled_date            │
└─────────────────────────┘   └────────────────────┘   └───────────────────────────┘

```

---

## Entity Details & Field Schema

### 1. User & Household Domain

* **`Household`**: Represents a family unit.
* Fields: `id`, `name`, `notes`, `carer_person_id` (FK to `Person`).


* **`Person`**: Main user table covering members, family carers, donors, volunteers, and admins.
* Fields: `id`, `email`, `name`, `role_primary`, `roles`, `language`, `household_id` (FK), `household_role`, `password_hash`, `profile_code`.


* **`CommPreferences`**: One-to-one communication settings per person.
* Fields: `id`, `person_id` (FK to `Person`), `email_on`, `sms_on`, `whatsapp_on`, `opt_out_token`.



---

### 2. Activity & Program Domain

* **`Activity`**: Programs offered by the platform.
* Fields: `id`, `title`, `description`, `goal`, `age_band`, `day`, `support_need`, `language`, `capacity`, `spots_left`.


* **`Registration`**: Junction table linking a person/household to an activity session.
* Fields: `id`, `activity_id` (FK), `household_id` (FK), `member_person_id` (FK), `status` (`registered`, `waitlist`, `attended`), `reminder_channel`, `session_date`, `waitlist_position`, `feedback`.



---

### 3. Member Progress Domain

* **`Achievement`**: Milestones approved by coaches.
* Fields: `id`, `member_person_id` (FK to `Person`), `title`, `pillar`, `status`, `share_consent`, `coach_name`, `approved_at`.


* **`Goal`**: Targets set for beneficiaries.
* Fields: `id`, `member_person_id` (FK to `Person`), `title`, `status`, `target_date`.



---

### 4. Volunteering Domain

* **`VolunteerProfile`**: Extended profile for users with a volunteer role.
* Fields: `id`, `person_id` (FK to `Person`), `skills`, `languages`, `availability`, `onboarded`, `hours_logged`, `points_balance`, `points_spent`.


* **`VolunteerShift`**: Volunteer opportunities (both in-person and remote/async).
* Fields: `id`, `title`, `description`, `duration_min`, `skills_needed`, `language`, `remote`, `spots_left`, `requires_onboarding`, `scheduled_date`.


* **`VolunteerShiftClaim`**: Claims made by volunteers for shifts.
* Fields: `id`, `shift_id` (FK), `volunteer_profile_id` (FK), `status` (`claimed`, `completed`), `hours`, `reflection`, `completed_at`, `points_awarded`.



---

### 5. Fundraising & Audit Domain

* **`DonationCommitment`**: Recurring donor pledges.
* Fields: `id`, `supporter_person_id` (FK to `Person`), `amount_hkd`, `fund_category`, `status`, `cadence`.


* **`DonationReceipt`**: Transaction receipts generated under a commitment.
* Fields: `id`, `commitment_id` (FK to `DonationCommitment`), `amount_hkd`, `paid_at`, `story_back`.


* **`ImpactBadge`**: Badges awarded to supporters based on contributions.
* Fields: `id`, `person_id` (FK to `Person`), `title`, `level`, `earned_at`.


* **`JourneyEvent`**: Audit log/timeline tracking user milestones across all channels.
* Fields: `id`, `person_id` (FK to `Person`), `event_type`, `channel`, `payload`, `created_at`.