"""
Tests for WHOOP dashboard analysis helpers.
"""
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dashboard_analysis import (
    DashboardAnalyzer,
    sleep_actual_hours,
    sleep_debt_hours,
    sleep_need_hours,
)


class TestDashboardAnalysis(unittest.TestCase):
    """Unit tests for the dashboard aggregation layer."""

    def setUp(self):
        self.analyzer = DashboardAnalyzer(MagicMock())

    def test_sleep_helper_functions(self):
        """Sleep helpers should convert WHOOP millisecond buckets into hours."""
        record = {
            "score": {
                "stage_summary": {
                    "total_light_sleep_time_milli": 10_800_000,
                    "total_slow_wave_sleep_time_milli": 3_600_000,
                    "total_rem_sleep_time_milli": 3_600_000,
                },
                "sleep_needed": {
                    "baseline_milli": 28_800_000,
                    "need_from_sleep_debt_milli": 3_600_000,
                    "need_from_recent_strain_milli": 1_800_000,
                    "need_from_recent_nap_milli": 0,
                },
            }
        }

        self.assertEqual(sleep_actual_hours(record), 5.0)
        self.assertEqual(sleep_need_hours(record), 9.5)
        self.assertEqual(sleep_debt_hours(record), 1.0)

    def test_build_payload_returns_dashboard_sections(self):
        """The analyzer should build the sections consumed by the web UI."""
        profile = {
            "first_name": "Arpit",
            "last_name": "Kumaar",
            "email": "arpit@example.com",
            "user_id": 1,
        }
        auth_status = {"status": "valid"}
        body_measurements = {
            "height_meter": 1.8,
            "weight_kilogram": 75.0,
            "max_heart_rate": 190,
        }
        sources = {
            "bodyMeasurements": {"available": True, "count": 1, "message": None},
            "recovery": {"available": True, "count": 2},
            "sleep": {"available": True, "count": 2},
            "workouts": {"available": True, "count": 1},
            "cycles": {"available": False, "count": 0, "message": "Unauthorized"},
        }
        recovery = [
            {
                "created_at": "2026-03-01T12:00:00Z",
                "score": {
                    "recovery_score": 60,
                    "hrv_rmssd_milli": 70,
                    "resting_heart_rate": 58,
                    "spo2_percentage": 96.0,
                    "skin_temp_celsius": 35.0,
                },
            },
            {
                "created_at": "2026-03-02T12:00:00Z",
                "score": {
                    "recovery_score": 80,
                    "hrv_rmssd_milli": 88,
                    "resting_heart_rate": 55,
                    "spo2_percentage": 97.0,
                    "skin_temp_celsius": 34.9,
                },
            },
        ]
        sleep = [
            {
                "start": "2026-03-01T05:00:00Z",
                "score": {
                    "sleep_performance_percentage": 74,
                    "sleep_efficiency_percentage": 90,
                    "sleep_consistency_percentage": 68,
                    "respiratory_rate": 16.8,
                    "stage_summary": {
                        "total_light_sleep_time_milli": 14_400_000,
                        "total_slow_wave_sleep_time_milli": 3_600_000,
                        "total_rem_sleep_time_milli": 3_600_000,
                    },
                    "sleep_needed": {
                        "baseline_milli": 28_800_000,
                        "need_from_sleep_debt_milli": 3_600_000,
                        "need_from_recent_strain_milli": 0,
                        "need_from_recent_nap_milli": 0,
                    },
                },
            },
            {
                "start": "2026-03-02T05:00:00Z",
                "score": {
                    "sleep_performance_percentage": 86,
                    "sleep_efficiency_percentage": 94,
                    "sleep_consistency_percentage": 73,
                    "respiratory_rate": 16.5,
                    "stage_summary": {
                        "total_light_sleep_time_milli": 16_200_000,
                        "total_slow_wave_sleep_time_milli": 4_500_000,
                        "total_rem_sleep_time_milli": 4_500_000,
                    },
                    "sleep_needed": {
                        "baseline_milli": 28_800_000,
                        "need_from_sleep_debt_milli": 1_800_000,
                        "need_from_recent_strain_milli": 900_000,
                        "need_from_recent_nap_milli": 0,
                    },
                },
            },
        ]
        workouts = [
            {
                "start": "2026-03-02T14:00:00Z",
                "end": "2026-03-02T14:45:00Z",
                "sport_name": "running",
                "score": {
                    "strain": 8.5,
                    "average_heart_rate": 128,
                    "max_heart_rate": 162,
                },
            }
        ]
        cycles = []

        payload = self.analyzer._build_payload(
            profile,
            body_measurements,
            auth_status,
            recovery,
            sleep,
            workouts,
            cycles,
            sources,
        )

        self.assertEqual(payload["profile"]["firstName"], "Arpit")
        self.assertEqual(payload["dateRange"]["days"], 2)
        self.assertEqual(payload["metrics"]["recovery"]["average"], 70.0)
        self.assertEqual(payload["metrics"]["sleep"]["averageHours"], 6.5)
        self.assertEqual(payload["metrics"]["sleep"]["currentDebtHours"], 0.5)
        self.assertEqual(payload["metrics"]["sleep"]["averageDebtHours"], 0.75)
        self.assertEqual(payload["metrics"]["workouts"]["count"], 1)
        self.assertEqual(len(payload["cards"]), 5)
        self.assertEqual(payload["cards"][2]["id"], "sleep-debt")
        self.assertEqual(payload["cards"][2]["value"], 0.5)
        self.assertEqual(payload["sources"]["cycles"]["available"], False)
        self.assertIn("rawData", payload)
        self.assertEqual(payload["rawData"]["profile"]["first_name"], "Arpit")
        self.assertEqual(len(payload["rawData"]["sleep"]), 2)

    def test_build_dashboard_returns_empty_payload_without_tokens(self):
        """Missing auth should return a safe empty payload instead of raising."""
        client = MagicMock()
        client.get_auth_status.return_value = {"status": "no_tokens"}
        client.clear_cache.return_value = None
        client.get_user_profile = AsyncMock()

        analyzer = DashboardAnalyzer(client)
        payload = asyncio.run(analyzer.build_dashboard())

        self.assertEqual(payload["authStatus"]["status"], "no_tokens")
        self.assertEqual(payload["errorState"]["title"], "No WHOOP tokens were found for the local dashboard.")
        self.assertEqual(payload["cards"], [])
        client.get_user_profile.assert_not_called()


if __name__ == "__main__":
    unittest.main()
