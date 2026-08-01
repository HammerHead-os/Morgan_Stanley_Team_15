"""Volunteer points helpers."""

from __future__ import annotations

from typing import Optional


def points_for_minutes(duration_min: Optional[float] = None) -> int:
    mins = int(duration_min or 0)
    if mins <= 15:
        return 20
    if mins <= 30:
        return 35
    if mins <= 45:
        return 40
    return mins + 5


# Demo redeem catalogue
REWARDS = [
    {
        "id": "thanks_card",
        "label": "Thank-you postcard",
        "cost": 40,
        "detail": "Printed note from the Love 21 team.",
    },
    {
        "id": "class_credit",
        "label": "HKD 50 class credit",
        "cost": 100,
        "detail": "Applied to one Love 21 class booking.",
    },
    {
        "id": "tote",
        "label": "Love 21 tote bag",
        "cost": 150,
        "detail": "Pick up at Love 21 Space.",
    },
    {
        "id": "guest_pass",
        "label": "Guest swim pass",
        "cost": 200,
        "detail": "Bring a friend to one beginners session.",
    },
]


def reward_by_id(reward_id: str):
    for r in REWARDS:
        if r["id"] == reward_id:
            return r
    return None
