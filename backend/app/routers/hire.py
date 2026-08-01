from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person, optional_person, require_admin
from ..posthog_client import get_posthog_client

router = APIRouter(prefix="/api/hire", tags=["hire"])


@router.post("", response_model=schemas.HireOut)
def hire_creator(
    body: schemas.HireIn,
    person: models.Person | None = Depends(optional_person),
    db: Session = Depends(get_db),
):
    # Allow hire without login; attach person when present
    if person is None:
        # ensure a guest-linked enquiry still works — use carer demo if no token
        person = (
            db.query(models.Person)
            .filter(models.Person.email == "carer@chen.demo")
            .first()
        )
    enquiry = models.HireEnquiry(
        person_id=person.id if person else None,
        creator_label=body.creator_label,
        preferred_date=body.preferred_date,
        requester_name=body.requester_name,
        company_name=body.company_name,
        event_description=body.event_description,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        status="received",
    )
    db.add(enquiry)
    if person:
        db.add(
            models.JourneyEvent(
                person_id=person.id,
                event_type="hire_enquiry",
                channel="email",
                payload=body.creator_label
                + (f";date={body.preferred_date}" if body.preferred_date else ""),
            )
        )
    db.commit()
    db.refresh(enquiry)
    client = get_posthog_client()
    if client:
        client.capture(
            "hire_enquiry_submitted",
            properties={"has_preferred_date": bool(enquiry.preferred_date)},
        )
    return enquiry


@router.get("", response_model=list[schemas.HireOut])
def list_hires(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.HireEnquiry)
        .filter(models.HireEnquiry.person_id == person.id)
        .order_by(models.HireEnquiry.created_at.desc())
        .all()
    )


@router.get("/admin", response_model=list[schemas.HireOut])
def list_all_hires(
    staff: models.Person = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """For the organisation: every enquiry, regardless of who submitted it."""
    return (
        db.query(models.HireEnquiry)
        .order_by(models.HireEnquiry.created_at.desc())
        .all()
    )
