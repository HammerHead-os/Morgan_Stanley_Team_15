"""24-hours-before reminder job. Runs on an interval via APScheduler
(wired up in main.py) — checks registrations and volunteer shift claims
for anything happening in roughly a day, and emails every non-child
household member once per event."""

import logging
from datetime import datetime, timedelta

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


def _send_registration_reminders(db, window_start_date, window_end_date):
    regs = (
        db.query(models.Registration)
        .filter(
            models.Registration.session_date >= window_start_date,
            models.Registration.session_date <= window_end_date,
            models.Registration.status == "registered",
            models.Registration.reminder_sent_at.is_(None),
        )
        .all()
    )
    for reg in regs:
        activity = db.get(models.Activity, reg.activity_id)
        title = activity.title if activity else "your class"
        for person in _recipients(db, reg.household_id, reg.member_person_id):
            text = f"Reminder: {title} is coming up on {reg.session_date}. See you there!"
            html = (
                f"<p>Reminder: <strong>{title}</strong> is coming up on "
                f"{reg.session_date}.</p>"
            )
            send_email(person.email, f"Reminder: {title} tomorrow", text, html)
        reg.reminder_sent_at = datetime.utcnow()
    db.commit()
    return len(regs)


def _send_volunteer_reminders(db, window_start_date, window_end_date):
    claims = (
        db.query(models.VolunteerShiftClaim)
        .join(models.VolunteerShift)
        .filter(
            models.VolunteerShift.scheduled_date >= window_start_date,
            models.VolunteerShift.scheduled_date <= window_end_date,
            models.VolunteerShift.remote.is_(False),
            models.VolunteerShiftClaim.status == "claimed",
            models.VolunteerShiftClaim.reminder_sent_at.is_(None),
        )
        .all()
    )
    for claim in claims:
        shift = claim.shift
        title = shift.title if shift else "your volunteer shift"
        profile = db.get(models.VolunteerProfile, claim.volunteer_profile_id)
        person = db.get(models.Person, profile.person_id) if profile else None
        if person:
            for recipient in _recipients(db, person.household_id, person.id):
                text = (
                    f"Reminder: {title} is coming up on {shift.scheduled_date}. "
                    f"Thanks for volunteering!"
                )
                html = (
                    f"<p>Reminder: <strong>{title}</strong> is coming up on "
                    f"{shift.scheduled_date}.</p>"
                )
                send_email(recipient.email, f"Reminder: {title} tomorrow", text, html)
        claim.reminder_sent_at = datetime.utcnow()
    db.commit()
    return len(claims)


def check_and_send_reminders() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_start_date = (now + timedelta(hours=REMINDER_WINDOW_START_HOURS)).date()
        window_end_date = (now + timedelta(hours=REMINDER_WINDOW_END_HOURS)).date()
        sent_regs = _send_registration_reminders(db, window_start_date, window_end_date)
        sent_claims = _send_volunteer_reminders(db, window_start_date, window_end_date)
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
