"""
Tests for WHOOP CSV export generation.
"""
import csv
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from export_whoop_data import generate_csv_exports


class TestWhoopCsvExport(unittest.TestCase):
    """Validate flattened CSV outputs from JSON exports."""

    def test_generate_csv_exports_writes_expected_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_dir = Path(tmp)

            (export_dir / "recovery.json").write_text(
                json.dumps(
                    {
                        "records": [
                            {
                                "created_at": "2026-03-01T08:00:00Z",
                                "score": {
                                    "recovery_score": 72,
                                    "hrv_rmssd_milli": 86,
                                    "resting_heart_rate": 56,
                                    "spo2_percentage": 97.0,
                                    "skin_temp_celsius": 34.8,
                                },
                            },
                            {
                                "created_at": "2026-03-02T08:00:00Z",
                                "score": {
                                    "recovery_score": 65,
                                    "hrv_rmssd_milli": 78,
                                    "resting_heart_rate": 58,
                                    "spo2_percentage": 96.4,
                                    "skin_temp_celsius": 35.0,
                                },
                            },
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (export_dir / "sleep.json").write_text(
                json.dumps(
                    {
                        "records": [
                            {
                                "start": "2026-03-01T01:00:00Z",
                                "end": "2026-03-01T08:00:00Z",
                                "score": {
                                    "sleep_performance_percentage": 82,
                                    "sleep_efficiency_percentage": 91,
                                    "sleep_consistency_percentage": 73,
                                    "respiratory_rate": 16.2,
                                    "stage_summary": {
                                        "total_light_sleep_time_milli": 16_200_000,
                                        "total_slow_wave_sleep_time_milli": 4_200_000,
                                        "total_rem_sleep_time_milli": 4_200_000,
                                    },
                                    "sleep_needed": {
                                        "baseline_milli": 28_800_000,
                                        "need_from_sleep_debt_milli": 1_800_000,
                                        "need_from_recent_strain_milli": 0,
                                        "need_from_recent_nap_milli": 0,
                                    },
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (export_dir / "workouts.json").write_text(
                json.dumps(
                    {
                        "records": [
                            {
                                "start": "2026-03-02T14:00:00Z",
                                "end": "2026-03-02T14:45:00Z",
                                "sport_name": "running",
                                "score": {
                                    "strain": 8.6,
                                    "average_heart_rate": 130,
                                    "max_heart_rate": 164,
                                    "zone_durations": {
                                        "zone_one_milli": 300_000,
                                        "zone_two_milli": 600_000,
                                        "zone_three_milli": 900_000,
                                        "zone_four_milli": 0,
                                        "zone_five_milli": 0,
                                        "zone_six_milli": 0,
                                    },
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (export_dir / "cycles.json").write_text(
                json.dumps(
                    {
                        "records": [
                            {
                                "start": "2026-03-02T00:00:00Z",
                                "score": {"strain": 11.1, "kilojoule": 1820},
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            summary = generate_csv_exports(export_dir)

            self.assertIn("daily_summary.csv", summary["files"])
            self.assertTrue((export_dir / "recovery.csv").exists())
            self.assertTrue((export_dir / "sleep.csv").exists())
            self.assertTrue((export_dir / "workouts.csv").exists())
            self.assertTrue((export_dir / "cycles.csv").exists())
            self.assertTrue((export_dir / "daily_summary.csv").exists())

            with (export_dir / "daily_summary.csv").open(encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[-1]["workout_count"], "1")
            self.assertEqual(rows[-1]["cycle_strain"], "11.1")

            with (export_dir / "workouts.csv").open(encoding="utf-8") as handle:
                workout_rows = list(csv.DictReader(handle))
            self.assertEqual(float(workout_rows[0]["zone_one_minutes"]), 5.0)
            self.assertEqual(float(workout_rows[0]["zone_two_minutes"]), 10.0)
            self.assertEqual(float(workout_rows[0]["zone_three_minutes"]), 15.0)


if __name__ == "__main__":
    unittest.main()
