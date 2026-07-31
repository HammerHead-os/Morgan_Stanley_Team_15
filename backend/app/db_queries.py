from __future__ import annotations

from collections import Counter
from decimal import Decimal
from typing import Any

from fastapi.encoders import jsonable_encoder

from .db_supabase import supabase

Row = dict[str, Any]


class SupabaseBackendError(RuntimeError):
    """Wrap Supabase client errors so routers can return a clean API response."""


def _execute(query: Any) -> list[Row]:
    try:
        response = query.execute()
    except Exception as exc:  # Supabase/postgrest exception classes vary by version.
        raise SupabaseBackendError(str(exc)) from exc
    return response.data or []


def _payload(data: Row, *, drop_none: bool = False) -> Row:
    encoded = jsonable_encoder(data)
    if drop_none:
        return {key: value for key, value in encoded.items() if value is not None}
    return encoded


def _first(rows: list[Row]) -> Row | None:
    return rows[0] if rows else None


def _get_by_id(table: str, row_id: str) -> Row | None:
    return _first(_execute(supabase.table(table).select("*").eq("id", row_id).limit(1)))


def _insert(table: str, data: Row) -> Row:
    return _first(_execute(supabase.table(table).insert(_payload(data, drop_none=True)))) or {}


def _update(table: str, row_id: str, data: Row) -> Row | None:
    rows = _execute(
        supabase.table(table).update(_payload(data)).eq("id", row_id)
    )
    return _first(rows)


def _delete(table: str, row_id: str) -> Row | None:
    return _first(_execute(supabase.table(table).delete().eq("id", row_id)))


def _list(table: str, *, order: str = "created_at", desc: bool = True, **filters: Any) -> list[Row]:
    query = supabase.table(table).select("*")
    for key, value in filters.items():
        if value is not None:
            query = query.eq(key, str(value))
    return _execute(query.order(order, desc=desc))


def _sum_money(rows: list[Row], key: str) -> str:
    total = sum(Decimal(str(row.get(key) or 0)) for row in rows)
    return f"{total:.2f}"


def _refresh_participant_counts(participant_id: str) -> None:
    activities = get_participant_activities(participant_id)
    programmes = {row["programme_type"] for row in activities if row.get("programme_type")}
    supabase.table("participants").update(
        {
            "activities_joined_count": len(activities),
            "programmes_explored_count": len(programmes),
        }
    ).eq("id", participant_id).execute()


def _refresh_volunteer_counts(volunteer_id: str) -> None:
    activities = get_volunteer_activities(volunteer_id)
    days = {row["event_date"] for row in activities if row.get("event_date")}
    supabase.table("volunteers").update(
        {
            "activities_supported_count": len(activities),
            "days_volunteered": len(days),
        }
    ).eq("id", volunteer_id).execute()


def _refresh_donor_counts(donor_id: str) -> None:
    records = get_donor_records(donor_id)
    dates = {row["donation_date"] for row in records if row.get("donation_date")}
    update: Row = {
        "total_donated": _sum_money(records, "amount_of_money"),
        "gifts_made_count": len(records),
        "giving_occasions": len(dates),
    }
    recurring = [
        row for row in records if str(row.get("donation_type", "")).lower() in {"monthly", "regular"}
    ]
    if recurring:
        most_common_amount = Counter(
            str(row.get("amount_of_money") or "0.00") for row in recurring
        ).most_common(1)[0][0]
        update["regular_donation_amount"] = most_common_amount
    supabase.table("donors").update(update).eq("id", donor_id).execute()


# Participant profiles and activities


def list_participants() -> list[Row]:
    return _list("participants", order="register_date")


def get_participant(participant_id: str) -> Row | None:
    return _get_by_id("participants", participant_id)


def get_participant_by_auth(auth_id: str) -> Row | None:
    return _first(
        _execute(supabase.table("participants").select("*").eq("auth_id", auth_id).limit(1))
    )


def create_participant(data: Row) -> Row:
    return _insert("participants", data)


def update_participant(participant_id: str, data: Row) -> Row | None:
    return _update("participants", participant_id, data)


def delete_participant(participant_id: str) -> Row | None:
    return _delete("participants", participant_id)


def get_participant_activities(participant_id: str) -> list[Row]:
    return _list(
        "participant_activities",
        order="event_date",
        participant_id=participant_id,
    )


def add_participant_activity(data: Row) -> Row:
    row = _insert("participant_activities", data)
    if row.get("participant_id"):
        _refresh_participant_counts(row["participant_id"])
    return row


def update_participant_activity(activity_id: str, data: Row) -> Row | None:
    row = _update("participant_activities", activity_id, data)
    if row and row.get("participant_id"):
        _refresh_participant_counts(row["participant_id"])
    return row


def delete_participant_activity(activity_id: str) -> Row | None:
    row = _delete("participant_activities", activity_id)
    if row and row.get("participant_id"):
        _refresh_participant_counts(row["participant_id"])
    return row


# Volunteer profiles and activities


def list_volunteers() -> list[Row]:
    return _list("volunteers", order="register_date")


def get_volunteer(volunteer_id: str) -> Row | None:
    return _get_by_id("volunteers", volunteer_id)


def get_volunteer_by_auth(auth_id: str) -> Row | None:
    return _first(
        _execute(supabase.table("volunteers").select("*").eq("auth_id", auth_id).limit(1))
    )


def create_volunteer(data: Row) -> Row:
    return _insert("volunteers", data)


def update_volunteer(volunteer_id: str, data: Row) -> Row | None:
    return _update("volunteers", volunteer_id, data)


def delete_volunteer(volunteer_id: str) -> Row | None:
    return _delete("volunteers", volunteer_id)


def get_volunteer_activities(volunteer_id: str) -> list[Row]:
    return _list(
        "volunteer_activities",
        order="event_date",
        volunteer_id=volunteer_id,
    )


def add_volunteer_activity(data: Row) -> Row:
    row = _insert("volunteer_activities", data)
    if row.get("volunteer_id"):
        _refresh_volunteer_counts(row["volunteer_id"])
    return row


def update_volunteer_activity(activity_id: str, data: Row) -> Row | None:
    row = _update("volunteer_activities", activity_id, data)
    if row and row.get("volunteer_id"):
        _refresh_volunteer_counts(row["volunteer_id"])
    return row


def delete_volunteer_activity(activity_id: str) -> Row | None:
    row = _delete("volunteer_activities", activity_id)
    if row and row.get("volunteer_id"):
        _refresh_volunteer_counts(row["volunteer_id"])
    return row


# Donor profiles and donation records


def list_donors() -> list[Row]:
    return _list("donors", order="register_date")


def get_donor(donor_id: str) -> Row | None:
    return _get_by_id("donors", donor_id)


def get_donor_by_auth(auth_id: str) -> Row | None:
    return _first(
        _execute(supabase.table("donors").select("*").eq("auth_id", auth_id).limit(1))
    )


def create_donor(data: Row) -> Row:
    return _insert("donors", data)


def update_donor(donor_id: str, data: Row) -> Row | None:
    return _update("donors", donor_id, data)


def delete_donor(donor_id: str) -> Row | None:
    return _delete("donors", donor_id)


def get_donor_records(donor_id: str) -> list[Row]:
    return _list("donor_records", order="donation_date", donor_id=donor_id)


def add_donor_record(data: Row) -> Row:
    row = _insert("donor_records", data)
    if row.get("donor_id"):
        _refresh_donor_counts(row["donor_id"])
    return row


def update_donor_record(record_id: str, data: Row) -> Row | None:
    row = _update("donor_records", record_id, data)
    if row and row.get("donor_id"):
        _refresh_donor_counts(row["donor_id"])
    return row


def delete_donor_record(record_id: str) -> Row | None:
    row = _delete("donor_records", record_id)
    if row and row.get("donor_id"):
        _refresh_donor_counts(row["donor_id"])
    return row


# Admins and cross-role helpers


def check_is_admin(user_id: str) -> bool:
    rows = _execute(supabase.table("admins").select("user_id").eq("user_id", user_id).limit(1))
    return bool(rows)


def list_admins() -> list[Row]:
    return _list("admins", order="created_at")


def add_admin(user_id: str) -> Row:
    return _first(_execute(supabase.table("admins").insert({"user_id": user_id}))) or {}


def remove_admin(user_id: str) -> Row | None:
    return _first(_execute(supabase.table("admins").delete().eq("user_id", user_id)))


def get_profiles_by_auth(auth_id: str) -> Row:
    return {
        "auth_id": auth_id,
        "is_admin": check_is_admin(auth_id),
        "participant": get_participant_by_auth(auth_id),
        "volunteer": get_volunteer_by_auth(auth_id),
        "donor": get_donor_by_auth(auth_id),
    }
