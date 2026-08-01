from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..labels import status_label
from ..posthog_client import get_posthog_client

router = APIRouter(prefix="/api/impact", tags=["impact"])


def _commitment_out(c: models.DonationCommitment) -> schemas.CommitmentOut:
    return schemas.CommitmentOut(
        id=c.id,
        supporter_person_id=c.supporter_person_id,
        amount_hkd=c.amount_hkd,
        fund_category=c.fund_category,
        status=c.status,
        status_label=status_label(c.status),
        cadence=c.cadence,
        office_perk_unlocked=bool(c.office_perk_unlocked),
        started_at=c.started_at,
        updated_at=c.updated_at,
    )


@router.get("/transparency", response_model=schemas.TransparencyOut)
def transparency():
    return schemas.TransparencyOut(as_of=datetime.utcnow())


@router.get("/commitments", response_model=list[schemas.CommitmentOut])
def list_commitments(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == person.id)
        .order_by(models.DonationCommitment.started_at.desc())
        .all()
    )
    return [_commitment_out(c) for c in rows]


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
    amount = body.amount_hkd
    fund = body.fund_category
    if amount >= 500:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to run two coach-led "
            f"sport sessions, cover pool lane fees, and print bilingual class sheets "
            f"for {fund}."
        )
    elif amount >= 300:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to fund about two "
            f"coach-led programme sessions and snack support under {fund}."
        )
    else:
        story = (
            f"Your donation of HKD {amount:.0f} allowed us to cover coach transport "
            f"and session materials for {fund}."
        )
    db.add(
        models.DonationReceipt(
            commitment_id=commitment.id,
            amount_hkd=body.amount_hkd,
            story_back=story,
        )
    )
    db.add(
        models.ImpactBadge(
            person_id=person.id,
            title="Local contributor",
            level="bronze" if body.amount_hkd < 500 else "silver",
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
    client = get_posthog_client()
    if client:
        client.capture(
            "donation_commitment_started",
            properties={
                "amount_hkd": commitment.amount_hkd,
                "fund_category": commitment.fund_category,
                "cadence": commitment.cadence,
            },
        )
    return _commitment_out(commitment)


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
    client = get_posthog_client()
    if client:
        client.capture(
            "donation_commitment_updated",
            properties={"status": commitment.status, "cadence": commitment.cadence},
        )
    return _commitment_out(commitment)


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
