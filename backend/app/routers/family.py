from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..labels import status_label
from sqlalchemy import or_

router = APIRouter(prefix="/api/family", tags=["family"])


def _registration_out(reg: models.Registration) -> schemas.RegistrationOut:
    label = status_label(reg.status)
    if reg.status == "waitlist" and reg.waitlist_position:
        label = f"On waitlist · #{reg.waitlist_position}"
    return schemas.RegistrationOut(
        id=reg.id,
        activity_id=reg.activity_id,
        party_size=reg.party_size,
        contact_name=reg.contact_name,
        contact_phone=reg.contact_phone,
        status=reg.status,
        status_label=label,
        waitlist_position=reg.waitlist_position,
        reminder_channel=reg.reminder_channel,
        created_at=reg.created_at,
        feedback=reg.feedback,
        activity_title=reg.activity.title if reg.activity else None,
        activity_location=reg.activity.location if reg.activity else None,
        attendees=[schemas.AttendeeOut.model_validate(a) for a in reg.attendees],
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
    activity = db.get(models.Activity, body.activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    existing = (
        db.query(models.Registration)
        .filter(
            models.Registration.activity_id == body.activity_id,
            models.Registration.owner_person_id == person.id,
            models.Registration.status.in_("registered", "waitlist"),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already registered for this class")

    party_size = max(body.party_size, len(body.attendees) or 1)

    if activity.spots_left >= party_size:
        status, waitlist_position = "registered", None
        activity.spots_left -= party_size
        event = "registration_confirmed"
    else:
        status = "waitlist"
        waiting = (
            db.query(models.Registration)
            .filter(models.Registration.activity_id == activity.id, models.Registration.status == "waitlist")
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
        owner_person_id=person.id,
        household_id=person.household_id,
        party_size=party_size,
        contact_name=body.contact_name,
        contact_phone=body.contact_phone,
        status=status,
        waitlist_position=waitlist_position,
        reminder_channel=channel,
    )
    db.add(reg)
    db.flush()
    for a in body.attendees:
        db.add(models.RegistrationAttendee(
            registration_id=reg.id, full_name=a.full_name, phone=a.phone, email=a.email, age=a.age
        ))

    _log_journey(db, person.id, event, channel, f"activity={activity.id};party={party_size};status={status}")
    db.commit()
    db.refresh(reg)
    reg.activity = activity
    return _registration_out(reg)


@router.get("/registrations", response_model=list[schemas.RegistrationOut])
def list_registrations(person: models.Person = Depends(get_current_person), db: Session = Depends(get_db)):
    from sqlalchemy import or_
    regs = (
        db.query(models.Registration)
        .filter(or_(
            models.Registration.owner_person_id == person.id,
            models.Registration.household_id == person.household_id,
        ))
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


@router.post("/members", response_model=schemas.PersonOut)
def add_family_member(
    body: schemas.FamilyMemberIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    from ..roles_util import has_role, parse_roles

    if not person.household_id:
        raise HTTPException(status_code=400, detail="You need a household first")
    if not (has_role(person, "family") or person.household_id):
        raise HTTPException(status_code=403, detail="Not a household account")
    if person.household_role == "child":
        raise HTTPException(
            status_code=403, detail="Ask a parent or caregiver to add members"
        )

    role = body.household_role.strip().lower()
    allowed = {"mom", "dad", "caregiver", "helper", "child"}
    if role not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Role must be mom, dad, caregiver, helper, or child",
        )

    import secrets

    email = (body.email or "").strip().lower()
    if not email:
        slug = body.name.lower().replace(" ", ".")[:40]
        email = f"{slug}.{person.household_id}.{secrets.token_hex(3)}@family.love21"

    existing = db.query(models.Person).filter(models.Person.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="That email is already in use")

    is_child = body.is_child or role == "child"
    new_roles = "member" if is_child else "family"
    new_person = models.Person(
        email=email,
        name=body.name.strip(),
        role_primary="member" if is_child else "family",
        roles=new_roles,
        language=person.language or "both",
        household_id=person.household_id,
        household_role=role,
        profile_code=f"L21-HK-{secrets.randbelow(9000) + 1000}",
    )
    db.add(new_person)
    db.flush()
    db.add(
        models.CommPreferences(
            person_id=new_person.id,
            email_on=True,
            sms_on=False,
            whatsapp_on=False,
            opt_out_token=secrets.token_urlsafe(16),
        )
    )
    _log_journey(
        db,
        person.id,
        "family_member_added",
        "email",
        f"member={new_person.id};role={role}",
    )
    db.commit()
    db.refresh(new_person)
    return schemas.PersonOut(
        id=new_person.id,
        email=new_person.email,
        name=new_person.name,
        role_primary=new_person.role_primary,
        roles=parse_roles(new_person),
        language=new_person.language,
        household_id=new_person.household_id,
        household_role=new_person.household_role,
        profile_code=new_person.profile_code,
        issued_at=new_person.issued_at or new_person.created_at,
    )
