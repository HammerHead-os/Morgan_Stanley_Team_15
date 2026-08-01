from datetime import date, datetime
from types import SimpleNamespace
import unittest

from app.routers.profile import (
    _family_metrics,
    _impact_metrics,
    _volunteer_metrics,
)


class ProfileMetricTests(unittest.TestCase):
    def test_family_metrics_include_all_children_and_only_joined_statuses(self):
        children = [
            SimpleNamespace(id=10, name="Alex Chen"),
            SimpleNamespace(id=11, name="Casey Chen"),
        ]
        activities = {
            "swim": SimpleNamespace(title="Swimming", goal="sport"),
            "cook": SimpleNamespace(title="Cooking", goal="nutrition"),
            "yoga": SimpleNamespace(title="Yoga", goal="arts"),
        }
        registrations = [
            SimpleNamespace(member_person_id=10, status="registered", activity=activities["swim"]),
            SimpleNamespace(member_person_id=11, status="attended", activity=activities["cook"]),
            SimpleNamespace(member_person_id=11, status="attended", activity=activities["yoga"]),
            SimpleNamespace(member_person_id=10, status="waitlist", activity=activities["cook"]),
            SimpleNamespace(member_person_id=11, status="cancelled", activity=activities["swim"]),
            SimpleNamespace(member_person_id=99, status="attended", activity=activities["swim"]),
        ]

        metrics = _family_metrics(registrations, children)

        self.assertEqual(metrics.child_names, ["Alex Chen", "Casey Chen"])
        self.assertEqual(metrics.activities_joined, 3)
        self.assertEqual(metrics.programmes_explored, 3)
        self.assertEqual(metrics.favourite_programme, "Cooking")
        self.assertEqual(
            [badge.title for badge in metrics.badges],
            ["First step", "Active family", "Programme explorer"],
        )

    def test_impact_metrics_use_paid_total_and_distinct_months(self):
        commitments = [
            SimpleNamespace(
                id=1,
                status="active",
                fund_category="Sports programmes",
                updated_at=datetime(2026, 6, 1),
            )
        ]
        receipts = [
            SimpleNamespace(commitment_id=1, amount_hkd=500, paid_at=datetime(2026, 4, 1)),
            SimpleNamespace(commitment_id=1, amount_hkd=750, paid_at=datetime(2026, 4, 20)),
            SimpleNamespace(commitment_id=1, amount_hkd=1000, paid_at=datetime(2026, 5, 1)),
            SimpleNamespace(commitment_id=1, amount_hkd=3000, paid_at=datetime(2026, 6, 1)),
        ]

        metrics = _impact_metrics(commitments, receipts)

        self.assertEqual(metrics.total_donated, 5250)
        self.assertEqual(metrics.gift_count, 4)
        self.assertEqual(metrics.giving_occasions, 3)
        self.assertEqual(metrics.primary_fund, "Sports programmes")
        self.assertEqual(
            [badge.title for badge in metrics.badges],
            ["First gift", "Impact maker", "Regular supporter", "Community champion"],
        )

    def test_volunteer_days_exclude_remote_and_open_claims(self):
        profile = SimpleNamespace(hours_logged=7.5)
        claims = [
            SimpleNamespace(
                status="completed",
                shift=SimpleNamespace(remote=False, scheduled_date=date(2026, 5, 1)),
            ),
            SimpleNamespace(
                status="completed",
                shift=SimpleNamespace(remote=False, scheduled_date=date(2026, 5, 1)),
            ),
            SimpleNamespace(
                status="completed",
                shift=SimpleNamespace(remote=True, scheduled_date=None),
            ),
            SimpleNamespace(
                status="claimed",
                shift=SimpleNamespace(remote=False, scheduled_date=date(2026, 6, 1)),
            ),
        ]

        metrics = _volunteer_metrics(profile, claims)

        self.assertEqual(metrics.completed_shifts, 3)
        self.assertEqual(metrics.days_volunteered, 1)
        self.assertEqual(
            [badge.title for badge in metrics.badges],
            ["Helping hand", "Time giver", "Reliable teammate"],
        )


if __name__ == "__main__":
    unittest.main()
