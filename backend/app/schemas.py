from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PersonOut(OrmModel):
    id: int
    email: str
    name: str
    role_primary: str
    roles: list[str] = []
    language: str
    household_id: Optional[int] = None
    household_role: Optional[str] = None
    profile_code: str = ""
    issued_at: Optional[datetime] = None

    @field_validator("roles", mode="before")
    @classmethod
    def coerce_roles(cls, v, info):
        if isinstance(v, str):
            parts = [x.strip() for x in v.split(",") if x.strip()]
            return parts
        if v is None:
            return []
        return list(v)


class RolesUpdateIn(BaseModel):
    roles: list[str] = Field(min_length=1)


class CalendarEventOut(BaseModel):
    id: str
    title: str
    date: date
    kind: str  # class | volunteer | hire
    detail: str = ""
    status: str = ""


class DemoLoginIn(BaseModel):
    email: str = "carer@chen.demo"


class DemoLoginOut(BaseModel):
    person: PersonOut
    token: str


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
    status_label: str = ""
    waitlist_position: Optional[int] = None
    reminder_channel: str
    created_at: datetime
    session_date: Optional[date] = None
    feedback: Optional[str] = None
    activity_title: Optional[str] = None
    activity_location: Optional[str] = None
    member_name: Optional[str] = None


class FeedbackIn(BaseModel):
    feedback: str = Field(min_length=1, max_length=2000)


class AchievementOut(OrmModel):
    id: int
    member_person_id: int
    title: str
    pillar: str
    status: str
    status_label: str = ""
    share_consent: bool
    coach_name: str = "Coach Pat"
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
    status_label: str = ""
    target_date: Optional[date] = None
    created_at: datetime


class ConsentIn(BaseModel):
    share_consent: bool


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
    status_label: str = ""
    cadence: str
    office_perk_unlocked: bool = True
    started_at: datetime
    updated_at: datetime


class CommitmentUpdateIn(BaseModel):
    status: Optional[str] = None
    fund_category: Optional[str] = None
    amount_hkd: Optional[float] = None


class ReceiptOut(OrmModel):
    id: int
    commitment_id: int
    amount_hkd: float
    paid_at: datetime
    story_back: Optional[str] = None


class ImpactBadgeOut(OrmModel):
    id: int
    person_id: int
    title: str
    level: str
    earned_at: datetime


class TransparencyOut(BaseModel):
    as_of: datetime
    programmes_pct: float = 74.6
    people_pct: float = 12.1
    venue_pct: float = 6.8
    outreach_pct: float = 4.0
    ops_pct: float = 2.5
    hkd_300_means: str = "About 2 coach-led programme sessions"


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
    scheduled_date: Optional[date] = None


class ClaimShiftIn(BaseModel):
    shift_id: int


class ClaimOut(OrmModel):
    id: int
    shift_id: int
    volunteer_profile_id: int
    status: str
    status_label: str = ""
    hours: float
    reflection: Optional[str] = None
    claimed_at: datetime
    completed_at: Optional[datetime] = None
    shift_title: Optional[str] = None
    points_awarded: int = 0
    points_available: int = 0
    duration_min: Optional[int] = None


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
    points_balance: int = 0
    points_spent: int = 0


class RedeemIn(BaseModel):
    reward_id: str = Field(min_length=2, max_length=40)


class RewardOut(BaseModel):
    id: str
    label: str
    cost: int
    detail: str = ""


class RedeemOut(BaseModel):
    ok: bool
    reward_id: str
    reward_label: str
    cost: int
    points_balance: int
    message: str = ""


class PointsOut(BaseModel):
    points_balance: int
    points_spent: int
    hours_logged: float
    rewards: list[RewardOut] = []

class OnboardIn(BaseModel):
    skills: Optional[str] = None
    languages: Optional[str] = None
    availability: Optional[str] = None


class HireIn(BaseModel):
    creator_label: str = Field(min_length=2, max_length=200)
    preferred_date: Optional[str] = Field(default=None, max_length=40)


class HireOut(OrmModel):
    id: int
    creator_label: str
    preferred_date: Optional[str] = None
    status: str
    created_at: datetime


class FamilyMemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    household_role: str = Field(min_length=2, max_length=40)
    email: Optional[str] = Field(default=None, max_length=255)
    # mom | dad | caregiver | helper | child
    is_child: bool = False


class PrefsOut(OrmModel):
    email_on: bool
    sms_on: bool
    whatsapp_on: bool
    opt_out_token: Optional[str] = None


class PrefsUpdateIn(BaseModel):
    email_on: Optional[bool] = None
    sms_on: Optional[bool] = None
    whatsapp_on: Optional[bool] = None


class JourneyEventOut(OrmModel):
    id: int
    event_type: str
    event_label: str = ""
    channel: str
    payload: str
    created_at: datetime


class NextActionOut(BaseModel):
    label: str
    href: str
    tab: Optional[str] = None


class FamilyProfileOut(BaseModel):
    household_name: str
    members: list[PersonOut]
    registrations: list[RegistrationOut]


class AchievementProfileOut(BaseModel):
    member: PersonOut
    achievements: list[AchievementOut]
    goals: list[GoalOut]


class ImpactProfileOut(BaseModel):
    commitments: list[CommitmentOut]
    receipts: list[ReceiptOut]
    badges: list[ImpactBadgeOut] = []
    programmes_pct: float = 74.6


class VolunteerProfileSummaryOut(BaseModel):
    profile: Optional[VolunteerProfileOut] = None
    claims: list[ClaimOut]
    suggested_next: Optional[VolunteerShiftOut] = None
    points_balance: int = 0
    points_spent: int = 0
    rewards: list[RewardOut] = []


class ProfileOut(BaseModel):
    person: PersonOut
    prefs: PrefsOut
    visible_tabs: list[str]
    home_tab: str = "ability"
    next_action: NextActionOut
    family: Optional[FamilyProfileOut] = None
    achievement: Optional[AchievementProfileOut] = None
    impact: ImpactProfileOut
    volunteer: VolunteerProfileSummaryOut
    journey_events: list[JourneyEventOut] = []
    hire_enquiries: list[HireOut] = []
    calendar_events: list[CalendarEventOut] = []


class InstagramPostOut(BaseModel):
    id: str
    caption: str
    media_type: str
    image_url: str
    permalink: str
    timestamp: datetime
    username: str


class InstagramFeedOut(BaseModel):
    connected: bool
    username: str
    fetched_at: Optional[datetime] = None
    pinned: list[InstagramPostOut] = Field(default_factory=list)
    recent: list[InstagramPostOut] = Field(default_factory=list)
