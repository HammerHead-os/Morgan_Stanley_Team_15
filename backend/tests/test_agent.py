from types import SimpleNamespace
import unittest

from app.routers.agent import _access_level, _dashboard_summary, _local_answer


class AgentPolicyTests(unittest.TestCase):
    def test_access_level_is_derived_from_authenticated_roles(self):
        self.assertEqual(_access_level(None), "guest")
        self.assertEqual(
            _access_level(SimpleNamespace(roles="family,donor", role_primary="family")),
            "member",
        )
        self.assertEqual(
            _access_level(SimpleNamespace(roles="admin", role_primary="admin")),
            "admin",
        )

    def test_dashboard_summary_counts_visits_without_trusting_the_browser_role(self):
        result = _dashboard_summary(
            {
                "visitors": [
                    {"Visits": 4, "Source": "Website", "User Type": "Family"},
                    {"count": 2, "source": "Instagram", "userType": "Volunteer"},
                ],
                "people": [{"Name": "Demo One"}],
            }
        )
        self.assertTrue(result["available"])
        self.assertEqual(result["tables"]["visitors"]["rows"], 2)
        self.assertEqual(result["tables"]["visitors"]["total_visits"], 6)
        self.assertEqual(result["tables"]["people"]["rows"], 1)

    def test_finance_fallback_includes_direct_report_link(self):
        answer = _local_answer(
            "Where is the financial report?",
            "guest",
            {"programmes": []},
            None,
            None,
        )
        self.assertIn("/pages/about.html#reports", answer)

    def test_member_activity_question_uses_account_records(self):
        answer = _local_answer(
            "我參加過哪些活動？",
            "member",
            {"programmes": [{"title": "Public class", "day": "Sunday", "location": "Studio", "spots_left": 2}]},
            {
                "family_members": [],
                "activity_records": [
                    {
                        "activity": "Family swimming",
                        "member": "Alex",
                        "date": "2026-08-01",
                        "status": "attended",
                    }
                ],
            },
            None,
        )
        self.assertIn("Family swimming", answer)
        self.assertNotIn("Public class", answer)


if __name__ == "__main__":
    unittest.main()
