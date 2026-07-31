from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..posthog_client import get_posthog

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_ACCOUNTS = {
    "carer@chen.demo": "Jamie · Mom (family + volunteer + donor)",
    "dad@chen.demo": "Chris · Dad (family + donor)",
    "alex@chen.demo": "Alex · Child member",
    "donor@demo.love21": "Sam · Donor + volunteer",
    "volunteer@demo.love21": "Taylor · Volunteer + donor",
}


@router.get("/demo-accounts")
def list_demo_accounts():
    return [
        {"email": email, "label": label} for email, label in DEMO_ACCOUNTS.items()
    ]


@router.post("/demo-login", response_model=schemas.DemoLoginOut)
def demo_login(body: schemas.DemoLoginIn, db: Session = Depends(get_db)):
    person = db.query(models.Person).filter(models.Person.email == body.email).first()
    if not person:
        raise HTTPException(status_code=404, detail="Demo account not found")

    posthog_client = get_posthog()
    if posthog_client is not None:
        with posthog_client.new_context(fresh=True):
            posthog_client.identify_context(str(person.id))
            posthog_client.set(
                properties={
                    "email": person.email,
                    "name": person.name,
                    "role_primary": person.role_primary,
                    "roles": person.roles,
                }
            )
            posthog_client.capture("demo_login_completed")

    return schemas.DemoLoginOut(
        person=schemas.PersonOut.model_validate(person),
        token=str(person.id),
    )
