from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person

router = APIRouter(prefix="/api/impact", tags=["impact"])


@router.get("/transparency", response_model=schemas.TransparencyOut)
def transparency():
    return schemas.TransparencyOut(as_of=datetime.utcnow())


@router.get("/commitments", response_model=list[schemas.CommitmentOut])
def list_commitments(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .order_by(models.DonationCommitment.started_at.desc())
        .all()
    )


@router.post("/commitments", response_model=schemas.CommitmentOut)
def start_commitment(
    body: schemas.CommitmentIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    commitment = models.DonationCommitment(
        supporter_person_id=person.id,
        amount_hkd=body.amount_hkd,
        fund_category=body.fund_category,
        cadence=body.cadence,
        status="active",
    )
    db.add(commitment)
    db.flush()
    db.add(
        models.DonationReceipt(
            commitment_id=commitment.id,
            amount_hkd=body.amount_hkd,
            story_back=f"Thank you — HKD {body.amount_hkd:.0f} supports {body.fund_category}.",
        )
    )
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="commitment_started",
            channel="email",
            payload=f"amount={body.amount_hkd};fund={body.fund_category}",
        )
    )
    db.commit()
    db.refresh(commitment)
    return commitment


@router.patch("/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def update_commitment(
    commitment_id: int,
    body: schemas.CommitmentUpdateIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    commitment = db.get(models.DonationCommitment, commitment_id)
    if not commitment or commitment.supporter_person_id != person.id:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if body.status is not None:
        if body.status not in ("active", "paused", "cancelled"):
            raise HTTPException(status_code=400, detail="Invalid status")
        commitment.status = body.status
    if body.fund_category is not None:
        commitment.fund_category = body.fund_category
    if body.amount_hkd is not None:
        commitment.amount_hkd = body.amount_hkd
    commitment.updated_at = datetime.utcnow()
    db.add(
        models.JourneyEvent(
            person_id=person.id,
            event_type="commitment_updated",
            channel="email",
            payload=f"id={commitment.id};status={commitment.status}",
        )
    )
    db.commit()
    db.refresh(commitment)
    return commitment


@router.get("/receipts", response_model=list[schemas.ReceiptOut])
def list_receipts(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.DonationReceipt)
        .join(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .order_by(models.DonationReceipt.paid_at.desc())
        .all()
    )
