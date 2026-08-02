from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..email_client import send_email
from ..points import REWARDS, points_for_minutes, reward_by_id
from ..posthog_client import get_posthog_client
from ..roles_util import ensure_role

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


def _split_selection(
    claim: models.VolunteerShiftClaim,
    attendee_ids: list[int] | None,
    include_self: bool,
) -> tuple[list[models.VolunteerClaimAttendee], list[models.VolunteerClaimAttendee], int, int]:
    """Split a claim's party into the selected group and everyone else,
    by attendee row id. attendee_ids=None means "everyone" (keeps old
    whole-claim behaviour as the default)."""
    all_attendees = list(claim.attendees)
    if attendee_ids is None:
        selected = all_attendees
    else:
        id_set = set(attendee_ids)
        selected = [a for a in all_attendees if a.id in id_set]
        if len(selected) != len(id_set):
            raise HTTPException(status_code=400, detail="Invalid attendee selection")
    remaining = [a for a in all_attendees if a not in selected]
    selected_count = (1 if include_self else 0) + len(selected)
    remaining_count = (0 if include_self else 1) + len(remaining)
    if selected_count < 1:
        raise HTTPException(
            status_code=400, detail="Select at least one person"
        )
    return selected, remaining, selected_count, remaining_count


def _notify_party(
    person: models.Person,
    include_self: bool,
    selected_attendees: list[models.VolunteerClaimAttendee],
    title: str,
    kind: str,
    old_date,
    new_date=None,
) -> None:
    """Email everyone affected by a cancel/reschedule — the account holder
    (if they're part of the affected group) and any attendee with an email
    on file. Attendees without an email on their row are silently skipped
    since there's nowhere to send it."""
    recipients = []
    if include_self and person.email:
        recipients.append((person.name, person.email))
    for a in selected_attendees:
        if a.email:
            recipients.append((a.full_name, a.email))
    for name, email in recipients:
        if kind == "cancelled":
            subject = f"Cancelled: {title}"
            when = f" on {old_date}" if old_date else ""
            text = f'Hi {name}, your volunteer shift "{title}"{when} has been cancelled.'
        else:
            subject = f"Time changed: {title}"
            text = (
                f'Hi {name}, your volunteer shift "{title}" has moved '
                f"from {old_date} to {new_date}."
            )
        send_email(email, subject, text)


def _ensure_profile(db: Session, person: models.Person) -> models.VolunteerProfile:
    profile = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id == person.id)
        .first()
    )
    if profile:
        return profile
    profile = models.VolunteerProfile(person_id=person.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _claim_out(claim: models.VolunteerShiftClaim) -> schemas.ClaimOut:
    from ..labels import status_label

    shift = claim.shift
    duration = shift.duration_min if shift else None
    available = points_for_minutes(duration) if claim.status == "claimed" else 0
    remote = bool(shift.remote) if shift else True
    scheduled = None if remote else (shift.scheduled_date if shift else None)
    return schemas.ClaimOut(
        id=claim.id,
        shift_id=claim.shift_id,
        volunteer_profile_id=claim.volunteer_profile_id,
        status=claim.status,
        status_label=status_label(claim.status),
        party_size=claim.party_size,
        hours=claim.hours,
        reflection=claim.reflection,
        claimed_at=claim.claimed_at,
        completed_at=claim.completed_at,
        shift_title=shift.title if shift else None,
        points_awarded=claim.points_awarded or 0,
        points_available=available,
        duration_min=duration,
        remote=remote,
        scheduled_date=scheduled,
        attendees=[schemas.AttendeeOut.model_validate(a) for a in claim.attendees],
    )


@router.get("/shifts", response_model=list[schemas.VolunteerShiftOut])
def list_shifts(db: Session = Depends(get_db)):
    return (
        db.query(models.VolunteerShift)
        .filter(models.VolunteerShift.spots_left > 0)
        .order_by(models.VolunteerShift.title)
        .all()
    )


@router.get("/me", response_model=schemas.VolunteerProfileOut)
def my_profile(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    return _ensure_profile(db, person)


@router.get("/points", response_model=schemas.PointsOut)
def my_points(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    return schemas.PointsOut(
        points_balance=profile.points_balance or 0,
        points_spent=profile.points_spent or 0,
        hours_logged=profile.hours_logged or 0.0,
        rewards=[schemas.RewardOut(**r) for r in REWARDS],
    )


@router.post("/onboard", response_model=schemas.VolunteerProfileOut)
def onboard(
    body: schemas.OnboardIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    if body.skills is not None:
        profile.skills = body.skills
    if body.languages is not None:
        profile.languages = body.languages
    if body.availability is not None:
        profile.availability = body.availability
    profile.onboarded = True
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="volunteer_onboarded",
            channel="email",
            payload=f"profile={profile.id}",
        )
    )
    db.commit()
    db.refresh(profile)
    client = get_posthog_client()
    if client:
        client.capture("volunteer_onboarded")
    return profile


@router.post("/claims", response_model=schemas.ClaimOut)
def claim_shift(
    body: schemas.ClaimShiftIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    shift = db.get(models.VolunteerShift, body.shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    party_size = 1 + len(body.attendees)
    if shift.spots_left < party_size:
        raise HTTPException(
            status_code=409, detail="Not enough spots left for your party"
        )
    if shift.requires_onboarding and not profile.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    existing = (
        db.query(models.VolunteerShiftClaim)
        .filter(
            models.VolunteerShiftClaim.shift_id == shift.id,
            models.VolunteerShiftClaim.volunteer_profile_id == profile.id,
            models.VolunteerShiftClaim.status.in_(["claimed", "completed"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already claimed")

    claim = models.VolunteerShiftClaim(
        shift_id=shift.id,
        volunteer_profile_id=profile.id,
        status="claimed",
        party_size=party_size,
        hours=shift.duration_min / 60.0,
        points_awarded=0,
    )
    shift.spots_left -= party_size
    ensure_role(person, "volunteer")
    db.add(claim)
    db.flush()
    for a in body.attendees:
        db.add(
            models.VolunteerClaimAttendee(
                claim_id=claim.id,
                full_name=a.full_name,
                phone=a.phone,
                email=a.email,
                age=a.age,
                role=a.role,
            )
        )
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="shift_claimed",
            channel="email",
            payload=f"shift={shift.id};party={party_size}",
        )
    )
    db.commit()
    db.refresh(claim)
    claim.shift = shift
    client = get_posthog_client()
    if client:
        client.capture(
            "volunteer_shift_claimed",
            properties={"is_remote": bool(shift.remote), "duration_min": shift.duration_min},
        )
    return _claim_out(claim)


@router.get("/claims", response_model=list[schemas.ClaimOut])
def list_claims(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    claims = (
        db.query(models.VolunteerShiftClaim)
        .filter(models.VolunteerShiftClaim.volunteer_profile_id == profile.id)
        .order_by(models.VolunteerShiftClaim.claimed_at.desc())
        .all()
    )
    for c in claims:
        c.shift  # load relationship
    return [_claim_out(c) for c in claims]


@router.post("/claims/{claim_id}/complete", response_model=schemas.ClaimOut)
def complete_claim(
    claim_id: int,
    body: schemas.ReflectionIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    claim = db.get(models.VolunteerShiftClaim, claim_id)
    if not claim or claim.volunteer_profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status == "completed":
        raise HTTPException(status_code=409, detail="Already completed")

    shift = db.get(models.VolunteerShift, claim.shift_id)
    hours = body.hours if body.hours is not None else claim.hours
    pts = points_for_minutes(shift.duration_min if shift else hours * 60)

    claim.status = "completed"
    claim.reflection = body.reflection
    claim.hours = hours
    claim.completed_at = datetime.utcnow()
    claim.points_awarded = pts
    profile.hours_logged = (profile.hours_logged or 0) + hours
    profile.points_balance = (profile.points_balance or 0) + pts

    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="shift_completed",
            channel="email",
            payload=f"claim={claim.id};hours={hours};points={pts}",
        )
    )
    db.commit()
    db.refresh(claim)
    claim.shift = shift
    client = get_posthog_client()
    if client:
        client.capture(
            "volunteer_shift_completed",
            properties={"hours_logged": hours, "points_awarded": pts},
        )
    return _claim_out(claim)


@router.post("/claims/{claim_id}/cancel", response_model=schemas.ClaimOut)
def cancel_claim(
    claim_id: int,
    body: schemas.CancelClaimIn | None = None,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    claim = db.get(models.VolunteerShiftClaim, claim_id)
    if not claim or claim.volunteer_profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status == "completed":
        raise HTTPException(status_code=409, detail="Can't cancel a completed shift")
    if claim.status == "cancelled":
        raise HTTPException(status_code=409, detail="Already cancelled")

    attendee_ids = body.attendee_ids if body else None
    include_self = body.include_self if body else True
    selected, remaining, selected_count, remaining_count = _split_selection(
        claim, attendee_ids, include_self
    )

    shift = db.get(models.VolunteerShift, claim.shift_id)
    if remaining_count == 0:
        # Everyone in the party is cancelling — void the whole claim.
        if shift:
            shift.spots_left += claim.party_size
        claim.status = "cancelled"
    else:
        # Only some of the party is dropping out; the rest keep their claim.
        if shift:
            shift.spots_left += selected_count
        for a in selected:
            db.delete(a)
        claim.party_size = remaining_count

    if shift:
        _notify_party(
            person,
            include_self,
            selected,
            shift.title,
            "cancelled",
            shift.scheduled_date,
        )

    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="shift_claim_cancelled",
            channel="email",
            payload=f"claim={claim.id};party={selected_count}",
        )
    )
    db.commit()
    db.refresh(claim)
    if shift:
        claim.shift = shift
    client = get_posthog_client()
    if client:
        client.capture("volunteer_shift_claim_cancelled")
    return _claim_out(claim)


@router.post("/claims/{claim_id}/reschedule", response_model=schemas.ClaimOut)
def reschedule_claim(
    claim_id: int,
    body: schemas.RescheduleClaimIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    claim = db.get(models.VolunteerShiftClaim, claim_id)
    if not claim or claim.volunteer_profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "claimed":
        raise HTTPException(
            status_code=409, detail="Only an open claim can be rescheduled"
        )

    new_shift = db.get(models.VolunteerShift, body.new_shift_id)
    if not new_shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    if new_shift.id == claim.shift_id:
        raise HTTPException(status_code=400, detail="Already on that shift")
    if new_shift.spots_left < claim.party_size:
        raise HTTPException(
            status_code=409, detail="Not enough spots left on that shift"
        )
    if new_shift.requires_onboarding and not profile.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    already_on_new = (
        db.query(models.VolunteerShiftClaim)
        .filter(
            models.VolunteerShiftClaim.shift_id == new_shift.id,
            models.VolunteerShiftClaim.volunteer_profile_id == profile.id,
            models.VolunteerShiftClaim.status.in_(["claimed", "completed"]),
        )
        .first()
    )
    if already_on_new:
        raise HTTPException(status_code=409, detail="Already claimed that shift")

    selected, remaining, selected_count, remaining_count = _split_selection(
        claim, body.attendee_ids, body.include_self
    )
    if new_shift.spots_left < selected_count:
        raise HTTPException(
            status_code=409, detail="Not enough spots left on that shift"
        )

    old_shift = db.get(models.VolunteerShift, claim.shift_id)
    old_date = old_shift.scheduled_date if old_shift else None

    if remaining_count == 0:
        # Whole party is moving — shift this claim in place, same as before.
        if old_shift:
            old_shift.spots_left += claim.party_size
        new_shift.spots_left -= selected_count
        claim.shift_id = new_shift.id
        claim.hours = new_shift.duration_min / 60.0
        moved_claim = claim
    else:
        # Only part of the party is moving — split off a new claim on the
        # new shift for them; the rest keep their claim on the old shift.
        if old_shift:
            old_shift.spots_left += selected_count
        new_shift.spots_left -= selected_count
        moved_claim = models.VolunteerShiftClaim(
            shift_id=new_shift.id,
            volunteer_profile_id=profile.id,
            status="claimed",
            party_size=selected_count,
            hours=new_shift.duration_min / 60.0,
        )
        db.add(moved_claim)
        db.flush()
        for a in selected:
            a.claim_id = moved_claim.id
        claim.party_size = remaining_count

    _notify_party(
        person,
        body.include_self,
        selected,
        old_shift.title if old_shift else "your volunteer shift",
        "rescheduled",
        old_date,
        new_shift.scheduled_date,
    )

    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="shift_rescheduled",
            channel="email",
            payload=f"claim={claim.id};to_shift={new_shift.id};party={selected_count}",
        )
    )
    db.commit()
    db.refresh(moved_claim)
    moved_claim.shift = new_shift
    client = get_posthog_client()
    if client:
        client.capture("volunteer_shift_rescheduled")
    return _claim_out(moved_claim)


@router.post("/redeem", response_model=schemas.RedeemOut)
def redeem_reward(
    body: schemas.RedeemIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(db, person)
    reward = reward_by_id(body.reward_id)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    balance = profile.points_balance or 0
    if balance < reward["cost"]:
        raise HTTPException(
            status_code=400,
            detail=f"Need {reward['cost']} points (you have {balance})",
        )

    profile.points_balance = balance - reward["cost"]
    profile.points_spent = (profile.points_spent or 0) + reward["cost"]
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="points_redeemed",
            channel="email",
            payload=f"reward={reward['id']};cost={reward['cost']}",
        )
    )
    db.commit()
    db.refresh(profile)
    client = get_posthog_client()
    if client:
        client.capture("reward_redeemed", properties={"points_cost": reward["cost"]})
    return schemas.RedeemOut(
        ok=True,
        reward_id=reward["id"],
        reward_label=reward["label"],
        cost=reward["cost"],
        points_balance=profile.points_balance,
        message=f"Redeemed {reward['label']}. Staff will follow up by email.",
    )
