from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    role_primary: Mapped[str] = mapped_column(String(40), default="family")
    # family (carer) | member | donor | volunteer | corporate
    # Multi-role: comma list e.g. "family,volunteer,donor"
    roles: Mapped[str] = mapped_column(String(120), default="family")
    language: Mapped[str] = mapped_column(String(20), default="both")
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    profile_code: Mapped[str] = mapped_column(String(32), unique=True)
    # mom | dad | caregiver | helper | child | (blank for non-family)
    household_role: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Authentication fields
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="password")
    google_sub: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False)

    household_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("households.id"), nullable=True
    )

    household: Mapped[Optional["Household"]] = relationship(
        back_populates="members", foreign_keys=[household_id]
    )
    prefs: Mapped[Optional["CommPreferences"]] = relationship(
        back_populates="person", uselist=False
    )
    volunteer_profile: Mapped[Optional["VolunteerProfile"]] = relationship(
        back_populates="person", uselist=False
    )
    achievements: Mapped[list["Achievement"]] = relationship(back_populates="member")
    goals: Mapped[list["Goal"]] = relationship(back_populates="member")
    commitments: Mapped[list["DonationCommitment"]] = relationship(
        back_populates="supporter"
    )


class Household(Base):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    carer_person_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    members: Mapped[list[Person]] = relationship(
        back_populates="household", foreign_keys="Person.household_id"
    )
    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="household"
    )


class CommPreferences(Base):
    __tablename__ = "comm_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), unique=True)
    email_on: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_on: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_on: Mapped[bool] = mapped_column(Boolean, default=False)
    opt_out_token: Mapped[str] = mapped_column(String(64), unique=True)

    person: Mapped[Person] = relationship(back_populates="prefs")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    goal: Mapped[str] = mapped_column(String(40))  # sport, nutrition, family, arts
    age_band: Mapped[str] = mapped_column(String(40))  # child, teen, adult
    day: Mapped[str] = mapped_column(String(40))  # weekday, saturday, sunday
    support_need: Mapped[str] = mapped_column(String(40))  # low, 1to1, group
    language: Mapped[str] = mapped_column(String(20))  # yue, en, both
    capacity: Mapped[int] = mapped_column(Integer, default=10)
    spots_left: Mapped[int] = mapped_column(Integer, default=10)
    location: Mapped[str] = mapped_column(String(200), default="San Po Kong")

    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="activity"
    )


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint("activity_id", "member_person_id", name="uq_reg_activity_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"))
    member_person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    status: Mapped[str] = mapped_column(String(40), default="registered")
    # registered | waitlist | attended | cancelled
    waitlist_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reminder_channel: Mapped[str] = mapped_column(String(20), default="email")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    session_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feedback_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    activity: Mapped[Activity] = relationship(back_populates="registrations")
    household: Mapped[Household] = relationship(back_populates="registrations")
    member: Mapped[Person] = relationship(foreign_keys=[member_person_id])


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    title: Mapped[str] = mapped_column(String(200))
    pillar: Mapped[str] = mapped_column(String(40), default="sport")
    status: Mapped[str] = mapped_column(String(40), default="pending")
    # pending | coach_approved | shared
    share_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    coach_name: Mapped[str] = mapped_column(String(120), default="Coach Pat")
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped[Person] = relationship(back_populates="achievements")


class ImpactBadge(Base):
    __tablename__ = "impact_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    title: Mapped[str] = mapped_column(String(120), default="Local contributor")
    level: Mapped[str] = mapped_column(String(40), default="bronze")
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HireEnquiry(Base):
    __tablename__ = "hire_enquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("people.id"), nullable=True
    )
    creator_label: Mapped[str] = mapped_column(String(200))
    requester_name: Mapped[str] = mapped_column(String(120), default="")
    company_name: Mapped[str] = mapped_column(String(160), default="")
    event_description: Mapped[str] = mapped_column(Text, default="")
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="received")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="in_progress")
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped[Person] = relationship(back_populates="goals")


class DonationCommitment(Base):
    __tablename__ = "donation_commitments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supporter_person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    amount_hkd: Mapped[float] = mapped_column(Float)
    fund_category: Mapped[str] = mapped_column(String(80), default="Sports programmes")
    status: Mapped[str] = mapped_column(String(40), default="active")
    # active | paused | cancelled
    cadence: Mapped[str] = mapped_column(String(20), default="monthly")
    office_perk_unlocked: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    supporter: Mapped[Person] = relationship(back_populates="commitments")
    receipts: Mapped[list["DonationReceipt"]] = relationship(
        back_populates="commitment"
    )


class DonationReceipt(Base):
    __tablename__ = "donation_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commitment_id: Mapped[int] = mapped_column(ForeignKey("donation_commitments.id"))
    amount_hkd: Mapped[float] = mapped_column(Float)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    story_back: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    commitment: Mapped[DonationCommitment] = relationship(back_populates="receipts")


class VolunteerProfile(Base):
    __tablename__ = "volunteer_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), unique=True)
    skills: Mapped[str] = mapped_column(String(255), default="")
    languages: Mapped[str] = mapped_column(String(80), default="en")
    availability: Mapped[str] = mapped_column(String(120), default="")
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    hours_logged: Mapped[float] = mapped_column(Float, default=0.0)
    points_balance: Mapped[int] = mapped_column(Integer, default=0)
    points_spent: Mapped[int] = mapped_column(Integer, default=0)

    person: Mapped[Person] = relationship(back_populates="volunteer_profile")
    shifts: Mapped[list["VolunteerShiftClaim"]] = relationship(
        back_populates="volunteer"
    )


class VolunteerShift(Base):
    __tablename__ = "volunteer_shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    duration_min: Mapped[int] = mapped_column(Integer, default=60)
    skills_needed: Mapped[str] = mapped_column(String(120), default="")
    language: Mapped[str] = mapped_column(String(40), default="en")
    remote: Mapped[bool] = mapped_column(Boolean, default=True)
    spots_left: Mapped[int] = mapped_column(Integer, default=5)
    requires_onboarding: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    claims: Mapped[list["VolunteerShiftClaim"]] = relationship(back_populates="shift")


class VolunteerShiftClaim(Base):
    __tablename__ = "volunteer_shift_claims"
    __table_args__ = (
        UniqueConstraint("shift_id", "volunteer_profile_id", name="uq_shift_volunteer"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("volunteer_shifts.id"))
    volunteer_profile_id: Mapped[int] = mapped_column(
        ForeignKey("volunteer_profiles.id")
    )
    status: Mapped[str] = mapped_column(String(40), default="claimed")
    # claimed | completed | cancelled
    hours: Mapped[float] = mapped_column(Float, default=0.0)
    reflection: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)

    shift: Mapped[VolunteerShift] = relationship(back_populates="claims")
    volunteer: Mapped[VolunteerProfile] = relationship(back_populates="shifts")


class JourneyEvent(Base):
    """Audit / automation log for email-first journeys (demo)."""

    __tablename__ = "journey_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    event_type: Mapped[str] = mapped_column(String(80))
    channel: Mapped[str] = mapped_column(String(20), default="email")
    payload: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
