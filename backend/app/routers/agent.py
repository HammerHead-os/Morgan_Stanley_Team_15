from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/agent", tags=["agent"])

FINANCE_2024_25 = {
    "income_total": 13_495_000,
    "income": [
        ("Unrestricted funds", 6_700_000, 49),
        ("Restricted funds", 6_630_000, 49),
        ("Other income", 165_000, 2),
    ],
    "expenditure_total": 11_490_000,
    "expenditure": [
        ("Programme", 9_939_000, 86),
        ("Fundraising", 903_000, 8),
        ("Administrative", 651_000, 6),
    ],
}

BOARD_MEMBERS = [
    "Carol Chan",
    "Eleni Symeonidou",
    "Jeff Sayed",
    "Matthew Hosford",
    "Kevin Wong",
    "Young-Sook Stewart",
    "Lobo Cheung",
    "Dan Maley",
    "Edith Chen",
    "James Barrett",
    "Raymond Tam",
    "Dr. Ruby Ng",
]


def _money(value: int) -> str:
    return f"HKD {value:,.0f}"


def _activity_answer(db: Session) -> tuple[str, list[schemas.AgentToolTrace]]:
    activities = (
        db.query(models.Activity)
        .order_by(models.Activity.spots_left.desc(), models.Activity.title)
        .limit(5)
        .all()
    )
    lines = [
        f"- **{item.title}** — {item.description} "
        f"({'waitlist' if item.spots_left <= 0 else f'{item.spots_left} places left'})"
        for item in activities
    ]
    answer = (
        "## Current programme options\n\n"
        + "\n".join(lines)
        + "\n\n[Open the Activity Finder](/pages/activity-finder.html)"
    )
    return answer, [
        schemas.AgentToolTrace(
            name="search_public_programmes", result_count=len(activities)
        )
    ]


def _volunteer_answer(db: Session) -> tuple[str, list[schemas.AgentToolTrace]]:
    shifts = (
        db.query(models.VolunteerShift)
        .filter(models.VolunteerShift.spots_left > 0)
        .order_by(models.VolunteerShift.remote.desc(), models.VolunteerShift.title)
        .limit(5)
        .all()
    )
    lines = [
        f"- **{shift.title}** — {shift.duration_min} minutes, "
        f"{'remote' if shift.remote else 'in person'}, {shift.spots_left} places left"
        for shift in shifts
    ]
    answer = (
        "## Volunteer opportunities\n\n"
        + "\n".join(lines)
        + "\n\n[See every open shift](/pages/volunteer.html)"
    )
    return answer, [
        schemas.AgentToolTrace(name="list_opportunities", result_count=len(shifts))
    ]


def _finance_answer() -> tuple[str, list[schemas.AgentToolTrace]]:
    income = "\n".join(
        f"- **{label}:** {_money(value)} ({percent}%)"
        for label, value, percent in FINANCE_2024_25["income"]
    )
    expenditure = "\n".join(
        f"- **{label}:** {_money(value)} ({percent}%)"
        for label, value, percent in FINANCE_2024_25["expenditure"]
    )
    answer = (
        "## 2024-2025 financial overview\n\n"
        f"**Total income:** {_money(FINANCE_2024_25['income_total'])}\n\n"
        f"{income}\n\n"
        f"**Total expenditure:** {_money(FINANCE_2024_25['expenditure_total'])}\n\n"
        f"{expenditure}\n\n"
        "[See the visual breakdown and official reports](/pages/about.html#reports)"
    )
    return answer, [
        schemas.AgentToolTrace(name="get_financial_summary", result_count=6)
    ]


def _impact_answer(db: Session) -> tuple[str, list[schemas.AgentToolTrace]]:
    activity_count = db.query(func.count(models.Activity.id)).scalar() or 0
    registration_count = db.query(func.count(models.Registration.id)).scalar() or 0
    answer = (
        "## Latest published impact snapshot\n\n"
        "- **490 families** supported in 2024-2025\n"
        "- **6,859 sessions** delivered\n"
        "- **84 activity types** offered\n"
        f"- **{activity_count} demo activities** and "
        f"**{registration_count} demo registrations** are connected to this prototype\n\n"
        "The annual-report figures are published aggregates; the smaller database "
        "counts are local journey-demo records."
    )
    return answer, [
        schemas.AgentToolTrace(name="get_public_impact", result_count=4)
    ]


def _board_answer() -> tuple[str, list[schemas.AgentToolTrace]]:
    names = "\n".join(f"- {name}" for name in BOARD_MEMBERS)
    answer = (
        "## Board of Directors\n\n"
        f"{names}\n\n"
        "[Meet the board and view the organisation chart]"
        "(/pages/about.html#board)"
    )
    return answer, [
        schemas.AgentToolTrace(name="search_public_content", result_count=len(BOARD_MEMBERS))
    ]


def _default_answer(role: str) -> tuple[str, list[schemas.AgentToolTrace]]:
    role_note = {
        "family": "I can help you find a suitable class or explain the Profile Passport.",
        "volunteer": "I can show open volunteer roles or explain how contribution hours work.",
        "donor": "I can explain the latest financial figures, impact, and donation journey.",
        "company": "I can outline CSR options, volunteer opportunities, and reporting.",
        "curious": "I can introduce Love 21's story, programmes, reports, and leadership.",
    }.get(role, "I can help you explore Love 21.")
    answer = (
        "## Ask about Love 21\n\n"
        f"{role_note}\n\n"
        "Try one of these:\n\n"
        "- What programmes are available?\n"
        "- How was 2024-2025 income and expenditure divided?\n"
        "- Who is on the Board of Directors?\n"
        "- What volunteer roles are open?"
    )
    return answer, []


@router.post("/chat", response_model=schemas.AgentChatOut)
def chat(body: schemas.AgentChatIn, db: Session = Depends(get_db)):
    last_user = next(
        (message.content for message in reversed(body.messages) if message.role == "user"),
        None,
    )
    if not last_user:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    query = last_user.casefold()
    if any(term in query for term in ("finance", "financial", "income", "expenditure", "money", "report")):
        answer, tools = _finance_answer()
    elif any(term in query for term in ("board", "director", "organisation", "organization", "leadership")):
        answer, tools = _board_answer()
    elif any(term in query for term in ("volunteer", "shift", "help out")):
        answer, tools = _volunteer_answer(db)
    elif any(term in query for term in ("impact", "families", "sessions", "figures")):
        answer, tools = _impact_answer(db)
    elif any(term in query for term in ("programme", "program", "activity", "class", "sport", "nutrition")):
        answer, tools = _activity_answer(db)
    else:
        answer, tools = _default_answer(body.role)

    return schemas.AgentChatOut(answer=answer, tools=tools)
