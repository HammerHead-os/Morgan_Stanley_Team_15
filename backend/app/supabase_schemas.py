from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class PatchModel(BaseModel):
    def update_payload(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class ParticipantCreate(BaseModel):
    auth_id: UUID | None = None
    photo_url: str | None = None
    name: str = Field(min_length=1, max_length=200)
    country: str | None = None
    family_members: list[dict[str, Any]] = Field(default_factory=list)
    home_district: str | None = None
    favourite_programme: str | None = None


class ParticipantUpdate(PatchModel):
    photo_url: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    country: str | None = None
    family_members: list[dict[str, Any]] | None = None
    home_district: str | None = None
    favourite_programme: str | None = None


class ParticipantActivityCreate(BaseModel):
    event_date: date
    programme_type: str = Field(min_length=1, max_length=120)
    event_name: str = Field(min_length=1, max_length=200)
    event_description: str | None = None
    family_members_joined: list[str] = Field(default_factory=list)


class ParticipantActivityUpdate(PatchModel):
    event_date: date | None = None
    programme_type: str | None = Field(default=None, min_length=1, max_length=120)
    event_name: str | None = Field(default=None, min_length=1, max_length=200)
    event_description: str | None = None
    family_members_joined: list[str] | None = None


class VolunteerCreate(BaseModel):
    auth_id: UUID | None = None
    photo_url: str | None = None
    name: str = Field(min_length=1, max_length=200)
    country: str | None = None
    hours_contributed: Decimal = Decimal("0.00")
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class VolunteerUpdate(PatchModel):
    photo_url: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    country: str | None = None
    hours_contributed: Decimal | None = None
    skills: list[str] | None = None
    languages: list[str] | None = None


class VolunteerActivityCreate(BaseModel):
    event_date: date
    programme_type: str = Field(min_length=1, max_length=120)
    event_name: str = Field(min_length=1, max_length=200)
    event_description: str | None = None
    role_in_event: str = Field(min_length=1, max_length=120)


class VolunteerActivityUpdate(PatchModel):
    event_date: date | None = None
    programme_type: str | None = Field(default=None, min_length=1, max_length=120)
    event_name: str | None = Field(default=None, min_length=1, max_length=200)
    event_description: str | None = None
    role_in_event: str | None = Field(default=None, min_length=1, max_length=120)


class DonorCreate(BaseModel):
    auth_id: UUID | None = None
    photo_url: str | None = None
    name: str = Field(min_length=1, max_length=200)
    country: str | None = None
    regular_donation_amount: Decimal = Decimal("0.00")
    primary_fund: str | None = None


class DonorUpdate(PatchModel):
    photo_url: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    country: str | None = None
    regular_donation_amount: Decimal | None = None
    primary_fund: str | None = None


class DonorRecordCreate(BaseModel):
    donation_date: date
    donation_type: str = Field(min_length=1, max_length=120)
    description: str | None = None
    amount_of_money: Decimal = Decimal("0.00")


class DonorRecordUpdate(PatchModel):
    donation_date: date | None = None
    donation_type: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    amount_of_money: Decimal | None = None


class AdminCreate(BaseModel):
    user_id: UUID
