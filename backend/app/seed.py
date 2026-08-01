import secrets
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine
from .security import hash_password


def seed(db: Session) -> None:
    if db.query(models.Person).first():
        return

    household = models.Household(name="Chen family", notes="Demo household")
    db.add(household)
    db.flush()

    carer = models.Person(
        email="carer@chen.demo",
        name="Jamie Chen",
        role_primary="family",
        roles="family,volunteer,donor",
        language="both",
        household_id=household.id,
        household_role="mom",
        profile_code="L21-HK-1001",
    )
    member = models.Person(
        email="alex@chen.demo",
        name="Alex Chen",
        role_primary="member",
        roles="member",
        language="yue",
        household_id=household.id,
        household_role="child",
        profile_code="L21-HK-1002",
    )
    dad = models.Person(
        email="dad@chen.demo",
        name="Chris Chen",
        role_primary="family",
        roles="family,donor",
        language="en",
        household_id=household.id,
        household_role="dad",
        profile_code="L21-HK-1003",
    )
    donor = models.Person(
        email="donor@demo.love21",
        name="Sam Wong",
        role_primary="donor",
        roles="donor,volunteer",
        language="en",
        profile_code="L21-HK-2001",
    )
    volunteer = models.Person(
        email="volunteer@demo.love21",
        name="Taylor Ng",
        role_primary="volunteer",
        roles="volunteer,donor",
        language="both",
        profile_code="L21-HK-3001",
    )
    db.add_all([carer, member, dad, donor, volunteer])
    db.flush()

    household.carer_person_id = carer.id

    for person in (carer, member, dad, donor, volunteer):
        db.add(
            models.CommPreferences(
                person_id=person.id,
                email_on=True,
                sms_on=False,
                whatsapp_on=False,
                opt_out_token=secrets.token_urlsafe(16),
            )
        )

    activities = [
        models.Activity(
            title="Swim · beginners",
            description="San Po Kong pool · ages 6–12 · bilingual coaches.",
            goal="sport",
            age_band="child",
            day="saturday",
            support_need="low",
            language="both",
            capacity=12,
            spots_left=2,
        ),
        models.Activity(
            title="One-on-one nutrition",
            description="Cantonese sessions · teens · waitlist open.",
            goal="nutrition",
            age_band="teen",
            day="weekday",
            support_need="1to1",
            language="yue",
            capacity=4,
            spots_left=0,
        ),
        models.Activity(
            title="Yoga & stretch",
            description="Adult members · calm room · group welcome.",
            goal="arts",
            age_band="adult",
            day="sunday",
            support_need="group",
            language="en",
            capacity=15,
            spots_left=8,
        ),
        models.Activity(
            title="Parent counselling circle",
            description="Carers’ peer support · monthly · San Po Kong.",
            goal="family",
            age_band="adult",
            day="saturday",
            support_need="group",
            language="yue",
            capacity=20,
            spots_left=11,
        ),
        models.Activity(
            title="Ball sports clinic",
            description="Teens · bilingual · join waitlist for next block.",
            goal="sport",
            age_band="teen",
            day="weekday",
            support_need="group",
            language="both",
            capacity=10,
            spots_left=0,
        ),
        models.Activity(
            title="Cooking together",
            description="Member-led kitchen · English · quiet hour option.",
            goal="nutrition",
            age_band="adult",
            day="saturday",
            support_need="low",
            language="en",
            capacity=8,
            spots_left=3,
        ),
    ]
    db.add_all(activities)
    db.flush()

    # Existing family registrations
    db.add(
        models.Registration(
            activity_id=activities[0].id,
            household_id=household.id,
            member_person_id=member.id,
            status="registered",
            reminder_channel="email",
            session_date=date.today() + timedelta(days=(5 - date.today().weekday()) % 7 or 7),
        )
    )
    db.add(
        models.Registration(
            activity_id=activities[1].id,
            household_id=household.id,
            member_person_id=member.id,
            status="waitlist",
            waitlist_position=4,
            reminder_channel="email",
            session_date=date.today() + timedelta(days=10),
        )
    )
    db.add(
        models.Registration(
            activity_id=activities[5].id,
            household_id=household.id,
            member_person_id=member.id,
            status="attended",
            reminder_channel="email",
            session_date=date.today() - timedelta(days=7),
            feedback="Alex loved the quiet hour and helped plate snacks.",
        )
    )

    db.add_all(
        [
            models.Achievement(
                member_person_id=member.id,
                title="First 25m freestyle",
                pillar="sport",
                status="coach_approved",
                share_consent=True,
                coach_name="Coach Pat",
                approved_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=40),
            ),
            models.Achievement(
                member_person_id=member.id,
                title="Nutrition plan · 8 weeks",
                pillar="nutrition",
                status="coach_approved",
                share_consent=False,
                coach_name="Coach Yan",
                approved_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=14),
            ),
            models.Goal(
                member_person_id=member.id,
                title="Lead warm-up · Sep goal",
                status="in_progress",
                target_date=date(2026, 9, 30),
            ),
        ]
    )
    # Add a staff account for admin/testing
    staff = models.Person(
        email="staff@love21.org",
        name="Love 21 Staff",
        role_primary="donor",
        language="en",
        profile_code="L21-HK-9000",
        password_hash=hash_password("changeme123"),
        auth_provider="password",
        is_staff=True,
    )
    db.add(staff)
    db.flush()
    db.add(
        models.CommPreferences(
            person_id=staff.id,
            email_on=True,
            sms_on=False,
            whatsapp_on=False,
            opt_out_token=secrets.token_urlsafe(16),
        )
    )
    commitment = models.DonationCommitment(
        supporter_person_id=donor.id,
        amount_hkd=300,
        fund_category="Sports programmes",
        status="active",
        cadence="monthly",
    )
    db.add(commitment)
    db.flush()
    db.add(
        models.DonationReceipt(
            commitment_id=commitment.id,
            amount_hkd=300,
            paid_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=20),
            story_back=(
                "Your donation of HKD 300 allowed us to fund two coach-led swim "
                "sessions, cover lane fees, and print bilingual class sheets."
            ),
        )
    )
    db.add(
        models.ImpactBadge(
            person_id=donor.id,
            title="Local contributor",
            level="bronze",
            earned_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=20),
        )
    )

    vprofile = models.VolunteerProfile(
        person_id=volunteer.id,
        skills="cantonese,photos,voice",
        languages="yue,en",
        availability="saturday mornings, remote",
        onboarded=True,
        hours_logged=6.5,
        points_balance=55,
        points_spent=0,
    )
    db.add(vprofile)
    # Jamie is also a volunteer in the multi-role demo
    db.add(
        models.VolunteerProfile(
            person_id=carer.id,
            skills="photos,voice",
            languages="both",
            availability="weekday evenings",
            onboarded=True,
            hours_logged=1.0,
        )
    )
    db.add(
        models.VolunteerProfile(
            person_id=donor.id,
            skills="photos",
            languages="en",
            availability="remote",
            onboarded=False,
            hours_logged=0.0,
        )
    )
    db.flush()

    shifts = [
        models.VolunteerShift(
            title="Cantonese flyer check",
            description="Proofread banquet flyers.",
            duration_min=15,
            skills_needed="cantonese",
            language="yue",
            remote=True,
            spots_left=3,
            scheduled_date=date.today() + timedelta(days=2),
        ),
        models.VolunteerShift(
            title="Photo sort",
            description="Sort July hike photos into swim, kitchen, and track folders.",
            duration_min=30,
            skills_needed="photos",
            language="en",
            remote=True,
            spots_left=2,
            scheduled_date=date.today() + timedelta(days=6),
        ),
        models.VolunteerShift(
            title="Voice cheers",
            description="Record a few short cheers for Saturday track.",
            duration_min=45,
            skills_needed="voice",
            language="en",
            remote=True,
            spots_left=5,
            scheduled_date=date.today() + timedelta(days=9),
        ),
        models.VolunteerShift(
            title="Session buddy · swimming",
            description="Help one swim lane. Onboarded volunteers only.",
            duration_min=120,
            skills_needed="sports",
            language="both",
            remote=False,
            spots_left=2,
            requires_onboarding=True,
            scheduled_date=date.today() + timedelta(days=12),
        ),
    ]
    db.add_all(shifts)
    db.flush()

    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[0].id,
            volunteer_profile_id=vprofile.id,
            status="completed",
            hours=0.25,
            reflection="Quick. Flyers look clearer in Cantonese.",
            completed_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=18),
            points_awarded=20,
        )
    )
    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[1].id,
            volunteer_profile_id=vprofile.id,
            status="completed",
            hours=0.5,
            reflection="Sorted hiking set; tagged for social wall.",
            completed_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=10),
            points_awarded=35,
        )
    )
    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[2].id,
            volunteer_profile_id=vprofile.id,
            status="claimed",
            hours=shifts[2].duration_min / 60.0,
            points_awarded=0,
        )
    )
    shifts[0].spots_left = 2
    shifts[1].spots_left = 1
    shifts[2].spots_left = max(0, shifts[2].spots_left - 1)

    db.add_all(
        [
            models.JourneyEvent(
                person_id=carer.id,
                event_type="registration_confirmed",
                channel="email",
                payload="Swim · beginners",
                created_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=12),
            ),
            models.JourneyEvent(
                person_id=carer.id,
                event_type="waitlist_joined",
                channel="email",
                payload="One-on-one nutrition",
                created_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=5),
            ),
            models.JourneyEvent(
                person_id=donor.id,
                event_type="commitment_started",
                channel="email",
                payload="amount=300;fund=Sports programmes",
                created_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=20),
            ),
            models.JourneyEvent(
                person_id=volunteer.id,
                event_type="shift_completed",
                channel="email",
                payload="Cantonese flyer check",
                created_at=datetime.now(datetime.UTC).replace(tzinfo=None) - timedelta(days=18),
            ),
        ]
    )

    db.commit()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_columns()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


def _migrate_sqlite_columns() -> None: #using this function instead of actually altering the database before discussing
    """Add new columns on existing SQLite DBs without wiping data."""
    from sqlalchemy import text

    alters = [
        ("volunteer_profiles", "points_balance", "INTEGER DEFAULT 0"),
        ("volunteer_profiles", "points_spent", "INTEGER DEFAULT 0"),
        ("volunteer_shift_claims", "points_awarded", "INTEGER DEFAULT 0"),
        ("donation_commitments", "payment_method", "VARCHAR(40) DEFAULT 'PayMe'"),
        ("hire_enquiries", "requester_name", "VARCHAR(120) DEFAULT ''"),
        ("hire_enquiries", "company_name", "VARCHAR(160) DEFAULT ''"),
        ("hire_enquiries", "event_description", "TEXT DEFAULT ''"),
        ("hire_enquiries", "event_date", "DATE"),
        ("hire_enquiries", "contact_email", "VARCHAR(255)"),
        ("hire_enquiries", "contact_phone", "VARCHAR(40)"),
        ("registrations", "owner_person_id", "INTEGER"),
        ("registrations", "party_size", "INTEGER DEFAULT 1"),
        ("registrations", "contact_name", "VARCHAR(120) DEFAULT ''"),
        ("registrations", "contact_phone", "VARCHAR(40) DEFAULT ''"),
    ]
    with engine.begin() as conn:
        for table, col, decl in alters:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            names = {r[1] for r in rows}
            if col not in names:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {decl}"))

        # backfill owner_person_id on any legacy registration rows that predate it
        conn.execute(text(
            "UPDATE registrations SET owner_person_id = member_person_id "
            "WHERE owner_person_id IS NULL AND member_person_id IS NOT NULL"
        ))

        # Demo: give Taylor a starter balance once if still at zero
        conn.execute(
            text(
                """
                UPDATE volunteer_profiles
                SET points_balance = 55
                WHERE points_balance = 0
                  AND person_id = (
                    SELECT id FROM people WHERE email = 'volunteer@demo.love21'
                  )
                """
            )
        )

    # Backfill session_date on legacy registration rows so the Profile
    # calendar shows class events (seed only sets these on fresh DBs).
    _backfill_session_dates()

    # Backfill volunteer shift scheduled dates so the Profile calendar
    # shows volunteer shift events on legacy DBs.
    _backfill_shift_dates()

    # Ensure every demo account the UI offers exists on legacy DBs where
    # the initial seed ran before some accounts were added.
    _backfill_demo_accounts()


def _backfill_shift_dates() -> None:
    """Give legacy volunteer shifts a scheduled_date so the Profile calendar shows them."""
    from sqlalchemy import text

    with SessionLocal() as db:
        rows = db.execute(
            text(
                "SELECT id FROM volunteer_shifts WHERE scheduled_date IS NULL "
                "ORDER BY id"
            )
        ).fetchall()
        today = date.today()
        # Space shifts out starting tomorrow so the calendar has upcoming events.
        for i, (shift_id,) in enumerate(rows):
            scheduled = today + timedelta(days=i + 1)
            db.execute(
                text("UPDATE volunteer_shifts SET scheduled_date = :d WHERE id = :id"),
                {"d": scheduled.isoformat(), "id": shift_id},
            )
        db.commit()


def _backfill_demo_accounts() -> None:
    """Create any missing demo accounts from auth.DEMO_ACCOUNTS."""
    from sqlalchemy import text

    with SessionLocal() as db:
        existing = {
            row[0]
            for row in db.execute(
                text("SELECT email FROM people WHERE email LIKE '%.demo' OR email LIKE '%.love21'")
            ).fetchall()
        }
        household_id = db.execute(
            text(
                "SELECT h.id FROM households h "
                "JOIN people p ON p.household_id = h.id "
                "WHERE p.email = 'carer@chen.demo' LIMIT 1"
            )
        ).scalar()
        if not household_id:
            # The Chen household may not exist yet on this DB; create it.
            db.execute(
                text(
                    "INSERT INTO households (name, notes) VALUES ('Chen family', 'Demo household')"
                )
            )
            db.commit()
            household_id = db.execute(
                text("SELECT id FROM households WHERE name = 'Chen family' ORDER BY id LIMIT 1")
            ).scalar()
            carer_id = db.execute(
                text("SELECT id FROM people WHERE email = 'carer@chen.demo'")
            ).scalar()
            if carer_id:
                db.execute(
                    text("UPDATE households SET carer_person_id = :c WHERE id = :h"),
                    {"c": carer_id, "h": household_id},
                )
                db.execute(
                    text("UPDATE people SET household_id = :h WHERE id = :c"),
                    {"h": household_id, "c": carer_id},
                )

        accounts = {
            "carer@chen.demo": ("Jamie Chen", "family", "family,volunteer,donor", "mom"),
            "dad@chen.demo": ("Chris Chen", "family", "family,donor", "dad"),
            "alex@chen.demo": ("Alex Chen", "member", "member", "child"),
            "donor@demo.love21": ("Sam Wong", "donor", "donor,volunteer", None),
            "volunteer@demo.love21": ("Taylor Ng", "volunteer", "volunteer,donor", None),
        }
        for email, (name, primary, roles, hh_role) in accounts.items():
            if email in existing:
                continue
            profile_code = {
                "carer@chen.demo": "L21-HK-1001",
                "dad@chen.demo": "L21-HK-1003",
                "alex@chen.demo": "L21-HK-1002",
                "donor@demo.love21": "L21-HK-2001",
                "volunteer@demo.love21": "L21-HK-3001",
            }[email]
            hh = household_id if hh_role else None
            db.execute(
                text(
                    "INSERT INTO people "
                    "(email, name, role_primary, roles, language, profile_code, "
                    " household_id, household_role, issued_at, created_at) "
                    "VALUES (:email, :name, :primary, :roles, 'both', :code, "
                    " :hh, :hh_role, :now, :now)"
                ),
                {
                    "email": email,
                    "name": name,
                    "primary": primary,
                    "roles": roles,
                    "code": profile_code,
                    "hh": hh,
                    "hh_role": hh_role,
                    "now": datetime.utcnow(),
                },
            )
            person_id = db.execute(
                text("SELECT id FROM people WHERE email = :email"),
                {"email": email},
            ).scalar()
            db.execute(
                text(
                    "INSERT OR IGNORE INTO comm_preferences "
                    "(person_id, email_on, sms_on, whatsapp_on, opt_out_token) "
                    "VALUES (:pid, 1, 0, 0, :token)"
                ),
                {"pid": person_id, "token": secrets.token_urlsafe(16)},
            )
            if email == "dad@chen.demo":
                # Dad shares the Chen household registrations/calendar
                db.execute(
                    text(
                        "UPDATE people SET household_id = :h WHERE id = :id"
                    ),
                    {"h": household_id, "id": person_id},
                )
        db.commit()


def _backfill_session_dates() -> None:
    """Give legacy registrations a session_date so the Profile calendar shows them."""
    from sqlalchemy import text

    day_offsets = {
        "sunday": 0,
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
    }
    with SessionLocal() as db:
        rows = db.execute(
            text(
                "SELECT r.id, r.status, a.day FROM registrations r "
                "JOIN activities a ON a.id = r.activity_id "
                "WHERE r.session_date IS NULL"
            )
        ).fetchall()
        today = date.today()
        for reg_id, status, day in rows:
            target = day_offsets.get(day, 5)
            if status == "attended":
                # nearest past occurrence of the class day
                delta = (today.weekday() - target) % 7
                session_date = today - timedelta(days=delta or 7)
            else:
                # next occurrence of the class day
                delta = (target - today.weekday()) % 7
                session_date = today + timedelta(days=delta or 7)
            db.execute(
                text("UPDATE registrations SET session_date = :d WHERE id = :id"),
                {"d": session_date.isoformat(), "id": reg_id},
            )
        db.commit()
