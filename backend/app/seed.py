import secrets
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine
from .security import hash_password

DEMO_PASSWORD = "love21demo"


def seed(db: Session) -> None:
    if db.query(models.Person).first():
        return

    household = models.Household(name="Chen family", notes="Demo household")
    db.add(household)
    db.flush()

    demo_hash = hash_password(DEMO_PASSWORD)

    carer = models.Person(
        email="carer@chen.demo",
        name="Jamie Chen",
        role_primary="family",
        roles="family,volunteer,donor",
        language="both",
        household_id=household.id,
        household_role="mom",
        password_hash=demo_hash,
        profile_code="L21-HK-1001",
        login_count=18,
        last_login_at=datetime.utcnow() - timedelta(days=2),
        current_login_at=datetime.utcnow(),
        last_login_ip="202.82.1.15",
    )
    member = models.Person(
        email="alex@chen.demo",
        name="Alex Chen",
        role_primary="member",
        roles="member",
        language="yue",
        household_id=household.id,
        household_role="child",
        password_hash=demo_hash,
        profile_code="L21-HK-1002",
        login_count=30,
        last_login_at=datetime.utcnow() - timedelta(hours=3),
        current_login_at=datetime.utcnow(),
        last_login_ip="218.102.0.8",
    )
    dad = models.Person(
        email="dad@chen.demo",
        name="Chris Chen",
        role_primary="family",
        roles="family,donor",
        language="en",
        household_id=household.id,
        household_role="dad",
        password_hash=demo_hash,
        profile_code="L21-HK-1003",
        login_count=30,
        last_login_at=datetime.utcnow() - timedelta(hours=3),
        current_login_at=datetime.utcnow(),
        last_login_ip="218.102.0.8",
    )
    donor = models.Person(
        email="donor@demo.love21",
        name="Sam Wong",
        role_primary="donor",
        roles="donor,volunteer",
        language="en",
        password_hash=demo_hash,
        profile_code="L21-HK-2001",
    )
    volunteer = models.Person(
        email="volunteer@demo.love21",
        name="Taylor Ng",
        role_primary="volunteer",
        roles="volunteer,donor",
        language="both",
        password_hash=demo_hash,
        profile_code="L21-HK-3001",
    )
    admin = models.Person(
        email="admin@demo.love21",
        name="Morgan Yip",
        role_primary="admin",
        roles="admin",
        language="en",
        password_hash=demo_hash,
        profile_code="L21-HK-9001",
        login_count=20,
        last_login_at=datetime.utcnow() - timedelta(hours=3),
        current_login_at=datetime.utcnow(),
        last_login_ip="14.0.128.42",
    )
    db.add_all([carer, member, dad, donor, volunteer, admin])
    db.flush()

    household.carer_person_id = carer.id

    for person in (carer, member, dad, donor, volunteer, admin):
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
                approved_at=datetime.utcnow() - timedelta(days=40),
            ),
            models.Achievement(
                member_person_id=member.id,
                title="Nutrition plan · 8 weeks",
                pillar="nutrition",
                status="coach_approved",
                share_consent=False,
                coach_name="Coach Yan",
                approved_at=datetime.utcnow() - timedelta(days=14),
            ),
            models.Goal(
                member_person_id=member.id,
                title="Lead warm-up · Sep goal",
                status="in_progress",
                target_date=date(2026, 9, 30),
            ),
        ]
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
            paid_at=datetime.utcnow() - timedelta(days=20),
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
            earned_at=datetime.utcnow() - timedelta(days=20),
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
            description="Proofread banquet flyers. Do anytime this week.",
            duration_min=15,
            skills_needed="cantonese",
            language="yue",
            remote=True,
            spots_left=3,
            scheduled_date=None,
        ),
        models.VolunteerShift(
            title="Photo sort",
            description="Sort July hike photos into swim, kitchen, and track folders. Async.",
            duration_min=30,
            skills_needed="photos",
            language="en",
            remote=True,
            spots_left=2,
            scheduled_date=None,
        ),
        models.VolunteerShift(
            title="Voice cheers",
            description="Record a few short cheers for Saturday track. Upload when ready.",
            duration_min=45,
            skills_needed="voice",
            language="en",
            remote=True,
            spots_left=5,
            scheduled_date=None,
        ),
        models.VolunteerShift(
            title="Kitchen prep · Saturday",
            description="Help set tables and label snack boxes before the banquet.",
            duration_min=90,
            skills_needed="sports",
            language="both",
            remote=False,
            spots_left=4,
            requires_onboarding=False,
            scheduled_date=date.today() + timedelta(days=5),
        ),
        models.VolunteerShift(
            title="Track day helper",
            description="Hand out water and cheer on the straight at San Po Kong.",
            duration_min=120,
            skills_needed="sports",
            language="both",
            remote=False,
            spots_left=6,
            requires_onboarding=False,
            scheduled_date=date.today() + timedelta(days=12),
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
            scheduled_date=date.today() + timedelta(days=19),
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
            completed_at=datetime.utcnow() - timedelta(days=18),
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
            completed_at=datetime.utcnow() - timedelta(days=10),
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
    # Open in-person claim so the profile calendar has a dated mark
    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[3].id,
            volunteer_profile_id=vprofile.id,
            status="claimed",
            hours=shifts[3].duration_min / 60.0,
            points_awarded=0,
        )
    )
    shifts[0].spots_left = 2
    shifts[1].spots_left = 1
    shifts[2].spots_left = max(0, shifts[2].spots_left - 1)
    shifts[3].spots_left = max(0, shifts[3].spots_left - 1)

    db.add_all(
        [
            models.JourneyEvent(
                person_id=carer.id,
                event_type="registration_confirmed",
                channel="email",
                payload="Swim · beginners",
                created_at=datetime.utcnow() - timedelta(days=12),
            ),
            models.JourneyEvent(
                person_id=carer.id,
                event_type="waitlist_joined",
                channel="email",
                payload="One-on-one nutrition",
                created_at=datetime.utcnow() - timedelta(days=5),
            ),
            models.JourneyEvent(
                person_id=donor.id,
                event_type="commitment_started",
                channel="email",
                payload="amount=300;fund=Sports programmes",
                created_at=datetime.utcnow() - timedelta(days=20),
            ),
            models.JourneyEvent(
                person_id=volunteer.id,
                event_type="shift_completed",
                channel="email",
                payload="Cantonese flyer check",
                created_at=datetime.utcnow() - timedelta(days=18),
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
        _ensure_admin_demo_account(db)
        _ensure_profile_demo_data(db)
    finally:
        db.close()


def _ensure_admin_demo_account(db: Session) -> None:
    """Backfill the admin demo account on DBs that were already seeded
    before the admin role existed, without touching anything else."""
    if db.query(models.Person).filter_by(email="admin@demo.love21").first():
        return
    db.add(
        models.Person(
            email="admin@demo.love21",
            name="Morgan Yip",
            role_primary="admin",
            roles="admin",
            language="en",
            password_hash=hash_password(DEMO_PASSWORD),
            profile_code="L21-HK-9001",
        )
    )
    db.commit()


def _ensure_profile_demo_data(db: Session) -> None:
    """Add an idempotent profile showcase to both old and freshly seeded DBs."""
    demo_hash = hash_password(DEMO_PASSWORD)

    carer = db.query(models.Person).filter_by(email="carer@chen.demo").first()
    household = carer.household if carer else None
    if not household:
        household = db.query(models.Household).filter_by(name="Chen family").first()
    if not household:
        household = models.Household(name="Chen family", notes="Demo household")
        db.add(household)
        db.flush()
    if not carer:
        carer = models.Person(
            email="carer@chen.demo",
            name="Jamie Chen",
            role_primary="family",
            roles="family,volunteer,donor",
            language="both",
            household_id=household.id,
            household_role="mom",
            password_hash=demo_hash,
            profile_code="L21-HK-1001",
        )
        db.add(carer)
        db.flush()
    if not household.carer_person_id:
        household.carer_person_id = carer.id

    def ensure_person(email: str, **values) -> models.Person:
        existing = db.query(models.Person).filter_by(email=email).first()
        if existing:
            return existing
        person = models.Person(email=email, password_hash=demo_hash, **values)
        db.add(person)
        db.flush()
        return person

    alex = ensure_person(
        "alex@chen.demo",
        name="Alex Chen",
        role_primary="member",
        roles="member",
        language="yue",
        household_id=household.id,
        household_role="child",
        profile_code="L21-HK-1002",
    )
    dad = ensure_person(
        "dad@chen.demo",
        name="Chris Chen",
        role_primary="family",
        roles="family,donor",
        language="en",
        household_id=household.id,
        household_role="dad",
        profile_code="L21-HK-1003",
    )
    casey = ensure_person(
        "casey@chen.demo",
        name="Casey Chen",
        role_primary="member",
        roles="member",
        language="both",
        household_id=household.id,
        household_role="child",
        profile_code="L21-HK-1004",
    )
    donor = ensure_person(
        "donor@demo.love21",
        name="Sam Wong",
        role_primary="donor",
        roles="donor,volunteer",
        language="en",
        profile_code="L21-HK-2001",
    )
    volunteer = ensure_person(
        "volunteer@demo.love21",
        name="Taylor Ng",
        role_primary="volunteer",
        roles="volunteer,donor",
        language="both",
        profile_code="L21-HK-3001",
    )

    for demo_person in (carer, alex, dad, casey, donor, volunteer):
        if not demo_person.prefs:
            db.add(
                models.CommPreferences(
                    person_id=demo_person.id,
                    email_on=True,
                    sms_on=False,
                    whatsapp_on=False,
                    opt_out_token=secrets.token_urlsafe(16),
                )
            )

    activities = {
        activity.title: activity for activity in db.query(models.Activity).all()
    }

    def ensure_registration(
        member: models.Person, title: str, status: str, session_date: date
    ) -> None:
        activity = activities.get(title)
        if not activity:
            return
        existing = (
            db.query(models.Registration)
            .filter_by(activity_id=activity.id, member_person_id=member.id)
            .first()
        )
        if existing:
            return
        db.add(
            models.Registration(
                activity_id=activity.id,
                household_id=household.id,
                member_person_id=member.id,
                status=status,
                reminder_channel="email",
                session_date=session_date,
                created_at=datetime.combine(session_date, datetime.min.time()),
            )
        )

    today = date.today()
    ensure_registration(casey, "Swim · beginners", "attended", today - timedelta(days=95))
    ensure_registration(casey, "Yoga & stretch", "attended", today - timedelta(days=70))
    ensure_registration(casey, "Parent counselling circle", "attended", today - timedelta(days=45))
    ensure_registration(casey, "Cooking together", "registered", today + timedelta(days=14))

    if not db.query(models.Achievement).filter_by(
        member_person_id=casey.id, title="Confident group warm-up"
    ).first():
        db.add(
            models.Achievement(
                member_person_id=casey.id,
                title="Confident group warm-up",
                pillar="sport",
                status="coach_approved",
                share_consent=True,
                coach_name="Coach Lee",
                approved_at=datetime.utcnow() - timedelta(days=35),
            )
        )

    donor_commitment = (
        db.query(models.DonationCommitment)
        .filter_by(supporter_person_id=donor.id)
        .first()
    )
    if not donor_commitment:
        donor_commitment = models.DonationCommitment(
            supporter_person_id=donor.id,
            amount_hkd=500,
            fund_category="Sports programmes",
            status="active",
            cadence="monthly",
        )
        db.add(donor_commitment)
        db.flush()

    donor_profile = db.query(models.VolunteerProfile).filter_by(person_id=donor.id).first()
    if not donor_profile:
        donor_profile = models.VolunteerProfile(
            person_id=donor.id,
            skills="photos",
            languages="en",
            availability="remote",
            onboarded=False,
            hours_logged=0,
        )
        db.add(donor_profile)

    demo_gifts = [
        (datetime(2026, 3, 1), 500, "A monthly gift helped cover pool-lane fees."),
        (datetime(2026, 4, 1), 750, "This gift supported bilingual class materials."),
        (datetime(2026, 5, 1), 1200, "This gift helped fund family nutrition workshops."),
        (datetime(2026, 6, 1), 1500, "This gift supported coach-led sports sessions."),
        (datetime(2026, 8, 1), 1000, "This gift helped fund the summer activity programme."),
    ]
    existing_gift_months = {
        receipt.paid_at.strftime("%Y-%m")
        for receipt in donor_commitment.receipts
        if receipt.paid_at
    }
    for paid_at, amount, story in demo_gifts:
        if paid_at.strftime("%Y-%m") in existing_gift_months:
            continue
        db.add(
            models.DonationReceipt(
                commitment_id=donor_commitment.id,
                amount_hkd=amount,
                paid_at=paid_at,
                story_back=story,
            )
        )

    volunteer_profile = (
        db.query(models.VolunteerProfile).filter_by(person_id=volunteer.id).first()
    )
    if not volunteer_profile:
        volunteer_profile = models.VolunteerProfile(
            person_id=volunteer.id,
            skills="events,photos,cantonese",
            languages="yue,en",
            availability="saturday mornings, remote",
            onboarded=True,
            hours_logged=0,
            points_balance=55,
        )
        db.add(volunteer_profile)
        db.flush()

    volunteer_commitment = (
        db.query(models.DonationCommitment)
        .filter_by(supporter_person_id=volunteer.id)
        .first()
    )
    if not volunteer_commitment:
        volunteer_commitment = models.DonationCommitment(
            supporter_person_id=volunteer.id,
            amount_hkd=300,
            fund_category="Sports programmes",
            status="active",
            cadence="monthly",
        )
        db.add(volunteer_commitment)
        db.flush()
        db.add(
            models.DonationReceipt(
                commitment_id=volunteer_commitment.id,
                amount_hkd=300,
                paid_at=datetime.utcnow() - timedelta(days=15),
                story_back="A sports-programme gift recorded for the volunteer demo.",
            )
        )

    historical_shifts = [
        ("Family sports day welcome", 120, today - timedelta(days=100), 2.0, 50),
        ("Nutrition workshop support", 180, today - timedelta(days=72), 3.0, 60),
        ("Open day photography", 240, today - timedelta(days=38), 4.0, 80),
    ]
    for title, duration, scheduled, hours, points in historical_shifts:
        shift = db.query(models.VolunteerShift).filter_by(title=title).first()
        if not shift:
            shift = models.VolunteerShift(
                title=title,
                description="Completed demo shift for the live volunteer passport.",
                duration_min=duration,
                skills_needed="events",
                language="both",
                remote=False,
                spots_left=0,
                requires_onboarding=False,
                scheduled_date=scheduled,
            )
            db.add(shift)
            db.flush()
        claim = (
            db.query(models.VolunteerShiftClaim)
            .filter_by(shift_id=shift.id, volunteer_profile_id=volunteer_profile.id)
            .first()
        )
        if not claim:
            db.add(
                models.VolunteerShiftClaim(
                    shift_id=shift.id,
                    volunteer_profile_id=volunteer_profile.id,
                    status="completed",
                    hours=hours,
                    reflection="Completed as part of the Love 21 demo journey.",
                    claimed_at=datetime.combine(scheduled, datetime.min.time()),
                    completed_at=datetime.combine(scheduled, datetime.min.time()),
                    points_awarded=points,
                )
            )

    db.flush()
    completed_hours = sum(
        float(claim.hours or 0)
        for claim in db.query(models.VolunteerShiftClaim)
        .filter_by(volunteer_profile_id=volunteer_profile.id, status="completed")
        .all()
    )
    volunteer_profile.hours_logged = max(
        float(volunteer_profile.hours_logged or 0), completed_hours
    )

    # Upgrade only legacy demo accounts that already have matching role data.
    carer_profile = db.query(models.VolunteerProfile).filter_by(person_id=carer.id).first()
    carer_commitment = (
        db.query(models.DonationCommitment).filter_by(supporter_person_id=carer.id).first()
    )
    if not carer_profile:
        carer_profile = models.VolunteerProfile(
            person_id=carer.id,
            skills="photos,voice,events",
            languages="both",
            availability="weekday evenings, saturday mornings",
            onboarded=True,
            hours_logged=1.0,
        )
        db.add(carer_profile)
        db.flush()
    if not carer_commitment:
        carer_commitment = models.DonationCommitment(
            supporter_person_id=carer.id,
            amount_hkd=150,
            fund_category="Family support",
            status="active",
            cadence="monthly",
        )
        db.add(carer_commitment)
        db.flush()
        db.add(
            models.DonationReceipt(
                commitment_id=carer_commitment.id,
                amount_hkd=150,
                paid_at=datetime.utcnow() - timedelta(days=12),
                story_back="A family-support gift recorded for the multi-role demo.",
            )
        )
    db.flush()

    jamie_gifts = [
        (datetime(2026, 4, 1), 200, "Jamie helped fund bilingual family materials."),
        (datetime(2026, 5, 1), 250, "Jamie supported a family nutrition workshop."),
        (datetime(2026, 6, 1), 300, "Jamie helped cover inclusive sports equipment."),
        (datetime(2026, 8, 1), 500, "Jamie supported the summer family programme."),
    ]
    existing_jamie_months = {
        receipt.paid_at.strftime("%Y-%m")
        for receipt in db.query(models.DonationReceipt)
        .filter_by(commitment_id=carer_commitment.id)
        .all()
        if receipt.paid_at
    }
    for paid_at, amount, story in jamie_gifts:
        if paid_at.strftime("%Y-%m") in existing_jamie_months:
            continue
        db.add(
            models.DonationReceipt(
                commitment_id=carer_commitment.id,
                amount_hkd=amount,
                paid_at=paid_at,
                story_back=story,
            )
        )

    jamie_claims = [
        ("Family sports day welcome", "completed", 2.0, 50),
        ("Open day photography", "completed", 4.0, 80),
        ("Kitchen prep · Saturday", "claimed", 1.5, 0),
    ]
    for title, claim_status, hours, points in jamie_claims:
        shift = db.query(models.VolunteerShift).filter_by(title=title).first()
        if not shift:
            continue
        existing_claim = (
            db.query(models.VolunteerShiftClaim)
            .filter_by(shift_id=shift.id, volunteer_profile_id=carer_profile.id)
            .first()
        )
        if existing_claim:
            continue
        completed_at = None
        claimed_at = datetime.utcnow() - timedelta(days=2)
        if claim_status == "completed":
            completed_at = datetime.combine(
                shift.scheduled_date or today, datetime.min.time()
            )
            claimed_at = completed_at - timedelta(days=7)
        db.add(
            models.VolunteerShiftClaim(
                shift_id=shift.id,
                volunteer_profile_id=carer_profile.id,
                status=claim_status,
                hours=hours,
                reflection=(
                    "Jamie completed this shift while supporting the family programme."
                    if claim_status == "completed"
                    else None
                ),
                claimed_at=claimed_at,
                completed_at=completed_at,
                points_awarded=points,
            )
        )

    db.flush()
    jamie_completed_hours = sum(
        float(claim.hours or 0)
        for claim in db.query(models.VolunteerShiftClaim)
        .filter_by(volunteer_profile_id=carer_profile.id, status="completed")
        .all()
    )
    carer_profile.hours_logged = max(
        float(carer_profile.hours_logged or 0), jamie_completed_hours
    )
    dad_commitment = (
        db.query(models.DonationCommitment).filter_by(supporter_person_id=dad.id).first()
    )
    if not dad_commitment:
        dad_commitment = models.DonationCommitment(
            supporter_person_id=dad.id,
            amount_hkd=200,
            fund_category="Family support",
            status="active",
            cadence="monthly",
        )
        db.add(dad_commitment)
        db.flush()
        db.add(
            models.DonationReceipt(
                commitment_id=dad_commitment.id,
                amount_hkd=200,
                paid_at=datetime.utcnow() - timedelta(days=25),
                story_back="A family-support gift recorded for the parent demo.",
            )
        )
    if carer.roles == "family":
        carer.roles = "family,volunteer,donor"
    if donor.roles == "donor" and donor_profile:
        donor.roles = "donor,volunteer"
    if volunteer.roles == "volunteer" and volunteer_commitment:
        volunteer.roles = "volunteer,donor"

    db.commit()


def _migrate_sqlite_columns() -> None:
    """Add new columns on existing SQLite DBs without wiping data."""
    from sqlalchemy import text

    alters = [
        ("volunteer_profiles", "points_balance", "INTEGER DEFAULT 0"),
        ("volunteer_profiles", "points_spent", "INTEGER DEFAULT 0"),
        ("volunteer_shift_claims", "points_awarded", "INTEGER DEFAULT 0"),

        ("people", "login_count", "INTEGER DEFAULT 0"),
        ("people", "failed_login_count", "INTEGER DEFAULT 0"),
        ("people", "last_login_at", "DATETIME"),
        ("people", "current_login_at", "DATETIME"),
        ("people", "last_login_ip", "VARCHAR(45)"),
        ("people", "locked_until", "DATETIME"),
    ]
    with engine.begin() as conn:
        for table, col, decl in alters:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            names = {r[1] for r in rows}
            if col not in names:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {decl}"))
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
        # Remote = async (no calendar date); in-person must have a date
        conn.execute(
            text("UPDATE volunteer_shifts SET scheduled_date = NULL WHERE remote = 1")
        )
        conn.execute(
            text(
                """
                UPDATE volunteer_shifts
                SET scheduled_date = date('now', '+7 days')
                WHERE remote = 0 AND scheduled_date IS NULL
                """
            )
        )
        # Add dated in-person tasks if missing (existing DBs)
        existing = {
            r[0]
            for r in conn.execute(text("SELECT title FROM volunteer_shifts")).fetchall()
        }
        extras = [
            (
                "Kitchen prep · Saturday",
                "Help set tables and label snack boxes before the banquet.",
                90,
                "sports",
                "both",
                0,
                4,
                0,
                "date('now', '+5 days')",
            ),
            (
                "Track day helper",
                "Hand out water and cheer on the straight at San Po Kong.",
                120,
                "sports",
                "both",
                0,
                6,
                0,
                "date('now', '+12 days')",
            ),
        ]
        for title, desc, mins, skills, lang, remote, spots, onboard, when_sql in extras:
            if title in existing:
                continue
            conn.execute(
                text(
                    f"""
                    INSERT INTO volunteer_shifts
                    (title, description, duration_min, skills_needed, language,
                     remote, spots_left, requires_onboarding, scheduled_date)
                    VALUES
                    (:title, :desc, :mins, :skills, :lang,
                     :remote, :spots, :onboard, {when_sql})
                    """
                ),
                {
                    "title": title,
                    "desc": desc,
                    "mins": mins,
                    "skills": skills,
                    "lang": lang,
                    "remote": remote,
                    "spots": spots,
                    "onboard": onboard,
                },
            )
