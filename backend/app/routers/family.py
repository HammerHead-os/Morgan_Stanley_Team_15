from datetime import date, datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..email_client import frontend_url, qr_data_uri, send_email
from ..labels import status_label
from ..posthog_client import get_posthog_client
from ..reminders import _all_recipients
from ..roles_util import ensure_role

INVITE_TTL_DAYS = 7

router = APIRouter(prefix="/api/family", tags=["family"])

_WEEKDAY_TARGETS = {"saturday": 5, "sunday": 6}  # Monday=0 ... Sunday=6


def _next_occurrence(day: str) -> date:
    """The actual calendar date of this activity's next session. Classes run
    on a fixed recurring schedule (Activity.day), so this is always computed
    server-side — never something a registrant picks."""
    today = date.today()
    target = _WEEKDAY_TARGETS.get(day)
    if target is not None:
        return today + timedelta(days=(target - today.weekday()) % 7)
    # "weekday" (or anything unrecognized): today if it's already Mon–Fri,
    # otherwise the next Monday.
    candidate = today
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def _session_date_for(activity: models.Activity) -> date:
    """A one-off activity (fixed_date set) always happens on that exact
    date; a recurring one falls back to the next matching weekday."""
    return activity.fixed_date or _next_occurrence(activity.day)


def _registration_out(reg: models.Registration) -> schemas.RegistrationOut:
    label = status_label(reg.status)
    if reg.status == "waitlist" and reg.waitlist_position:
        label = f"On waitlist · #{reg.waitlist_position}"
    return schemas.RegistrationOut(
        id=reg.id,
        activity_id=reg.activity_id,
        household_id=reg.household_id,
        member_person_id=reg.member_person_id,
        party_size=reg.party_size,
        status=reg.status,
        status_label=label,
        waitlist_position=reg.waitlist_position,
        reminder_channel=reg.reminder_channel,
        created_at=reg.created_at,
        session_date=reg.session_date,
        scheduled_time=reg.activity.scheduled_time if reg.activity else None,
        feedback=reg.feedback,
        activity_title=reg.activity.title if reg.activity else None,
        activity_location=reg.activity.location if reg.activity else None,
        activity_goal=reg.activity.goal if reg.activity else None,
        member_name=reg.member.name if reg.member else None,
        attendees=[schemas.AttendeeOut.model_validate(a) for a in reg.attendees],
    )


def _log_journey(
    db: Session, person_id: int, event_type: str, channel: str, payload: str
):
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
    # Registering yourself needs no household at all — the registrant may be
    # the person with support needs, not necessarily a carer booking a
    # separate dependent. Registering someone else still requires that
    # person to be an existing member of your own household.
    target_id = body.member_person_id or person.id
    member = db.get(models.Person, target_id)
    if not member:
        raise HTTPException(status_code=404, detail="Person not found")
    if member.id != person.id:
        if not person.household_id or member.household_id != person.household_id:
            raise HTTPException(status_code=403, detail="Member not in your household")

    activity = db.get(models.Activity, body.activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # 1. Check if member already has an ACTIVE record for this activity —
    # a cancelled registration doesn't block rebooking (see the partial
    # unique index on Registration for the DB-level half of this).
    existing = (
        db.query(models.Registration)
        .filter(
            models.Registration.activity_id == body.activity_id,
            models.Registration.member_person_id == target_id,
            models.Registration.status != "cancelled",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This family member is already registered or on the waitlist for this activity.",
        )

    # 2. Assign registration or waitlist status — a party only fits if every
    # seat it needs is available; otherwise the whole party waits together.
    party_size = 1 + len(body.attendees)
    if activity.spots_left >= party_size:
        reg_status = "registered"
        waitlist_position = None
        activity.spots_left -= party_size
        event = "registration_confirmed"
    else:
        reg_status = "waitlist"
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

    channel = (
        body.reminder_channel
        if body.reminder_channel in ("email", "sms", "whatsapp")
        else "email"
    )
    prefs = person.prefs
    if channel == "sms" and prefs and not prefs.sms_on:
        channel = "email"
    if channel == "whatsapp" and prefs and not prefs.whatsapp_on:
        channel = "email"

    reg = models.Registration(
        activity_id=activity.id,
        household_id=person.household_id,
        member_person_id=member.id,
        party_size=party_size,
        status=reg_status,
        waitlist_position=waitlist_position,
        reminder_channel=channel,
        session_date=_session_date_for(activity),
        created_at=datetime.utcnow(),
    )
    ensure_role(person, "family")
    db.add(reg)
    db.flush()
    for a in body.attendees:
        db.add(
            models.RegistrationAttendee(
                registration_id=reg.id,
                full_name=a.full_name,
                phone=a.phone,
                email=a.email,
                age=a.age,
                role=a.role,
            )
        )
    _log_journey(
        db,
        person.id,
        event,
        channel,
        f"activity={activity.id};member={member.id};party={party_size};status={reg_status}",
    )

    # 3. Safely commit with exception handling for database integrity constraints
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This family member is already registered for this activity.",
        )

    db.refresh(reg)
    reg.activity = activity
    reg.member = member

    client = get_posthog_client()
    if client:
        client.capture(
            (
                "activity_registration_completed"
                if reg_status == "registered"
                else "activity_waitlist_joined"
            ),
            properties={"reminder_channel": channel},
        )

    return _registration_out(reg)


def _owns_registration(person: models.Person, reg: models.Registration) -> bool:
    if reg.member_person_id == person.id:
        return True
    return bool(person.household_id) and reg.household_id == person.household_id


@router.get("/registrations", response_model=list[schemas.RegistrationOut])
def list_registrations(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    conditions = [models.Registration.member_person_id == person.id]
    if person.household_id:
        conditions.append(models.Registration.household_id == person.household_id)
    regs = (
        db.query(models.Registration)
        .filter(or_(*conditions))
        .order_by(models.Registration.created_at.desc())
        .all()
    )
    return [_registration_out(r) for r in regs]


@router.post(
    "/registrations/{registration_id}/feedback", response_model=schemas.RegistrationOut
)
def post_feedback(
    registration_id: int,
    body: schemas.FeedbackIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    reg = db.get(models.Registration, registration_id)
    if not reg or not _owns_registration(person, reg):
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

    client = get_posthog_client()
    if client:
        client.capture("session_feedback_submitted")

    return _registration_out(reg)


@router.post(
    "/registrations/{registration_id}/cancel", response_model=schemas.RegistrationOut
)
def cancel_registration(
    registration_id: int,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    reg = db.get(models.Registration, registration_id)
    if not reg or not _owns_registration(person, reg):
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status == "cancelled":
        raise HTTPException(status_code=409, detail="Already cancelled")
    if reg.status == "attended":
        raise HTTPException(status_code=409, detail="Can't cancel a completed session")

    was_registered = reg.status == "registered"
    freed_position = reg.waitlist_position
    reg.status = "cancelled"
    reg.waitlist_position = None

    activity = db.get(models.Activity, reg.activity_id)
    if was_registered and activity:
        activity.spots_left += reg.party_size
        waiting = (
            db.query(models.Registration)
            .filter(
                models.Registration.activity_id == activity.id,
                models.Registration.status == "waitlist",
            )
            .order_by(models.Registration.waitlist_position)
            .all()
        )
        for candidate in waiting:
            if activity.spots_left >= candidate.party_size:
                candidate.status = "registered"
                candidate.waitlist_position = None
                activity.spots_left -= candidate.party_size
                _log_journey(
                    db,
                    candidate.member_person_id,
                    "registration_promoted",
                    candidate.reminder_channel,
                    f"activity={activity.id};registration={candidate.id}",
                )
        # Close any gaps left by out-of-order promotion so positions stay
        # a clean 1..N for whoever's still waiting.
        still_waiting = [c for c in waiting if c.status == "waitlist"]
        for i, candidate in enumerate(still_waiting, start=1):
            candidate.waitlist_position = i
    elif freed_position:
        (
            db.query(models.Registration)
            .filter(
                models.Registration.activity_id == reg.activity_id,
                models.Registration.status == "waitlist",
                models.Registration.waitlist_position > freed_position,
            )
            .update(
                {
                    models.Registration.waitlist_position: models.Registration.waitlist_position
                    - 1
                }
            )
        )

        if activity:
            time_str = (
                activity.scheduled_time.strftime("%I:%M %p").lstrip("0")
                if activity.scheduled_time
                else ""
            )
            when_text = (
                f"{reg.session_date} at {time_str}"
                if reg.session_date and time_str
                else str(reg.session_date or "")
            )
        for name, email in _all_recipients(
            db, reg.household_id, reg.member_person_id, reg.attendees
        ):
            text = f'Hi {name}, your booking for "{activity.title}"{" on " + when_text if when_text else ""} has been cancelled.'
            html = f'<p>Hi {name}, your booking for <strong>{activity.title}</strong>{" on " + when_text if when_text else ""} has been cancelled.</p>'
            send_email(email, f"Cancelled: {activity.title}", text, html)

    _log_journey(
        db,
        person.id,
        "registration_cancelled",
        reg.reminder_channel,
        f"registration={reg.id}",
    )
    db.commit()
    db.refresh(reg)
    if activity:
        reg.activity = activity

    client = get_posthog_client()
    if client:
        client.capture("activity_registration_cancelled")

    return _registration_out(reg)


def _create_invite(
    db: Session,
    household: models.Household,
    created_by: models.Person,
    invited_email: str,
    invited_person_id: int,
) -> models.HouseholdInvite:
    invite = models.HouseholdInvite(
        household_id=household.id,
        invited_email=invited_email,
        invited_person_id=invited_person_id,
        code=secrets.token_urlsafe(24),
        created_by_person_id=created_by.id,
        expires_at=datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    return invite


def _send_join_invite_email(household: models.Household, invite: models.HouseholdInvite) -> None:
    link = frontend_url(f"/pages/profile.html?join_code={invite.code}")
    qr = qr_data_uri(link)
    text = (
        f"You've been invited to join {household.name} on Love 21.\n\n"
        f"Log in to your account, then open Profile and enter this code: {invite.code}\n"
        f"Or click: {link}\n\n"
        f"This invite expires in {INVITE_TTL_DAYS} days."
    )
    html = (
        f"<p>You've been invited to join <strong>{household.name}</strong> on Love 21.</p>"
        f"<p>Log in to your account, then open Profile and enter this code: <strong>{invite.code}</strong></p>"
        f'<p><a href="{link}">{link}</a></p>'
        f'<p><img src="{qr}" alt="QR code" width="180" height="180" /></p>'
        f"<p>This invite expires in {INVITE_TTL_DAYS} days.</p>"
    )
    send_email(invite.invited_email, f"Join {household.name} on Love 21", text, html)


def _send_create_account_invite_email(
    household: models.Household, invite: models.HouseholdInvite, name: str
) -> None:
    link = frontend_url(f"/pages/claim-account.html?code={invite.code}")
    qr = qr_data_uri(link)
    text = (
        f"{name} was added to {household.name} on Love 21.\n\n"
        f"Create your own login so you can see and manage your bookings: {link}\n"
        f"Your invite code: {invite.code}\n\n"
        f"This invite expires in {INVITE_TTL_DAYS} days."
    )
    html = (
        f"<p><strong>{name}</strong> was added to <strong>{household.name}</strong> on Love 21.</p>"
        f'<p><a href="{link}">Create your account</a> so you can see and manage your bookings.</p>'
        f"<p>Your invite code: <strong>{invite.code}</strong></p>"
        f'<p><img src="{qr}" alt="QR code" width="180" height="180" /></p>'
        f"<p>This invite expires in {INVITE_TTL_DAYS} days.</p>"
    )
    send_email(
        invite.invited_email, f"Create your Love 21 account — {household.name}", text, html
    )


@router.post("/members", response_model=schemas.PersonOut | schemas.InviteOut)
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

    email = body.email.strip().lower()
    household = db.get(models.Household, person.household_id)

    existing = db.query(models.Person).filter(models.Person.email == email).first()

    if existing:
        # They already have their own account — don't touch it. Invite them
        # to join this household instead of creating a duplicate record.
        if existing.household_id == person.household_id:
            raise HTTPException(
                status_code=409, detail="They're already in your household"
            )
        invite = _create_invite(db, household, person, email, existing.id)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="An invite is already pending for that email"
            )
        db.refresh(invite)
        _send_join_invite_email(household, invite)
        client = get_posthog_client()
        if client:
            client.capture(
                "household_invite_sent", properties={"kind": "existing_account"}
            )
        return schemas.InviteOut(status="invited", invited_email=email)

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
    invite = _create_invite(db, household, person, email, new_person.id)
    _log_journey(
        db,
        person.id,
        "family_member_added",
        "email",
        f"member={new_person.id};role={role}",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email is already in use")
    db.refresh(new_person)
    db.refresh(invite)

    _send_create_account_invite_email(household, invite, new_person.name)

    client = get_posthog_client()
    if client:
        client.capture(
            "family_member_added",
            properties={"household_role": role, "is_child": is_child},
        )

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


@router.delete("/members/{person_id}", response_model=schemas.PersonOut)
def remove_family_member(
    person_id: int,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    from ..roles_util import parse_roles

    if not person.household_id:
        raise HTTPException(status_code=400, detail="You need a household first")
    if person.household_role == "child":
        raise HTTPException(
            status_code=403, detail="Ask a parent or caregiver to remove members"
        )
    if person_id == person.id:
        raise HTTPException(
            status_code=400,
            detail="You can't remove yourself — join a different household instead",
        )

    target = db.get(models.Person, person_id)
    if not target or target.household_id != person.household_id:
        raise HTTPException(status_code=404, detail="Member not found")

    # Removing someone shouldn't leave them stranded — spin them off into
    # their own solo household (same shape signup() creates) and carry
    # their own bookings with them, mirroring /join's re-parenting.
    new_household = models.Household(
        name=f"{target.name}'s household", carer_person_id=target.id
    )
    db.add(new_household)
    db.flush()
    target.household_id = new_household.id
    db.query(models.Registration).filter(
        models.Registration.member_person_id == target.id
    ).update({models.Registration.household_id: new_household.id})

    _log_journey(
        db, person.id, "family_member_removed", "email", f"member={target.id}"
    )
    db.commit()
    db.refresh(target)

    client = get_posthog_client()
    if client:
        client.capture("family_member_removed")

    return schemas.PersonOut(
        id=target.id,
        email=target.email,
        name=target.name,
        role_primary=target.role_primary,
        roles=parse_roles(target),
        language=target.language,
        household_id=target.household_id,
        household_role=target.household_role,
        profile_code=target.profile_code,
        issued_at=target.issued_at or target.created_at,
    )


@router.post("/join", response_model=schemas.PersonOut)
def join_household(
    body: schemas.JoinHouseholdIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    from ..roles_util import parse_roles

    invite = (
        db.query(models.HouseholdInvite)
        .filter(models.HouseholdInvite.code == body.code)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    # Only the account this invite was actually addressed to may redeem it —
    # otherwise any logged-in account that obtains a code meant for someone
    # else could hijack its way into an arbitrary household.
    if invite.invited_person_id != person.id:
        raise HTTPException(
            status_code=403, detail="This invite isn't addressed to your account"
        )
    if invite.status != "pending":
        raise HTTPException(status_code=409, detail="This invite has already been used")
    if invite.expires_at < datetime.utcnow():
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=409, detail="This invite has expired")

    old_household_id = person.household_id
    person.household_id = invite.household_id
    db.query(models.Registration).filter(
        models.Registration.member_person_id == person.id
    ).update({models.Registration.household_id: invite.household_id})
    invite.status = "accepted"
    invite.accepted_at = datetime.utcnow()

    _log_journey(
        db,
        person.id,
        "household_joined",
        "email",
        f"from_household={old_household_id};to_household={invite.household_id}",
    )
    db.commit()
    db.refresh(person)

    client = get_posthog_client()
    if client:
        client.capture("household_joined")

    return schemas.PersonOut(
        id=person.id,
        email=person.email,
        name=person.name,
        role_primary=person.role_primary,
        roles=parse_roles(person),
        language=person.language,
        household_id=person.household_id,
        household_role=person.household_role,
        profile_code=person.profile_code,
        issued_at=person.issued_at or person.created_at,
    )
