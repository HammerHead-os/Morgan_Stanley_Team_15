from collections import Counter, defaultdict

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

FAMILY_ACTIVITY_STATUSES = {"registered", "attended"}


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
        payment_method=c.payment_method,
        office_perk_unlocked=bool(c.office_perk_unlocked),
        started_at=c.started_at,
        updated_at=c.updated_at,
    )


def _badge(icon: str, title: str, description: str) -> schemas.RuleBadgeOut:
    return schemas.RuleBadgeOut(icon=icon, title=title, description=description)


def _family_metrics(
    registrations: list[models.Registration], child_members: list[models.Person]
) -> schemas.FamilyMetricsOut:
    child_ids = {child.id for child in child_members}
    eligible = [
        registration
        for registration in registrations
        if registration.member_person_id in child_ids
        and registration.status in FAMILY_ACTIVITY_STATUSES
    ]
    goals = {
        registration.activity.goal
        for registration in eligible
        if registration.activity and registration.activity.goal
    }
    titles = Counter(
        registration.activity.title
        for registration in eligible
        if registration.activity and registration.activity.title
    )
    favourite = None
    if titles:
        favourite = sorted(titles.items(), key=lambda item: (-item[1], item[0]))[0][0]

    joined = len(eligible)
    programmes = len(goals)
    badges = []
    if joined >= 1:
        badges.append(_badge("1", "First step", "Joined a first Love 21 activity"))
    if joined >= 3:
        badges.append(_badge("3", "Active family", "3 confirmed or attended activities"))
    if joined >= 5:
        badges.append(_badge("5", "Community regular", "5 confirmed or attended activities"))
    if programmes >= 3:
        badges.append(_badge("3", "Programme explorer", "Joined activities across 3 programme areas"))

    return schemas.FamilyMetricsOut(
        child_names=[child.name for child in child_members],
        activities_joined=joined,
        programmes_explored=programmes,
        favourite_programme=favourite,
        badges=badges,
    )


def _impact_metrics(
    commitments: list[models.DonationCommitment],
    receipts: list[models.DonationReceipt],
) -> schemas.ImpactMetricsOut:
    total = sum(float(receipt.amount_hkd or 0) for receipt in receipts)
    occasions = len(
        {
            receipt.paid_at.strftime("%Y-%m")
            for receipt in receipts
            if receipt.paid_at
        }
    )
    fund_totals: dict[str, float] = defaultdict(float)
    commitment_by_id = {commitment.id: commitment for commitment in commitments}
    for receipt in receipts:
        commitment = commitment_by_id.get(receipt.commitment_id)
        if commitment and commitment.fund_category:
            fund_totals[commitment.fund_category] += float(receipt.amount_hkd or 0)

    primary_fund = None
    if fund_totals:
        primary_fund = sorted(
            fund_totals.items(), key=lambda item: (-item[1], item[0])
        )[0][0]
    elif commitments:
        active = [commitment for commitment in commitments if commitment.status == "active"]
        candidates = active or commitments
        primary_fund = max(candidates, key=lambda item: item.updated_at).fund_category

    gift_count = len(receipts)
    badges = []
    if gift_count >= 1:
        badges.append(_badge("1", "First gift", "Made a first recorded donation"))
    if total >= 1000:
        badges.append(_badge("1k", "Impact maker", "Donated HKD 1,000 in total"))
    if occasions >= 3:
        badges.append(_badge("3", "Regular supporter", "Gave in 3 different months"))
    if total >= 5000:
        badges.append(_badge("5k", "Community champion", "Donated HKD 5,000 in total"))

    return schemas.ImpactMetricsOut(
        total_donated=total,
        gift_count=gift_count,
        giving_occasions=occasions,
        primary_fund=primary_fund,
        badges=badges,
    )


def _volunteer_metrics(
    profile: models.VolunteerProfile | None,
    claims: list[models.VolunteerShiftClaim],
) -> schemas.VolunteerMetricsOut:
    completed = [claim for claim in claims if claim.status == "completed"]
    days = {
        claim.shift.scheduled_date
        for claim in completed
        if claim.shift and not claim.shift.remote and claim.shift.scheduled_date
    }
    hours = float(profile.hours_logged or 0) if profile else 0
    badges = []
    if hours >= 1:
        badges.append(_badge("1h", "Helping hand", "Contributed 1 volunteer hour"))
    if hours >= 5:
        badges.append(_badge("5h", "Time giver", "Contributed 5 volunteer hours"))
    if len(completed) >= 3:
        badges.append(_badge("3", "Reliable teammate", "Completed 3 volunteer shifts"))
    if len(days) >= 3:
        badges.append(_badge("3d", "Community regular", "Volunteered in person on 3 days"))

    return schemas.VolunteerMetricsOut(
        completed_shifts=len(completed),
        days_volunteered=len(days),
        badges=badges,
    )


def _shared_funds(db: Session, members: list[models.Person]) -> schemas.SharedFundsOut:
    member_ids = [m.id for m in members]
    if not member_ids:
        return schemas.SharedFundsOut()
    rows = (
        db.query(models.DonationCommitment.fund_category, models.DonationReceipt.amount_hkd)
        .join(
            models.DonationReceipt,
            models.DonationReceipt.commitment_id == models.DonationCommitment.id,
        )
        .filter(models.DonationCommitment.supporter_person_id.in_(member_ids))
        .all()
    )
    total = 0.0
    by_category: dict[str, float] = defaultdict(float)
    for fund_category, amount in rows:
        amount = float(amount or 0)
        total += amount
        by_category[fund_category] += amount
    return schemas.SharedFundsOut(
        total_hkd=total,
        gift_count=len(rows),
        by_fund_category=[
            schemas.FundByCategoryOut(fund_category=cat, total_hkd=amt)
            for cat, amt in sorted(by_category.items(), key=lambda kv: -kv[1])
        ],
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

    is_familyish = has_role(person, "family") or has_role(person, "member") or bool(
        person.household_id
    )

    family = None
    members = []
    regs = []
    child_members = []
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
        child_members = [
            member
            for member in members
            if member.household_role == "child" or member.role_primary == "member"
        ]
        family = schemas.FamilyProfileOut(
            household_name=household.name if household else "Household",
            members=[_person_out(m) for m in members],
            registrations=[_registration_out(r) for r in regs],
            metrics=_family_metrics(regs, child_members),
            shared_funds=_shared_funds(db, members),
        )
    else:
        # No household — still surface this person's own direct
        # registrations (they may be the participant themselves, not a
        # carer registering a separate dependent).
        regs = (
            db.query(models.Registration)
            .filter(models.Registration.member_person_id == person.id)
            .order_by(models.Registration.created_at.desc())
            .all()
        )
        if is_familyish or regs:
            members = [person]
            child_members = [person]
            family = schemas.FamilyProfileOut(
                household_name=f"{person.name}'s registrations",
                members=[_person_out(m) for m in members],
                registrations=[_registration_out(r) for r in regs],
                metrics=_family_metrics(regs, child_members),
                shared_funds=_shared_funds(db, members),
            )

    achievement_members = child_members or ([person] if is_familyish else [])
    achievement_member_ids = [member.id for member in achievement_members]
    ach_member = achievement_members[0] if achievement_members else person

    achievements = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id.in_(achievement_member_ids))
        .order_by(models.Achievement.created_at.desc())
        .all()
        if achievement_member_ids
        else []
    )
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id.in_(achievement_member_ids))
        .order_by(models.Goal.created_at.desc())
        .all()
        if achievement_member_ids
        else []
    )
    achievement = None
    if is_familyish:
        achievement = schemas.AchievementProfileOut(
            member=_person_out(ach_member),
            members=[_person_out(member) for member in achievement_members],
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
        metrics=_impact_metrics(commitments, receipts),
    )

    profile = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id == person.id)
        .first()
    )
    claims = []
    suggested = None
    # Show claims regardless of role tag — someone who's actually claimed a
    # shift has a VolunteerProfile row (created on first claim/onboard) even
    # if their account was never explicitly tagged with the "volunteer"
    # role. Gating on the role alone hid real claims for any account that
    # started as e.g. "family" and later claimed a shift.
    if has_role(person, "volunteer") or has_role(person, "corporate") or profile:
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
        metrics=_volunteer_metrics(profile, claims),
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
                    person_name=r.member_name or "",
                    detail=r.member_name or "",
                    status=r.status_label or r.status,
                )
            )
    calendar_people = members or [person]
    calendar_person_by_id = {calendar_person.id: calendar_person for calendar_person in calendar_people}
    calendar_person_ids = list(calendar_person_by_id)

    calendar_profiles = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id.in_(calendar_person_ids))
        .all()
        if calendar_person_ids
        else []
    )
    calendar_profile_by_id = {profile.id: profile for profile in calendar_profiles}
    calendar_profile_ids = list(calendar_profile_by_id)
    calendar_claims = (
        db.query(models.VolunteerShiftClaim)
        .filter(models.VolunteerShiftClaim.volunteer_profile_id.in_(calendar_profile_ids))
        .all()
        if calendar_profile_ids
        else []
    )
    for claim in calendar_claims:
        shift = claim.shift
        if not shift:
            continue
        if shift.remote:
            if claim.status != "completed" or not claim.completed_at:
                continue
            event_date = claim.completed_at.date()
            mode = "Remote"
        else:
            if not shift.scheduled_date:
                continue
            event_date = shift.scheduled_date
            mode = "In person"
        volunteer_profile = calendar_profile_by_id.get(claim.volunteer_profile_id)
        volunteer_person = (
            calendar_person_by_id.get(volunteer_profile.person_id)
            if volunteer_profile
            else None
        )
        volunteer_name = volunteer_person.name if volunteer_person else "Volunteer"
        calendar_events.append(
            schemas.CalendarEventOut(
                id=f"vol-{claim.id}",
                title=shift.title,
                date=event_date,
                kind="volunteer",
                person_name=volunteer_name,
                detail=f"{volunteer_name} · {mode} · {shift.duration_min} min",
                status=status_label(claim.status),
            )
        )

    calendar_commitments = (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id.in_(calendar_person_ids))
        .all()
        if calendar_person_ids
        else []
    )
    calendar_commitment_by_id = {
        commitment.id: commitment for commitment in calendar_commitments
    }
    calendar_commitment_ids = list(calendar_commitment_by_id)
    calendar_receipts = (
        db.query(models.DonationReceipt)
        .filter(models.DonationReceipt.commitment_id.in_(calendar_commitment_ids))
        .all()
        if calendar_commitment_ids
        else []
    )
    for receipt in calendar_receipts:
        if not receipt.paid_at:
            continue
        commitment = calendar_commitment_by_id.get(receipt.commitment_id)
        if not commitment:
            continue
        supporter = calendar_person_by_id.get(commitment.supporter_person_id)
        supporter_name = supporter.name if supporter else "Supporter"
        calendar_events.append(
            schemas.CalendarEventOut(
                id=f"donation-{receipt.id}",
                title=f"Donation · HKD {receipt.amount_hkd:,.0f}",
                date=receipt.paid_at.date(),
                kind="donation",
                person_name=supporter_name,
                detail=f"{supporter_name} · {commitment.fund_category}",
                status="Paid",
            )
        )
    for h in hires:
        # preferred_date is a display string; skip if not ISO-like — seed uses readable dates
        pass
    calendar_events.sort(key=lambda e: e.date)

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
