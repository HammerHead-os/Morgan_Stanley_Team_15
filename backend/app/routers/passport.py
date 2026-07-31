from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from .family import _registration_out
from .volunteers import _claim_out, _ensure_profile

router = APIRouter(prefix="/api/passport", tags=["passport"])


@router.get("", response_model=schemas.PassportOut)
def get_passport(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    prefs = person.prefs
    prefs_out = schemas.PrefsOut(
        email_on=prefs.email_on if prefs else True,
        sms_on=prefs.sms_on if prefs else False,
        whatsapp_on=prefs.whatsapp_on if prefs else False,
    )

    family = None
    if person.household_id:
        household = db.get(models.Household, person.household_id)
        members = (
            db.query(models.Person)
            .filter(models.Person.household_id == person.household_id)
            .all()
        )
        regs = (
            db.query(models.Registration)
            .filter(models.Registration.household_id == person.household_id)
            .order_by(models.Registration.created_at.desc())
            .all()
        )
        family = schemas.FamilyPassportOut(
            household_name=household.name if household else "Household",
            members=[schemas.PersonOut.model_validate(m) for m in members],
            registrations=[_registration_out(r) for r in regs],
        )

    # Achievement passport: prefer a member in household, else self
    ach_member = person
    if person.household_id:
        kid = (
            db.query(models.Person)
            .filter(
                models.Person.household_id == person.household_id,
                models.Person.role_primary == "member",
            )
            .first()
        )
        if kid:
            ach_member = kid
    achievements = (
        db.query(models.Achievement)
        .filter(models.Achievement.member_person_id == ach_member.id)
        .order_by(models.Achievement.created_at.desc())
        .all()
    )
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.member_person_id == ach_member.id)
        .order_by(models.Goal.created_at.desc())
        .all()
    )
    achievement = schemas.AchievementPassportOut(
        member=schemas.PersonOut.model_validate(ach_member),
        achievements=[schemas.AchievementOut.model_validate(a) for a in achievements],
        goals=[schemas.GoalOut.model_validate(g) for g in goals],
    )

    # Impact: use donor account data if current user is donor; else show donor demo empty or own
    impact_person_id = person.id
    if person.role_primary != "donor":
        # Still allow viewing own commitments (may be empty)
        pass
    commitments = (
        db.query(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == impact_person_id)
        .all()
    )
    receipts = (
        db.query(models.DonationReceipt)
        .join(models.DonationCommitment)
        .filter(models.DonationCommitment.supporter_person_id == impact_person_id)
        .order_by(models.DonationReceipt.paid_at.desc())
        .all()
    )
    impact = schemas.ImpactPassportOut(
        commitments=[schemas.CommitmentOut.model_validate(c) for c in commitments],
        receipts=[schemas.ReceiptOut.model_validate(r) for r in receipts],
    )

    profile = (
        db.query(models.VolunteerProfile)
        .filter(models.VolunteerProfile.person_id == person.id)
        .first()
    )
    claims = []
    suggested = None
    if profile:
        claims = (
            db.query(models.VolunteerShiftClaim)
            .filter(models.VolunteerShiftClaim.volunteer_profile_id == profile.id)
            .order_by(models.VolunteerShiftClaim.claimed_at.desc())
            .all()
        )
        claimed_ids = {c.shift_id for c in claims}
        q = db.query(models.VolunteerShift).filter(
            models.VolunteerShift.spots_left > 0
        )
        if claimed_ids:
            q = q.filter(~models.VolunteerShift.id.in_(claimed_ids))
        suggested = q.order_by(models.VolunteerShift.duration_min).first()
    elif person.role_primary == "volunteer":
        profile = _ensure_profile(db, person)

    volunteer = schemas.VolunteerPassportOut(
        profile=schemas.VolunteerProfileOut.model_validate(profile) if profile else None,
        claims=[_claim_out(c) for c in claims],
        suggested_next=schemas.VolunteerShiftOut.model_validate(suggested)
        if suggested
        else None,
    )

    return schemas.PassportOut(
        person=schemas.PersonOut.model_validate(person),
        prefs=prefs_out,
        family=family,
        achievement=achievement,
        impact=impact,
        volunteer=volunteer,
    )
