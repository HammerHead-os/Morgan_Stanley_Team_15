"""24-hours-before reminder job. Runs on an interval via APScheduler
(wired up in main.py) — checks registrations and volunteer shift claims
for anything happening in roughly a day, and emails every non-child
household member once per event."""

import logging
from datetime import datetime, time, timedelta

from . import models
from .database import SessionLocal
from .email_client import send_email

logger = logging.getLogger(__name__)

REMINDER_WINDOW_START_HOURS = 23
REMINDER_WINDOW_END_HOURS = 25


def _recipients(db, household_id, fallback_person_id):
    """Every non-child person sharing this household (or just the
    registrant, if there's no household), deduplicated by email and
    filtered to people who haven't opted out of email."""
    if household_id:
        people = (
            db.query(models.Person)
            .filter(models.Person.household_id == household_id)
            .all()
        )
    else:
        fallback = db.get(models.Person, fallback_person_id)
        people = [fallback] if fallback else []

    seen_emails = set()
    recipients = []
    for p in people:
        if p.household_role == "child" or not p.email:
            continue
        prefs = (
            db.query(models.CommPreferences)
            .filter(models.CommPreferences.person_id == p.id)
            .first()
        )
        if prefs and not prefs.email_on:
            continue
        key = p.email.lower()
        if key in seen_emails:
            continue
        seen_emails.add(key)
        recipients.append(p)
    return recipients


def _all_recipients(db, household_id, fallback_person_id, attendees):
    """Household accounts (deduped, opt-out respected) plus any named
    attendee on the booking itself who has an email on file — people added
    at registration/claim time should get reminded too, not just accounts,
    since there's no SMS/phone channel wired up to reach them any other way."""
    people = _recipients(db, household_id, fallback_person_id)
    combined = [(p.name, p.email) for p in people]
    seen = {p.email.lower() for p in people}
    for a in attendees:
        if not a.email:
            continue
        key = a.email.lower()
        if key in seen:
            continue
        seen.add(key)
        combined.append((a.full_name, a.email))
    return combined


def _send_registration_reminders(db, window_start, window_end):
    # Coarse date-range prefilter in SQL, exact datetime check in Python
    # below using the activity's scheduled_time — same pattern as volunteer
    # shift reminders, so same-day classes at different times each fire at
    # their own correct moment.
    candidates = (
        db.query(models.Registration)
        .filter(
            models.Registration.session_date >= window_start.date(),
            models.Registration.session_date <= window_end.date(),
            models.Registration.status == "registered",
            models.Registration.reminder_sent_at.is_(None),
        )
        .all()
    )
    sent = 0
    for reg in candidates:
        if not reg.session_date:
            continue
        activity = db.get(models.Activity, reg.activity_id)
        scheduled_time = activity.scheduled_time if activity else None
        target = datetime.combine(reg.session_date, scheduled_time or time(0, 0))
        if not (window_start <= target <= window_end):
            continue
        title = activity.title if activity else "your class"
        if scheduled_time:
            time_str = scheduled_time.strftime("%I:%M %p").lstrip("0")
            when_text = f"{reg.session_date} at {time_str}"
        else:
            when_text = str(reg.session_date)
        for name, email in _all_recipients(
            db, reg.household_id, reg.member_person_id, reg.attendees
        ):
            text = f"Hi {name}, reminder: {title} is coming up on {when_text}. See you there!"
            html = f"<p>Hi {name}, reminder: <strong>{title}</strong> is coming up on {when_text}.</p>"
            send_email(email, f"Reminder: {title} tomorrow", text, html)
        reg.reminder_sent_at = datetime.utcnow()
        sent += 1
    db.commit()
    return sent


def _send_volunteer_reminders(db, window_start, window_end):
    # Coarse date-range prefilter in SQL (cheap), then an exact datetime
    # check in Python below using scheduled_time when it's set — this is
    # what makes same-day, different-time shifts (e.g. three slots on the
    # same afternoon) each get reminded at their own correct moment instead
    # of all firing together just because they share a date.
    candidates = (
        db.query(models.VolunteerShiftClaim)
        .join(models.VolunteerShift)
        .filter(
            models.VolunteerShift.scheduled_date >= window_start.date(),
            models.VolunteerShift.scheduled_date <= window_end.date(),
            models.VolunteerShift.remote.is_(False),
            models.VolunteerShiftClaim.status == "claimed",
            models.VolunteerShiftClaim.reminder_sent_at.is_(None),
        )
        .all()
    )
    sent = 0
    for claim in candidates:
        shift = claim.shift
        if not shift or not shift.scheduled_date:
            continue
        target = datetime.combine(shift.scheduled_date, shift.scheduled_time or time(0, 0))
        if not (window_start <= target <= window_end):
            continue
        title = shift.title
        if shift.scheduled_time:
            time_str = shift.scheduled_time.strftime("%I:%M %p").lstrip("0")
            when_text = f"{shift.scheduled_date} at {time_str}"
        else:
            when_text = str(shift.scheduled_date)
        profile = db.get(models.VolunteerProfile, claim.volunteer_profile_id)
        person = db.get(models.Person, profile.person_id) if profile else None
        if person:
            for name, email in _all_recipients(
                db, person.household_id, person.id, claim.attendees
            ):
                text = f"Hi {name}, reminder: {title} is coming up on {when_text}. Thanks for volunteering!"
                html = f"<p>Hi {name}, reminder: <strong>{title}</strong> is coming up on {when_text}.</p>"
                send_email(email, f"Reminder: {title} tomorrow", text, html)
        claim.reminder_sent_at = datetime.utcnow()
        sent += 1
    db.commit()
    return sent


def check_and_send_reminders() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_start = now + timedelta(hours=REMINDER_WINDOW_START_HOURS)
        window_end = now + timedelta(hours=REMINDER_WINDOW_END_HOURS)
        sent_regs = _send_registration_reminders(db, window_start, window_end)
        sent_claims = _send_volunteer_reminders(db, window_start, window_end)
        if sent_regs or sent_claims:
            logger.info(
                "Reminder job: %d registration(s), %d volunteer claim(s) processed",
                sent_regs,
                sent_claims,
            )
    except Exception:
        logger.exception("Reminder job failed")
        db.rollback()
    finally:
        db.close()
