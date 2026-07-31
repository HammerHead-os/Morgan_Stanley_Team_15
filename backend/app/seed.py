import secrets
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine


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
        language="both",
        household_id=household.id,
        profile_code="L21-HK-1001",
    )
    member = models.Person(
        email="alex@chen.demo",
        name="Alex Chen",
        role_primary="member",
        language="yue",
        household_id=household.id,
        profile_code="L21-HK-1002",
    )
    donor = models.Person(
        email="donor@demo.love21",
        name="Sam Wong",
        role_primary="donor",
        language="en",
        profile_code="L21-HK-2001",
    )
    volunteer = models.Person(
        email="volunteer@demo.love21",
        name="Taylor Ng",
        role_primary="volunteer",
        language="both",
        profile_code="L21-HK-3001",
    )
    db.add_all([carer, member, donor, volunteer])
    db.flush()

    household.carer_person_id = carer.id

    for person in (carer, member, donor, volunteer):
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
        )
    )
    db.add(
        models.Registration(
            activity_id=activities[5].id,
            household_id=household.id,
            member_person_id=member.id,
            status="attended",
            reminder_channel="email",
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
            story_back="Mei’s swim stamp unlocked after your June gift.",
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
    )
    db.add(vprofile)
    db.flush()

    shifts = [
        models.VolunteerShift(
            title="Cantonese flyer check",
            description="Proof sports flyer text before print. LinkedIn-ready badge.",
            duration_min=45,
            skills_needed="cantonese",
            language="yue",
            remote=True,
            spots_left=3,
        ),
        models.VolunteerShift(
            title="Hiking photo sort",
            description="Organise last month’s hike and yoga images for the social wall.",
            duration_min=90,
            skills_needed="photos",
            language="en",
            remote=True,
            spots_left=2,
        ),
        models.VolunteerShift(
            title="Voice cheers for racers",
            description="Record a short cheer members hear before race day.",
            duration_min=30,
            skills_needed="voice",
            language="en",
            remote=True,
            spots_left=5,
        ),
        models.VolunteerShift(
            title="Session buddy · swimming",
            description="Support one lane · onboarded volunteers only.",
            duration_min=120,
            skills_needed="sports",
            language="both",
            remote=False,
            spots_left=2,
            requires_onboarding=True,
        ),
    ]
    db.add_all(shifts)
    db.flush()

    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[0].id,
            volunteer_profile_id=vprofile.id,
            status="completed",
            hours=0.75,
            reflection="Quick and useful — flyers clearer in Cantonese.",
            completed_at=datetime.utcnow() - timedelta(days=18),
        )
    )
    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[1].id,
            volunteer_profile_id=vprofile.id,
            status="completed",
            hours=1.5,
            reflection="Sorted hiking set; tagged for social wall.",
            completed_at=datetime.utcnow() - timedelta(days=10),
        )
    )
    db.add(
        models.VolunteerShiftClaim(
            shift_id=shifts[2].id,
            volunteer_profile_id=vprofile.id,
            status="claimed",
            hours=shifts[2].duration_min / 60.0,
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
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
