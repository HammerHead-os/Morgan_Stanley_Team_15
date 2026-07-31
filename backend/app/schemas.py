from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ——— People / auth demo ———
class PersonOut(OrmModel):
    id: int
    email: str
    name: str
    role_primary: str
    language: str
    household_id: Optional[int] = None


class DemoLoginIn(BaseModel):
    email: str = "carer@chen.demo"


class DemoLoginOut(BaseModel):
    person: PersonOut
    token: str  # demo: person id as string


# ——— Activities ———
class ActivityOut(OrmModel):
    id: int
    title: str
    description: str
    goal: str
    age_band: str
    day: str
    support_need: str
    language: str
    capacity: int
    spots_left: int
    location: str


class RegisterIn(BaseModel):
    activity_id: int
    member_person_id: int
    reminder_channel: str = "email"


class RegistrationOut(OrmModel):
    id: int
    activity_id: int
    household_id: int
    member_person_id: int
    status: str
    waitlist_position: Optional[int] = None
    reminder_channel: str
    created_at: datetime
    feedback: Optional[str] = None
    activity_title: Optional[str] = None
    member_name: Optional[str] = None


class FeedbackIn(BaseModel):
    feedback: str = Field(min_length=1, max_length=2000)


# ——— Achievements / goals ———
class AchievementOut(OrmModel):
    id: int
    member_person_id: int
    title: str
    pillar: str
    status: str
    share_consent: bool
    approved_at: Optional[datetime] = None
    created_at: datetime


class GoalIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    member_person_id: int
    target_date: Optional[date] = None


class GoalOut(OrmModel):
    id: int
    member_person_id: int
    title: str
    status: str
    target_date: Optional[date] = None
    created_at: datetime


class ConsentIn(BaseModel):
    share_consent: bool


# ——— Impact / donations ———
class CommitmentIn(BaseModel):
    amount_hkd: float = 300
    fund_category: str = "Sports programmes"
    cadence: str = "monthly"


class CommitmentOut(OrmModel):
    id: int
    supporter_person_id: int
    amount_hkd: float
    fund_category: str
    status: str
    cadence: str
    started_at: datetime
    updated_at: datetime


class CommitmentUpdateIn(BaseModel):
    status: Optional[str] = None  # active | paused | cancelled
    fund_category: Optional[str] = None
    amount_hkd: Optional[float] = None


class ReceiptOut(OrmModel):
    id: int
    commitment_id: int
    amount_hkd: float
    paid_at: datetime
    story_back: Optional[str] = None


class TransparencyOut(BaseModel):
    as_of: datetime
    programmes_pct: float = 74.6
    people_pct: float = 12.1
    venue_pct: float = 6.8
    outreach_pct: float = 4.0
    ops_pct: float = 2.5
    hkd_300_means: str = "About 2 coach-led programme sessions"


# ——— Volunteers ———
class VolunteerShiftOut(OrmModel):
    id: int
    title: str
    description: str
    duration_min: int
    skills_needed: str
    language: str
    remote: bool
    spots_left: int
    requires_onboarding: bool


class ClaimShiftIn(BaseModel):
    shift_id: int


class ClaimOut(OrmModel):
    id: int
    shift_id: int
    volunteer_profile_id: int
    status: str
    hours: float
    reflection: Optional[str] = None
    claimed_at: datetime
    shift_title: Optional[str] = None


class ReflectionIn(BaseModel):
    reflection: str = Field(min_length=1, max_length=2000)
    hours: Optional[float] = None


class VolunteerProfileOut(OrmModel):
    id: int
    person_id: int
    skills: str
    languages: str
    availability: str
    onboarded: bool
    hours_logged: float


class OnboardIn(BaseModel):
    skills: Optional[str] = None
    languages: Optional[str] = None
    availability: Optional[str] = None


# ——— Comm prefs ———
class PrefsOut(OrmModel):
    email_on: bool
    sms_on: bool
    whatsapp_on: bool


class PrefsUpdateIn(BaseModel):
    email_on: Optional[bool] = None
    sms_on: Optional[bool] = None
    whatsapp_on: Optional[bool] = None


# ——— Passport aggregate ———
class FamilyPassportOut(BaseModel):
    household_name: str
    members: list[PersonOut]
    registrations: list[RegistrationOut]


class AchievementPassportOut(BaseModel):
    member: PersonOut
    achievements: list[AchievementOut]
    goals: list[GoalOut]


class ImpactPassportOut(BaseModel):
    commitments: list[CommitmentOut]
    receipts: list[ReceiptOut]
    programmes_pct: float = 74.6


class VolunteerPassportOut(BaseModel):
    profile: Optional[VolunteerProfileOut] = None
    claims: list[ClaimOut]
    suggested_next: Optional[VolunteerShiftOut] = None


class PassportOut(BaseModel):
    person: PersonOut
    prefs: PrefsOut
    family: Optional[FamilyPassportOut] = None
    achievement: Optional[AchievementPassportOut] = None
    impact: ImpactPassportOut
    volunteer: VolunteerPassportOut
