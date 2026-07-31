from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("", response_model=list[schemas.ActivityOut])
def list_activities(
    goal: str | None = Query(None),
    age: str | None = Query(None, alias="age"),
    day: str | None = Query(None),
    support: str | None = Query(None),
    lang: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Activity)
    if goal:
        q = q.filter(models.Activity.goal == goal)
    if age:
        q = q.filter(models.Activity.age_band == age)
    if day:
        q = q.filter(models.Activity.day == day)
    if support:
        q = q.filter(models.Activity.support_need == support)
    if lang:
        q = q.filter(models.Activity.language == lang)
    return q.order_by(models.Activity.title).all()


@router.get("/{activity_id}", response_model=schemas.ActivityOut)
def get_activity(activity_id: int, db: Session = Depends(get_db)):
    activity = db.get(models.Activity, activity_id)
    if not activity:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Activity not found")
    return activity
