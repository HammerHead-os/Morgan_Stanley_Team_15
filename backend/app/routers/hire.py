from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person, optional_person

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
        status="received",
    )
    db.add(enquiry)
    if person:
        db.add(
            models.JourneyEvent(
                person_id=person.id,
                event_type="hire_enquiry",
                channel="email",
                payload=body.creator_label,
            )
        )
    db.commit()
    db.refresh(enquiry)
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
