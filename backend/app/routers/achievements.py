from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..labels import status_label
from ..posthog_client import get_posthog_client

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


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


@router.get("", response_model=list[schemas.AchievementOut])
def list_achievements(
    member_person_id: int | None = None,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    member_id = member_person_id or person.id
    # Allow household carers to view member stamps
    target = db.get(models.Person, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.id != person.id and (
        not person.household_id or target.household_id != person.household_id
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id == member_id)
        .order_by(models.Achievement.created_at.desc())
        .all()
    )
    return [_achievement_out(a) for a in rows]


@router.post("/goals", response_model=schemas.GoalOut)
def create_goal(
    body: schemas.GoalIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    member = db.get(models.Person, body.member_person_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.id != person.id and (
        not person.household_id or member.household_id != person.household_id
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    goal = models.Goal(
        member_person_id=member.id,
        title=body.title,
        target_date=body.target_date,
        status="in_progress",
    )
    db.add(goal)
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="goal_set",
            channel="email",
            payload=f"goal={body.title}",
        )
    )
    db.commit()
    db.refresh(goal)
    client = get_posthog_client()
    if client:
        client.capture("goal_created", properties={"has_target_date": bool(goal.target_date)})
    return _goal_out(goal)


@router.get("/goals", response_model=list[schemas.GoalOut])
def list_goals(
    member_person_id: int | None = None,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    member_id = member_person_id or person.id
    target = db.get(models.Person, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.id != person.id and (
        not person.household_id or target.household_id != person.household_id
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id == member_id)
        .order_by(models.Goal.created_at.desc())
        .all()
    )
    return [_goal_out(g) for g in rows]


@router.patch("/{achievement_id}/consent", response_model=schemas.AchievementOut)
def update_consent(
    achievement_id: int,
    body: schemas.ConsentIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    ach = db.get(models.Achievement, achievement_id)
    if not ach:
        raise HTTPException(status_code=404, detail="Achievement not found")
    member = db.get(models.Person, ach.member_person_id)
    if not member or (
        member.id != person.id
        and (not person.household_id or member.household_id != person.household_id)
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    ach.share_consent = body.share_consent
    if body.share_consent and ach.status == "coach_approved":
        ach.status = "shared"
    elif not body.share_consent and ach.status == "shared":
        ach.status = "coach_approved"
    db.commit()
    db.refresh(ach)
    client = get_posthog_client()
    if client:
        client.capture(
            "achievement_share_consent_updated",
            properties={"share_consent": ach.share_consent, "achievement_status": ach.status},
        )
    return _achievement_out(ach)


@router.post("/{achievement_id}/approve", response_model=schemas.AchievementOut)
def coach_approve(
    achievement_id: int,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    """Demo endpoint — any logged-in user can simulate coach approval."""
    ach = db.get(models.Achievement, achievement_id)
    if not ach:
        raise HTTPException(status_code=404, detail="Achievement not found")
    ach.status = "coach_approved"
    ach.approved_at = datetime.utcnow()
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="achievement_coach_approved",
            channel="email",
            payload=f"achievement={ach.id}",
        )
    )
    db.commit()
    db.refresh(ach)
    client = get_posthog_client()
    if client:
        client.capture("achievement_coach_approved", properties={"achievement_status": ach.status})
    return _achievement_out(ach)
