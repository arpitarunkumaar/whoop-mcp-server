"""
WHOOP dashboard analysis helpers.
"""
import asyncio
import hashlib
import json
import math
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from whoop_client import WhoopClient


MAX_PAGE_SIZE = 25
UTC_MIN = datetime.min.replace(tzinfo=timezone.utc)
EXPORT_DIR_PREFIX = "whoop-export-"
EXPORT_TIMESTAMP_PATTERN = re.compile(r"^whoop-export-(\d{8}T\d{6}Z)$")

SINGLE_EXPORT_FILES = {
    "profile": "profile.json",
    "bodyMeasurements": "body_measurements.json",
}

COLLECTION_EXPORT_FILES = {
    "recovery": "recovery.json",
    "sleep": "sleep.json",
    "workouts": "workouts.json",
    "cycles": "cycles.json",
}


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


def std_dev(values: Iterable[Optional[float]], digits: int = 2) -> Optional[float]:
    """Compute standard deviation."""
    cleaned = [value for value in values if value is not None]
    if len(cleaned) < 2:
        return None
    return round(statistics.stdev(cleaned), digits)


def calculate_ns_state(current_hrv: Optional[float], hrv_mean: Optional[float], hrv_stdev: Optional[float],
                       current_rhr: Optional[float], rhr_mean: Optional[float], rhr_stdev: Optional[float]) -> str:
    """Classify Nervous System State based on 30-day baselines vs current day."""
    if None in (current_hrv, hrv_mean, hrv_stdev, current_rhr, rhr_mean, rhr_stdev):
        return "Unknown"

    if hrv_stdev == 0 or rhr_stdev == 0:
        return "Balanced"

    hrv_z = (current_hrv - hrv_mean) / hrv_stdev
    rhr_z = (rhr_mean - current_rhr) / rhr_stdev  # Inverted: lower RHR is better

    ns_score = hrv_z + rhr_z

    if ns_score > 1.0:
        return "Parasympathetic Dominant"
    elif ns_score < -1.5 and hrv_z < -1.0:
        return "Suppressed"
    elif ns_score < -1.0 and rhr_z < 0:
        return "Sympathetic Dominant"
    else:
        return "Balanced"


def calculate_daily_decision(recovery_score: Optional[float], ns_state: str) -> Dict[str, str]:
    """Generate daily action recommendations based on recovery and NS state."""
    if recovery_score is None:
        return {"action": "Gathering data", "optimal_strain": "Unknown"}

    if recovery_score > 66 and ns_state == "Parasympathetic Dominant":
        return {"action": "Prime for high strain. Push intensity.", "optimal_strain": "14-18"}
    elif recovery_score > 66:
        return {"action": "System adaptable. Normal training load.", "optimal_strain": "12-16"}
    elif recovery_score >= 34:
        if ns_state in ("Suppressed", "Sympathetic Dominant"):
            return {"action": "Monitor intensity. System showing stress.", "optimal_strain": "8-12"}
        else:
            return {"action": "Maintain moderate strain. Focus on volume, not intensity.", "optimal_strain": "10-14"}
    else:
        return {"action": "Prioritize active recovery. Zone 2 max 45 min.", "optimal_strain": "< 10"}


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


def milli_to_hours(value: Optional[float], digits: int = 2) -> Optional[float]:
    """Convert milliseconds to hours for dashboard display."""
    if value is None:
        return None
    return round(value / 3_600_000, digits)


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


def rolling_average(values: List[Optional[float]], window: int, digits: int = 2) -> List[Optional[float]]:
    """Compute a trailing rolling average for each position."""
    output: List[Optional[float]] = []
    for index in range(len(values)):
        chunk = values[max(0, index - window + 1) : index + 1]
        output.append(mean(chunk, digits=digits))
    return output


def shift_date(value: str, days: int) -> Optional[str]:
    """Shift an ISO date string by a day offset."""
    try:
        base = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None
    return (base + timedelta(days=days)).date().isoformat()


def record_identity(record: Dict[str, Any]) -> str:
    """Build a stable identity key for deduping WHOOP records."""
    preferred_keys = ("id", "cycle_id", "sleep_id", "created_at", "start", "end")
    for key in preferred_keys:
        value = record.get(key)
        if value not in (None, ""):
            return f"{key}:{value}"

    try:
        canonical = json.dumps(record, sort_keys=True, default=str)
    except (TypeError, ValueError):
        canonical = repr(record)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"hash:{digest}"


class DashboardAnalyzer:
    """Builds the WHOOP dashboard payload used by the local web app."""

    def __init__(
        self,
        client: Optional[WhoopClient] = None,
        data: Optional[Dict[str, Any]] = None,
        data_source: Optional[Dict[str, Any]] = None,
    ):
        self.client = client
        self.data = data
        self.data_source = data_source or {
            "mode": "offline" if data is not None else "live",
            "label": "offline" if data is not None else "live",
        }

    @staticmethod
    def _timestamp() -> str:
        """Build a consistent UTC timestamp for payloads."""
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _default_live_data_source() -> Dict[str, Any]:
        """Return metadata for live payloads."""
        return {
            "mode": "live",
            "label": "live",
            "exportDate": None,
            "exportDir": None,
        }

    @staticmethod
    def _export_date_from_dir_name(directory_name: str) -> Optional[str]:
        """Extract YYYY-MM-DD from whoop-export-YYYYMMDDTHHMMSSZ."""
        match = EXPORT_TIMESTAMP_PATTERN.match(directory_name)
        if not match:
            return None
        try:
            parsed = datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ")
        except ValueError:
            return None
        return parsed.date().isoformat()

    @classmethod
    def format_offline_data_source(cls, export_dir: Path) -> Dict[str, Any]:
        """Build human-readable metadata for offline exports."""
        export_date = cls._export_date_from_dir_name(export_dir.name)
        label = (
            f"offline (export from {export_date})"
            if export_date
            else f"offline ({export_dir.name})"
        )
        return {
            "mode": "offline",
            "label": label,
            "exportDate": export_date,
            "exportDir": str(export_dir),
        }

    @staticmethod
    def list_export_dirs(export_base: Path) -> List[Path]:
        """Return all timestamped export directories."""
        if not export_base.exists() or not export_base.is_dir():
            return []
        return sorted(
            [
                path
                for path in export_base.iterdir()
                if path.is_dir() and path.name.startswith(EXPORT_DIR_PREFIX)
            ],
            key=lambda path: path.name,
        )

    @classmethod
    def find_latest_export_dir(cls, export_base: Path) -> Optional[Path]:
        """Find the newest export directory under a base path."""
        exports = cls.list_export_dirs(export_base)
        return exports[-1] if exports else None

    @staticmethod
    def _read_export_json(path: Path) -> Any:
        """Read a JSON file from disk."""
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _unwrap_single_payload(payload: Any) -> Dict[str, Any]:
        """Normalize single-resource export payloads."""
        if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
            return payload["data"]
        if isinstance(payload, dict):
            return payload
        return {}

    @staticmethod
    def _unwrap_collection_payload(payload: Any) -> List[Dict[str, Any]]:
        """Normalize collection export payloads."""
        if isinstance(payload, dict) and isinstance(payload.get("records"), list):
            return payload["records"]
        if isinstance(payload, list):
            return payload
        return []

    @classmethod
    def load_from_export(cls, export_dir: Path) -> Dict[str, Any]:
        """Load profile/body/collections from an export directory."""
        resolved = export_dir.expanduser().resolve()
        if not resolved.exists() or not resolved.is_dir():
            raise FileNotFoundError(f"Export directory not found: {resolved}")

        profile_path = resolved / SINGLE_EXPORT_FILES["profile"]
        body_path = resolved / SINGLE_EXPORT_FILES["bodyMeasurements"]
        recovery_path = resolved / COLLECTION_EXPORT_FILES["recovery"]
        sleep_path = resolved / COLLECTION_EXPORT_FILES["sleep"]
        workouts_path = resolved / COLLECTION_EXPORT_FILES["workouts"]
        cycles_path = resolved / COLLECTION_EXPORT_FILES["cycles"]

        profile_payload = cls._read_export_json(profile_path) if profile_path.exists() else {}
        body_payload = cls._read_export_json(body_path) if body_path.exists() else {}
        recovery_payload = cls._read_export_json(recovery_path) if recovery_path.exists() else {"records": []}
        sleep_payload = cls._read_export_json(sleep_path) if sleep_path.exists() else {"records": []}
        workouts_payload = cls._read_export_json(workouts_path) if workouts_path.exists() else {"records": []}
        cycles_payload = cls._read_export_json(cycles_path) if cycles_path.exists() else {"records": []}

        auth_status_path = resolved / "auth_status.json"
        auth_status = (
            cls._read_export_json(auth_status_path)
            if auth_status_path.exists()
            else {"status": "offline_export"}
        )
        if not isinstance(auth_status, dict):
            auth_status = {"status": "offline_export"}
        auth_status.setdefault("status", "offline_export")

        return {
            "profile": cls._unwrap_single_payload(profile_payload),
            "bodyMeasurements": cls._unwrap_single_payload(body_payload),
            "recovery": cls._unwrap_collection_payload(recovery_payload),
            "sleep": cls._unwrap_collection_payload(sleep_payload),
            "workouts": cls._unwrap_collection_payload(workouts_payload),
            "cycles": cls._unwrap_collection_payload(cycles_payload),
            "authStatus": auth_status,
            "dataSource": cls.format_offline_data_source(resolved),
        }

    @classmethod
    def load_latest_export(cls, export_base: Path) -> Dict[str, Any]:
        """Load the newest available export from the base directory."""
        latest = cls.find_latest_export_dir(export_base.expanduser().resolve())
        if latest is None:
            raise FileNotFoundError(f"No exports found in {export_base}")
        return cls.load_from_export(latest)

    async def _safe_fetch(self, coroutine: Any) -> Dict[str, Any]:
        """Capture endpoint failures without aborting the whole dashboard."""
        try:
            return {"data": await coroutine, "error": None}
        except Exception as exc:
            return {"data": None, "error": str(exc)}

    @staticmethod
    def _source_summary(data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Build source availability metadata from normalized records."""
        return {
            "bodyMeasurements": {
                "available": bool(data.get("bodyMeasurements")),
                "count": 1 if data.get("bodyMeasurements") else 0,
                "message": None,
            },
            "recovery": {
                "available": True,
                "count": len(data.get("recovery") or []),
                "message": None,
            },
            "sleep": {
                "available": True,
                "count": len(data.get("sleep") or []),
                "message": None,
            },
            "workouts": {
                "available": True,
                "count": len(data.get("workouts") or []),
                "message": None,
            },
            "cycles": {
                "available": True,
                "count": len(data.get("cycles") or []),
                "message": None,
            },
        }

    async def _fetch_all_records(self, endpoint: str) -> List[Dict[str, Any]]:
        """Fetch every page from a WHOOP endpoint using cursor pagination."""
        records: List[Dict[str, Any]] = []
        seen_keys = set()
        seen_page_tokens = set()
        next_token: Optional[str] = None

        while True:
            params: Dict[str, Any] = {"limit": MAX_PAGE_SIZE}
            if next_token:
                if next_token in seen_page_tokens:
                    break
                seen_page_tokens.add(next_token)
                params["nextToken"] = next_token

            payload = await self.client._make_request(endpoint, params)
            page = payload.get("records", [])
            if not page:
                break

            for record in page:
                record_key = record_identity(record)
                if record_key in seen_keys:
                    continue
                seen_keys.add(record_key)
                records.append(record)

            next_token = payload.get("next_token") or payload.get("nextToken")
            if not next_token:
                break

        return records

    async def build_dashboard(self, refresh: bool = False) -> Dict[str, Any]:
        """Fetch WHOOP data and compute dashboard-friendly summaries."""
        if self.data is not None:
            offline_auth = self.data.get("authStatus") or {"status": "offline_export"}
            return self._build_payload(
                self.data.get("profile") or {},
                self.data.get("bodyMeasurements") or {},
                offline_auth,
                self.data.get("recovery") or [],
                self.data.get("sleep") or [],
                self.data.get("workouts") or [],
                self.data.get("cycles") or [],
                self._source_summary(self.data),
                data_source=self.data.get("dataSource") or self.data_source,
            )

        if self.client is None:
            raise ValueError("A WHOOP client is required for live dashboard mode.")

        if refresh:
            self.client.clear_cache()

        auth_status = self.client.get_auth_status()
        if auth_status.get("status") == "no_tokens":
            return self._empty_payload(
                auth_status,
                "No WHOOP tokens were found for the local dashboard.",
                "Run `python3.11 setup.py --client-id YOUR_ID --client-secret YOUR_SECRET`, then refresh the page.",
                data_source=self._default_live_data_source(),
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
                data_source=self._default_live_data_source(),
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
            data_source=self._default_live_data_source(),
        )

    def _empty_payload(
        self,
        auth_status: Dict[str, Any],
        title: str,
        message: str,
        sources: Optional[Dict[str, Dict[str, Any]]] = None,
        data_source: Optional[Dict[str, Any]] = None,
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
            "dataSource": data_source or self.data_source or self._default_live_data_source(),
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
            "series": {
                "recovery": [],
                "sleep": [],
                "workouts": [],
                "workoutSessions": [],
                "cycles": [],
            },
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
            "rawData": {
                "profile": {},
                "bodyMeasurements": {},
                "recovery": [],
                "sleep": [],
                "workouts": [],
                "cycles": [],
            },
            "rawSnapshots": {},
            "errorState": {
                "title": title,
                "message": message,
            },
        }

    def _build_insights(
        self,
        recent_recovery_average: Optional[float],
        previous_recovery_average: Optional[float],
        sleep_hours_values: List[Optional[float]],
        sleep_need_values: List[Optional[float]],
        sleep_gap_values: List[Optional[float]],
        sleep_perf_corr: Optional[float],
        latest_month: Optional[Dict[str, Any]],
        previous_month: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build narrative dashboard insights from aggregated metrics."""
        recovery_delta = delta(recent_recovery_average, previous_recovery_average)
        if recovery_delta is None:
            recovery_title = "Recovery trend is unclear"
            recovery_body = (
                "There is not enough history to compare the latest 7-day recovery window "
                "against the prior week."
            )
        elif recovery_delta > 0:
            recovery_title = "Recovery is trending up"
            recovery_body = (
                f"Your latest 7-day recovery average is {recent_recovery_average}, "
                f"up {abs(recovery_delta)} points from the prior week."
            )
        elif recovery_delta < 0:
            recovery_title = "Recovery is trending down"
            recovery_body = (
                f"Your latest 7-day recovery average is {recent_recovery_average}, "
                f"down {abs(recovery_delta)} points from the prior week."
            )
        else:
            recovery_title = "Recovery is holding steady"
            recovery_body = (
                f"Your latest 7-day recovery average is {recent_recovery_average}, "
                "unchanged from the prior week."
            )

        insights = [
            {
                "title": recovery_title,
                "body": recovery_body,
            },
            {
                "title": "Sleep quantity is the main constraint"
                if (mean(sleep_gap_values) or 0) > 0
                else "Sleep quantity is covering your need",
                "body": (
                    f"You average {mean(sleep_hours_values)} hours of sleep against "
                    f"{mean(sleep_need_values)} hours needed, leaving a {mean(sleep_gap_values)} hour nightly gap."
                    if (mean(sleep_gap_values) or 0) > 0
                    else (
                        f"You average {mean(sleep_hours_values)} hours of sleep against "
                        f"{mean(sleep_need_values)} hours needed, which means you are at or above need on average."
                    )
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
            latest_gap = latest_month["avgSleepGapHours"]
            previous_gap = previous_month["avgSleepGapHours"]
            month_is_better = (
                latest_month["avgSleepPerformance"] is not None
                and previous_month["avgSleepPerformance"] is not None
                and latest_month["avgSleepPerformance"] >= previous_month["avgSleepPerformance"]
                and (
                    latest_gap is None
                    or previous_gap is None
                    or latest_gap <= previous_gap
                )
            )
            insights.append(
                {
                    "title": (
                        f"{latest_month['label']} is trending better"
                        if month_is_better
                        else f"{latest_month['label']} needs attention"
                    ),
                    "body": (
                        f"{latest_month['label']} shows sleep performance at {latest_month['avgSleepPerformance']}% "
                        f"versus {previous_month['avgSleepPerformance']}% in {previous_month['label']}, "
                        f"with sleep gap narrowing from {previous_month['avgSleepGapHours']}h to {latest_month['avgSleepGapHours']}h."
                    ),
                }
            )
        return insights

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
        data_source: Optional[Dict[str, Any]] = None,
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

        for index, value in enumerate(rolling_average(hrv_values, window=7, digits=2)):
            recovery_series[index]["hrvMovingAverage7d"] = value

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
            stage_summary = score.get("stage_summary") or {}
            actual_hours = sleep_actual_hours(record)
            need_hours = sleep_need_hours(record)
            debt_hours = sleep_debt_hours(record)
            gap_hours = round_value(need_hours - actual_hours) if need_hours is not None and actual_hours is not None else None
            entry = {
                "date": record.get("start", "")[:10],
                "isNap": bool(record.get("nap")),
                "start": record.get("start"),
                "end": record.get("end"),
                "timezoneOffset": record.get("timezone_offset"),
                "sleepPerformance": score.get("sleep_performance_percentage"),
                "sleepEfficiency": round_value(score.get("sleep_efficiency_percentage")),
                "sleepConsistency": score.get("sleep_consistency_percentage"),
                "actualHours": actual_hours,
                "needHours": need_hours,
                "debtHours": debt_hours,
                "gapHours": gap_hours,
                "respiratoryRate": round_value(score.get("respiratory_rate")),
                "inBedHours": milli_to_hours(stage_summary.get("total_in_bed_time_milli")),
                "awakeHours": milli_to_hours(stage_summary.get("total_awake_time_milli")),
                "lightSleepHours": milli_to_hours(stage_summary.get("total_light_sleep_time_milli")),
                "slowWaveSleepHours": milli_to_hours(stage_summary.get("total_slow_wave_sleep_time_milli")),
                "remSleepHours": milli_to_hours(stage_summary.get("total_rem_sleep_time_milli")),
                "sleepCycleCount": stage_summary.get("sleep_cycle_count"),
                "disturbanceCount": stage_summary.get("disturbance_count"),
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
        zone_duration_totals_milli: Dict[str, int] = {
            "zone_zero_milli": 0,
            "zone_one_milli": 0,
            "zone_two_milli": 0,
            "zone_three_milli": 0,
            "zone_four_milli": 0,
            "zone_five_milli": 0,
        }
        daily_workouts: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "date": None,
                "totalStrain": 0.0,
                "totalDurationMinutes": 0.0,
                "sessions": 0,
                "averageHeartRate": [],
                "labels": [],
                "zoneZeroMinutes": 0.0,
                "zoneOneMinutes": 0.0,
                "zoneTwoMinutes": 0.0,
                "zoneThreeMinutes": 0.0,
                "zoneFourMinutes": 0.0,
                "zoneFiveMinutes": 0.0,
            }
        )
        for record in workouts:
            score = record.get("score") or {}
            zone_durations = score.get("zone_durations") or {}
            duration_minutes = workout_duration_minutes(record)
            exercise_date = record.get("start", "")[:10]
            sports_counter[record.get("sport_name") or "unknown"] += 1
            zone_durations = score.get("zone_durations") or {}

            workout_entry = {
                "date": exercise_date,
                "start": record.get("start"),
                "end": record.get("end"),
                "timezoneOffset": record.get("timezone_offset"),
                "sport": record.get("sport_name"),
                "durationMinutes": duration_minutes,
                "strain": round_value(score.get("strain")),
                "averageHeartRate": score.get("average_heart_rate"),
                "maxHeartRate": score.get("max_heart_rate"),
                "zoneDurationsMinutes": {
                    "zone0": round_value((zone_durations.get("zone_zero_milli") or 0) / 60_000, 2),
                    "zone1": round_value((zone_durations.get("zone_one_milli") or 0) / 60_000, 2),
                    "zone2": round_value((zone_durations.get("zone_two_milli") or 0) / 60_000, 2),
                    "zone3": round_value((zone_durations.get("zone_three_milli") or 0) / 60_000, 2),
                    "zone4": round_value((zone_durations.get("zone_four_milli") or 0) / 60_000, 2),
                    "zone5": round_value((zone_durations.get("zone_five_milli") or 0) / 60_000, 2),
                },
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
            bucket["zoneZeroMinutes"] += workout_entry["zoneDurationsMinutes"]["zone0"] or 0.0
            bucket["zoneOneMinutes"] += workout_entry["zoneDurationsMinutes"]["zone1"] or 0.0
            bucket["zoneTwoMinutes"] += workout_entry["zoneDurationsMinutes"]["zone2"] or 0.0
            bucket["zoneThreeMinutes"] += workout_entry["zoneDurationsMinutes"]["zone3"] or 0.0
            bucket["zoneFourMinutes"] += workout_entry["zoneDurationsMinutes"]["zone4"] or 0.0
            bucket["zoneFiveMinutes"] += workout_entry["zoneDurationsMinutes"]["zone5"] or 0.0

            for key in zone_duration_totals_milli:
                zone_duration_totals_milli[key] += int(zone_durations.get(key, 0) or 0)

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
                    "zoneZeroMinutes": round_value(row["zoneZeroMinutes"]),
                    "zoneOneMinutes": round_value(row["zoneOneMinutes"]),
                    "zoneTwoMinutes": round_value(row["zoneTwoMinutes"]),
                    "zoneThreeMinutes": round_value(row["zoneThreeMinutes"]),
                    "zoneFourMinutes": round_value(row["zoneFourMinutes"]),
                    "zoneFiveMinutes": round_value(row["zoneFiveMinutes"]),
                }
            )

        heart_rate_zone_labels = [
            ("zone_zero_milli", "Zone 0"),
            ("zone_one_milli", "Zone 1"),
            ("zone_two_milli", "Zone 2"),
            ("zone_three_milli", "Zone 3"),
            ("zone_four_milli", "Zone 4"),
            ("zone_five_milli", "Zone 5"),
        ]
        total_zone_minutes = sum(zone_duration_totals_milli.values()) / 60_000
        heart_rate_zones = []
        for key, label in heart_rate_zone_labels:
            minutes = round((zone_duration_totals_milli[key] or 0) / 60_000, 2)
            percentage = round((minutes / total_zone_minutes) * 100, 2) if total_zone_minutes else 0.0
            heart_rate_zones.append(
                {
                    "zone": label,
                    "minutes": minutes,
                    "percentage": percentage,
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

        # 30-day baselines and Daily Insights
        trailing_30_hrv = last_n(hrv_values, 30)
        trailing_30_rhr = last_n(rhr_values, 30)

        baseline_hrv_mean = mean(trailing_30_hrv)
        baseline_hrv_stdev = std_dev(trailing_30_hrv)
        baseline_rhr_mean = mean(trailing_30_rhr)
        baseline_rhr_stdev = std_dev(trailing_30_rhr)

        current_hrv = hrv_values[-1] if hrv_values else None
        current_rhr = rhr_values[-1] if rhr_values else None
        current_recovery = recovery_scores[-1] if recovery_scores else None

        ns_state = calculate_ns_state(
            current_hrv, baseline_hrv_mean, baseline_hrv_stdev,
            current_rhr, baseline_rhr_mean, baseline_rhr_stdev
        )
        daily_decision = calculate_daily_decision(current_recovery, ns_state)

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
        recovery_delta = delta(recent_recovery_average, previous_recovery_average)
        sleep_performance_delta = delta(
            recent_sleep_performance_average,
            previous_sleep_performance_average,
        )
        latest_sleep_hours_average = mean(recent_sleep_hours)

        summary_cards = [
            {
                "id": "recovery",
                "title": "Recovery",
                "value": recent_recovery_average,
                "suffix": "",
                "delta": recovery_delta,
                "deltaLabel": "vs prior 7 days",
                "sparkline": last_n(recovery_scores, 14),
                "deltaFormat": "signed",
                "deltaSuffix": "",
                "deltaDigits": 1,
                "tone": "positive"
                if recovery_delta
                and recovery_delta > 0
                else "neutral",
                "detail": f"{sum(1 for value in recovery_scores if value is not None and value >= 67)} high-recovery days",
            },
            {
                "id": "sleep-hours",
                "title": "Sleep",
                "value": latest_sleep_hours_average,
                "suffix": "h",
                "delta": sleep_performance_delta,
                "deltaLabel": "sleep performance vs prior 7 days",
                "sparkline": last_n(sleep_hours_values, 14),
                "deltaFormat": "signed",
                "deltaSuffix": " pts",
                "deltaDigits": 1,
                "tone": "warning"
                if sleep_performance_delta is not None and sleep_performance_delta < 0
                else "positive",
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

        insights = self._build_insights(
            recent_recovery_average,
            previous_recovery_average,
            sleep_hours_values,
            sleep_need_values,
            sleep_gap_values,
            sleep_perf_corr,
            latest_month,
            previous_month,
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
            "dataSource": data_source or self.data_source or self._default_live_data_source(),
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
                "workoutSessions": workout_records,
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
                    "averageHrv7d": mean(last_n(hrv_values, 7)),
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
                    "heartRateZones": heart_rate_zones,
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
            "advancedInsights": {
                "nervousSystemState": ns_state,
                "dailyDecision": daily_decision,
                "baselines": {
                    "hrvMean": baseline_hrv_mean,
                    "hrvStdev": baseline_hrv_stdev,
                    "rhrMean": baseline_rhr_mean,
                    "rhrStdev": baseline_rhr_stdev,
                }
            },
            "rawData": {
                "profile": profile,
                "bodyMeasurements": body_measurements,
                "recovery": recovery,
                "sleep": sleep,
                "workouts": workouts,
                "cycles": cycles,
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
