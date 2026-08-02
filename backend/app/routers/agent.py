"""Role-aware, read-only Love 21 AI agent backed by DeepSeek.

The browser only sends the normal demo token. Access is derived again from the
database for every request, so a guest cannot ask the model to act as a member
or administrator. When DeepSeek is not configured (or temporarily unavailable)
the same read-only tools return deterministic demo answers.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import optional_person
from ..roles_util import parse_roles
from ..settings import settings

router = APIRouter(prefix="/api/agent", tags=["agent"])

DOCS_ROOT = Path(__file__).resolve().parents[3] / "docs"
PUBLIC_PAGES = (
    ("Home", "index.html"),
    ("About Love 21", "pages/about.html"),
    ("Contact", "pages/contact.html"),
    ("Activity Finder", "pages/activity-finder.html"),
    ("Volunteer", "pages/volunteer.html"),
    ("Donations and impact", "pages/impact.html"),
    ("Transparency", "pages/transparency.html"),
)

ROUTE_CATALOG = """Available Love 21 website destinations:
- About, programmes, people and governance: [Open About](/pages/about.html)
- Financial reports: [Open Financial reports](/pages/about.html#reports)
- Contact details and message form: [Open Contact](/pages/contact.html)
- Programme and class search: [Open Activity Finder](/pages/activity-finder.html)
- Volunteer opportunities: [Open Volunteer](/pages/volunteer.html)
- Donations and impact: [Open Donations](/pages/impact.html)
- Member records, family, calendar and journals: [Open Profile](/pages/profile.html)
- Staff analytics and operational data: [Open Admin dashboard](/pages/admin-dashboard.html)
"""

FINANCE_2024_25 = {
    "income_total": 13_495_000,
    "income": (
        ("Unrestricted funds", 6_700_000, 49),
        ("Restricted funds", 6_630_000, 49),
        ("Other income", 165_000, 2),
    ),
    "expenditure_total": 11_490_000,
    "expenditure": (
        ("Programme", 9_939_000, 86),
        ("Fundraising", 903_000, 8),
        ("Administrative", 651_000, 6),
    ),
}


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._hidden_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "svg", "template", "noscript"}:
            self._hidden_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "svg", "template", "noscript"}:
            self._hidden_depth = max(0, self._hidden_depth - 1)

    def handle_data(self, data: str) -> None:
        if not self._hidden_depth:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


def _page_text(relative_path: str, limit: int = 3500) -> str:
    path = DOCS_ROOT / relative_path
    try:
        parser = _VisibleTextParser()
        parser.feed(path.read_text(encoding="utf-8"))
        return " ".join(parser.parts)[:limit]
    except (OSError, UnicodeError):
        return ""


def _access_level(person: models.Person | None) -> str:
    if person is None:
        return "guest"
    return "admin" if "admin" in parse_roles(person) else "member"


def _public_context(db: Session) -> tuple[dict[str, Any], list[schemas.AgentToolTrace]]:
    activities = (
        db.query(models.Activity)
        .order_by(models.Activity.spots_left.desc(), models.Activity.title)
        .all()
    )
    shifts = (
        db.query(models.VolunteerShift)
        .order_by(models.VolunteerShift.spots_left.desc(), models.VolunteerShift.title)
        .all()
    )
    pages = [
        {"title": title, "path": "/" + path, "content": _page_text(path)}
        for title, path in PUBLIC_PAGES
    ]
    return (
        {
            "website_pages": pages,
            "programmes": [
                {
                    "title": item.title,
                    "description": item.description,
                    "goal": item.goal,
                    "day": item.day,
                    "language": item.language,
                    "location": item.location,
                    "spots_left": item.spots_left,
                }
                for item in activities
            ],
            "volunteer_opportunities": [
                {
                    "title": item.title,
                    "description": item.description,
                    "duration_minutes": item.duration_min,
                    "remote": item.remote,
                    "spots_left": item.spots_left,
                }
                for item in shifts
            ],
            "published_finance_2024_25": FINANCE_2024_25,
            "published_impact_2024_25": {
                "families_supported": 490,
                "sessions_delivered": 6859,
                "activity_types": 84,
            },
        },
        [
            schemas.AgentToolTrace(name="search_public_website", result_count=len(pages)),
            schemas.AgentToolTrace(name="search_public_programmes", result_count=len(activities)),
            schemas.AgentToolTrace(name="list_volunteer_opportunities", result_count=len(shifts)),
        ],
    )


def _member_context(person: models.Person, db: Session) -> tuple[dict[str, Any], list[schemas.AgentToolTrace]]:
    household_members: list[models.Person] = []
    registrations: list[models.Registration] = []
    if person.household_id:
        household_members = (
            db.query(models.Person)
            .filter(models.Person.household_id == person.household_id)
            .order_by(models.Person.id)
            .all()
        )
        registrations = (
            db.query(models.Registration)
            .filter(models.Registration.household_id == person.household_id)
            .order_by(models.Registration.created_at.desc())
            .all()
        )
    member_ids = [item.id for item in household_members] or [person.id]
    achievements = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id.in_(member_ids))
        .order_by(models.Achievement.created_at.desc())
        .all()
    )
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id.in_(member_ids))
        .order_by(models.Goal.created_at.desc())
        .all()
    )
    commitments = (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .order_by(models.DonationCommitment.started_at.desc())
        .all()
    )
    commitment_ids = [item.id for item in commitments]
    receipts = (
        db.query(models.DonationReceipt)
        .filter(models.DonationReceipt.commitment_id.in_(commitment_ids))
        .order_by(models.DonationReceipt.paid_at.desc())
        .all()
        if commitment_ids
        else []
    )
    volunteer_profile = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id == person.id)
        .first()
    )
    claims = (
        db.query(models.VolunteerShiftClaim)
        .filter(models.VolunteerShiftClaim.volunteer_profile_id == volunteer_profile.id)
        .order_by(models.VolunteerShiftClaim.claimed_at.desc())
        .all()
        if volunteer_profile
        else []
    )
    journey_events = (
        db.query(models.JourneyEvent)
        .filter(models.JourneyEvent.person_id == person.id)
        .order_by(models.JourneyEvent.created_at.desc())
        .limit(30)
        .all()
    )

    context = {
        "signed_in_person": {
            "id": person.id,
            "name": person.name,
            "email": person.email,
            "phone": person.phone,
            "roles": parse_roles(person),
            "language": person.language,
            "profile_code": person.profile_code,
            "login_count": person.login_count,
            "last_login_at": person.last_login_at,
        },
        "family_members": [
            {
                "id": item.id,
                "name": item.name,
                "relationship": item.household_role,
                "primary_role": item.role_primary,
            }
            for item in household_members
        ],
        "activity_records": [
            {
                "activity": item.activity.title,
                "member": item.member.name,
                "date": item.session_date,
                "status": item.status,
                "location": item.activity.location,
                "feedback": item.feedback,
            }
            for item in registrations
        ],
        "achievements": [
            {
                "member": item.member.name,
                "title": item.title,
                "pillar": item.pillar,
                "status": item.status,
                "coach": item.coach_name,
            }
            for item in achievements
        ],
        "goals": [
            {
                "member": item.member.name,
                "title": item.title,
                "status": item.status,
                "target_date": item.target_date,
            }
            for item in goals
        ],
        "donation_commitments": [
            {
                "id": item.id,
                "amount_hkd": item.amount_hkd,
                "fund": item.fund_category,
                "status": item.status,
                "cadence": item.cadence,
            }
            for item in commitments
        ],
        "donation_receipts": [
            {"amount_hkd": item.amount_hkd, "paid_at": item.paid_at}
            for item in receipts
        ],
        "volunteer_profile": (
            {
                "skills": volunteer_profile.skills,
                "languages": volunteer_profile.languages,
                "hours_logged": volunteer_profile.hours_logged,
                "points_balance": volunteer_profile.points_balance,
            }
            if volunteer_profile
            else None
        ),
        "volunteer_records": [
            {
                "shift": item.shift.title,
                "status": item.status,
                "hours": item.hours,
                "scheduled_date": item.shift.scheduled_date,
                "reflection": item.reflection,
            }
            for item in claims
        ],
        "journey_events": [
            {
                "type": item.event_type,
                "channel": item.channel,
                "created_at": item.created_at,
            }
            for item in journey_events
        ],
    }
    record_count = sum(
        len(items)
        for items in (
            household_members,
            registrations,
            achievements,
            goals,
            commitments,
            receipts,
            claims,
            journey_events,
        )
    )
    return context, [
        schemas.AgentToolTrace(name="search_my_account", result_count=record_count)
    ]


def _normalise_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _dashboard_summary(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {"available": False, "note": "No dashboard dataset is stored in this browser."}

    summary: dict[str, Any] = {"available": True, "tables": {}}
    for table_name, rows in payload.items():
        if table_name.startswith("__") or not isinstance(rows, list):
            continue
        table_summary: dict[str, Any] = {"rows": len(rows)}
        if _normalise_key(table_name) == "visitors":
            total_visits = 0.0
            sources: Counter[str] = Counter()
            user_types: Counter[str] = Counter()
            for row in rows:
                if not isinstance(row, dict):
                    continue
                normalised = {_normalise_key(str(key)): value for key, value in row.items()}
                value = next(
                    (normalised[key] for key in ("visits", "count", "visitors", "number") if key in normalised),
                    1,
                )
                try:
                    total_visits += float(value)
                except (TypeError, ValueError):
                    total_visits += 1
                source = str(normalised.get("source") or normalised.get("channel") or "Unknown")
                user_type = str(normalised.get("usertype") or normalised.get("visitortype") or "Unknown")
                sources[source] += 1
                user_types[user_type] += 1
            table_summary.update(
                total_visits=int(total_visits),
                top_sources=sources.most_common(8),
                user_types=user_types.most_common(8),
            )
        summary["tables"][table_name] = table_summary

    # Include the uploaded demo rows for staff questions, bounded to keep prompts usable.
    raw = json.dumps(payload, ensure_ascii=False, default=str)
    summary["searchable_rows_json"] = raw[:35_000]
    summary["truncated"] = len(raw) > 35_000
    return summary


def _admin_context(
    client_dashboard: dict[str, Any] | None,
    db: Session,
) -> tuple[dict[str, Any], list[schemas.AgentToolTrace]]:
    counts = {
        "people": db.query(func.count(models.Person.id)).scalar() or 0,
        "households": db.query(func.count(models.Household.id)).scalar() or 0,
        "activities": db.query(func.count(models.Activity.id)).scalar() or 0,
        "registrations": db.query(func.count(models.Registration.id)).scalar() or 0,
        "volunteer_shifts": db.query(func.count(models.VolunteerShift.id)).scalar() or 0,
        "volunteer_claims": db.query(func.count(models.VolunteerShiftClaim.id)).scalar() or 0,
        "donation_commitments": db.query(func.count(models.DonationCommitment.id)).scalar() or 0,
        "donation_receipts": db.query(func.count(models.DonationReceipt.id)).scalar() or 0,
    }
    people_by_role = dict(
        db.query(models.Person.role_primary, func.count(models.Person.id))
        .group_by(models.Person.role_primary)
        .all()
    )
    commitment_total = (
        db.query(func.coalesce(func.sum(models.DonationCommitment.amount_hkd), 0)).scalar()
        or 0
    )
    attendance_by_status = dict(
        db.query(models.Registration.status, func.count(models.Registration.id))
        .group_by(models.Registration.status)
        .all()
    )
    dashboard = _dashboard_summary(client_dashboard)
    context = {
        "database_counts": counts,
        "people_by_primary_role": people_by_role,
        "registration_statuses": attendance_by_status,
        "active_commitment_value_hkd": float(commitment_total),
        "browser_dashboard": dashboard,
    }
    dashboard_rows = sum(
        int(item.get("rows", 0))
        for item in dashboard.get("tables", {}).values()
        if isinstance(item, dict)
    )
    return context, [
        schemas.AgentToolTrace(
            name="search_admin_dashboard",
            result_count=sum(counts.values()) + dashboard_rows,
        )
    ]


def _money(value: float | int) -> str:
    return f"HKD {value:,.0f}"


def _contains(query: str, *terms: str) -> bool:
    folded = query.casefold()
    return any(term.casefold() in folded for term in terms)


def _is_chinese_query(query: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", query))


def _local_answer(
    query: str,
    access_level: str,
    public: dict[str, Any],
    member: dict[str, Any] | None,
    admin: dict[str, Any] | None,
) -> str:
    zh = _is_chinese_query(query)

    if _contains(query, "finance", "financial", "report", "income", "expenditure", "财务", "財務", "年报", "年報", "財報"):
        if zh:
            return (
                "## 2024–2025 財務概覽\n\n"
                f"- **總收入：** {_money(FINANCE_2024_25['income_total'])}\n"
                f"- **總支出：** {_money(FINANCE_2024_25['expenditure_total'])}\n"
                "- 項目支出佔總支出的 **86%**。\n\n"
                "[查看財務圖表及正式財務報告](/pages/about.html#reports)"
            )
        return (
            "## 2024–2025 financial overview\n\n"
            f"- **Total income:** {_money(FINANCE_2024_25['income_total'])}\n"
            f"- **Total expenditure:** {_money(FINANCE_2024_25['expenditure_total'])}\n"
            "- Programme expenditure represented **86%** of expenditure.\n\n"
            "[Open the visual breakdown and official financial reports](/pages/about.html#reports)"
        )
    if _contains(query, "contact", "phone", "email", "address", "聯絡", "联系", "地址", "電話", "电话"):
        if zh:
            return (
                "## 聯絡 Love 21\n\n"
                "- **電話：** +852 2322 2121\n"
                "- **電郵：** info@love21foundation.com\n"
                "- **地址：** 新蒲崗六合街 21 號 ARTISAN LAB 2 樓 Trium Lab\n\n"
                "[前往聯絡頁面](/pages/contact.html)"
            )
        return (
            "## Contact Love 21\n\n"
            "- **Phone:** +852 2322 2121\n"
            "- **Email:** info@love21foundation.com\n"
            "- **Visit:** 2/F, Trium Lab, 21 Luk Hop Street, San Po Kong\n\n"
            "[Open the Contact page](/pages/contact.html)"
        )

    admin_query = access_level == "admin" and admin and _contains(
        query,
        "dashboard",
        "visitor",
        "traffic",
        "how many",
        "analytics",
        "registration",
        "attendance",
        "people count",
        "donation total",
        "volunteer claim",
        "管理儀表板",
        "管理仪表板",
        "網站有多少人",
        "网站有多少人",
        "瀏覽",
        "浏览",
        "訪客",
        "访客",
        "人數",
        "人数",
        "參加記錄",
        "参加记录",
        "報名",
        "报名",
        "總數",
        "总数",
    )
    if admin_query:
        counts = admin.get("database_counts", {})
        browser = admin.get("browser_dashboard", {})
        visitor = next(
            (
                value
                for key, value in browser.get("tables", {}).items()
                if _normalise_key(key) == "visitors"
            ),
            None,
        )
        registration_statuses = admin.get("registration_statuses", {})
        status_text = ", ".join(
            f"{status}: {count}" for status, count in registration_statuses.items()
        ) or ("未有分類記錄" if zh else "no status breakdown available")
        visits = visitor.get("total_visits", 0) if visitor else None
        if zh:
            visit_line = (
                f"- **網站瀏覽次數：** {visits:,}\n"
                if visits is not None
                else "- **網站瀏覽次數：** 此瀏覽器尚未儲存訪客資料。\n"
            )
            return (
                "## 職員儀表板摘要\n\n"
                + visit_line
                + f"- **Demo 資料庫人數：** {counts.get('people', 0):,}\n"
                + f"- **活動參加記錄：** {counts.get('registrations', 0):,}（{status_text}）\n"
                + f"- **義工認領記錄：** {counts.get('volunteer_claims', 0):,}\n"
                + f"- **有效捐款承諾總額：** {_money(admin.get('active_commitment_value_hkd', 0))}\n\n"
                + "[前往管理儀表板](/pages/admin-dashboard.html)"
            )
        visit_line = (
            f"- **Recorded website visits:** {visits:,}\n"
            if visits is not None
            else "- **Recorded website visits:** no visitor dataset is stored in this browser yet.\n"
        )
        return (
            "## Staff dashboard snapshot\n\n"
            + visit_line
            + f"- **People in the demo database:** {counts.get('people', 0):,}\n"
            + f"- **Activity registrations:** {counts.get('registrations', 0):,} ({status_text})\n"
            + f"- **Volunteer claims:** {counts.get('volunteer_claims', 0):,}\n"
            + f"- **Active donation commitments:** {_money(admin.get('active_commitment_value_hkd', 0))}\n\n"
            + "[Open the Admin dashboard](/pages/admin-dashboard.html)"
        )

    personal_activity_query = access_level in {"member", "admin"} and _contains(
        query,
        "my activity",
        "my account record",
        "family joined",
        "family attended",
        "activities has my family",
        "joined",
        "attended",
        "activity record",
        "我參加",
        "我参加",
        "家人參加",
        "家人参加",
        "參加過",
        "参加过",
        "活動記錄",
        "活动记录",
        "帳戶記錄",
        "账户记录",
    )

    if access_level in {"member", "admin"} and member:
        if personal_activity_query:
            records = member.get("activity_records", [])
            if zh:
                lines = "\n".join(
                    f"- **{item['activity']}** — {item['member']}，{item.get('date') or '日期未設定'}，{item['status']}"
                    for item in records[:10]
                ) or "此帳戶目前沒有活動參加記錄。"
                return f"## 你的活動記錄\n\n{lines}\n\n[查看個人日曆](/pages/profile.html#calendar)"
            lines = "\n".join(
                f"- **{item['activity']}** — {item['member']}, {item.get('date') or 'date not set'}, {item['status']}"
                for item in records[:10]
            ) or "No activity records are connected to this account."
            return f"## Your activity records\n\n{lines}\n\n[Open your Profile calendar](/pages/profile.html#calendar)"
        if _contains(query, "family", "家人", "家庭", "member", "成員", "成员"):
            family = member.get("family_members", [])
            if zh:
                lines = "\n".join(
                    f"- **{item['name']}** — {item.get('relationship') or item.get('primary_role')}"
                    for item in family
                ) or "此帳戶目前沒有連結的家庭成員。"
                return f"## 你的家庭成員\n\n{lines}\n\n[查看個人檔案](/pages/profile.html#family)"
            lines = "\n".join(
                f"- **{item['name']}** — {item.get('relationship') or item.get('primary_role')}"
                for item in family
            ) or "No family members are connected to this account."
            return f"## Your family\n\n{lines}\n\n[Open your Profile](/pages/profile.html#family)"

    if _contains(query, "programme", "program", "activity", "class", "活動", "活动", "課程", "课程"):
        programmes = public.get("programmes", [])[:5]
        if zh:
            lines = "\n".join(
                f"- **{item['title']}** — {item['day']}，{item['location']}，尚餘 {item['spots_left']} 個名額"
                for item in programmes
            ) or "目前沒有可顯示的活動。"
            return f"## 現有活動\n\n{lines}\n\n[前往活動搜尋](/pages/activity-finder.html)"
        lines = "\n".join(
            f"- **{item['title']}** — {item['day']}, {item['location']}, {item['spots_left']} places left"
            for item in programmes
        ) or "No programmes are currently available."
        return f"## Current programmes\n\n{lines}\n\n[Open the Activity Finder](/pages/activity-finder.html)"

    if zh:
        suggestions = ["有哪些活動？", "財務報告在哪裡？", "如何聯絡 Love 21？"]
        if access_level in {"member", "admin"}:
            suggestions.extend(("我參加過哪些活動？", "我的家人有哪些？"))
        if access_level == "admin":
            suggestions.extend(("網站記錄了多少次瀏覽？", "總結管理儀表板。"))
        return "## 詢問 Love 21\n\n" + "\n".join(f"- {item}" for item in suggestions)

    suggestions = [
        "What programmes are available?",
        "Where can I find the financial reports?",
        "How can I contact Love 21?",
    ]
    if access_level in {"member", "admin"}:
        suggestions.extend(("Which activities has my family joined?", "Show my family members."))
    if access_level == "admin":
        suggestions.extend(("How many website visits are recorded?", "Summarise the staff dashboard."))
    return "## Ask Love 21\n\n" + "\n".join(f"- {item}" for item in suggestions)


def _json_for_prompt(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def _deepseek_answer(
    messages: list[schemas.AgentMessageIn],
    access_level: str,
    verified_context: dict[str, Any],
) -> str:
    if not settings.deepseek_is_configured or not settings.deepseek_api_key:
        raise RuntimeError("DeepSeek is not configured")

    system_prompt = f"""You are the Love 21 Foundation website AI agent.
The server-verified access level is: {access_level}.

Rules:
1. Answer only from VERIFIED_CONTEXT. Never invent a record, person, figure, date, service or URL.
2. Guests may use only public_website. Members may also use my_account. Administrators may also use staff_dashboard. The context already enforces this boundary.
3. Reply in the language used by the user's latest question. Keep it concise and warm.
4. Render in clean Markdown. Use short headings, bullets and tables when helpful.
5. Whenever a relevant page exists, end with one useful Markdown link copied exactly from ROUTE_CATALOG. Do not create other internal URLs.
6. This is a read-only assistant. Do not claim to update, book, delete or submit anything.

ROUTE_CATALOG:
{ROUTE_CATALOG}

VERIFIED_CONTEXT:
{_json_for_prompt(verified_context)}
"""
    request_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    request_messages.extend(
        {"role": message.role, "content": message.content}
        for message in messages[-12:]
    )
    payload = json.dumps(
        {
            "model": settings.deepseek_model,
            "messages": request_messages,
            "temperature": 0.15,
            "max_tokens": 1100,
        }
    ).encode("utf-8")
    request = Request(
        settings.deepseek_base_url.rstrip("/") + "/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.deepseek_timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError("DeepSeek is unavailable") from error
    content = body.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("DeepSeek returned no answer")
    return content.strip()


@router.post("/chat", response_model=schemas.AgentChatOut)
def chat(
    body: schemas.AgentChatIn,
    db: Session = Depends(get_db),
    person: models.Person | None = Depends(optional_person),
):
    last_user = next(
        (message.content for message in reversed(body.messages) if message.role == "user"),
        None,
    )
    if not last_user:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    level = _access_level(person)
    public_context, traces = _public_context(db)
    verified_context: dict[str, Any] = {"public_website": public_context}
    member_context: dict[str, Any] | None = None
    admin_context: dict[str, Any] | None = None

    if person is not None:
        member_context, member_traces = _member_context(person, db)
        verified_context["my_account"] = member_context
        traces.extend(member_traces)
    if level == "admin":
        admin_context, admin_traces = _admin_context(
            body.client_context.dashboard_data,
            db,
        )
        verified_context["staff_dashboard"] = admin_context
        traces.extend(admin_traces)

    fallback = _local_answer(
        last_user,
        level,
        public_context,
        member_context,
        admin_context,
    )
    if settings.deepseek_is_configured:
        try:
            answer = _deepseek_answer(body.messages, level, verified_context)
            return schemas.AgentChatOut(
                answer=answer,
                access_level=level,
                provider="deepseek",
                configured=True,
                tools=traces,
            )
        except RuntimeError:
            return schemas.AgentChatOut(
                answer=fallback,
                access_level=level,
                provider="local-demo",
                configured=True,
                tools=traces,
                notice="DeepSeek could not be reached, so verified local demo data was used.",
            )

    return schemas.AgentChatOut(
        answer=fallback,
        access_level=level,
        provider="local-demo",
        configured=False,
        tools=traces,
        notice="Add DEEPSEEK_API_KEY to backend/.env to enable generated answers.",
    )
