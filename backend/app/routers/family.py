from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person

router = APIRouter(prefix="/api/family", tags=["family"])


def _registration_out(reg: models.Registration) -> schemas.RegistrationOut:
    return schemas.RegistrationOut(
        id=reg.id,
        activity_id=reg.activity_id,
        household_id=reg.household_id,
        member_person_id=reg.member_person_id,
        status=reg.status,
        waitlist_position=reg.waitlist_position,
        reminder_channel=reg.reminder_channel,
        created_at=reg.created_at,
        feedback=reg.feedback,
        activity_title=reg.activity.title if reg.activity else None,
        member_name=reg.member.name if reg.member else None,
    )


def _log_journey(db: Session, person_id: int, event_type: str, channel: str, payload: str):
    db.add(
        models.JourneyEvent(
            person_id=person_id,
            event_type=event_type,
            channel=channel,
            payload=payload,
        )
    )


@router.post("/register", response_model=schemas.RegistrationOut)
def register_for_activity(
    body: schemas.RegisterIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    if not person.household_id:
        raise HTTPException(status_code=400, detail="Person has no household")

    member = db.get(models.Person, body.member_person_id)
    if not member or member.household_id != person.household_id:
        raise HTTPException(status_code=403, detail="Member not in your household")

    activity = db.get(models.Activity, body.activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    existing = (
        db.query(models.Registration)
        .filter(
            models.Registration.activity_id == body.activity_id,
            models.Registration.member_person_id == body.member_person_id,
            models.Registration.status.in_(["registered", "waitlist"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already registered or on waitlist")

    if activity.spots_left > 0:
        status = "registered"
        waitlist_position = None
        activity.spots_left -= 1
        event = "registration_confirmed"
    else:
        status = "waitlist"
        waiting = (
            db.query(models.Registration)
            .filter(
                models.Registration.activity_id == activity.id,
                models.Registration.status == "waitlist",
            )
            .count()
        )
        waitlist_position = waiting + 1
        event = "waitlist_joined"

    channel = body.reminder_channel if body.reminder_channel in ("email", "sms", "whatsapp") else "email"
    prefs = person.prefs
    if channel == "sms" and prefs and not prefs.sms_on:
        channel = "email"
    if channel == "whatsapp" and prefs and not prefs.whatsapp_on:
        channel = "email"

    reg = models.Registration(
        activity_id=activity.id,
        household_id=person.household_id,
        member_person_id=member.id,
        status=status,
        waitlist_position=waitlist_position,
        reminder_channel=channel,
    )
    db.add(reg)
    _log_journey(
        db,
        person.id,
        event,
        channel,
        f"activity={activity.id};member={member.id};status={status}",
    )
    db.commit()
    db.refresh(reg)
    reg.activity = activity
    reg.member = member
    return _registration_out(reg)


@router.get("/registrations", response_model=list[schemas.RegistrationOut])
def list_registrations(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    if not person.household_id:
        return []
    regs = (
        db.query(models.Registration)
        .filter(models.Registration.household_id == person.household_id)
        .order_by(models.Registration.created_at.desc())
        .all()
    )
    return [_registration_out(r) for r in regs]


@router.post("/registrations/{registration_id}/feedback", response_model=schemas.RegistrationOut)
def post_feedback(
    registration_id: int,
    body: schemas.FeedbackIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    reg = db.get(models.Registration, registration_id)
    if not reg or reg.household_id != person.household_id:
        raise HTTPException(status_code=404, detail="Registration not found")
    reg.feedback = body.feedback
    reg.feedback_at = datetime.utcnow()
    _log_journey(
        db,
        person.id,
        "post_session_feedback",
        "email",
        f"registration={reg.id}",
    )
    db.commit()
    db.refresh(reg)
    return _registration_out(reg)
