from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_person
from ..posthog_client import get_posthog_client

router = APIRouter(prefix="/api/prefs", tags=["prefs"])


@router.get("", response_model=schemas.PrefsOut)
def get_prefs(
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    prefs = person.prefs
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return schemas.PrefsOut(
        email_on=prefs.email_on,
        sms_on=prefs.sms_on,
        whatsapp_on=prefs.whatsapp_on,
        opt_out_token=prefs.opt_out_token,
    )


@router.patch("", response_model=schemas.PrefsOut)
def update_prefs(
    body: schemas.PrefsUpdateIn,
    person: models.Person = Depends(get_current_person),
    db: Session = Depends(get_db),
):
    prefs = person.prefs
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    if body.email_on is not None:
        prefs.email_on = body.email_on
    if body.sms_on is not None:
        prefs.sms_on = body.sms_on
    if body.whatsapp_on is not None:
        prefs.whatsapp_on = body.whatsapp_on
    db.commit()
    db.refresh(prefs)
    client = get_posthog_client()
    if client:
        client.capture(
            "communication_preferences_updated",
            properties={
                "email_enabled": prefs.email_on,
                "sms_enabled": prefs.sms_on,
                "whatsapp_enabled": prefs.whatsapp_on,
            },
        )
    return schemas.PrefsOut(
        email_on=prefs.email_on,
        sms_on=prefs.sms_on,
        whatsapp_on=prefs.whatsapp_on,
        opt_out_token=prefs.opt_out_token,
    )


@router.post("/opt-out/{token}")
def one_click_opt_out(token: str, db: Session = Depends(get_db)):
    prefs = (
        db.query(models.CommPreferences)
        .filter(models.CommPreferences.opt_out_token == token)
        .first()
    )
    if not prefs:
        raise HTTPException(status_code=404, detail="Invalid opt-out token")
    prefs.email_on = False
    prefs.sms_on = False
    prefs.whatsapp_on = False
    db.add(
        models.JourneyEvent(
            person_id=prefs.person_id,
            event_type="one_click_opt_out",
            channel="email",
            payload="all_channels_off",
        )
    )
    db.commit()
    return {"ok": True, "message": "You have been opted out of all channels."}
