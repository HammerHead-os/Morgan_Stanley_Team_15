from typing import List, Dict, Any, Optional
from db_supabase import supabase

# ==============================================================================
# PARTICIPANTS QUERIES
# ==============================================================================


def get_participant_by_auth(auth_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a participant profile using their Supabase auth_id."""
    response = (
        supabase.table("participants").select("*").eq("auth_id", auth_id).execute()
    )
    return response.data[0] if response.data else None


def create_participant(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new participant.
    Expected keys: auth_id, name, country, home_district, family_members (list of dicts), etc.
    """
    response = supabase.table("participants").insert(data).execute()
    return response.data[0] if response.data else {}


def get_participant_activities(participant_id: str) -> List[Dict[str, Any]]:
    """Fetch all activities joined by a specific participant."""
    response = (
        supabase.table("participant_activities")
        .select("*")
        .eq("participant_id", participant_id)
        .execute()
    )
    return response.data


def add_participant_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record a new activity for a participant.
    Expected keys: participant_id, event_date, programme_type, event_name, family_members_joined (list of strings).
    """
    response = supabase.table("participant_activities").insert(data).execute()
    return response.data[0] if response.data else {}


# ==============================================================================
# VOLUNTEERS QUERIES
# ==============================================================================


def get_volunteer_by_auth(auth_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a volunteer profile using their Supabase auth_id."""
    response = supabase.table("volunteers").select("*").eq("auth_id", auth_id).execute()
    return response.data[0] if response.data else None


def create_volunteer(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new volunteer.
    Expected keys: auth_id, name, country, skills (list), languages (list), etc.
    """
    response = supabase.table("volunteers").insert(data).execute()
    return response.data[0] if response.data else {}


def get_volunteer_activities(volunteer_id: str) -> List[Dict[str, Any]]:
    """Fetch all events a volunteer has supported."""
    response = (
        supabase.table("volunteer_activities")
        .select("*")
        .eq("volunteer_id", volunteer_id)
        .execute()
    )
    return response.data


def add_volunteer_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record a new volunteer shift/activity.
    Expected keys: volunteer_id, event_date, programme_type, event_name, role_in_event.
    """
    response = supabase.table("volunteer_activities").insert(data).execute()
    return response.data[0] if response.data else {}


# ==============================================================================
# DONORS QUERIES
# ==============================================================================


def get_donor_by_auth(auth_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a donor profile using their Supabase auth_id."""
    response = supabase.table("donors").select("*").eq("auth_id", auth_id).execute()
    return response.data[0] if response.data else None


def create_donor(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new donor profile.
    Expected keys: auth_id, name, country, primary_fund, etc.
    """
    response = supabase.table("donors").insert(data).execute()
    return response.data[0] if response.data else {}


def get_donor_records(donor_id: str) -> List[Dict[str, Any]]:
    """Fetch all donation histories for a specific donor."""
    response = (
        supabase.table("donor_records").select("*").eq("donor_id", donor_id).execute()
    )
    return response.data


def add_donor_record(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record a new donation.
    Expected keys: donor_id, donation_date, donation_type, amount_of_money, description.
    """
    response = supabase.table("donor_records").insert(data).execute()
    return response.data[0] if response.data else {}


# ==============================================================================
# ADMIN QUERIES
# ==============================================================================


def check_is_admin(user_id: str) -> bool:
    """Check if a specific auth.users ID is in the admins table."""
    response = supabase.table("admins").select("*").eq("user_id", user_id).execute()
    return len(response.data) > 0


def get_all_participants_for_admin() -> List[Dict[str, Any]]:
    """
    Example of an admin-only fetch.
    If the caller's JWT doesn't belong to an admin, RLS will return an empty list.
    """
    response = supabase.table("participants").select("*").execute()
    return response.data
