from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..labels import event_label, status_label
from ..roles_util import has_role, parse_roles, pick_primary, serialize_roles
from .family import _registration_out
from .volunteers import _claim_out, _ensure_profile
from ..points import REWARDS

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _person_out(p: models.Person) -> schemas.PersonOut:
    return schemas.PersonOut(
        id=p.id,
        email=p.email,
        name=p.name,
        role_primary=p.role_primary,
        roles=parse_roles(p),
        language=p.language,
        household_id=p.household_id,
        household_role=p.household_role,
        profile_code=p.profile_code or f"L21-{p.id:04d}",
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
    """Always the three profile chapters — settings live outside the tab strip."""
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
    return schemas.NextActionOut(label="Open your Profile", href="#", tab=None)


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


@router.get("", response_model=schemas.ProfileOut)
def get_profile(
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
        family = schemas.FamilyProfileOut(
            household_name=household.name if household else "Household",
            members=[_person_out(m) for m in members],
            registrations=[_registration_out(r) for r in regs],
        )

    ach_member = person
    is_familyish = has_role(person, "family") or has_role(person, "member") or bool(
        person.household_id
    )
    if is_familyish and person.household_id:
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

    achievements = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id == ach_member.id)
        .order_by(models.Achievement.created_at.desc())
        .all()
        if is_familyish
        else []
    )
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id == ach_member.id)
        .order_by(models.Goal.created_at.desc())
        .all()
        if is_familyish
        else []
    )
    achievement = None
    if is_familyish:
        achievement = schemas.AchievementProfileOut(
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
    impact = schemas.ImpactProfileOut(
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
    if has_role(person, "volunteer") or has_role(person, "corporate"):
        if not profile:
            profile = _ensure_profile(db, person)
        claims = (
            db.query(models.VolunteerShiftClaim)
            .filter(models.VolunteerShiftClaim.volunteer_profile_id == profile.id)
            .order_by(models.VolunteerShiftClaim.claimed_at.desc())
            .all()
        )
        for c in claims:
            _ = c.shift
        claimed_ids = {c.shift_id for c in claims}
        suggested = _match_shift(db, profile, claimed_ids)

    volunteer = schemas.VolunteerProfileSummaryOut(
        profile=schemas.VolunteerProfileOut.model_validate(profile) if profile else None,
        claims=[_claim_out(c) for c in claims],
        suggested_next=schemas.VolunteerShiftOut.model_validate(suggested)
        if suggested
        else None,
        points_balance=(profile.points_balance or 0) if profile else 0,
        points_spent=(profile.points_spent or 0) if profile else 0,
        rewards=[schemas.RewardOut(**r) for r in REWARDS],
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

    calendar_events: list[schemas.CalendarEventOut] = []
    if family:
        for r in family.registrations:
            if not r.session_date:
                continue
            calendar_events.append(
                schemas.CalendarEventOut(
                    id=f"class-{r.id}",
                    title=r.activity_title or "Class",
                    date=r.session_date,
                    kind="class",
                    detail=r.member_name or "",
                    status=r.status_label or r.status,
                )
            )
    for c in claims:
        shift = db.get(models.VolunteerShift, c.shift_id)
        if not shift or not shift.scheduled_date:
            continue
        calendar_events.append(
            schemas.CalendarEventOut(
                id=f"vol-{c.id}",
                title=shift.title,
                date=shift.scheduled_date,
                kind="volunteer",
                detail=f"{shift.duration_min} min",
                status=status_label(c.status),
            )
        )
    for h in hires:
        # preferred_date is a display string; skip if not ISO-like — seed uses readable dates
        pass
    calendar_events.sort(key=lambda e: e.date)

    roles = parse_roles(person)
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

    return schemas.ProfileOut(
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
        calendar_events=calendar_events,
    )


@router.patch("/roles", response_model=schemas.PersonOut)
def update_roles(
    body: schemas.RolesUpdateIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    roles = serialize_roles(body.roles)
    if not roles:
        raise HTTPException(status_code=400, detail="Pick at least one role")
    person.roles = roles
    person.role_primary = pick_primary(parse_roles(person))
    # Ensure volunteer profile exists when enabling volunteer
    if "volunteer" in parse_roles(person):
        _ensure_profile(db, person)
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="roles_updated",
            channel="email",
            payload=roles,
        )
    )
    db.commit()
    db.refresh(person)
    return _person_out(person)
