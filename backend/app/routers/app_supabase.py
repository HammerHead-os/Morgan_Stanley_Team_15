from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.encoders import jsonable_encoder

from .. import schemas
from ..db_supabase import supabase
from ..labels import event_label, status_label
from ..points import REWARDS, points_for_minutes, reward_by_id
from ..posthog_client import get_posthog
from ..roles_util import ALLOWED_ROLES, pick_primary, serialize_roles

router = APIRouter(tags=["app"])

Row = dict[str, Any]

DEMO_ACCOUNTS = {
    "carer@chen.demo": "Jamie - Mom (family + volunteer + donor)",
    "dad@chen.demo": "Chris - Dad (family + donor)",
    "alex@chen.demo": "Alex - Child member",
    "donor@demo.love21": "Sam - Donor + volunteer",
    "volunteer@demo.love21": "Taylor - Volunteer + donor",
}


def _execute(query: Any) -> list[Row]:
    try:
        response = query.execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc}",
        ) from exc
    return response.data or []


def _payload(data: Row, *, drop_none: bool = False) -> Row:
    encoded = jsonable_encoder(data)
    if drop_none:
        return {key: value for key, value in encoded.items() if value is not None}
    return encoded


def _first(rows: list[Row]) -> Row | None:
    return rows[0] if rows else None


def _row(table: str, row_id: int) -> Row | None:
    return _first(_execute(supabase.table(table).select("*").eq("id", row_id).limit(1)))


def _insert(table: str, data: Row) -> Row:
    return _first(_execute(supabase.table(table).insert(_payload(data, drop_none=True)))) or {}


def _update(table: str, row_id: int, data: Row) -> Row | None:
    return _first(_execute(supabase.table(table).update(_payload(data)).eq("id", row_id)))


def _delete(table: str, row_id: int) -> Row | None:
    return _first(_execute(supabase.table(table).delete().eq("id", row_id)))


def _list(table: str, *, order: str = "id", desc: bool = False, **filters: Any) -> list[Row]:
    query = supabase.table(table).select("*")
    for key, value in filters.items():
        if value is not None:
            query = query.eq(key, value)
    return _execute(query.order(order, desc=desc))


def _require(row: Row | None, entity: str) -> Row:
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")
    return row


def _capture(event: str, properties: Row | None = None) -> None:
    posthog_client = get_posthog()
    if posthog_client is not None:
        posthog_client.capture(event, properties=properties)


def _parse_roles(person: Row) -> list[str]:
    roles = [r.strip() for r in str(person.get("roles") or "").split(",") if r.strip()]
    primary = person.get("role_primary")
    if primary and primary not in roles:
        roles.insert(0, primary)
    out: list[str] = []
    seen = set()
    for role in roles:
        if role in ALLOWED_ROLES and role not in seen:
            out.append(role)
            seen.add(role)
    return out or ["family"]


def _has_role(person: Row, role: str) -> bool:
    return role in _parse_roles(person)


def _person_out(person: Row) -> Row:
    return {
        "id": person["id"],
        "email": person["email"],
        "name": person["name"],
        "role_primary": person["role_primary"],
        "roles": _parse_roles(person),
        "language": person.get("language") or "both",
        "household_id": person.get("household_id"),
        "household_role": person.get("household_role"),
        "profile_code": person.get("profile_code") or f"L21-{int(person['id']):04d}",
        "issued_at": person.get("issued_at") or person.get("created_at"),
    }


def _prefs_for_person(person_id: int) -> Row | None:
    return _first(
        _execute(
            supabase.table("comm_preferences")
            .select("*")
            .eq("person_id", person_id)
            .limit(1)
        )
    )


def _prefs_out(prefs: Row | None) -> Row:
    return {
        "email_on": (prefs or {}).get("email_on", True),
        "sms_on": (prefs or {}).get("sms_on", False),
        "whatsapp_on": (prefs or {}).get("whatsapp_on", False),
        "opt_out_token": (prefs or {}).get("opt_out_token"),
    }


def _current_person(
    x_demo_token: str | None = Header(default=None, alias="X-Demo-Token"),
) -> Row:
    if not x_demo_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Demo-Token header")
    try:
        person_id = int(x_demo_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    return _require(_row("people", person_id), "User")


def _optional_person(
    x_demo_token: str | None = Header(default=None, alias="X-Demo-Token"),
) -> Row | None:
    if not x_demo_token:
        return None
    try:
        return _row("people", int(x_demo_token))
    except ValueError:
        return None


def _log_journey(person_id: int, event_type: str, channel: str, payload: str) -> Row:
    return _insert(
        "journey_events",
        {
            "person_id": person_id,
            "event_type": event_type,
            "channel": channel,
            "payload": payload,
        },
    )


def _registration_out(reg: Row) -> Row:
    activity = _row("activities", reg["activity_id"]) if reg.get("activity_id") else None
    member = _row("people", reg["member_person_id"]) if reg.get("member_person_id") else None
    label = status_label(reg["status"])
    if reg["status"] == "waitlist" and reg.get("waitlist_position"):
        label = f"On waitlist - #{reg['waitlist_position']}"
    return {
        "id": reg["id"],
        "activity_id": reg["activity_id"],
        "household_id": reg["household_id"],
        "member_person_id": reg["member_person_id"],
        "status": reg["status"],
        "status_label": label,
        "waitlist_position": reg.get("waitlist_position"),
        "reminder_channel": reg.get("reminder_channel") or "email",
        "created_at": reg["created_at"],
        "session_date": reg.get("session_date"),
        "feedback": reg.get("feedback"),
        "activity_title": (activity or {}).get("title"),
        "activity_location": (activity or {}).get("location"),
        "member_name": (member or {}).get("name"),
    }


def _achievement_out(achievement: Row) -> Row:
    return {
        "id": achievement["id"],
        "member_person_id": achievement["member_person_id"],
        "title": achievement["title"],
        "pillar": achievement["pillar"],
        "status": achievement["status"],
        "status_label": status_label(achievement["status"]),
        "share_consent": achievement.get("share_consent", False),
        "coach_name": achievement.get("coach_name") or "Coach Pat",
        "approved_at": achievement.get("approved_at"),
        "created_at": achievement["created_at"],
    }


def _goal_out(goal: Row) -> Row:
    return {
        "id": goal["id"],
        "member_person_id": goal["member_person_id"],
        "title": goal["title"],
        "status": goal["status"],
        "status_label": status_label(goal["status"]),
        "target_date": goal.get("target_date"),
        "created_at": goal["created_at"],
    }


def _commitment_out(commitment: Row) -> Row:
    return {
        "id": commitment["id"],
        "supporter_person_id": commitment["supporter_person_id"],
        "amount_hkd": float(commitment.get("amount_hkd") or 0),
        "fund_category": commitment["fund_category"],
        "status": commitment["status"],
        "status_label": status_label(commitment["status"]),
        "cadence": commitment.get("cadence") or "monthly",
        "office_perk_unlocked": bool(commitment.get("office_perk_unlocked", True)),
        "started_at": commitment["started_at"],
        "updated_at": commitment["updated_at"],
    }


def _receipt_out(receipt: Row) -> Row:
    return {
        "id": receipt["id"],
        "commitment_id": receipt["commitment_id"],
        "amount_hkd": float(receipt.get("amount_hkd") or 0),
        "paid_at": receipt["paid_at"],
        "story_back": receipt.get("story_back"),
    }


def _volunteer_profile_for_person(person_id: int) -> Row | None:
    return _first(
        _execute(
            supabase.table("volunteer_profiles")
            .select("*")
            .eq("person_id", person_id)
            .limit(1)
        )
    )


def _ensure_volunteer_profile(person: Row) -> Row:
    profile = _volunteer_profile_for_person(person["id"])
    if profile:
        return profile
    return _insert("volunteer_profiles", {"person_id": person["id"]})


def _volunteer_profile_out(profile: Row) -> Row:
    return {
        "id": profile["id"],
        "person_id": profile["person_id"],
        "skills": profile.get("skills") or "",
        "languages": profile.get("languages") or "en",
        "availability": profile.get("availability") or "",
        "onboarded": bool(profile.get("onboarded", False)),
        "hours_logged": float(profile.get("hours_logged") or 0),
        "points_balance": int(profile.get("points_balance") or 0),
        "points_spent": int(profile.get("points_spent") or 0),
    }


def _claim_out(claim: Row) -> Row:
    shift = _row("volunteer_shifts", claim["shift_id"]) if claim.get("shift_id") else None
    duration = (shift or {}).get("duration_min")
    available = points_for_minutes(duration) if claim.get("status") == "claimed" else 0
    return {
        "id": claim["id"],
        "shift_id": claim["shift_id"],
        "volunteer_profile_id": claim["volunteer_profile_id"],
        "status": claim["status"],
        "status_label": status_label(claim["status"]),
        "hours": float(claim.get("hours") or 0),
        "reflection": claim.get("reflection"),
        "claimed_at": claim["claimed_at"],
        "completed_at": claim.get("completed_at"),
        "shift_title": (shift or {}).get("title"),
        "points_awarded": int(claim.get("points_awarded") or 0),
        "points_available": available,
        "duration_min": duration,
    }


def _visible_tabs(_role: str) -> list[str]:
    return ["ability", "contribution", "impact"]


def _home_tab(role: str) -> str:
    if role in ("family", "member"):
        return "ability"
    if role == "donor":
        return "impact"
    if role == "volunteer":
        return "contribution"
    return "ability"


def _next_action(role: str, data: Row) -> Row:
    if role in ("family", "member"):
        regs = (data.get("family") or {}).get("registrations") or []
        pending = [r for r in regs if r["status"] == "attended" and not r.get("feedback")]
        if pending:
            return {"label": "Leave feedback on your last session", "href": "#ability", "tab": "ability"}
        return {"label": "Find a class for your household", "href": "activity-finder.html", "tab": "ability"}
    if role == "donor":
        if not (data.get("impact") or {}).get("commitments"):
            return {"label": "Start a monthly gift", "href": "impact.html", "tab": "impact"}
        return {"label": "Book an office workshop with a creator", "href": "../index.html#marketplace", "tab": "impact"}
    if role == "volunteer":
        claims = (data.get("volunteer") or {}).get("claims") or []
        if [c for c in claims if c["status"] == "claimed"]:
            return {"label": "Mark your claimed shift complete", "href": "#contribution", "tab": "contribution"}
        return {"label": "Claim a short volunteer task", "href": "volunteer.html", "tab": "contribution"}
    return {"label": "Open your Profile", "href": "#", "tab": None}


def _match_shift(profile: Row, claimed_ids: set[int]) -> Row | None:
    shifts = _execute(
        supabase.table("volunteer_shifts")
        .select("*")
        .gt("spots_left", 0)
        .order("title")
    )
    skills = {s.strip().lower() for s in str(profile.get("skills") or "").split(",") if s.strip()}
    langs = {s.strip().lower() for s in str(profile.get("languages") or "").split(",") if s.strip()}

    def score(shift: Row) -> int:
        if shift["id"] in claimed_ids:
            return -999
        total = 0
        needed = {s.strip().lower() for s in str(shift.get("skills_needed") or "").split(",") if s.strip()}
        if needed & skills:
            total += 5
        if shift.get("language") in langs or shift.get("language") == "both" or "both" in langs:
            total += 3
        if shift.get("remote"):
            total += 1
        total -= int(shift.get("duration_min") or 0) // 60
        return total

    ranked = sorted(shifts, key=score, reverse=True)
    return ranked[0] if ranked and score(ranked[0]) > -900 else None


def _build_profile(person: Row) -> Row:
    prefs = _prefs_out(_prefs_for_person(person["id"]))

    family = None
    if person.get("household_id"):
        household = _row("households", person["household_id"])
        members = _list("people", order="id", household_id=person["household_id"])
        regs = _list("registrations", order="created_at", desc=True, household_id=person["household_id"])
        family = {
            "household_name": (household or {}).get("name") or "Household",
            "members": [_person_out(member) for member in members],
            "registrations": [_registration_out(reg) for reg in regs],
        }

    is_familyish = _has_role(person, "family") or _has_role(person, "member") or bool(person.get("household_id"))
    ach_member = person
    if is_familyish and person.get("household_id"):
        kid = _first(
            _execute(
                supabase.table("people")
                .select("*")
                .eq("household_id", person["household_id"])
                .eq("role_primary", "member")
                .limit(1)
            )
        )
        if kid:
            ach_member = kid

    achievement = None
    if is_familyish:
        achievements = _list(
            "achievements",
            order="created_at",
            desc=True,
            member_person_id=ach_member["id"],
        )
        goals = _list("goals", order="created_at", desc=True, member_person_id=ach_member["id"])
        achievement = {
            "member": _person_out(ach_member),
            "achievements": [_achievement_out(row) for row in achievements],
            "goals": [_goal_out(row) for row in goals],
        }

    commitments = _list(
        "donation_commitments",
        order="started_at",
        desc=True,
        supporter_person_id=person["id"],
    )
    receipts: list[Row] = []
    for commitment in commitments:
        receipts.extend(
            _list(
                "donation_receipts",
                order="paid_at",
                desc=True,
                commitment_id=commitment["id"],
            )
        )
    receipts.sort(key=lambda row: row.get("paid_at") or "", reverse=True)
    badges = _list("impact_badges", order="earned_at", desc=True, person_id=person["id"])
    impact = {
        "commitments": [_commitment_out(row) for row in commitments],
        "receipts": [_receipt_out(row) for row in receipts],
        "badges": [
            {
                "id": row["id"],
                "person_id": row["person_id"],
                "title": row["title"],
                "level": row["level"],
                "earned_at": row["earned_at"],
            }
            for row in badges
        ],
        "programmes_pct": 74.6,
    }

    profile = _volunteer_profile_for_person(person["id"])
    claims: list[Row] = []
    suggested = None
    if _has_role(person, "volunteer") or _has_role(person, "corporate"):
        profile = profile or _ensure_volunteer_profile(person)
        claims = _list(
            "volunteer_shift_claims",
            order="claimed_at",
            desc=True,
            volunteer_profile_id=profile["id"],
        )
        suggested = _match_shift(profile, {claim["shift_id"] for claim in claims})
    volunteer = {
        "profile": _volunteer_profile_out(profile) if profile else None,
        "claims": [_claim_out(row) for row in claims],
        "suggested_next": suggested,
        "points_balance": int((profile or {}).get("points_balance") or 0),
        "points_spent": int((profile or {}).get("points_spent") or 0),
        "rewards": REWARDS,
    }

    journey_rows = _execute(
        supabase.table("journey_events")
        .select("*")
        .eq("person_id", person["id"])
        .order("created_at", desc=True)
        .limit(12)
    )
    journey_events = [
        {
            "id": row["id"],
            "event_type": row["event_type"],
            "event_label": event_label(row["event_type"]),
            "channel": row["channel"],
            "payload": row.get("payload") or "",
            "created_at": row["created_at"],
        }
        for row in journey_rows
    ]

    hire_rows = _execute(
        supabase.table("hire_enquiries")
        .select("*")
        .eq("person_id", person["id"])
        .order("created_at", desc=True)
        .limit(10)
    )

    calendar_events: list[Row] = []
    if family:
        for reg in family["registrations"]:
            if reg.get("session_date"):
                calendar_events.append(
                    {
                        "id": f"class-{reg['id']}",
                        "title": reg.get("activity_title") or "Class",
                        "date": reg["session_date"],
                        "kind": "class",
                        "detail": reg.get("member_name") or "",
                        "status": reg.get("status_label") or reg["status"],
                    }
                )
    for claim in claims:
        shift = _row("volunteer_shifts", claim["shift_id"])
        if shift and shift.get("scheduled_date"):
            calendar_events.append(
                {
                    "id": f"vol-{claim['id']}",
                    "title": shift["title"],
                    "date": shift["scheduled_date"],
                    "kind": "volunteer",
                    "detail": f"{shift['duration_min']} min",
                    "status": status_label(claim["status"]),
                }
            )
    calendar_events.sort(key=lambda row: row["date"])

    role = person["role_primary"]
    return {
        "person": _person_out(person),
        "prefs": prefs,
        "visible_tabs": _visible_tabs(role),
        "home_tab": _home_tab(role),
        "next_action": _next_action(
            role,
            {
                "family": {"registrations": family["registrations"]} if family else {},
                "impact": {"commitments": impact["commitments"]},
                "volunteer": {"claims": volunteer["claims"]},
            },
        ),
        "family": family,
        "achievement": achievement,
        "impact": impact,
        "volunteer": volunteer,
        "journey_events": journey_events,
        "hire_enquiries": hire_rows,
        "calendar_events": calendar_events,
    }


@router.get("/api/auth/demo-accounts")
def list_demo_accounts():
    return [{"email": email, "label": label} for email, label in DEMO_ACCOUNTS.items()]


@router.post("/api/auth/demo-login", response_model=schemas.DemoLoginOut)
def demo_login(body: schemas.DemoLoginIn):
    person = _first(
        _execute(
            supabase.table("people")
            .select("*")
            .eq("email", body.email)
            .limit(1)
        )
    )
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found")

    posthog_client = get_posthog()
    if posthog_client is not None:
        with posthog_client.new_context(fresh=True):
            posthog_client.identify_context(str(person["id"]))
            posthog_client.set(
                properties={
                    "email": person["email"],
                    "name": person["name"],
                    "role_primary": person["role_primary"],
                    "roles": person["roles"],
                }
            )
            posthog_client.capture("demo_login_completed")

    return {"person": _person_out(person), "token": str(person["id"])}


@router.get("/api/activities", response_model=list[schemas.ActivityOut])
def list_activities(
    goal: str | None = None,
    age: str | None = None,
    day: str | None = None,
    support: str | None = None,
    lang: str | None = None,
):
    query = supabase.table("activities").select("*")
    if goal:
        query = query.eq("goal", goal)
    if age:
        query = query.eq("age_band", age)
    if day:
        query = query.eq("day", day)
    if support:
        query = query.eq("support_need", support)
    if lang:
        query = query.eq("language", lang)
    return _execute(query.order("title"))


@router.get("/api/activities/{activity_id}", response_model=schemas.ActivityOut)
def get_activity(activity_id: int):
    return _require(_row("activities", activity_id), "Activity")


@router.get("/api/profile", response_model=schemas.ProfileOut)
def get_profile(person: Row = Depends(_current_person)):
    return _build_profile(person)


@router.patch("/api/profile/roles", response_model=schemas.PersonOut)
def update_roles(body: schemas.RolesUpdateIn, person: Row = Depends(_current_person)):
    roles = serialize_roles(body.roles)
    if not roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pick at least one role")
    parsed = [r for r in roles.split(",") if r]
    updated = _require(
        _update(
            "people",
            person["id"],
            {
                "roles": roles,
                "role_primary": pick_primary(parsed),
            },
        ),
        "User",
    )
    if "volunteer" in parsed:
        _ensure_volunteer_profile(updated)
    _log_journey(person["id"], "roles_updated", "email", roles)
    _capture("roles_updated", {"roles": parsed})
    return _person_out(updated)


@router.get("/api/prefs", response_model=schemas.PrefsOut)
def get_prefs(person: Row = Depends(_current_person)):
    return _prefs_out(_require(_prefs_for_person(person["id"]), "Preferences"))


@router.patch("/api/prefs", response_model=schemas.PrefsOut)
def update_prefs(body: schemas.PrefsUpdateIn, person: Row = Depends(_current_person)):
    prefs = _require(_prefs_for_person(person["id"]), "Preferences")
    update = body.model_dump(exclude_unset=True)
    merged = {**prefs, **update}
    if not merged.get("email_on") and not merged.get("sms_on") and not merged.get("whatsapp_on"):
        update["email_on"] = True
    rows = _execute(supabase.table("comm_preferences").update(_payload(update)).eq("id", prefs["id"]))
    updated = _require(_first(rows), "Preferences")
    _capture(
        "communication_preferences_updated",
        {
            "email_on": updated["email_on"],
            "sms_on": updated["sms_on"],
            "whatsapp_on": updated["whatsapp_on"],
        },
    )
    return _prefs_out(updated)


@router.post("/api/prefs/opt-out/{token}")
def one_click_opt_out(token: str):
    prefs = _first(
        _execute(
            supabase.table("comm_preferences")
            .select("*")
            .eq("opt_out_token", token)
            .limit(1)
        )
    )
    if not prefs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid opt-out token")
    _execute(
        supabase.table("comm_preferences")
        .update({"email_on": False, "sms_on": False, "whatsapp_on": False})
        .eq("id", prefs["id"])
    )
    _log_journey(prefs["person_id"], "one_click_opt_out", "email", "all_channels_off")
    return {"ok": True, "message": "You have been opted out of all channels."}


@router.post("/api/family/register", response_model=schemas.RegistrationOut)
def register_for_activity(body: schemas.RegisterIn, person: Row = Depends(_current_person)):
    if not person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Person has no household")
    member = _row("people", body.member_person_id)
    if not member or member.get("household_id") != person["household_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Member not in your household")
    activity = _require(_row("activities", body.activity_id), "Activity")
    existing = _execute(
        supabase.table("registrations")
        .select("*")
        .eq("activity_id", body.activity_id)
        .eq("member_person_id", body.member_person_id)
    )
    if [row for row in existing if row.get("status") in ("registered", "waitlist")]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already registered or on waitlist")

    if int(activity.get("spots_left") or 0) > 0:
        reg_status = "registered"
        waitlist_position = None
        event = "registration_confirmed"
        _update("activities", activity["id"], {"spots_left": int(activity["spots_left"]) - 1})
    else:
        reg_status = "waitlist"
        waiting = _execute(
            supabase.table("registrations")
            .select("id")
            .eq("activity_id", activity["id"])
            .eq("status", "waitlist")
        )
        waitlist_position = len(waiting) + 1
        event = "waitlist_joined"

    channel = body.reminder_channel if body.reminder_channel in ("email", "sms", "whatsapp") else "email"
    prefs = _prefs_for_person(person["id"])
    if channel == "sms" and prefs and not prefs.get("sms_on"):
        channel = "email"
    if channel == "whatsapp" and prefs and not prefs.get("whatsapp_on"):
        channel = "email"
    reg = _insert(
        "registrations",
        {
            "activity_id": activity["id"],
            "household_id": person["household_id"],
            "member_person_id": member["id"],
            "status": reg_status,
            "waitlist_position": waitlist_position,
            "reminder_channel": channel,
        },
    )
    _log_journey(person["id"], event, channel, f"activity={activity['id']};member={member['id']};status={reg_status}")
    _capture(
        "activity_registered" if reg_status == "registered" else "activity_waitlist_joined",
        {"reminder_channel": channel},
    )
    return _registration_out(reg)


@router.get("/api/family/registrations", response_model=list[schemas.RegistrationOut])
def list_registrations(person: Row = Depends(_current_person)):
    if not person.get("household_id"):
        return []
    regs = _list("registrations", order="created_at", desc=True, household_id=person["household_id"])
    return [_registration_out(row) for row in regs]


@router.post("/api/family/registrations/{registration_id}/feedback", response_model=schemas.RegistrationOut)
def post_feedback(
    registration_id: int,
    body: schemas.FeedbackIn,
    person: Row = Depends(_current_person),
):
    reg = _require(_row("registrations", registration_id), "Registration")
    if reg.get("household_id") != person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found")
    updated = _require(
        _update(
            "registrations",
            reg["id"],
            {"feedback": body.feedback, "feedback_at": datetime.utcnow().isoformat()},
        ),
        "Registration",
    )
    _log_journey(person["id"], "post_session_feedback", "email", f"registration={reg['id']}")
    _capture("session_feedback_submitted")
    return _registration_out(updated)


@router.post("/api/family/members", response_model=schemas.PersonOut)
def add_family_member(body: schemas.FamilyMemberIn, person: Row = Depends(_current_person)):
    if not person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You need a household first")
    if person.get("household_role") == "child":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ask a parent or caregiver to add members")
    role = body.household_role.strip().lower()
    if role not in {"mom", "dad", "caregiver", "helper", "child"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be mom, dad, caregiver, helper, or child")
    email = (body.email or "").strip().lower()
    if not email:
        slug = body.name.lower().replace(" ", ".")[:40]
        email = f"{slug}.{person['household_id']}.{secrets.token_hex(3)}@family.love21"
    existing = _first(_execute(supabase.table("people").select("id").eq("email", email).limit(1)))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That email is already in use")
    is_child = body.is_child or role == "child"
    new_person = _insert(
        "people",
        {
            "email": email,
            "name": body.name.strip(),
            "role_primary": "member" if is_child else "family",
            "roles": "member" if is_child else "family",
            "language": person.get("language") or "both",
            "household_id": person["household_id"],
            "household_role": role,
            "profile_code": f"L21-HK-{secrets.randbelow(9000) + 1000}",
        },
    )
    _insert(
        "comm_preferences",
        {
            "person_id": new_person["id"],
            "email_on": True,
            "sms_on": False,
            "whatsapp_on": False,
            "opt_out_token": secrets.token_urlsafe(16),
        },
    )
    _log_journey(person["id"], "family_member_added", "email", f"member={new_person['id']};role={role}")
    _capture("family_member_added", {"household_role": role, "is_child": is_child})
    return _person_out(new_person)


@router.get("/api/volunteers/shifts", response_model=list[schemas.VolunteerShiftOut])
def list_shifts():
    return _execute(
        supabase.table("volunteer_shifts")
        .select("*")
        .gt("spots_left", 0)
        .order("title")
    )


@router.get("/api/volunteers/me", response_model=schemas.VolunteerProfileOut)
def my_profile(person: Row = Depends(_current_person)):
    return _volunteer_profile_out(_ensure_volunteer_profile(person))


@router.get("/api/volunteers/points", response_model=schemas.PointsOut)
def my_points(person: Row = Depends(_current_person)):
    profile = _ensure_volunteer_profile(person)
    return {
        "points_balance": int(profile.get("points_balance") or 0),
        "points_spent": int(profile.get("points_spent") or 0),
        "hours_logged": float(profile.get("hours_logged") or 0),
        "rewards": REWARDS,
    }


@router.post("/api/volunteers/onboard", response_model=schemas.VolunteerProfileOut)
def onboard(body: schemas.OnboardIn, person: Row = Depends(_current_person)):
    profile = _ensure_volunteer_profile(person)
    update = {"onboarded": True}
    if body.skills is not None:
        update["skills"] = body.skills
    if body.languages is not None:
        update["languages"] = body.languages
    if body.availability is not None:
        update["availability"] = body.availability
    updated = _require(_update("volunteer_profiles", profile["id"], update), "Volunteer profile")
    _log_journey(person["id"], "volunteer_onboarded", "email", f"profile={profile['id']}")
    _capture("volunteer_onboarded")
    return _volunteer_profile_out(updated)


@router.post("/api/volunteers/claims", response_model=schemas.ClaimOut)
def claim_shift(body: schemas.ClaimShiftIn, person: Row = Depends(_current_person)):
    profile = _ensure_volunteer_profile(person)
    shift = _require(_row("volunteer_shifts", body.shift_id), "Shift")
    if int(shift.get("spots_left") or 0) <= 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No spots left")
    if shift.get("requires_onboarding") and not profile.get("onboarded"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Complete onboarding first")
    existing = _execute(
        supabase.table("volunteer_shift_claims")
        .select("*")
        .eq("shift_id", shift["id"])
        .eq("volunteer_profile_id", profile["id"])
    )
    if [row for row in existing if row.get("status") in ("claimed", "completed")]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already claimed")
    _update("volunteer_shifts", shift["id"], {"spots_left": int(shift["spots_left"]) - 1})
    claim = _insert(
        "volunteer_shift_claims",
        {
            "shift_id": shift["id"],
            "volunteer_profile_id": profile["id"],
            "status": "claimed",
            "hours": int(shift["duration_min"]) / 60.0,
            "points_awarded": 0,
        },
    )
    _log_journey(person["id"], "shift_claimed", "email", f"shift={shift['id']}")
    _capture(
        "shift_claimed",
        {
            "duration_min": shift["duration_min"],
            "requires_onboarding": shift["requires_onboarding"],
            "remote": shift["remote"],
        },
    )
    return _claim_out(claim)


@router.get("/api/volunteers/claims", response_model=list[schemas.ClaimOut])
def list_claims(person: Row = Depends(_current_person)):
    profile = _ensure_volunteer_profile(person)
    claims = _list(
        "volunteer_shift_claims",
        order="claimed_at",
        desc=True,
        volunteer_profile_id=profile["id"],
    )
    return [_claim_out(row) for row in claims]


@router.post("/api/volunteers/claims/{claim_id}/complete", response_model=schemas.ClaimOut)
def complete_claim(
    claim_id: int,
    body: schemas.ReflectionIn,
    person: Row = Depends(_current_person),
):
    profile = _ensure_volunteer_profile(person)
    claim = _require(_row("volunteer_shift_claims", claim_id), "Claim")
    if claim.get("volunteer_profile_id") != profile["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    if claim.get("status") == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already completed")
    shift = _row("volunteer_shifts", claim["shift_id"])
    hours = body.hours if body.hours is not None else float(claim.get("hours") or 0)
    points = points_for_minutes((shift or {}).get("duration_min") or hours * 60)
    updated_claim = _require(
        _update(
            "volunteer_shift_claims",
            claim["id"],
            {
                "status": "completed",
                "reflection": body.reflection,
                "hours": hours,
                "completed_at": datetime.utcnow().isoformat(),
                "points_awarded": points,
            },
        ),
        "Claim",
    )
    _update(
        "volunteer_profiles",
        profile["id"],
        {
            "hours_logged": float(profile.get("hours_logged") or 0) + hours,
            "points_balance": int(profile.get("points_balance") or 0) + points,
        },
    )
    _log_journey(person["id"], "shift_completed", "email", f"claim={claim['id']};hours={hours};points={points}")
    _capture("shift_completed", {"hours": hours, "points_awarded": points})
    return _claim_out(updated_claim)


@router.post("/api/volunteers/redeem", response_model=schemas.RedeemOut)
def redeem_reward(body: schemas.RedeemIn, person: Row = Depends(_current_person)):
    profile = _ensure_volunteer_profile(person)
    reward = reward_by_id(body.reward_id)
    if not reward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    balance = int(profile.get("points_balance") or 0)
    if balance < reward["cost"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Need {reward['cost']} points (you have {balance})")
    updated = _require(
        _update(
            "volunteer_profiles",
            profile["id"],
            {
                "points_balance": balance - reward["cost"],
                "points_spent": int(profile.get("points_spent") or 0) + reward["cost"],
            },
        ),
        "Volunteer profile",
    )
    _log_journey(person["id"], "points_redeemed", "email", f"reward={reward['id']};cost={reward['cost']}")
    _capture("reward_redeemed", {"reward_id": reward["id"], "cost": reward["cost"]})
    return {
        "ok": True,
        "reward_id": reward["id"],
        "reward_label": reward["label"],
        "cost": reward["cost"],
        "points_balance": int(updated.get("points_balance") or 0),
        "message": f"Redeemed {reward['label']}. Staff will follow up by email.",
    }


@router.get("/api/impact/transparency", response_model=schemas.TransparencyOut)
def transparency():
    return {"as_of": datetime.utcnow()}


@router.get("/api/impact/commitments", response_model=list[schemas.CommitmentOut])
def list_commitments(person: Row = Depends(_current_person)):
    rows = _list(
        "donation_commitments",
        order="started_at",
        desc=True,
        supporter_person_id=person["id"],
    )
    return [_commitment_out(row) for row in rows]


@router.post("/api/impact/commitments", response_model=schemas.CommitmentOut)
def start_commitment(body: schemas.CommitmentIn, person: Row = Depends(_current_person)):
    commitment = _insert(
        "donation_commitments",
        {
            "supporter_person_id": person["id"],
            "amount_hkd": body.amount_hkd,
            "fund_category": body.fund_category,
            "cadence": body.cadence,
            "status": "active",
        },
    )
    amount = float(body.amount_hkd)
    if amount >= 500:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to run two coach-led "
            f"sport sessions, cover pool lane fees, and print bilingual class sheets "
            f"for {body.fund_category}."
        )
    elif amount >= 300:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to fund about two "
            f"coach-led programme sessions and snack support under {body.fund_category}."
        )
    else:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to cover coach transport "
            f"and session materials for {body.fund_category}."
        )
    _insert(
        "donation_receipts",
        {
            "commitment_id": commitment["id"],
            "amount_hkd": body.amount_hkd,
            "story_back": story,
        },
    )
    _insert(
        "impact_badges",
        {
            "person_id": person["id"],
            "title": "Local contributor",
            "level": "bronze" if amount < 500 else "silver",
        },
    )
    _log_journey(person["id"], "commitment_started", "email", f"amount={body.amount_hkd};fund={body.fund_category}")
    _capture(
        "commitment_started",
        {
            "amount_hkd": amount,
            "fund_category": body.fund_category,
            "cadence": body.cadence,
        },
    )
    return _commitment_out(commitment)


@router.patch("/api/impact/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def update_commitment(
    commitment_id: int,
    body: schemas.CommitmentUpdateIn,
    person: Row = Depends(_current_person),
):
    commitment = _require(_row("donation_commitments", commitment_id), "Commitment")
    if commitment.get("supporter_person_id") != person["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commitment not found")
    update = body.model_dump(exclude_unset=True)
    if "status" in update and update["status"] not in ("active", "paused", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    update["updated_at"] = datetime.utcnow().isoformat()
    updated = _require(_update("donation_commitments", commitment["id"], update), "Commitment")
    _log_journey(person["id"], "commitment_updated", "email", f"id={commitment['id']};status={updated['status']}")
    _capture("commitment_updated", {"status": updated["status"]})
    return _commitment_out(updated)


@router.get("/api/impact/receipts", response_model=list[schemas.ReceiptOut])
def list_receipts(person: Row = Depends(_current_person)):
    rows: list[Row] = []
    for commitment in _list("donation_commitments", supporter_person_id=person["id"]):
        rows.extend(_list("donation_receipts", order="paid_at", desc=True, commitment_id=commitment["id"]))
    rows.sort(key=lambda row: row.get("paid_at") or "", reverse=True)
    return [_receipt_out(row) for row in rows]


@router.get("/api/achievements", response_model=list[schemas.AchievementOut])
def list_achievements(member_person_id: int | None = None, person: Row = Depends(_current_person)):
    member_id = member_person_id or person["id"]
    target = _require(_row("people", member_id), "Member")
    if target["id"] != person["id"] and target.get("household_id") != person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    rows = _list("achievements", order="created_at", desc=True, member_person_id=member_id)
    return [_achievement_out(row) for row in rows]


@router.post("/api/achievements/goals", response_model=schemas.GoalOut)
def create_goal(body: schemas.GoalIn, person: Row = Depends(_current_person)):
    member = _require(_row("people", body.member_person_id), "Member")
    if member["id"] != person["id"] and member.get("household_id") != person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    goal = _insert(
        "goals",
        {
            "member_person_id": member["id"],
            "title": body.title,
            "target_date": body.target_date,
            "status": "in_progress",
        },
    )
    _log_journey(person["id"], "goal_set", "email", f"goal={body.title}")
    _capture("goal_created", {"has_target_date": goal.get("target_date") is not None})
    return _goal_out(goal)


@router.get("/api/achievements/goals", response_model=list[schemas.GoalOut])
def list_goals(member_person_id: int | None = None, person: Row = Depends(_current_person)):
    member_id = member_person_id or person["id"]
    target = _require(_row("people", member_id), "Member")
    if target["id"] != person["id"] and target.get("household_id") != person.get("household_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    rows = _list("goals", order="created_at", desc=True, member_person_id=member_id)
    return [_goal_out(row) for row in rows]


@router.patch("/api/achievements/{achievement_id}/consent", response_model=schemas.AchievementOut)
def update_consent(
    achievement_id: int,
    body: schemas.ConsentIn,
    person: Row = Depends(_current_person),
):
    achievement = _require(_row("achievements", achievement_id), "Achievement")
    member = _row("people", achievement["member_person_id"])
    if not member or (member["id"] != person["id"] and member.get("household_id") != person.get("household_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    next_status = achievement["status"]
    if body.share_consent and next_status == "coach_approved":
        next_status = "shared"
    elif not body.share_consent and next_status == "shared":
        next_status = "coach_approved"
    updated = _require(
        _update(
            "achievements",
            achievement["id"],
            {"share_consent": body.share_consent, "status": next_status},
        ),
        "Achievement",
    )
    _capture("achievement_consent_updated", {"share_consent": body.share_consent, "status": next_status})
    return _achievement_out(updated)


@router.post("/api/achievements/{achievement_id}/approve", response_model=schemas.AchievementOut)
def coach_approve(achievement_id: int, person: Row = Depends(_current_person)):
    achievement = _require(_row("achievements", achievement_id), "Achievement")
    updated = _require(
        _update(
            "achievements",
            achievement["id"],
            {"status": "coach_approved", "approved_at": datetime.utcnow().isoformat()},
        ),
        "Achievement",
    )
    _log_journey(person["id"], "achievement_coach_approved", "email", f"achievement={achievement['id']}")
    _capture("achievement_approved")
    return _achievement_out(updated)


@router.post("/api/hire", response_model=schemas.HireOut)
def hire_creator(body: schemas.HireIn, person: Row | None = Depends(_optional_person)):
    if person is None:
        person = _first(
            _execute(
                supabase.table("people")
                .select("*")
                .eq("email", "carer@chen.demo")
                .limit(1)
            )
        )
    enquiry = _insert(
        "hire_enquiries",
        {
            "person_id": person["id"] if person else None,
            "creator_label": body.creator_label,
            "preferred_date": body.preferred_date,
            "status": "received",
        },
    )
    if person:
        _log_journey(
            person["id"],
            "hire_enquiry",
            "email",
            body.creator_label + (f";date={body.preferred_date}" if body.preferred_date else ""),
        )
    _capture("hire_enquiry_submitted", {"has_preferred_date": body.preferred_date is not None})
    return enquiry


@router.get("/api/hire", response_model=list[schemas.HireOut])
def list_hires(person: Row = Depends(_current_person)):
    return _list("hire_enquiries", order="created_at", desc=True, person_id=person["id"])
