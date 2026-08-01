# Profile page - database-to-frontend mapping

## Purpose

Use this document as the editable source of truth for the Profile page's live connection to the current SQLite database.

**Scope:** `docs/pages/profile.html` and its JavaScript, backed by `GET /api/profile`.

**Current database/API path:**

```text
docs/pages/profile.html + docs/js/profile.js + docs/js/journal.js
  -> GET /api/profile (X-Demo-Token identifies the signed-in person)
  -> backend/app/routers/profile.py
  -> SQLAlchemy models
  -> backend/love21.db (SQLite)
```

Do not have browser JavaScript query `love21.db` directly. The backend must select and authorize data, then return only the JSON needed by the current person.

## Current state

| Profile area | Current source | Is it real database data now? | Implementation note |
| --- | --- | --- | --- |
| Profile header: name, roles, profile code | `GET /api/profile -> person` | Yes | Rendered by `docs/js/profile.js`. |
| Communication preference switches | `GET/PATCH /api/prefs` and `profile.prefs` | Yes | The values are database-backed. |
| Family members | `profile.family.members` | Yes | Adding a member calls `POST /api/family/members`. |
| Household calendar | `profile.calendar_events` | Yes | Combines dated classes, volunteer shifts, and paid donations for every member of the selected household. |
| Passport selector labels, book identity, badges, and recent records | `GET /api/profile` | Yes | `docs/js/journal.js` now derives all passport content from the authenticated payload. |
| `renderFeed()` in `docs/js/profile.js` | `GET /api/profile` data | Not visible | It has no matching `[data-activity-feed]` element in `profile.html`, so it currently renders nowhere. |

## Single API payload to use

Start with the existing authenticated request:

```js
const profile = await window.Love21.api("/api/profile");
```

It already returns the profile-oriented aggregate needed by the page. Keep this as the page's primary read request rather than making the browser issue one SQL-shaped request per card.

## Mapping table: shared profile/header

| Frontend element / content | API field | Database origin | Transformation or display rule | Status / decision |
| --- | --- | --- | --- | --- |
| `[data-cover-name]` | `person.name` | `people.name` | Text | Ready now |
| `[data-cover-role]` | `person.roles`, `person.household_role` | `people.roles`, `people.household_role` | Convert role codes into labels such as Family carer, Volunteer, Supporter; the current `roleLabel()` already does this. | Ready now |
| `[data-cover-code]` | `person.profile_code` | `people.profile_code` | Text | Ready now |
| Passport holder initials | `person.name` | `people.name` | First character of the first two name parts | Ready now |
| Member since | `person.issued_at` | `people.issued_at` | Format as `Month YYYY` | Ready now; use this instead of the static dates in `journal.js` |
| Passport number | `person.profile_code` | `people.profile_code` | Recommended: show the same persistent profile code in all passports. | Product decision: avoid invented role-specific codes unless they are stored. |
| City / home district | none | none | Keep a general Love 21 location as editorial copy, or add a `district` field to `people`. | Missing data for a person-specific value |
| Preferences: email/SMS/WhatsApp | `prefs.email_on`, `prefs.sms_on`, `prefs.whatsapp_on` | `comm_preferences` | Toggle on/off | Ready now |

## Mapping table: Family passport

| Frontend content | API field(s) available now | Database origin | Calculation / rendering rule | Gap or decision |
| --- | --- | --- | --- | --- |
| Show/hide Family passport | `person.roles`, `person.household_id` | `people` | Show when role includes `family` or `member`, or the person belongs to a household. | Ready now |
| Passport title and description | role = `family` | N/A | Static editorial text is acceptable. | Ready now |
| Family members | `family.members[]` | `people` filtered by `household_id` | Render name, household role, and profile code. | Ready now |
| Child names | `family.metrics.child_names` | `people` | Include every household person whose household role is `child` or primary role is `member`; show all names in `Family member`. | Implemented |
| Activities joined | `family.metrics.activities_joined` | `registrations` | Count all children's registrations whose status is exactly `registered` or `attended`. Exclude waitlisted and cancelled records. | Implemented |
| Programmes explored | `family.metrics.programmes_explored` | `registrations -> activities.goal` | Count distinct programme goals across the qualifying child registrations. | Implemented |
| Child-member count | `family.metrics.child_names.length` | `people` | Count child/member records, not carers and helpers. | Implemented |
| Family details: favourite programme | `family.metrics.favourite_programme` | `registrations -> activities` | Most frequent activity title across qualifying child registrations; alphabetical title breaks a tie. | Implemented |
| Family rule badges | `family.metrics.badges[]` | Calculated from registrations | Earn badges at 1, 3, and 5 activities; earn Programme explorer after 3 distinct programme areas. | Implemented |
| Recent class record | `family.registrations[]` | `registrations`, joined `activities`, `people` | Date: `session_date` when present, otherwise `created_at`; title: `activity_title`; detail: `member_name`, location; result: `status_label`. | Ready now |
| Recent achievement record | `achievement.achievements[]` | `achievements` | Date: `approved_at` or `created_at`; title: achievement title; result: status label / coach. | Ready now |

## Mapping table: Volunteer passport

| Frontend content | API field(s) available now | Database origin | Calculation / rendering rule | Gap or decision |
| --- | --- | --- | --- | --- |
| Show/hide Volunteer passport | `person.roles` | `people.roles` | Show when roles include `volunteer` or `corporate`. | Ready now |
| Hours contributed | `volunteer.profile.hours_logged` | `volunteer_profiles.hours_logged` | Display with sensible precision, e.g. `42` or `42.5 hours`. | Ready now |
| Activities/shifts joined | `volunteer.claims[]` | `volunteer_shift_claims` | Recommended: count all non-cancelled claims; label as `shifts claimed`, not `activities joined`. | Product wording decision |
| Days volunteered | `volunteer.claims[].scheduled_date`, `.status` | `volunteer_shift_claims -> volunteer_shifts` | Count distinct non-null scheduled dates for completed claims. Remote tasks have no date and should not be included. | Ready now in frontend, or calculate server-side for consistency |
| Skills / languages / availability | `volunteer.profile.skills`, `.languages`, `.availability` | `volunteer_profiles` | Render as entered; show `Not added yet` when blank. | Ready now |
| Volunteer badges | `volunteer.metrics.badges[]` | Calculated from volunteer profile and claims | Earn at 1 hour, 5 hours, 3 completed shifts, and 3 distinct in-person volunteer days. | Implemented |
| Recent volunteer record | `volunteer.claims[]` | `volunteer_shift_claims`, joined `volunteer_shifts` | Date: `completed_at`, then `claimed_at`, then `scheduled_date`; title: `shift_title`; detail: remote/in-person, duration; result: status and earned points. | Ready now |
| Points and rewards | `volunteer.points_balance`, `.rewards[]` | balance: `volunteer_profiles`; rewards: backend `REWARDS` constant | Still returned by the API for other consumers; the Profile page no longer displays the My tasks panel. | API available; hidden on Profile |

## Mapping table: Donor passport

| Frontend content | API field(s) available now | Database origin | Calculation / rendering rule | Gap or decision |
| --- | --- | --- | --- | --- |
| Show/hide Donor passport | `person.roles`, `impact.commitments[]` | `people.roles`, `donation_commitments` | Show when a donor role exists or at least one commitment exists. | Ready now |
| Total donated | `impact.receipts[]` | `donation_receipts` | `SUM(receipt.amount_hkd)`. Do not use commitment amount because it represents a pledge, not necessarily a payment. | Ready now |
| Gifts made | `impact.receipts[]` | `donation_receipts` | `COUNT(receipts)`. | Ready now |
| Giving occasions | `impact.metrics.giving_occasions` | `donation_receipts` | Count distinct calendar months containing at least one paid receipt. | Implemented |
| Supporter since | `person.issued_at` | `people.issued_at` | Format as `Month YYYY`. | Ready now |
| Regular gift | `impact.commitments[]` | `donation_commitments` | Choose the most recently updated active monthly commitment; display amount + fund. | Define behaviour when there are several active commitments. |
| Primary fund | `impact.commitments[]` | `donation_commitments` | Simple initial rule: fund on the active commitment with the latest `updated_at`. Better rule: fund with greatest paid total. | Better rule requires fund category alongside receipts or an API aggregation. |
| Donor badges | `impact.metrics.badges[]` | Calculated from paid receipts | Earn First gift after 1 payment, Impact maker at HKD 1,000, Regular supporter after 3 paid months, and Community champion at HKD 5,000. | Implemented |
| Recent giving record | `impact.receipts[]` | `donation_receipts` | Date: `paid_at`; title: `Gift - HKD {amount_hkd}`; detail: `story_back`; result: paid. | Ready now |

## Recommended calculations and ownership

| Metric | Formula | Recommended owner | Why |
| --- | --- | --- | --- |
| Family activities joined | count child registrations with `registered` or `attended` status | Backend | Keeps the eligibility rule consistent across pages. |
| Family programmes explored | count distinct activity goals from qualifying child registrations | Backend | Keeps the programme definition consistent. |
| Favourite programme | most frequent registered activity or goal | Backend | Defines a deterministic tie-break and avoids exposing extra raw data. |
| Volunteer hours | `volunteer_profiles.hours_logged` | Backend/database | This is already a maintained aggregate. |
| Volunteer days | distinct scheduled dates on completed, in-person claims | Backend preferred | Prevents remote or cancelled work being accidentally counted. |
| Total donated | sum of donation receipt amounts | Backend | Payment totals should not be client-calculated for a live donor experience. |
| Gifts made | count donation receipts | Backend | Same reason as total donated. |
| Passport badges | stored badges or documented threshold rules | Backend | Badges need one trusted set of rules. |

For the first implementation, client-side calculation from the existing `/api/profile` payload is acceptable for simple display-only counts. Move financial totals, eligibility counts, and badges to the backend before production use.

## Mapping table: household calendar

| Calendar item | API field | Database origin | Inclusion rule | Frontend display |
| --- | --- | --- | --- | --- |
| Child/family class | `calendar_events[].kind = "class"` | `registrations -> activities`, scoped through the current household | Include a registration only when it has a `session_date`; registrations from every household member are eligible. | Activity title, member name, location, and registration status. |
| Volunteer shift | `calendar_events[].kind = "volunteer"` | `volunteer_shift_claims -> volunteer_profiles -> people`, scoped through the current household | Include dated in-person claims and completed remote claims with a completion date; exclude undated open remote work. | Shift title, volunteer name, mode, duration, and claim status. |
| Donation | `calendar_events[].kind = "donation"` | `donation_receipts -> donation_commitments -> people`, scoped through the current household | Include each paid receipt on its `paid_at` date. | `Donation - HKD {amount}`, donor name, fund, and Paid status. |

The backend builds and sorts this household-wide list and returns `person_name` separately from the event title. The browser groups events by date, writes the person's name and event name directly in each occupied date box, and colours the full box by class, volunteer, or donation type. Mixed-type days use a combined background.

## Profile page order and controls

The live Profile page order is: passport journal, household calendar, Member management, then role-aware quick actions. The journal selector and the active journal reader share one `.profile-journal-card` rather than appearing as separate cards. A sticky section index links directly to those four areas. The former `My tasks`, `Manage gift`, and `Your roles` panels have been removed from this page. Their API fields/endpoints remain available for another workflow if needed.

`Replay walkthrough` and `Preferences` sit below the role/profile-code line. Replay resets and starts the guided tour; Preferences opens the preference and demo-account drawer. When authenticated, `Log out` appears immediately to the right of Preferences instead of in the primary navigation. The primary session link uses the person's name only while a token and person are both present; otherwise it reads `Profile`.

## Profile API fields added for the live passport

The existing endpoint was extended with the following focused fields:

| Needed field / aggregate | Suggested JSON location | Why it is needed |
| --- | --- | --- |
| `family.metrics.activities_joined`, `.programmes_explored`, `.favourite_programme`, `.child_names`, `.badges` | `profile.family.metrics` | Implemented. |
| `volunteer.metrics.completed_shifts`, `.days_volunteered`, `.badges` | `profile.volunteer.metrics` | Implemented. |
| `impact.metrics.total_donated`, `.gift_count`, `.giving_occasions`, `.primary_fund`, `.badges` | `profile.impact.metrics` | Implemented. |
| `registration.activity_goal` | `profile.family.registrations[]` | Implemented so the passport can label each activity accurately. |
| District | Static frontend copy | Implemented as `Hong Kong`; no personal district is stored. |

## Implemented connection

1. `GET /api/profile` remains the single authenticated profile read.
2. `docs/js/journal.js` derives all three passports from that response.
3. Selector subtitles use family activity count, volunteer hours, and paid donation total.
4. Activity pages paginate dynamically, so all qualifying records can be viewed rather than only the first four.
5. Rule badges and financial/activity metrics are calculated on the backend.
6. The demo data backfill is idempotent and runs during database initialization.
7. Jamie Chen's demo account includes multiple completed volunteer records and five paid giving months so all three passports have meaningful examples.
8. Calendar events aggregate dated records from all members in Jamie's household.

## Acceptance checklist

- [ ] No passport displays another user's records.
- [ ] A logged-out visitor sees the existing login prompt rather than profile data.
- [ ] Family data uses the selected/current household and shows every child/member name.
- [ ] Donor totals are based on receipts, not pledged commitments.
- [ ] Remote volunteer tasks are not counted as dated volunteering days.
- [ ] Empty states are intentional and do not show demo names, static dates, or invented totals.
- [ ] Profile page works when served by the FastAPI app at `http://127.0.0.1:8000`.
- [ ] Replay walkthrough and Preferences are keyboard-accessible buttons.
- [ ] Calendar markers and details distinguish classes, volunteer work, and donations.

## Resolved decisions

1. Show all child names and combine qualifying activity records from all children.
2. Count `registered` and `attended` activities only.
3. Count giving occasions as distinct paid donation months.
4. Calculate badges from transparent activity, volunteering, and paid-donation thresholds.
5. Display `Hong Kong` as static copy and do not add a district field.

## Remaining future decision

If gift management returns to the Profile page, a multi-commitment interface should require the user to select the commitment being changed.
