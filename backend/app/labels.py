"""Shared label helpers for human-readable Profile statuses."""

STATUS_LABELS = {
    "registered": "Booked",
    "waitlist": "On waitlist",
    "attended": "Attended — feedback welcome",
    "cancelled": "Cancelled",
    "pending": "Awaiting coach",
    "coach_approved": "Coach approved",
    "shared": "Shared (with consent)",
    "in_progress": "In progress",
    "active": "Active",
    "paused": "Paused",
    "cancelled_gift": "Cancelled",
    "claimed": "Claimed",
    "completed": "Completed",
}

EVENT_LABELS = {
    "registration_confirmed": "Class booking confirmed",
    "waitlist_joined": "Joined waitlist — reminder set",
    "post_session_feedback": "Session feedback received",
    "goal_set": "New goal set",
    "achievement_coach_approved": "Coach approved a milestone",
    "commitment_started": "Monthly gift started",
    "commitment_updated": "Gift updated",
    "volunteer_onboarded": "Volunteer profile ready",
    "shift_claimed": "Volunteer shift claimed",
    "shift_completed": "Shift completed",
    "hire_enquiry": "Creator hire enquiry sent",
    "one_click_opt_out": "Opted out of messages",
}


def status_label(code: str) -> str:
    if code == "cancelled":
        return STATUS_LABELS.get("cancelled", code)
    return STATUS_LABELS.get(code, code.replace("_", " ").title())


def event_label(code: str) -> str:
    return EVENT_LABELS.get(code, code.replace("_", " ").title())
