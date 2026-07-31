from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from .. import db_queries as db
from .. import supabase_schemas as schemas

router = APIRouter(prefix="/api/supabase", tags=["supabase"])


def _not_found(entity: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")


def _call(fn, *args, **kwargs) -> Any:
    try:
        return fn(*args, **kwargs)
    except db.SupabaseBackendError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc}",
        ) from exc


def _require(row: dict[str, Any] | None, entity: str) -> dict[str, Any]:
    if not row:
        _not_found(entity)
    return row


@router.get("/me/{auth_id}")
def get_profiles_by_auth(auth_id: UUID):
    return _call(db.get_profiles_by_auth, str(auth_id))


@router.get("/participants")
def list_participants():
    return _call(db.list_participants)


@router.get("/participants/by-auth/{auth_id}")
def get_participant_by_auth(auth_id: UUID):
    return _require(_call(db.get_participant_by_auth, str(auth_id)), "Participant")


@router.get("/participants/{participant_id}")
def get_participant(participant_id: UUID):
    return _require(_call(db.get_participant, str(participant_id)), "Participant")


@router.post("/participants", status_code=status.HTTP_201_CREATED)
def create_participant(body: schemas.ParticipantCreate):
    return _call(db.create_participant, body.model_dump())


@router.patch("/participants/{participant_id}")
def update_participant(participant_id: UUID, body: schemas.ParticipantUpdate):
    return _require(
        _call(db.update_participant, str(participant_id), body.update_payload()),
        "Participant",
    )


@router.delete("/participants/{participant_id}")
def delete_participant(participant_id: UUID):
    return _require(_call(db.delete_participant, str(participant_id)), "Participant")


@router.get("/participants/{participant_id}/activities")
def list_participant_activities(participant_id: UUID):
    _require(_call(db.get_participant, str(participant_id)), "Participant")
    return _call(db.get_participant_activities, str(participant_id))


@router.post("/participants/{participant_id}/activities", status_code=status.HTTP_201_CREATED)
def add_participant_activity(
    participant_id: UUID,
    body: schemas.ParticipantActivityCreate,
):
    _require(_call(db.get_participant, str(participant_id)), "Participant")
    payload = body.model_dump()
    payload["participant_id"] = str(participant_id)
    return _call(db.add_participant_activity, payload)


@router.patch("/participant-activities/{activity_id}")
def update_participant_activity(
    activity_id: UUID,
    body: schemas.ParticipantActivityUpdate,
):
    return _require(
        _call(db.update_participant_activity, str(activity_id), body.update_payload()),
        "Participant activity",
    )


@router.delete("/participant-activities/{activity_id}")
def delete_participant_activity(activity_id: UUID):
    return _require(
        _call(db.delete_participant_activity, str(activity_id)),
        "Participant activity",
    )


@router.get("/volunteers")
def list_volunteers():
    return _call(db.list_volunteers)


@router.get("/volunteers/by-auth/{auth_id}")
def get_volunteer_by_auth(auth_id: UUID):
    return _require(_call(db.get_volunteer_by_auth, str(auth_id)), "Volunteer")


@router.get("/volunteers/{volunteer_id}")
def get_volunteer(volunteer_id: UUID):
    return _require(_call(db.get_volunteer, str(volunteer_id)), "Volunteer")


@router.post("/volunteers", status_code=status.HTTP_201_CREATED)
def create_volunteer(body: schemas.VolunteerCreate):
    return _call(db.create_volunteer, body.model_dump())


@router.patch("/volunteers/{volunteer_id}")
def update_volunteer(volunteer_id: UUID, body: schemas.VolunteerUpdate):
    return _require(
        _call(db.update_volunteer, str(volunteer_id), body.update_payload()),
        "Volunteer",
    )


@router.delete("/volunteers/{volunteer_id}")
def delete_volunteer(volunteer_id: UUID):
    return _require(_call(db.delete_volunteer, str(volunteer_id)), "Volunteer")


@router.get("/volunteers/{volunteer_id}/activities")
def list_volunteer_activities(volunteer_id: UUID):
    _require(_call(db.get_volunteer, str(volunteer_id)), "Volunteer")
    return _call(db.get_volunteer_activities, str(volunteer_id))


@router.post("/volunteers/{volunteer_id}/activities", status_code=status.HTTP_201_CREATED)
def add_volunteer_activity(
    volunteer_id: UUID,
    body: schemas.VolunteerActivityCreate,
):
    _require(_call(db.get_volunteer, str(volunteer_id)), "Volunteer")
    payload = body.model_dump()
    payload["volunteer_id"] = str(volunteer_id)
    return _call(db.add_volunteer_activity, payload)


@router.patch("/volunteer-activities/{activity_id}")
def update_volunteer_activity(activity_id: UUID, body: schemas.VolunteerActivityUpdate):
    return _require(
        _call(db.update_volunteer_activity, str(activity_id), body.update_payload()),
        "Volunteer activity",
    )


@router.delete("/volunteer-activities/{activity_id}")
def delete_volunteer_activity(activity_id: UUID):
    return _require(
        _call(db.delete_volunteer_activity, str(activity_id)),
        "Volunteer activity",
    )


@router.get("/donors")
def list_donors():
    return _call(db.list_donors)


@router.get("/donors/by-auth/{auth_id}")
def get_donor_by_auth(auth_id: UUID):
    return _require(_call(db.get_donor_by_auth, str(auth_id)), "Donor")


@router.get("/donors/{donor_id}")
def get_donor(donor_id: UUID):
    return _require(_call(db.get_donor, str(donor_id)), "Donor")


@router.post("/donors", status_code=status.HTTP_201_CREATED)
def create_donor(body: schemas.DonorCreate):
    return _call(db.create_donor, body.model_dump())


@router.patch("/donors/{donor_id}")
def update_donor(donor_id: UUID, body: schemas.DonorUpdate):
    return _require(
        _call(db.update_donor, str(donor_id), body.update_payload()),
        "Donor",
    )


@router.delete("/donors/{donor_id}")
def delete_donor(donor_id: UUID):
    return _require(_call(db.delete_donor, str(donor_id)), "Donor")


@router.get("/donors/{donor_id}/records")
def list_donor_records(donor_id: UUID):
    _require(_call(db.get_donor, str(donor_id)), "Donor")
    return _call(db.get_donor_records, str(donor_id))


@router.post("/donors/{donor_id}/records", status_code=status.HTTP_201_CREATED)
def add_donor_record(donor_id: UUID, body: schemas.DonorRecordCreate):
    _require(_call(db.get_donor, str(donor_id)), "Donor")
    payload = body.model_dump()
    payload["donor_id"] = str(donor_id)
    return _call(db.add_donor_record, payload)


@router.patch("/donor-records/{record_id}")
def update_donor_record(record_id: UUID, body: schemas.DonorRecordUpdate):
    return _require(
        _call(db.update_donor_record, str(record_id), body.update_payload()),
        "Donor record",
    )


@router.delete("/donor-records/{record_id}")
def delete_donor_record(record_id: UUID):
    return _require(_call(db.delete_donor_record, str(record_id)), "Donor record")


@router.get("/admins")
def list_admins():
    return _call(db.list_admins)


@router.get("/admins/{user_id}/is-admin")
def is_admin(user_id: UUID):
    return {"user_id": str(user_id), "is_admin": _call(db.check_is_admin, str(user_id))}


@router.post("/admins", status_code=status.HTTP_201_CREATED)
def add_admin(body: schemas.AdminCreate):
    return _call(db.add_admin, str(body.user_id))


@router.delete("/admins/{user_id}")
def remove_admin(user_id: UUID):
    return _require(_call(db.remove_admin, str(user_id)), "Admin")
