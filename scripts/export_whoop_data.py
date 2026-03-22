#!/usr/bin/env python3
"""Incrementally sync every WHOOP dataset available to this client."""

import argparse
import asyncio
import csv
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx


REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from whoop_client import WhoopClient  # noqa: E402


DEFAULT_PAGE_SIZE = 25
DEFAULT_OUTPUT_BASE = REPO_ROOT / "storage" / "exports"
OFFICIAL_API_DOCS_URL = "https://developer.whoop.com/api"
INCREMENTAL_LOOKBACK_HOURS = 48


def utc_now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


def utc_timestamp() -> str:
    """Return an ISO 8601 timestamp in UTC."""
    return utc_now().isoformat().replace("+00:00", "Z")


def timestamp_slug() -> str:
    """Return a filesystem-safe UTC timestamp."""
    return utc_now().strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, payload: Any) -> None:
    """Write JSON with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    """Write a text file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_json(path: Path) -> Optional[Any]:
    """Read JSON if the file exists."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def sanitize_filename(value: Any) -> str:
    """Convert arbitrary identifiers into safe filenames."""
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(value))


def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Parse WHOOP timestamps into timezone-aware datetimes."""
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def date_only(value: Optional[str]) -> Optional[str]:
    """Extract YYYY-MM-DD from an ISO timestamp."""
    parsed = parse_timestamp(value)
    if not parsed:
        return None
    return parsed.date().isoformat()


def hours_from_milli(value: Any) -> Optional[float]:
    """Convert milliseconds to hours."""
    if value in (None, ""):
        return None
    return round(float(value) / 3_600_000, 2)


def minutes_from_milli(value: Any) -> Optional[float]:
    """Convert milliseconds to minutes."""
    if value in (None, ""):
        return None
    return round(float(value) / 60_000, 2)


def safe_round(value: Any, digits: int = 2) -> Optional[float]:
    """Round numeric values while tolerating nulls."""
    if value in (None, ""):
        return None
    return round(float(value), digits)


def duration_minutes(start: Optional[str], end: Optional[str]) -> Optional[float]:
    """Compute duration in minutes from two timestamps."""
    start_ts = parse_timestamp(start)
    end_ts = parse_timestamp(end)
    if not start_ts or not end_ts:
        return None
    return round((end_ts - start_ts).total_seconds() / 60, 2)


def read_collection_records(path: Path) -> List[Dict[str, Any]]:
    """Read a collection payload and normalize records."""
    payload = read_json(path) or {}
    if isinstance(payload, dict) and isinstance(payload.get("records"), list):
        return payload["records"]
    if isinstance(payload, list):
        return payload
    return []


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    """Write rows to CSV with stable headers."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def flatten_recovery_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten recovery records for CSV export."""
    rows: List[Dict[str, Any]] = []
    for record in records:
        score = record.get("score") or {}
        rows.append(
            {
                "date": date_only(record.get("created_at")),
                "created_at": record.get("created_at"),
                "cycle_id": record.get("cycle_id"),
                "sleep_id": record.get("sleep_id"),
                "recovery_score": score.get("recovery_score"),
                "hrv_rmssd_milli": score.get("hrv_rmssd_milli"),
                "resting_heart_rate": score.get("resting_heart_rate"),
                "spo2_percentage": score.get("spo2_percentage"),
                "skin_temp_celsius": score.get("skin_temp_celsius"),
            }
        )
    return sorted(rows, key=lambda row: row.get("date") or "")


def flatten_sleep_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten sleep records for CSV export."""
    rows: List[Dict[str, Any]] = []
    for record in records:
        score = record.get("score") or {}
        stage = score.get("stage_summary") or {}
        sleep_needed = score.get("sleep_needed") or {}
        actual_milli = (
            (stage.get("total_light_sleep_time_milli", 0) or 0)
            + (stage.get("total_slow_wave_sleep_time_milli", 0) or 0)
            + (stage.get("total_rem_sleep_time_milli", 0) or 0)
        )
        need_milli = (
            (sleep_needed.get("baseline_milli", 0) or 0)
            + (sleep_needed.get("need_from_sleep_debt_milli", 0) or 0)
            + (sleep_needed.get("need_from_recent_strain_milli", 0) or 0)
            + (sleep_needed.get("need_from_recent_nap_milli", 0) or 0)
        )
        actual_hours = hours_from_milli(actual_milli)
        need_hours = hours_from_milli(need_milli)
        rows.append(
            {
                "date": date_only(record.get("start")),
                "start": record.get("start"),
                "end": record.get("end"),
                "is_nap": bool(record.get("nap")),
                "sleep_performance_percentage": score.get("sleep_performance_percentage"),
                "sleep_efficiency_percentage": score.get("sleep_efficiency_percentage"),
                "sleep_consistency_percentage": score.get("sleep_consistency_percentage"),
                "respiratory_rate": score.get("respiratory_rate"),
                "stage_light_hours": hours_from_milli(stage.get("total_light_sleep_time_milli")),
                "stage_sws_hours": hours_from_milli(stage.get("total_slow_wave_sleep_time_milli")),
                "stage_rem_hours": hours_from_milli(stage.get("total_rem_sleep_time_milli")),
                "sleep_actual_hours": actual_hours,
                "sleep_need_hours": need_hours,
                "sleep_debt_hours": hours_from_milli(sleep_needed.get("need_from_sleep_debt_milli")) or 0.0,
                "sleep_gap_hours": safe_round(need_hours - actual_hours)
                if need_hours is not None and actual_hours is not None
                else None,
            }
        )
    return sorted(rows, key=lambda row: row.get("date") or "")


def flatten_workout_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten workout records for CSV export."""
    rows: List[Dict[str, Any]] = []
    for record in records:
        score = record.get("score") or {}
        zones = score.get("zone_durations") or {}
        rows.append(
            {
                "date": date_only(record.get("start")),
                "start": record.get("start"),
                "end": record.get("end"),
                "sport_name": record.get("sport_name"),
                "strain": score.get("strain"),
                "average_heart_rate": score.get("average_heart_rate"),
                "max_heart_rate": score.get("max_heart_rate"),
                "kilojoule": score.get("kilojoule"),
                "workout_duration_minutes": duration_minutes(record.get("start"), record.get("end")),
                "zone_one_minutes": minutes_from_milli(zones.get("zone_one_milli")) or 0.0,
                "zone_two_minutes": minutes_from_milli(zones.get("zone_two_milli")) or 0.0,
                "zone_three_minutes": minutes_from_milli(zones.get("zone_three_milli")) or 0.0,
                "zone_four_minutes": minutes_from_milli(zones.get("zone_four_milli")) or 0.0,
                "zone_five_minutes": minutes_from_milli(zones.get("zone_five_milli")) or 0.0,
                "zone_six_minutes": minutes_from_milli(zones.get("zone_six_milli")) or 0.0,
            }
        )
    return sorted(rows, key=lambda row: row.get("date") or "")


def flatten_cycle_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten cycle records for CSV export."""
    rows: List[Dict[str, Any]] = []
    for record in records:
        score = record.get("score") or {}
        rows.append(
            {
                "date": date_only(record.get("start")),
                "start": record.get("start"),
                "end": record.get("end"),
                "strain": score.get("strain"),
                "kilojoule": score.get("kilojoule"),
                "average_heart_rate": score.get("average_heart_rate"),
                "max_heart_rate": score.get("max_heart_rate"),
            }
        )
    return sorted(rows, key=lambda row: row.get("date") or "")


def build_daily_summary_rows(
    recovery_rows: List[Dict[str, Any]],
    sleep_rows: List[Dict[str, Any]],
    workout_rows: List[Dict[str, Any]],
    cycle_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Join recovery/sleep/workout/cycle data by date for ad-hoc analysis."""
    summary_by_date: Dict[str, Dict[str, Any]] = {}

    def ensure_day(day: str) -> Dict[str, Any]:
        if day not in summary_by_date:
            summary_by_date[day] = {
                "date": day,
                "recovery_score": None,
                "hrv": None,
                "rhr": None,
                "spo2": None,
                "skin_temp": None,
                "sleep_hours": None,
                "sleep_need": None,
                "sleep_debt": None,
                "sleep_performance": None,
                "sleep_efficiency": None,
                "sleep_consistency": None,
                "respiratory_rate": None,
                "workout_count": 0,
                "workout_strain": 0.0,
                "workout_duration": 0.0,
                "cycle_strain": None,
                "cycle_kj": None,
            }
        return summary_by_date[day]

    for row in recovery_rows:
        day = row.get("date")
        if not day:
            continue
        target = ensure_day(day)
        target["recovery_score"] = row.get("recovery_score")
        target["hrv"] = row.get("hrv_rmssd_milli")
        target["rhr"] = row.get("resting_heart_rate")
        target["spo2"] = row.get("spo2_percentage")
        target["skin_temp"] = row.get("skin_temp_celsius")

    for row in sleep_rows:
        day = row.get("date")
        if not day:
            continue
        target = ensure_day(day)
        target["sleep_hours"] = row.get("sleep_actual_hours")
        target["sleep_need"] = row.get("sleep_need_hours")
        target["sleep_debt"] = row.get("sleep_debt_hours")
        target["sleep_performance"] = row.get("sleep_performance_percentage")
        target["sleep_efficiency"] = row.get("sleep_efficiency_percentage")
        target["sleep_consistency"] = row.get("sleep_consistency_percentage")
        target["respiratory_rate"] = row.get("respiratory_rate")

    for row in workout_rows:
        day = row.get("date")
        if not day:
            continue
        target = ensure_day(day)
        target["workout_count"] += 1
        if row.get("strain") is not None:
            target["workout_strain"] = round(target["workout_strain"] + float(row["strain"]), 2)
        if row.get("workout_duration_minutes") is not None:
            target["workout_duration"] = round(
                target["workout_duration"] + float(row["workout_duration_minutes"]),
                2,
            )

    for row in cycle_rows:
        day = row.get("date")
        if not day:
            continue
        target = ensure_day(day)
        target["cycle_strain"] = row.get("strain")
        target["cycle_kj"] = row.get("kilojoule")

    return [summary_by_date[day] for day in sorted(summary_by_date.keys())]


def generate_csv_exports(export_dir: Path) -> Dict[str, Any]:
    """Generate flattened CSV exports from the latest JSON snapshot."""
    recovery_records = read_collection_records(export_dir / "recovery.json")
    sleep_records = read_collection_records(export_dir / "sleep.json")
    workout_records = read_collection_records(export_dir / "workouts.json")
    cycle_records = read_collection_records(export_dir / "cycles.json")

    recovery_rows = flatten_recovery_rows(recovery_records)
    sleep_rows = flatten_sleep_rows(sleep_records)
    workout_rows = flatten_workout_rows(workout_records)
    cycle_rows = flatten_cycle_rows(cycle_records)
    daily_summary_rows = build_daily_summary_rows(
        recovery_rows,
        sleep_rows,
        workout_rows,
        cycle_rows,
    )

    write_csv(
        export_dir / "recovery.csv",
        recovery_rows,
        [
            "date",
            "created_at",
            "cycle_id",
            "sleep_id",
            "recovery_score",
            "hrv_rmssd_milli",
            "resting_heart_rate",
            "spo2_percentage",
            "skin_temp_celsius",
        ],
    )
    write_csv(
        export_dir / "sleep.csv",
        sleep_rows,
        [
            "date",
            "start",
            "end",
            "is_nap",
            "sleep_performance_percentage",
            "sleep_efficiency_percentage",
            "sleep_consistency_percentage",
            "respiratory_rate",
            "stage_light_hours",
            "stage_sws_hours",
            "stage_rem_hours",
            "sleep_actual_hours",
            "sleep_need_hours",
            "sleep_debt_hours",
            "sleep_gap_hours",
        ],
    )
    write_csv(
        export_dir / "workouts.csv",
        workout_rows,
        [
            "date",
            "start",
            "end",
            "sport_name",
            "strain",
            "average_heart_rate",
            "max_heart_rate",
            "kilojoule",
            "workout_duration_minutes",
            "zone_one_minutes",
            "zone_two_minutes",
            "zone_three_minutes",
            "zone_four_minutes",
            "zone_five_minutes",
            "zone_six_minutes",
        ],
    )
    write_csv(
        export_dir / "cycles.csv",
        cycle_rows,
        [
            "date",
            "start",
            "end",
            "strain",
            "kilojoule",
            "average_heart_rate",
            "max_heart_rate",
        ],
    )
    write_csv(
        export_dir / "daily_summary.csv",
        daily_summary_rows,
        [
            "date",
            "recovery_score",
            "hrv",
            "rhr",
            "spo2",
            "skin_temp",
            "sleep_hours",
            "sleep_need",
            "sleep_debt",
            "sleep_performance",
            "sleep_efficiency",
            "sleep_consistency",
            "respiratory_rate",
            "workout_count",
            "workout_strain",
            "workout_duration",
            "cycle_strain",
            "cycle_kj",
        ],
    )

    summary = {
        "generated_at": utc_timestamp(),
        "export_dir": str(export_dir),
        "files": {
            "recovery.csv": len(recovery_rows),
            "sleep.csv": len(sleep_rows),
            "workouts.csv": len(workout_rows),
            "cycles.csv": len(cycle_rows),
            "daily_summary.csv": len(daily_summary_rows),
        },
    }
    write_json(export_dir / "csv_manifest.json", summary)
    return summary


def record_key(record: Dict[str, Any], index: int) -> str:
    """Build a stable dedupe key across WHOOP collections."""
    for key in ("id", "cycle_id", "sleep_id", "v1_id"):
        value = record.get(key)
        if value not in (None, ""):
            return f"{key}:{value}"

    fragments = [
        record.get("user_id"),
        record.get("created_at"),
        record.get("start"),
        record.get("end"),
        record.get("updated_at"),
    ]
    if any(value not in (None, "") for value in fragments):
        return "fallback:" + "|".join("" if value is None else str(value) for value in fragments)
    return f"fallback-index:{index}"


def collection_span(records: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    """Compute the earliest and latest timestamps present in a collection."""
    candidates: List[datetime] = []
    for record in records:
        for key in ("start", "created_at", "updated_at", "end"):
            parsed = parse_timestamp(record.get(key))
            if parsed:
                candidates.append(parsed)

    if not candidates:
        return None, None

    return (
        min(candidates).isoformat().replace("+00:00", "Z"),
        max(candidates).isoformat().replace("+00:00", "Z"),
    )


def list_export_dirs(output_base: Path) -> List[Path]:
    """List existing WHOOP export directories sorted by name."""
    if not output_base.exists():
        return []
    return sorted(
        path for path in output_base.iterdir() if path.is_dir() and path.name.startswith("whoop-export-")
    )


def resolve_export_dir(output_base: Path, fresh: bool) -> Tuple[Path, bool]:
    """Return the export directory to update, creating one if required."""
    output_base.mkdir(parents=True, exist_ok=True)
    if not fresh:
        existing = list_export_dirs(output_base)
        if existing:
            return existing[-1], True

    export_dir = output_base / f"whoop-export-{timestamp_slug()}"
    export_dir.mkdir(parents=True, exist_ok=False)
    return export_dir, False


def incremental_start_timestamp(records: List[Dict[str, Any]]) -> Optional[str]:
    """Compute a bounded incremental query start from the latest saved record."""
    _, latest = collection_span(records)
    parsed = parse_timestamp(latest)
    if not parsed:
        return None
    return (parsed - timedelta(hours=INCREMENTAL_LOOKBACK_HOURS)).isoformat().replace("+00:00", "Z")


def dedupe_preserve_order(values: List[Any]) -> List[Any]:
    """Deduplicate values while preserving their first-seen order."""
    seen = set()
    result: List[Any] = []
    for value in values:
        if value in seen or value in (None, ""):
            continue
        seen.add(value)
        result.append(value)
    return result


def record_sort_value(dataset: str, record: Dict[str, Any]) -> datetime:
    """Return the primary sort timestamp for a dataset."""
    preferred_keys = {
        "recovery": ("created_at", "updated_at"),
        "sleep": ("start", "created_at", "updated_at"),
        "workouts": ("start", "created_at", "updated_at"),
        "cycles": ("start", "created_at", "updated_at"),
    }.get(dataset, ("start", "created_at", "updated_at", "end"))

    for key in preferred_keys:
        parsed = parse_timestamp(record.get(key))
        if parsed:
            return parsed
    return datetime.min.replace(tzinfo=timezone.utc)


def sort_records(dataset: str, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort merged WHOOP records with newest entries first."""
    return sorted(records, key=lambda row: record_sort_value(dataset, row), reverse=True)


def merge_records(
    dataset: str,
    existing_records: List[Dict[str, Any]],
    fetched_records: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], int, int]:
    """Merge fetched records into the existing export."""
    merged: Dict[str, Dict[str, Any]] = {}
    for index, record in enumerate(existing_records):
        merged[record_key(record, index)] = record

    new_count = 0
    updated_count = 0
    for index, record in enumerate(fetched_records):
        key = record_key(record, index)
        previous = merged.get(key)
        if previous is None:
            new_count += 1
        elif previous != record:
            updated_count += 1
        merged[key] = record

    return sort_records(dataset, list(merged.values())), new_count, updated_count


async def make_request(client: WhoopClient, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Issue a WHOOP request while waiting through local rate-limit windows."""
    while True:
        try:
            return await client._make_request(endpoint, params)
        except Exception as exc:  # pragma: no cover - exercised via live export
            message = str(exc)
            if "Rate limit exceeded" in message:
                wait_seconds = max(
                    1,
                    61 - int((datetime.now() - client.request_window_start).total_seconds()),
                )
                await asyncio.sleep(wait_seconds)
                continue

            if "status 429" in message:
                await asyncio.sleep(65)
                continue

            if "status 5" in message:
                await asyncio.sleep(5)
                continue

            if "Rate limit exceeded" not in message:
                raise


async def fetch_single_resource(
    client: WhoopClient,
    name: str,
    endpoint: str,
    output_dir: Path,
    run_output_dir: Path,
) -> Dict[str, Any]:
    """Fetch and store a non-paginated WHOOP resource."""
    payload = await make_request(client, endpoint)
    exported_at = utc_timestamp()
    wrapped_payload = {
        "dataset": name,
        "endpoint": endpoint,
        "exported_at": exported_at,
        "data": payload,
    }
    write_json(output_dir / f"{name}.json", wrapped_payload)
    write_json(run_output_dir / f"{name}.json", wrapped_payload)

    return {
        "dataset": name,
        "endpoint": endpoint,
        "type": "single",
        "exported_at": exported_at,
        "record_count": 1 if payload else 0,
        "output_file": f"{name}.json",
    }


async def fetch_collection(
    client: WhoopClient,
    name: str,
    endpoint: str,
    output_dir: Path,
    run_output_dir: Path,
    page_size: int,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Fetch and store every page from a WHOOP collection endpoint."""
    existing_payload = read_json(output_dir / f"{name}.json") or {}
    existing_records = existing_payload.get("records", []) if isinstance(existing_payload, dict) else []
    fetched_records: List[Dict[str, Any]] = []
    seen_keys = set()
    next_token: Optional[str] = None
    page_number = 0
    query_start = incremental_start_timestamp(existing_records)
    raw_pages_dir = run_output_dir / "raw_pages" / name

    while True:
        params: Dict[str, Any] = {"limit": page_size}
        if query_start:
            params["start"] = query_start
        if next_token:
            params["nextToken"] = next_token

        payload = await make_request(client, endpoint, params)
        page_number += 1
        write_json(raw_pages_dir / f"page-{page_number:04d}.json", payload)

        page_records = payload.get("records", [])
        new_rows = 0
        for index, record in enumerate(page_records):
            key = record_key(record, index)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            fetched_records.append(record)
            new_rows += 1

        next_token = payload.get("next_token") or payload.get("nextToken")
        if not page_records or not next_token or new_rows == 0:
            break

    merged_records, new_count, updated_count = merge_records(name, existing_records, fetched_records)
    earliest, latest = collection_span(merged_records)
    exported_at = utc_timestamp()
    wrapped_payload = {
        "dataset": name,
        "endpoint": endpoint,
        "exported_at": exported_at,
        "sync_mode": "incremental" if existing_records else "fresh",
        "query_start": query_start,
        "page_size": page_size,
        "page_count": page_number,
        "record_count": len(merged_records),
        "fetched_record_count": len(fetched_records),
        "new_record_count": new_count,
        "updated_record_count": updated_count,
        "earliest_timestamp": earliest,
        "latest_timestamp": latest,
        "records": merged_records,
    }
    write_json(output_dir / f"{name}.json", wrapped_payload)
    write_json(
        run_output_dir / f"{name}.json",
        {
            "dataset": name,
            "endpoint": endpoint,
            "exported_at": exported_at,
            "sync_mode": "incremental" if existing_records else "fresh",
            "query_start": query_start,
            "page_size": page_size,
            "page_count": page_number,
            "fetched_record_count": len(fetched_records),
            "new_record_count": new_count,
            "updated_record_count": updated_count,
            "merged_record_count": len(merged_records),
            "records": fetched_records,
        },
    )

    return (
        {
            "dataset": name,
            "endpoint": endpoint,
            "type": "collection",
            "exported_at": exported_at,
            "sync_mode": "incremental" if existing_records else "fresh",
            "query_start": query_start,
            "page_size": page_size,
            "page_count": page_number,
            "record_count": len(merged_records),
            "fetched_record_count": len(fetched_records),
            "new_record_count": new_count,
            "updated_record_count": updated_count,
            "earliest_timestamp": earliest,
            "latest_timestamp": latest,
            "output_file": f"{name}.json",
            "raw_pages_dir": str(Path("runs") / run_output_dir.name / "raw_pages" / name),
        },
        merged_records,
        fetched_records,
    )


async def fetch_batch_resources(
    client: WhoopClient,
    dataset: str,
    identifiers: List[Any],
    endpoint_builder: Any,
    output_dir: Path,
    run_output_dir: Path,
    id_label: str,
) -> Dict[str, Any]:
    """Fetch a set of per-ID resources and store both successes and failures."""
    batch_dir = output_dir / dataset
    run_batch_dir = run_output_dir / dataset
    items: List[Dict[str, Any]] = []
    existing_index = read_json(output_dir / f"{dataset}_index.json") or {}
    item_map: Dict[Any, Dict[str, Any]] = {}
    for item in existing_index.get("items", []):
        identifier = item.get(id_label)
        if identifier in (None, ""):
            continue
        item_map[identifier] = item

    retry_identifiers = [
        item.get(id_label)
        for item in existing_index.get("items", [])
        if item.get("status") == "error" and item.get(id_label) not in (None, "")
    ]
    targets = dedupe_preserve_order(list(identifiers) + retry_identifiers)
    run_items: List[Dict[str, Any]] = []

    for identifier in targets:
        endpoint = endpoint_builder(identifier)
        exported_at = utc_timestamp()
        payload_wrapper: Dict[str, Any] = {
            "dataset": dataset,
            "endpoint": endpoint,
            "exported_at": exported_at,
            id_label: identifier,
        }

        try:
            payload_wrapper["data"] = await make_request(client, endpoint)
            item = {
                id_label: identifier,
                "endpoint": endpoint,
                "status": "ok",
                "output_file": str(Path(dataset) / f"{sanitize_filename(identifier)}.json"),
            }
        except Exception as exc:
            payload_wrapper["error"] = str(exc)
            item = {
                id_label: identifier,
                "endpoint": endpoint,
                "status": "error",
                "error": str(exc),
                "output_file": str(Path(dataset) / f"{sanitize_filename(identifier)}.json"),
            }

        items.append(item)
        run_items.append(item)
        item_map[identifier] = item
        write_json(batch_dir / f"{sanitize_filename(identifier)}.json", payload_wrapper)
        write_json(run_batch_dir / f"{sanitize_filename(identifier)}.json", payload_wrapper)

    merged_items = list(item_map.values())
    success_count = sum(1 for item in merged_items if item.get("status") == "ok")
    error_count = sum(1 for item in merged_items if item.get("status") == "error")

    index_payload = {
        "dataset": dataset,
        "exported_at": utc_timestamp(),
        "input_count": len(merged_items),
        "requested_this_run": len(targets),
        "success_count": success_count,
        "error_count": error_count,
        "items": merged_items,
    }
    write_json(output_dir / f"{dataset}_index.json", index_payload)
    write_json(
        run_output_dir / f"{dataset}_index.json",
        {
            "dataset": dataset,
            "exported_at": utc_timestamp(),
            "requested_this_run": len(targets),
            "success_count": sum(1 for item in run_items if item.get("status") == "ok"),
            "error_count": sum(1 for item in run_items if item.get("status") == "error"),
            "items": run_items,
        },
    )

    return {
        "dataset": dataset,
        "type": "detail_batch",
        "input_count": len(merged_items),
        "requested_this_run": len(targets),
        "success_count": success_count,
        "error_count": error_count,
        "output_dir": dataset,
        "index_file": f"{dataset}_index.json",
        "id_label": id_label,
    }


async def fetch_official_docs_snapshot(output_dir: Path, run_output_dir: Path) -> Dict[str, Any]:
    """Store a snapshot of the official WHOOP API docs page and extract documented paths."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(OFFICIAL_API_DOCS_URL)
        response.raise_for_status()
        html = response.text

    write_text(output_dir / "official_api_docs.html", html)
    write_text(run_output_dir / "official_api_docs.html", html)

    paths = sorted(
        {
            match
            for match in re.findall(r"/v[12]/[A-Za-z0-9_./{}:-]+", html)
            if match.startswith("/v")
        }
    )
    summary = {
        "dataset": "official_api_docs",
        "type": "reference",
        "url": OFFICIAL_API_DOCS_URL,
        "exported_at": utc_timestamp(),
        "path_count": len(paths),
        "output_file": "official_api_docs.html",
        "paths_file": "official_api_paths.json",
        "documented_paths": paths,
    }
    write_json(output_dir / "official_api_paths.json", summary)
    write_json(run_output_dir / "official_api_paths.json", summary)
    return summary


def unique_values(records: List[Dict[str, Any]], key: str) -> List[Any]:
    """Return unique non-empty values from records while preserving order."""
    seen = set()
    values: List[Any] = []
    for record in records:
        value = record.get(key)
        if value in (None, "") or value in seen:
            continue
        seen.add(value)
        values.append(value)
    return values


def build_summary(export_dir: Path, manifest: Dict[str, Any]) -> str:
    """Build a concise text summary for quick inspection."""
    lines = [
        f"WHOOP export directory: {export_dir}",
        f"Exported at: {manifest['exported_at']}",
        f"Sync mode: {manifest.get('sync_mode')}",
        f"Run directory: {manifest.get('run_dir')}",
        f"API base: {manifest['api_base']}",
        f"Auth status: {manifest['auth_status'].get('status')}",
        "",
        "Datasets:",
    ]

    for dataset in manifest["datasets"]:
        if dataset.get("error"):
            lines.append(f"- {dataset['dataset']}: ERROR - {dataset['error']}")
            continue

        if dataset["type"] == "reference":
            lines.append(
                f"- {dataset['dataset']}: {dataset['path_count']} documented paths -> {dataset['output_file']}"
            )
            continue

        if dataset["type"] == "single":
            lines.append(
                f"- {dataset['dataset']}: {dataset['record_count']} record -> {dataset['output_file']}"
            )
            continue

        if dataset["type"] == "detail_batch":
            lines.append(
                f"- {dataset['dataset']}: {dataset.get('requested_this_run', 0)} requested this run, "
                f"{dataset['success_count']} ok / {dataset['error_count']} errors total across "
                f"{dataset['input_count']} known ids -> {dataset['output_dir']}/"
            )
            continue

        span = "unknown span"
        if dataset.get("earliest_timestamp") or dataset.get("latest_timestamp"):
            span = f"{dataset.get('earliest_timestamp')} .. {dataset.get('latest_timestamp')}"

        lines.append(
            f"- {dataset['dataset']}: {dataset['record_count']} total records "
            f"({dataset.get('new_record_count', 0)} new, {dataset.get('updated_record_count', 0)} updated, "
            f"{dataset.get('fetched_record_count', 0)} fetched this run) across "
            f"{dataset['page_count']} pages ({span}) -> {dataset['output_file']}"
        )

    if manifest.get("errors"):
        lines.extend(["", "Errors:"])
        for item in manifest["errors"]:
            lines.append(f"- {item['dataset']}: {item['error']}")

    lines.append("")
    return "\n".join(lines)


async def export_all(output_base: Path, page_size: int, fresh: bool) -> Path:
    """Export WHOOP datasets, reusing the latest export directory by default."""
    client = WhoopClient()
    export_dir, reused_existing_export = resolve_export_dir(output_base, fresh)
    run_id = timestamp_slug()
    run_dir = export_dir / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=False)

    auth_status = client.get_auth_status()
    write_json(export_dir / "auth_status.json", auth_status)
    write_json(run_dir / "auth_status.json", auth_status)

    datasets: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    fetched_collection_records: Dict[str, List[Dict[str, Any]]] = {}
    sync_mode = "incremental" if reused_existing_export else "fresh"

    try:
        datasets.append(await fetch_official_docs_snapshot(export_dir, run_dir))
    except Exception as exc:
        error = {
            "dataset": "official_api_docs",
            "endpoint": OFFICIAL_API_DOCS_URL,
            "error": str(exc),
        }
        datasets.append(
            {
                "dataset": "official_api_docs",
                "type": "reference",
                "url": OFFICIAL_API_DOCS_URL,
                "error": str(exc),
            }
        )
        errors.append(error)

    single_resources = [
        ("profile", "/user/profile/basic"),
        ("body_measurements", "/user/measurement/body"),
    ]
    collections = [
        ("recovery", "/recovery"),
        ("sleep", "/activity/sleep"),
        ("workouts", "/activity/workout"),
        ("cycles", "/cycle"),
    ]

    for name, endpoint in single_resources:
        try:
            datasets.append(await fetch_single_resource(client, name, endpoint, export_dir, run_dir))
        except Exception as exc:
            error = {"dataset": name, "endpoint": endpoint, "error": str(exc)}
            datasets.append({"dataset": name, "endpoint": endpoint, "type": "single", "error": str(exc)})
            errors.append(error)

    for name, endpoint in collections:
        try:
            dataset_summary, records, fetched_records = await fetch_collection(
                client,
                name,
                endpoint,
                export_dir,
                run_dir,
                page_size,
            )
            datasets.append(dataset_summary)
            fetched_collection_records[name] = fetched_records
        except Exception as exc:
            error = {"dataset": name, "endpoint": endpoint, "error": str(exc)}
            datasets.append(
                {"dataset": name, "endpoint": endpoint, "type": "collection", "error": str(exc)}
            )
            errors.append(error)

    batch_specs = [
        (
            "cycles_by_id",
            unique_values(fetched_collection_records.get("cycles", []), "id"),
            lambda identifier: f"/cycle/{identifier}",
            "cycle_id",
        ),
        (
            "cycle_sleep_by_cycle_id",
            unique_values(fetched_collection_records.get("cycles", []), "id"),
            lambda identifier: f"/cycle/{identifier}/sleep",
            "cycle_id",
        ),
        (
            "cycle_recovery_by_cycle_id",
            unique_values(fetched_collection_records.get("cycles", []), "id"),
            lambda identifier: f"/cycle/{identifier}/recovery",
            "cycle_id",
        ),
        (
            "sleep_by_id",
            unique_values(fetched_collection_records.get("sleep", []), "id"),
            lambda identifier: f"/activity/sleep/{identifier}",
            "sleep_id",
        ),
        (
            "workouts_by_id",
            unique_values(fetched_collection_records.get("workouts", []), "id"),
            lambda identifier: f"/activity/workout/{identifier}",
            "workout_id",
        ),
        (
            "activity_mappings_by_v1_id",
            sorted(
                set(unique_values(fetched_collection_records.get("sleep", []), "v1_id"))
                | set(unique_values(fetched_collection_records.get("workouts", []), "v1_id"))
            ),
            lambda identifier: f"/v1/activity-mapping/{identifier}",
            "activity_v1_id",
        ),
    ]

    for dataset_name, identifiers, endpoint_builder, id_label in batch_specs:
        try:
            datasets.append(
                await fetch_batch_resources(
                    client,
                    dataset_name,
                    identifiers,
                    endpoint_builder,
                    export_dir,
                    run_dir,
                    id_label,
                )
            )
        except Exception as exc:
            error = {"dataset": dataset_name, "error": str(exc)}
            datasets.append({"dataset": dataset_name, "type": "detail_batch", "error": str(exc)})
            errors.append(error)

    manifest = {
        "exported_at": utc_timestamp(),
        "export_dir": str(export_dir),
        "sync_mode": sync_mode,
        "reused_existing_export": reused_existing_export,
        "run_id": run_id,
        "run_dir": str(run_dir),
        "api_base": client.base_url,
        "auth_status": auth_status,
        "page_size": page_size,
        "datasets": datasets,
        "errors": errors,
    }

    write_json(export_dir / "manifest.json", manifest)
    write_json(run_dir / "manifest.json", manifest)
    write_text(export_dir / "SUMMARY.txt", build_summary(export_dir, manifest))
    write_text(run_dir / "SUMMARY.txt", build_summary(export_dir, manifest))

    return export_dir


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Incrementally sync every WHOOP dataset available to this client."
    )
    parser.add_argument(
        "--output-base",
        default=str(DEFAULT_OUTPUT_BASE),
        help=f"Base directory for timestamped exports (default: {DEFAULT_OUTPUT_BASE})",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help=f"WHOOP page size for paginated endpoints (default: {DEFAULT_PAGE_SIZE})",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Force a brand-new export directory and full pull instead of incrementally updating the latest export.",
    )
    parser.add_argument(
        "--csv",
        action="store_true",
        help="Generate flattened CSV exports after JSON sync completes.",
    )
    return parser.parse_args()


def main() -> int:
    """Run the export and print the output directory."""
    args = parse_args()
    output_base = Path(args.output_base).expanduser().resolve()

    try:
        export_dir = asyncio.run(export_all(output_base, args.page_size, args.fresh))
    except Exception as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1

    if args.csv:
        try:
            csv_summary = generate_csv_exports(export_dir)
            print(
                f"CSV export complete: {', '.join(csv_summary['files'].keys())}",
                file=sys.stderr,
            )
        except Exception as exc:
            print(f"CSV generation failed: {exc}", file=sys.stderr)
            return 1

    print(str(export_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
