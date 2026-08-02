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

    def test_guest_default_questions_have_specific_fallback_answers(self):
        public = {
            "programmes": [
                {
                    "title": "Sunday fitness",
                    "day": "Sunday",
                    "location": "Love 21 Space",
                    "spots_left": 4,
                }
            ]
        }
        answers = {
            "reports": _local_answer(
                "Where are the financial reports?", "guest", public, None, None
            ),
            "programmes": _local_answer(
                "What programmes are available?", "guest", public, None, None
            ),
            "contact": _local_answer(
                "How can I contact Love 21?", "guest", public, None, None
            ),
        }
        self.assertIn("/pages/about.html#reports", answers["reports"])
        self.assertIn("Sunday fitness", answers["programmes"])
        self.assertIn("+852 2322 2121", answers["contact"])

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

    def test_member_family_activity_default_is_not_misrouted_to_family_list(self):
        answer = _local_answer(
            "Which activities has my family joined?",
            "member",
            {"programmes": []},
            {
                "family_members": [
                    {"name": "Alex", "relationship": "Child", "primary_role": "member"}
                ],
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
        self.assertIn("Your activity records", answer)
        self.assertIn("Family swimming", answer)
        self.assertNotIn("Your family\n", answer)

    def test_admin_default_questions_use_staff_aggregate_fallback(self):
        admin = {
            "database_counts": {
                "people": 42,
                "registrations": 18,
                "volunteer_claims": 7,
            },
            "registration_statuses": {"attended": 12, "booked": 6},
            "active_commitment_value_hkd": 12500,
            "browser_dashboard": {
                "tables": {"visitors": {"rows": 2, "total_visits": 31}}
            },
        }
        for question in (
            "How many website visits are recorded?",
            "Summarise the admin dashboard.",
            "Show registration totals.",
        ):
            with self.subTest(question=question):
                answer = _local_answer(
                    question,
                    "admin",
                    {"programmes": []},
                    {"family_members": [], "activity_records": []},
                    admin,
                )
                self.assertIn("Recorded website visits:** 31", answer)
                self.assertIn("Activity registrations:** 18", answer)
                self.assertIn("/pages/admin-dashboard.html", answer)

    def test_chinese_admin_default_question_returns_chinese_staff_summary(self):
        answer = _local_answer(
            "有哪些活動參加記錄？",
            "admin",
            {"programmes": []},
            {"family_members": [], "activity_records": []},
            {
                "database_counts": {
                    "people": 42,
                    "registrations": 18,
                    "volunteer_claims": 7,
                },
                "registration_statuses": {"attended": 12},
                "active_commitment_value_hkd": 12500,
                "browser_dashboard": {"tables": {}},
            },
        )
        self.assertIn("職員儀表板摘要", answer)
        self.assertIn("活動參加記錄：** 18", answer)
        self.assertIn("/pages/admin-dashboard.html", answer)


if __name__ == "__main__":
    unittest.main()
