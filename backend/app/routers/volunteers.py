from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..points import REWARDS, points_for_minutes, reward_by_id

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


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
    if shift.spots_left <= 0:
        raise HTTPException(status_code=409, detail="No spots left")
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
        hours=shift.duration_min / 60.0,
        points_awarded=0,
    )
    shift.spots_left -= 1
    db.add(claim)
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="shift_claimed",
            channel="email",
            payload=f"shift={shift.id}",
        )
    )
    db.commit()
    db.refresh(claim)
    claim.shift = shift
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
    return _claim_out(claim)


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
    return schemas.RedeemOut(
        ok=True,
        reward_id=reward["id"],
        reward_label=reward["label"],
        cost=reward["cost"],
        points_balance=profile.points_balance,
        message=f"Redeemed {reward['label']}. Staff will follow up by email.",
    )
