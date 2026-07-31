from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..labels import event_label, status_label
from .family import _registration_out
from .volunteers import _claim_out, _ensure_profile

router = APIRouter(prefix="/api/passport", tags=["passport"])


def _person_out(p: models.Person) -> schemas.PersonOut:
    return schemas.PersonOut(
        id=p.id,
        email=p.email,
        name=p.name,
        role_primary=p.role_primary,
        language=p.language,
        household_id=p.household_id,
        passport_code=p.passport_code or f"L21-{p.id:04d}",
        issued_at=p.issued_at or p.created_at,
    )


def _achievement_out(a: models.Achievement) -> schemas.AchievementOut:
    return schemas.AchievementOut(
        id=a.id,
        member_person_id=a.member_person_id,
        title=a.title,
        pillar=a.pillar,
        status=a.status,
        status_label=status_label(a.status),
        share_consent=a.share_consent,
        coach_name=a.coach_name or "Coach Pat",
        approved_at=a.approved_at,
        created_at=a.created_at,
    )


def _goal_out(g: models.Goal) -> schemas.GoalOut:
    return schemas.GoalOut(
        id=g.id,
        member_person_id=g.member_person_id,
        title=g.title,
        status=g.status,
        status_label=status_label(g.status),
        target_date=g.target_date,
        created_at=g.created_at,
    )


def _commitment_out(c: models.DonationCommitment) -> schemas.CommitmentOut:
    return schemas.CommitmentOut(
        id=c.id,
        supporter_person_id=c.supporter_person_id,
        amount_hkd=c.amount_hkd,
        fund_category=c.fund_category,
        status=c.status,
        status_label=status_label(c.status),
        cadence=c.cadence,
        office_perk_unlocked=bool(c.office_perk_unlocked),
        started_at=c.started_at,
        updated_at=c.updated_at,
    )


def _visible_tabs(role: str) -> list[str]:
    """Always the three passport chapters — settings live outside the tab strip."""
    return ["ability", "contribution", "impact"]


def _home_tab(role: str) -> str:
    if role in ("family", "member"):
        return "ability"
    if role == "donor":
        return "impact"
    if role == "volunteer":
        return "contribution"
    return "ability"


def _next_action(role: str, data: dict) -> schemas.NextActionOut:
    if role in ("family", "member"):
        regs = (data.get("family") or {}).get("registrations") or []
        pending = [r for r in regs if r.status == "attended" and not r.feedback]
        if pending:
            return schemas.NextActionOut(
                label="Leave feedback on your last session",
                href="#ability",
                tab="ability",
            )
        return schemas.NextActionOut(
            label="Find a class for your household",
            href="activity-finder.html",
            tab="ability",
        )
    if role == "donor":
        if not (data.get("impact") or {}).get("commitments"):
            return schemas.NextActionOut(
                label="Start a monthly gift",
                href="impact.html",
                tab="impact",
            )
        return schemas.NextActionOut(
            label="Book an office workshop with a creator",
            href="../index.html#marketplace",
            tab="impact",
        )
    if role == "volunteer":
        claims = (data.get("volunteer") or {}).get("claims") or []
        open_claims = [c for c in claims if c.status == "claimed"]
        if open_claims:
            return schemas.NextActionOut(
                label="Mark your claimed shift complete",
                href="#contribution",
                tab="contribution",
            )
        return schemas.NextActionOut(
            label="Claim a short volunteer task",
            href="volunteer.html",
            tab="contribution",
        )
    return schemas.NextActionOut(label="Open your Passport", href="#", tab=None)


def _match_shift(db: Session, profile: models.VolunteerProfile, claimed_ids: set):
    shifts = (
        db.query(models.VolunteerShift)
        .filter(models.VolunteerShift.spots_left > 0)
        .all()
    )
    skills = {s.strip().lower() for s in (profile.skills or "").split(",") if s.strip()}
    langs = {s.strip().lower() for s in (profile.languages or "").split(",") if s.strip()}

    def score(shift: models.VolunteerShift) -> int:
        if shift.id in claimed_ids:
            return -999
        s = 0
        needed = {x.strip().lower() for x in (shift.skills_needed or "").split(",") if x.strip()}
        if needed & skills:
            s += 5
        if shift.language.lower() in langs or shift.language == "both" or "both" in langs:
            s += 3
        if shift.remote:
            s += 1
        s -= shift.duration_min // 60
        return s

    ranked = sorted(shifts, key=score, reverse=True)
    return ranked[0] if ranked and score(ranked[0]) > -900 else None


@router.get("", response_model=schemas.PassportOut)
def get_passport(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    prefs = person.prefs
    prefs_out = schemas.PrefsOut(
        email_on=prefs.email_on if prefs else True,
        sms_on=prefs.sms_on if prefs else False,
        whatsapp_on=prefs.whatsapp_on if prefs else False,
        opt_out_token=prefs.opt_out_token if prefs else None,
    )

    family = None
    if person.household_id:
        household = db.get(models.Household, person.household_id)
        members = (
            db.query(models.Person)
            .filter(models.Person.household_id == person.household_id)
            .all()
        )
        regs = (
            db.query(models.Registration)
            .filter(models.Registration.household_id == person.household_id)
            .order_by(models.Registration.created_at.desc())
            .all()
        )
        family = schemas.FamilyPassportOut(
            household_name=household.name if household else "Household",
            members=[_person_out(m) for m in members],
            registrations=[_registration_out(r) for r in regs],
        )

    ach_member = person
    if person.role_primary == "family" and person.household_id:
        kid = (
            db.query(models.Person)
            .filter(
                models.Person.household_id == person.household_id,
                models.Person.role_primary == "member",
            )
            .first()
        )
        if kid:
            ach_member = kid
    elif person.role_primary != "member" and person.role_primary != "family":
        ach_member = person

    achievements = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id == ach_member.id)
        .order_by(models.Achievement.created_at.desc())
        .all()
        if person.role_primary in ("family", "member")
        else []
    )
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id == ach_member.id)
        .order_by(models.Goal.created_at.desc())
        .all()
        if person.role_primary in ("family", "member")
        else []
    )
    achievement = None
    if person.role_primary in ("family", "member"):
        achievement = schemas.AchievementPassportOut(
            member=_person_out(ach_member),
            achievements=[_achievement_out(a) for a in achievements],
            goals=[_goal_out(g) for g in goals],
        )

    commitments = (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .all()
    )
    receipts = (
        db.query(models.DonationReceipt)
        .join(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .order_by(models.DonationReceipt.paid_at.desc())
        .all()
    )
    badges = (
        db.query(models.ImpactBadge)
        .filter(models.ImpactBadge.person_id == person.id)
        .order_by(models.ImpactBadge.earned_at.desc())
        .all()
    )
    impact = schemas.ImpactPassportOut(
        commitments=[_commitment_out(c) for c in commitments],
        receipts=[schemas.ReceiptOut.model_validate(r) for r in receipts],
        badges=[schemas.ImpactBadgeOut.model_validate(b) for b in badges],
    )

    profile = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id == person.id)
        .first()
    )
    claims = []
    suggested = None
    if person.role_primary == "volunteer":
        if not profile:
            profile = _ensure_profile(db, person)
        claims = (
            db.query(models.VolunteerShiftClaim)
            .filter(models.VolunteerShiftClaim.volunteer_profile_id == profile.id)
            .order_by(models.VolunteerShiftClaim.claimed_at.desc())
            .all()
        )
        claimed_ids = {c.shift_id for c in claims}
        suggested = _match_shift(db, profile, claimed_ids)

    volunteer = schemas.VolunteerPassportOut(
        profile=schemas.VolunteerProfileOut.model_validate(profile) if profile else None,
        claims=[_claim_out(c) for c in claims],
        suggested_next=schemas.VolunteerShiftOut.model_validate(suggested)
        if suggested
        else None,
    )

    events = (
        db.query(models.JourneyEvent)
        .filter(models.JourneyEvent.person_id == person.id)
        .order_by(models.JourneyEvent.created_at.desc())
        .limit(12)
        .all()
    )
    journey = [
        schemas.JourneyEventOut(
            id=e.id,
            event_type=e.event_type,
            event_label=event_label(e.event_type),
            channel=e.channel,
            payload=e.payload,
            created_at=e.created_at,
        )
        for e in events
    ]

    hires = (
        db.query(models.HireEnquiry)
        .filter(models.HireEnquiry.person_id == person.id)
        .order_by(models.HireEnquiry.created_at.desc())
        .limit(10)
        .all()
    )

    tabs = _visible_tabs(person.role_primary)
    home_tab = _home_tab(person.role_primary)
    next_action = _next_action(
        person.role_primary,
        {
            "family": {"registrations": family.registrations} if family else {},
            "impact": {"commitments": impact.commitments},
            "volunteer": {"claims": volunteer.claims},
        },
    )

    return schemas.PassportOut(
        person=_person_out(person),
        prefs=prefs_out,
        visible_tabs=tabs,
        home_tab=home_tab,
        next_action=next_action,
        family=family,
        achievement=achievement,
        impact=impact,
        volunteer=volunteer,
        journey_events=journey,
        hire_enquiries=[schemas.HireOut.model_validate(h) for h in hires],
    )
