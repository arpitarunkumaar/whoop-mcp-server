"""
WHOOP dashboard analysis helpers.
"""
import asyncio
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from whoop_client import WhoopClient


MAX_PAGE_SIZE = 25
UTC_MIN = datetime.min.replace(tzinfo=timezone.utc)


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse WHOOP timestamps into timezone-aware datetimes."""
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def format_month(month_key: str) -> str:
    """Convert YYYY-MM month keys into readable labels."""
    return datetime.strptime(month_key, "%Y-%m").strftime("%b %Y")


def round_value(value: Optional[float], digits: int = 2) -> Optional[float]:
    """Round floats without failing on nulls."""
    if value is None:
        return None
    return round(value, digits)


def mean(values: Iterable[Optional[float]], digits: int = 2) -> Optional[float]:
    """Compute a rounded average."""
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return round(sum(cleaned) / len(cleaned), digits)


def median(values: Iterable[Optional[float]], digits: int = 2) -> Optional[float]:
    """Compute a rounded median."""
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return round(statistics.median(cleaned), digits)


def percent_change(current: Optional[float], previous: Optional[float], digits: int = 1) -> Optional[float]:
    """Compute percent change when both values are available."""
    if current is None or previous in (None, 0):
        return None
    return round(((current - previous) / previous) * 100, digits)


def delta(current: Optional[float], previous: Optional[float], digits: int = 2) -> Optional[float]:
    """Compute absolute delta when both values are available."""
    if current is None or previous is None:
        return None
    return round(current - previous, digits)


def pearson(xs: Iterable[Optional[float]], ys: Iterable[Optional[float]]) -> Optional[float]:
    """Compute the Pearson correlation coefficient for paired samples."""
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 3:
        return None

    x_values = [pair[0] for pair in pairs]
    y_values = [pair[1] for pair in pairs]
    x_mean = sum(x_values) / len(x_values)
    y_mean = sum(y_values) / len(y_values)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in pairs)
    x_variance = sum((x - x_mean) ** 2 for x in x_values)
    y_variance = sum((y - y_mean) ** 2 for y in y_values)
    if not x_variance or not y_variance:
        return None
    return round(numerator / math.sqrt(x_variance * y_variance), 3)


def last_n(items: List[Optional[float]], count: int) -> List[Optional[float]]:
    """Return the trailing N values."""
    return items[-count:] if items else []


def sleep_actual_hours(record: Dict[str, Any]) -> Optional[float]:
    """Compute sleep duration from stage totals."""
    stage_summary = (record.get("score") or {}).get("stage_summary") or {}
    millis = sum(
        stage_summary.get(key, 0) or 0
        for key in (
            "total_light_sleep_time_milli",
            "total_slow_wave_sleep_time_milli",
            "total_rem_sleep_time_milli",
        )
    )
    if not millis:
        return None
    return round(millis / 3_600_000, 2)


def sleep_need_hours(record: Dict[str, Any]) -> Optional[float]:
    """Compute WHOOP sleep need from its component buckets."""
    sleep_need = (record.get("score") or {}).get("sleep_needed") or {}
    millis = sum(
        sleep_need.get(key, 0) or 0
        for key in (
            "baseline_milli",
            "need_from_sleep_debt_milli",
            "need_from_recent_strain_milli",
            "need_from_recent_nap_milli",
        )
    )
    if not millis:
        return None
    return round(millis / 3_600_000, 2)


def sleep_debt_hours(record: Dict[str, Any]) -> Optional[float]:
    """Compute WHOOP sleep debt from the dedicated debt bucket."""
    sleep_need = (record.get("score") or {}).get("sleep_needed") or {}
    millis = sleep_need.get("need_from_sleep_debt_milli", 0) or 0
    if not millis:
        return 0.0
    return round(millis / 3_600_000, 2)


def workout_duration_minutes(record: Dict[str, Any]) -> Optional[float]:
    """Compute workout duration in minutes."""
    start = parse_datetime(record.get("start"))
    end = parse_datetime(record.get("end"))
    if not start or not end:
        return None
    return round((end - start).total_seconds() / 60, 2)


def date_key(value: Optional[str]) -> Optional[str]:
    """Normalize timestamps into YYYY-MM-DD strings."""
    parsed = parse_datetime(value)
    if not parsed:
        return None
    return parsed.date().isoformat()


def correlation_label(value: Optional[float]) -> str:
    """Translate correlation coefficients into human-friendly labels."""
    if value is None:
        return "Not enough data"
    magnitude = abs(value)
    if magnitude >= 0.7:
        strength = "strong"
    elif magnitude >= 0.4:
        strength = "moderate"
    elif magnitude >= 0.2:
        strength = "weak"
    else:
        strength = "minimal"
    direction = "positive" if value >= 0 else "negative"
    return f"{strength} {direction}"


class DashboardAnalyzer:
    """Builds the WHOOP dashboard payload used by the local web app."""

    def __init__(self, client: WhoopClient):
        self.client = client

    @staticmethod
    def _timestamp() -> str:
        """Build a consistent UTC timestamp for payloads."""
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    async def _safe_fetch(self, coroutine: Any) -> Dict[str, Any]:
        """Capture endpoint failures without aborting the whole dashboard."""
        try:
            return {"data": await coroutine, "error": None}
        except Exception as exc:
            return {"data": None, "error": str(exc)}

    async def _fetch_all_records(self, endpoint: str) -> List[Dict[str, Any]]:
        """Fetch every page from a WHOOP endpoint using cursor pagination."""
        records: List[Dict[str, Any]] = []
        seen_keys = set()
        next_token: Optional[str] = None

        while True:
            params: Dict[str, Any] = {"limit": MAX_PAGE_SIZE}
            if next_token:
                params["nextToken"] = next_token

            payload = await self.client._make_request(endpoint, params)
            page = payload.get("records", [])
            if not page:
                break

            new_rows = 0
            for record in page:
                record_key = (
                    record.get("id")
                    or record.get("cycle_id")
                    or record.get("sleep_id")
                    or record.get("created_at")
                )
                if record_key in seen_keys:
                    continue
                seen_keys.add(record_key)
                records.append(record)
                new_rows += 1

            next_token = payload.get("next_token")
            if not next_token or not new_rows:
                break

        return records

    async def build_dashboard(self, refresh: bool = False) -> Dict[str, Any]:
        """Fetch WHOOP data and compute dashboard-friendly summaries."""
        if refresh:
            self.client.clear_cache()

        auth_status = self.client.get_auth_status()
        if auth_status.get("status") == "no_tokens":
            return self._empty_payload(
                auth_status,
                "No WHOOP tokens were found for the local dashboard.",
                "Run `python3 setup.py` in this repo, authorize WHOOP once, then refresh the page.",
            )

        (
            profile_result,
            body_result,
            recovery_result,
            sleep_result,
            workout_result,
            cycle_result,
        ) = await asyncio.gather(
            self._safe_fetch(self.client.get_user_profile()),
            self._safe_fetch(self.client.get_body_measurements()),
            self._safe_fetch(self._fetch_all_records("/recovery")),
            self._safe_fetch(self._fetch_all_records("/activity/sleep")),
            self._safe_fetch(self._fetch_all_records("/activity/workout")),
            self._safe_fetch(self._fetch_all_records("/cycle")),
        )

        sources = {
            "bodyMeasurements": {
                "available": body_result["error"] is None,
                "count": 1 if body_result["data"] else 0,
                "message": body_result["error"],
            },
            "recovery": {
                "available": recovery_result["error"] is None,
                "count": len(recovery_result["data"] or []),
                "message": recovery_result["error"],
            },
            "sleep": {
                "available": sleep_result["error"] is None,
                "count": len(sleep_result["data"] or []),
                "message": sleep_result["error"],
            },
            "workouts": {
                "available": workout_result["error"] is None,
                "count": len(workout_result["data"] or []),
                "message": workout_result["error"],
            },
            "cycles": {
                "available": cycle_result["error"] is None,
                "count": len(cycle_result["data"] or []),
                "message": cycle_result["error"],
            },
        }

        if (
            profile_result["error"]
            and body_result["error"]
            and recovery_result["error"]
            and sleep_result["error"]
            and workout_result["error"]
            and cycle_result["error"]
        ):
            return self._empty_payload(
                auth_status,
                "The dashboard could not load WHOOP data.",
                profile_result["error"],
                sources=sources,
            )

        return self._build_payload(
            profile_result["data"] or {},
            body_result["data"] or {},
            auth_status,
            recovery_result["data"] or [],
            sleep_result["data"] or [],
            workout_result["data"] or [],
            cycle_result["data"] or [],
            sources,
        )

    def _empty_payload(
        self,
        auth_status: Dict[str, Any],
        title: str,
        message: str,
        sources: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Return a frontend-safe empty payload instead of surfacing a 500."""
        return {
            "generatedAt": self._timestamp(),
            "profile": {
                "firstName": None,
                "lastName": None,
                "email": None,
                "userId": None,
            },
            "bodyMeasurements": {
                "heightMeter": None,
                "weightKilogram": None,
                "maxHeartRate": None,
            },
            "authStatus": auth_status,
            "dateRange": {"start": None, "end": None, "days": 0},
            "sources": sources
            or {
                "bodyMeasurements": {"available": False, "count": 0, "message": None},
                "recovery": {"available": False, "count": 0, "message": None},
                "sleep": {"available": False, "count": 0, "message": None},
                "workouts": {"available": False, "count": 0, "message": None},
                "cycles": {"available": False, "count": 0, "message": None},
            },
            "cards": [],
            "insights": [],
            "highlights": [],
            "series": {"recovery": [], "sleep": [], "workouts": [], "cycles": []},
            "recentDays": [],
            "monthly": [],
            "metrics": {
                "body": {},
                "recovery": {},
                "sleep": {},
                "workouts": {},
                "cycles": {},
                "correlations": [],
            },
            "rawSnapshots": {},
            "errorState": {
                "title": title,
                "message": message,
            },
        }

    def _build_payload(
        self,
        profile: Dict[str, Any],
        body_measurements: Dict[str, Any],
        auth_status: Dict[str, Any],
        recovery: List[Dict[str, Any]],
        sleep: List[Dict[str, Any]],
        workouts: List[Dict[str, Any]],
        cycles: List[Dict[str, Any]],
        sources: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Transform raw WHOOP records into dashboard sections."""
        recovery.sort(key=lambda row: parse_datetime(row.get("created_at")) or UTC_MIN)
        sleep.sort(key=lambda row: parse_datetime(row.get("start")) or UTC_MIN)
        workouts.sort(key=lambda row: parse_datetime(row.get("start")) or UTC_MIN)
        cycles.sort(key=lambda row: parse_datetime(row.get("start")) or UTC_MIN)

        all_dates = [
            parse_datetime(recovery[0].get("created_at")) if recovery else None,
            parse_datetime(sleep[0].get("start")) if sleep else None,
            parse_datetime(workouts[0].get("start")) if workouts else None,
            parse_datetime(cycles[0].get("start")) if cycles else None,
            parse_datetime(recovery[-1].get("created_at")) if recovery else None,
            parse_datetime(sleep[-1].get("start")) if sleep else None,
            parse_datetime(workouts[-1].get("start")) if workouts else None,
            parse_datetime(cycles[-1].get("start")) if cycles else None,
        ]
        filtered_dates = [value for value in all_dates if value]
        if filtered_dates:
            latest_date = max(filtered_dates).date()
            date_range = {
                "start": min(filtered_dates).date().isoformat(),
                "end": latest_date.isoformat(),
                "days": (max(filtered_dates) - min(filtered_dates)).days + 1,
            }
        else:
            latest_date = None
            date_range = {"start": None, "end": None, "days": 0}

        recovery_series = []
        recovery_scores = []
        hrv_values = []
        rhr_values = []
        spo2_values = []
        skin_temp_values = []
        for record in recovery:
            score = record.get("score") or {}
            entry = {
                "date": record.get("created_at", "")[:10],
                "recoveryScore": score.get("recovery_score"),
                "hrv": round_value(score.get("hrv_rmssd_milli")),
                "restingHeartRate": score.get("resting_heart_rate"),
                "spo2": round_value(score.get("spo2_percentage")),
                "skinTempC": round_value(score.get("skin_temp_celsius")),
            }
            recovery_series.append(entry)
            recovery_scores.append(entry["recoveryScore"])
            hrv_values.append(entry["hrv"])
            rhr_values.append(entry["restingHeartRate"])
            spo2_values.append(entry["spo2"])
            skin_temp_values.append(entry["skinTempC"])

        sleep_series = []
        sleep_performance_values = []
        sleep_efficiency_values = []
        sleep_consistency_values = []
        sleep_hours_values = []
        sleep_need_values = []
        sleep_debt_values = []
        sleep_gap_values = []
        respiratory_rate_values = []
        for record in sleep:
            score = record.get("score") or {}
            actual_hours = sleep_actual_hours(record)
            need_hours = sleep_need_hours(record)
            debt_hours = sleep_debt_hours(record)
            gap_hours = round_value(need_hours - actual_hours) if need_hours is not None and actual_hours is not None else None
            entry = {
                "date": record.get("start", "")[:10],
                "isNap": bool(record.get("nap")),
                "sleepPerformance": score.get("sleep_performance_percentage"),
                "sleepEfficiency": round_value(score.get("sleep_efficiency_percentage")),
                "sleepConsistency": score.get("sleep_consistency_percentage"),
                "actualHours": actual_hours,
                "needHours": need_hours,
                "debtHours": debt_hours,
                "gapHours": gap_hours,
                "respiratoryRate": round_value(score.get("respiratory_rate")),
            }
            sleep_series.append(entry)
            sleep_performance_values.append(entry["sleepPerformance"])
            sleep_efficiency_values.append(entry["sleepEfficiency"])
            sleep_consistency_values.append(entry["sleepConsistency"])
            sleep_hours_values.append(entry["actualHours"])
            sleep_need_values.append(entry["needHours"])
            sleep_debt_values.append(entry["debtHours"])
            sleep_gap_values.append(entry["gapHours"])
            respiratory_rate_values.append(entry["respiratoryRate"])

        workout_records = []
        workout_duration_values = []
        workout_strain_values = []
        workout_hr_values = []
        workout_max_hr_values = []
        sports_counter: Counter[str] = Counter()
        daily_workouts: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "date": None,
                "totalStrain": 0.0,
                "totalDurationMinutes": 0.0,
                "sessions": 0,
                "averageHeartRate": [],
                "labels": [],
            }
        )
        for record in workouts:
            score = record.get("score") or {}
            duration_minutes = workout_duration_minutes(record)
            exercise_date = record.get("start", "")[:10]
            sports_counter[record.get("sport_name") or "unknown"] += 1

            workout_entry = {
                "date": exercise_date,
                "sport": record.get("sport_name"),
                "durationMinutes": duration_minutes,
                "strain": round_value(score.get("strain")),
                "averageHeartRate": score.get("average_heart_rate"),
                "maxHeartRate": score.get("max_heart_rate"),
            }
            workout_records.append(workout_entry)

            workout_duration_values.append(duration_minutes)
            workout_strain_values.append(workout_entry["strain"])
            workout_hr_values.append(workout_entry["averageHeartRate"])
            workout_max_hr_values.append(workout_entry["maxHeartRate"])

            bucket = daily_workouts[exercise_date]
            bucket["date"] = exercise_date
            bucket["sessions"] += 1
            bucket["labels"].append(record.get("sport_name") or "activity")
            if workout_entry["strain"] is not None:
                bucket["totalStrain"] += workout_entry["strain"]
            if duration_minutes is not None:
                bucket["totalDurationMinutes"] += duration_minutes
            if workout_entry["averageHeartRate"] is not None:
                bucket["averageHeartRate"].append(workout_entry["averageHeartRate"])

        workout_series = []
        for row in sorted(daily_workouts.values(), key=lambda item: item["date"] or ""):
            workout_series.append(
                {
                    "date": row["date"],
                    "totalStrain": round_value(row["totalStrain"]),
                    "totalDurationMinutes": round_value(row["totalDurationMinutes"]),
                    "sessions": row["sessions"],
                    "averageHeartRate": mean(row["averageHeartRate"]),
                    "label": ", ".join(row["labels"]),
                }
            )

        cycle_series = []
        cycle_strain_values = []
        cycle_kilojoule_values = []
        cycle_hr_values = []
        cycle_max_hr_values = []
        for record in cycles:
            score = record.get("score") or {}
            entry = {
                "date": record.get("start", "")[:10],
                "strain": round_value(score.get("strain")),
                "kilojoule": round_value(score.get("kilojoule")),
                "averageHeartRate": score.get("average_heart_rate"),
                "maxHeartRate": score.get("max_heart_rate"),
            }
            cycle_series.append(entry)
            cycle_strain_values.append(entry["strain"])
            cycle_kilojoule_values.append(entry["kilojoule"])
            cycle_hr_values.append(entry["averageHeartRate"])
            cycle_max_hr_values.append(entry["maxHeartRate"])

        monthly_rollup: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "recovery": [],
                "sleepPerformance": [],
                "sleepHours": [],
                "sleepGap": [],
                "workoutCount": 0,
                "workoutMinutes": 0.0,
                "workoutStrain": [],
            }
        )

        for entry in recovery_series:
            month_key = entry["date"][:7]
            monthly_rollup[month_key]["recovery"].append(entry["recoveryScore"])
        for entry in sleep_series:
            month_key = entry["date"][:7]
            monthly_rollup[month_key]["sleepPerformance"].append(entry["sleepPerformance"])
            monthly_rollup[month_key]["sleepHours"].append(entry["actualHours"])
            monthly_rollup[month_key]["sleepGap"].append(entry["gapHours"])
        for entry in workout_records:
            month_key = entry["date"][:7]
            monthly_rollup[month_key]["workoutCount"] += 1
            if entry["durationMinutes"] is not None:
                monthly_rollup[month_key]["workoutMinutes"] += entry["durationMinutes"]
            monthly_rollup[month_key]["workoutStrain"].append(entry["strain"])

        monthly_series = []
        for month_key in sorted(monthly_rollup.keys()):
            row = monthly_rollup[month_key]
            monthly_series.append(
                {
                    "month": month_key,
                    "label": format_month(month_key),
                    "avgRecovery": mean(row["recovery"]),
                    "avgSleepPerformance": mean(row["sleepPerformance"]),
                    "avgSleepHours": mean(row["sleepHours"]),
                    "avgSleepGapHours": mean(row["sleepGap"]),
                    "workoutCount": row["workoutCount"],
                    "workoutHours": round_value(row["workoutMinutes"] / 60, 2),
                    "avgWorkoutStrain": mean(row["workoutStrain"]),
                }
            )

        recent_recovery = last_n(recovery_scores, 7)
        previous_recovery = recovery_scores[-14:-7]
        recent_sleep_performance = last_n(sleep_performance_values, 7)
        previous_sleep_performance = sleep_performance_values[-14:-7]
        recent_sleep_hours = last_n(sleep_hours_values, 7)
        recent_sleep_gap = last_n(sleep_gap_values, 7)
        nightly_sleep_series = [entry for entry in sleep_series if not entry["isNap"]] or sleep_series
        nightly_sleep_debt_values = [entry["debtHours"] for entry in nightly_sleep_series]
        latest_sleep_debt = nightly_sleep_debt_values[-1] if nightly_sleep_debt_values else None
        previous_sleep_debt = nightly_sleep_debt_values[-2] if len(nightly_sleep_debt_values) > 1 else None
        recent_recovery_average = mean(recent_recovery)
        previous_recovery_average = mean(previous_recovery)
        recent_sleep_performance_average = mean(recent_sleep_performance)
        previous_sleep_performance_average = mean(previous_sleep_performance)
        recent_sleep_gap_average = mean(recent_sleep_gap)

        recent_window_start = (
            (latest_date - timedelta(days=6)).isoformat() if latest_date else None
        )
        recent_workout_records = [
            row
            for row in workout_records
            if recent_window_start and row["date"] >= recent_window_start
        ]
        recent_workout_sessions = len(recent_workout_records)
        recent_workout_average_strain = mean(
            [row["strain"] for row in recent_workout_records]
        )
        recent_workout_hours = round_value(
            sum((row["durationMinutes"] or 0) for row in recent_workout_records) / 60,
            2,
        )

        recovery_by_date = {
            entry["date"]: entry["recoveryScore"]
            for entry in recovery_series
            if entry["date"] and entry["recoveryScore"] is not None
        }
        sleep_performance_by_date = {
            entry["date"]: entry["sleepPerformance"]
            for entry in sleep_series
            if entry["date"] and entry["sleepPerformance"] is not None
        }
        sleep_gap_by_date = {
            entry["date"]: entry["gapHours"]
            for entry in sleep_series
            if entry["date"] and entry["gapHours"] is not None
        }
        workout_strain_by_date = {
            entry["date"]: entry["totalStrain"]
            for entry in workout_series
            if entry["date"] and entry["totalStrain"] is not None
        }

        sleep_perf_dates = sorted(set(recovery_by_date) & set(sleep_performance_by_date))
        sleep_gap_dates = sorted(set(recovery_by_date) & set(sleep_gap_by_date))
        workout_dates = sorted(set(recovery_by_date) & set(workout_strain_by_date))

        sleep_perf_corr = pearson(
            [sleep_performance_by_date[day] for day in sleep_perf_dates],
            [recovery_by_date[day] for day in sleep_perf_dates],
        )
        sleep_gap_corr = pearson(
            [sleep_gap_by_date[day] for day in sleep_gap_dates],
            [recovery_by_date[day] for day in sleep_gap_dates],
        )
        workout_corr = pearson(
            [workout_strain_by_date[day] for day in workout_dates],
            [recovery_by_date[day] for day in workout_dates],
        )

        best_recovery = max(
            recovery_series,
            key=lambda entry: entry["recoveryScore"] if entry["recoveryScore"] is not None else -1,
            default=None,
        )
        worst_recovery = min(
            recovery_series,
            key=lambda entry: entry["recoveryScore"] if entry["recoveryScore"] is not None else 999,
            default=None,
        )
        best_sleep = max(
            sleep_series,
            key=lambda entry: entry["sleepPerformance"] if entry["sleepPerformance"] is not None else -1,
            default=None,
        )
        worst_sleep = min(
            sleep_series,
            key=lambda entry: entry["sleepPerformance"] if entry["sleepPerformance"] is not None else 999,
            default=None,
        )
        hardest_workout = max(
            workout_records,
            key=lambda entry: entry["strain"] if entry["strain"] is not None else -1,
            default=None,
        )

        latest_month = monthly_series[-1] if monthly_series else None
        previous_month = monthly_series[-2] if len(monthly_series) > 1 else None

        summary_cards = [
            {
                "id": "recovery",
                "title": "Recovery",
                "value": recent_recovery_average,
                "suffix": "",
                "delta": delta(recent_recovery_average, previous_recovery_average),
                "deltaLabel": "vs prior 7 days",
                "sparkline": last_n(recovery_scores, 14),
                "deltaFormat": "signed",
                "deltaSuffix": "",
                "deltaDigits": 1,
                "tone": "positive"
                if delta(recent_recovery_average, previous_recovery_average)
                and delta(recent_recovery_average, previous_recovery_average) > 0
                else "neutral",
                "detail": f"{sum(1 for value in recovery_scores if value is not None and value >= 67)} high-recovery days",
            },
            {
                "id": "sleep-hours",
                "title": "Sleep",
                "value": mean(recent_sleep_hours),
                "suffix": "h",
                "delta": delta(
                    recent_sleep_performance_average,
                    previous_sleep_performance_average,
                ),
                "deltaLabel": "sleep performance vs prior 7 days",
                "sparkline": last_n(sleep_hours_values, 14),
                "deltaFormat": "signed",
                "deltaSuffix": " pts",
                "deltaDigits": 1,
                "tone": "positive",
                "detail": f"{recent_sleep_gap_average}h average gap to need",
            },
            {
                "id": "sleep-debt",
                "title": "Sleep Debt",
                "value": latest_sleep_debt,
                "suffix": "h",
                "delta": delta(latest_sleep_debt, previous_sleep_debt),
                "deltaLabel": "vs prior overnight sleep",
                "sparkline": last_n(nightly_sleep_debt_values, 14),
                "deltaFormat": "signed",
                "deltaSuffix": "h",
                "deltaDigits": 2,
                "tone": "positive"
                if latest_sleep_debt == 0
                else "warning",
                "detail": "WHOOP debt from the latest overnight sleep record",
            },
            {
                "id": "workouts",
                "title": "Training Load",
                "value": recent_workout_sessions,
                "suffix": " sessions",
                "delta": recent_workout_average_strain,
                "deltaLabel": "avg strain in last 7 days",
                "sparkline": last_n([row["totalStrain"] for row in workout_series], 14),
                "deltaFormat": "plain",
                "deltaSuffix": "",
                "deltaDigits": 2,
                "tone": "neutral",
                "detail": f"{recent_workout_hours} hours logged in the recent week",
            },
            {
                "id": "cycle-strain",
                "title": "Cycle Strain",
                "value": mean(last_n(cycle_strain_values, 7)),
                "suffix": "",
                "delta": mean(last_n(cycle_kilojoule_values, 7)),
                "deltaLabel": "avg kJ in last 7 cycles",
                "sparkline": last_n(cycle_strain_values, 14),
                "deltaFormat": "plain",
                "deltaSuffix": "",
                "deltaDigits": 1,
                "tone": "neutral",
                "detail": f"Peak HR averages {mean(cycle_max_hr_values)} bpm",
            },
        ]

        insights = [
            {
                "title": "Recovery is trending up",
                "body": (
                    f"Your latest 7-day recovery average is {recent_recovery_average}, "
                    f"up {delta(recent_recovery_average, previous_recovery_average)} points from the prior week."
                ),
            },
            {
                "title": "Sleep quantity is the main constraint",
                "body": (
                    f"You average {mean(sleep_hours_values)} hours of sleep against "
                    f"{mean(sleep_need_values)} hours needed, leaving a {mean(sleep_gap_values)} hour nightly gap."
                ),
            },
            {
                "title": "Sleep quality maps to recovery",
                "body": (
                    f"Sleep performance and recovery move together with a {correlation_label(sleep_perf_corr)} "
                    f"relationship (r={sleep_perf_corr})."
                ),
            },
        ]
        if latest_month and previous_month:
            insights.append(
                {
                    "title": f"{latest_month['label']} is trending better",
                    "body": (
                        f"{latest_month['label']} shows sleep performance at {latest_month['avgSleepPerformance']}% "
                        f"versus {previous_month['avgSleepPerformance']}% in {previous_month['label']}, "
                        f"with sleep gap narrowing from {previous_month['avgSleepGapHours']}h to {latest_month['avgSleepGapHours']}h."
                    ),
                }
            )

        highlights = [
            {
                "title": "Best recovery",
                "value": (
                    f"{best_recovery['recoveryScore']} on {best_recovery['date']}"
                    if best_recovery
                    else "Not available"
                ),
                "detail": (
                    f"HRV {best_recovery['hrv']}, RHR {best_recovery['restingHeartRate']}"
                    if best_recovery
                    else ""
                ),
                "tone": "positive",
            },
            {
                "title": "Lowest recovery",
                "value": (
                    f"{worst_recovery['recoveryScore']} on {worst_recovery['date']}"
                    if worst_recovery
                    else "Not available"
                ),
                "detail": (
                    f"HRV {worst_recovery['hrv']}, RHR {worst_recovery['restingHeartRate']}"
                    if worst_recovery
                    else ""
                ),
                "tone": "warning",
            },
            {
                "title": "Best sleep night",
                "value": (
                    f"{best_sleep['sleepPerformance']}% on {best_sleep['date']}"
                    if best_sleep
                    else "Not available"
                ),
                "detail": (
                    f"{best_sleep['actualHours']}h asleep, {best_sleep['gapHours']}h gap"
                    if best_sleep
                    else ""
                ),
                "tone": "positive",
            },
            {
                "title": "Hardest workout",
                "value": (
                    f"{hardest_workout['sport']} on {hardest_workout['date']}"
                    if hardest_workout
                    else "Not available"
                ),
                "detail": (
                    f"Strain {hardest_workout['strain']}, {hardest_workout['durationMinutes']} minutes"
                    if hardest_workout
                    else ""
                ),
                "tone": "neutral",
            },
            {
                "title": "Body snapshot",
                "value": (
                    f"{round_value(body_measurements.get('weight_kilogram'))} kg at "
                    f"{round_value(body_measurements.get('height_meter'), 2)} m"
                    if body_measurements
                    else "Not available"
                ),
                "detail": (
                    f"Max heart rate {body_measurements.get('max_heart_rate')} bpm"
                    if body_measurements.get("max_heart_rate") is not None
                    else ""
                ),
                "tone": "neutral",
            },
        ]

        recent_days = []
        recent_recovery_map = {entry["date"]: entry for entry in recovery_series}
        recent_sleep_map = {entry["date"]: entry for entry in sleep_series}
        recent_workout_map = {entry["date"]: entry for entry in workout_series}
        recent_cycle_map = {entry["date"]: entry for entry in cycle_series}
        union_dates = sorted(
            set(recent_recovery_map)
            | set(recent_sleep_map)
            | set(recent_workout_map)
            | set(recent_cycle_map)
        )[-7:]
        for day in union_dates:
            recovery_entry = recent_recovery_map.get(day, {})
            sleep_entry = recent_sleep_map.get(day, {})
            workout_entry = recent_workout_map.get(day, {})
            cycle_entry = recent_cycle_map.get(day, {})
            recent_days.append(
                {
                    "date": day,
                    "recoveryScore": recovery_entry.get("recoveryScore"),
                    "hrv": recovery_entry.get("hrv"),
                    "restingHeartRate": recovery_entry.get("restingHeartRate"),
                    "sleepHours": sleep_entry.get("actualHours"),
                    "sleepNeedHours": sleep_entry.get("needHours"),
                    "sleepDebtHours": sleep_entry.get("debtHours"),
                    "sleepGapHours": sleep_entry.get("gapHours"),
                    "sleepPerformance": sleep_entry.get("sleepPerformance"),
                    "workoutSessions": workout_entry.get("sessions", 0),
                    "workoutStrain": workout_entry.get("totalStrain"),
                    "workoutMinutes": workout_entry.get("totalDurationMinutes"),
                    "skinTempC": recovery_entry.get("skinTempC"),
                    "spo2": recovery_entry.get("spo2"),
                    "respiratoryRate": sleep_entry.get("respiratoryRate"),
                    "cycleStrain": cycle_entry.get("strain"),
                }
            )

        return {
            "generatedAt": self._timestamp(),
            "profile": {
                "firstName": profile.get("first_name"),
                "lastName": profile.get("last_name"),
                "email": profile.get("email"),
                "userId": profile.get("user_id"),
            },
            "bodyMeasurements": {
                "heightMeter": round_value(body_measurements.get("height_meter")),
                "weightKilogram": round_value(body_measurements.get("weight_kilogram")),
                "maxHeartRate": body_measurements.get("max_heart_rate"),
            },
            "authStatus": auth_status,
            "dateRange": date_range,
            "sources": sources,
            "errorState": None,
            "cards": summary_cards,
            "insights": insights,
            "highlights": highlights,
            "series": {
                "recovery": recovery_series,
                "sleep": sleep_series,
                "workouts": workout_series,
                "cycles": cycle_series,
            },
            "recentDays": recent_days,
            "monthly": monthly_series,
            "metrics": {
                "body": {
                    "heightMeter": round_value(body_measurements.get("height_meter")),
                    "weightKilogram": round_value(body_measurements.get("weight_kilogram")),
                    "maxHeartRate": body_measurements.get("max_heart_rate"),
                },
                "recovery": {
                    "average": mean(recovery_scores),
                    "median": median(recovery_scores),
                    "highDays": sum(
                        1 for value in recovery_scores if value is not None and value >= 67
                    ),
                    "lowDays": sum(
                        1 for value in recovery_scores if value is not None and value < 34
                    ),
                    "averageHrv": mean(hrv_values),
                    "averageRestingHeartRate": mean(rhr_values),
                    "averageSpo2": mean(spo2_values),
                    "averageSkinTempC": mean(skin_temp_values),
                },
                "sleep": {
                    "averagePerformance": mean(sleep_performance_values),
                    "averageEfficiency": mean(sleep_efficiency_values),
                    "averageConsistency": mean(sleep_consistency_values),
                    "averageHours": mean(sleep_hours_values),
                    "averageNeedHours": mean(sleep_need_values),
                    "averageDebtHours": mean(sleep_debt_values),
                    "averageGapHours": mean(sleep_gap_values),
                    "currentDebtHours": latest_sleep_debt,
                    "averageRespiratoryRate": mean(respiratory_rate_values),
                },
                "workouts": {
                    "count": len(workouts),
                    "averageDurationMinutes": mean(workout_duration_values),
                    "totalDurationHours": round_value(
                        sum(value or 0 for value in workout_duration_values) / 60, 2
                    ),
                    "averageStrain": mean(workout_strain_values),
                    "averageHeartRate": mean(workout_hr_values),
                    "averageMaxHeartRate": mean(workout_max_hr_values),
                    "sports": sports_counter.most_common(),
                },
                "cycles": {
                    "count": len(cycles),
                    "averageStrain": mean(cycle_strain_values),
                    "averageKilojoule": mean(cycle_kilojoule_values),
                    "averageHeartRate": mean(cycle_hr_values),
                    "averageMaxHeartRate": mean(cycle_max_hr_values),
                },
                "correlations": [
                    {
                        "label": "Sleep performance vs recovery",
                        "value": sleep_perf_corr,
                        "description": correlation_label(sleep_perf_corr),
                        "samples": len(sleep_perf_dates),
                    },
                    {
                        "label": "Sleep gap vs recovery",
                        "value": sleep_gap_corr,
                        "description": correlation_label(sleep_gap_corr),
                        "samples": len(sleep_gap_dates),
                    },
                    {
                        "label": "Same-day workout strain vs recovery",
                        "value": workout_corr,
                        "description": correlation_label(workout_corr),
                        "samples": len(workout_dates),
                    },
                ],
            },
            "rawSnapshots": {
                "profile": profile,
                "bodyMeasurements": body_measurements,
                "recovery": recovery[-2:],
                "sleep": sleep[-2:],
                "workouts": workouts[-2:],
                "cycles": cycles[-2:],
            },
        }
