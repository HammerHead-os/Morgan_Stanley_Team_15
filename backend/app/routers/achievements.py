from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


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
    if target.id != person.id and target.household_id != person.household_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id == member_id)
        .order_by(models.Achievement.created_at.desc())
        .all()
    )


@router.post("/goals", response_model=schemas.GoalOut)
def create_goal(
    body: schemas.GoalIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    member = db.get(models.Person, body.member_person_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.id != person.id and member.household_id != person.household_id:
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
    return goal


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
    if target.id != person.id and target.household_id != person.household_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id == member_id)
        .order_by(models.Goal.created_at.desc())
        .all()
    )


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
        member.id != person.id and member.household_id != person.household_id
    ):
        raise HTTPException(status_code=403, detail="Not allowed")
    ach.share_consent = body.share_consent
    if body.share_consent and ach.status == "coach_approved":
        ach.status = "shared"
    elif not body.share_consent and ach.status == "shared":
        ach.status = "coach_approved"
    db.commit()
    db.refresh(ach)
    return ach


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
    return ach
