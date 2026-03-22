#!/usr/bin/env python3
"""
WHOOP MCP Server

A Model Context Protocol server that provides access to WHOOP fitness data
through MCP-compatible clients such as Claude Desktop and Codex using FastMCP.
"""
import asyncio
import os
import sys
from pathlib import Path
import statistics
from datetime import datetime
from typing import Dict, Any, List, Optional

from mcp.server.fastmcp import FastMCP

# Import our WHOOP client
from config import EXPORT_DIR
from dashboard_analysis import (
    DashboardAnalyzer,
    correlation_label,
    delta,
    mean,
    pearson,
    percent_change,
    shift_date,
)
from whoop_client import WhoopClient

# Create FastMCP server
mcp = FastMCP("whoop-mcp-server")

# Global WHOOP client
whoop_client = None
dashboard_analyzer = None
EXPORT_BASE_DIR = Path(EXPORT_DIR).expanduser().resolve()


def resolve_mcp_transport() -> str:
    """Resolve FastMCP transport from env with sensible defaults."""
    configured = os.getenv("WHOOP_MCP_TRANSPORT") or os.getenv("MCP_TRANSPORT")
    if configured is None:
        return "stdio"

    normalized = configured.strip().lower()
    if normalized in {"stdio", "sse", "streamable-http"}:
        return normalized
    return "stdio"


def resolve_streamable_http_host() -> str:
    """Resolve FastMCP HTTP host from env."""
    return os.getenv("FASTMCP_HOST", "127.0.0.1")


def resolve_streamable_http_port() -> int:
    """Resolve FastMCP HTTP port from env."""
    fastmcp_port = os.getenv("FASTMCP_PORT")
    if fastmcp_port:
        try:
            return int(fastmcp_port)
        except ValueError:
            return 8000

    fallback_port = os.getenv("PORT")
    if fallback_port:
        try:
            return int(fallback_port)
        except ValueError:
            return 8000

    return 8000


def init_whoop_client():
    """Initialize WHOOP client"""
    global whoop_client
    if whoop_client is None:
        print("Initializing WHOOP client...", file=sys.stderr)
        whoop_client = WhoopClient()
        auth_status = whoop_client.get_auth_status()
        print(f"WHOOP auth status: {auth_status['status']}", file=sys.stderr)
    return whoop_client


def init_dashboard_analyzer():
    """Initialize the shared dashboard analyzer."""
    global dashboard_analyzer
    if dashboard_analyzer is None:
        dashboard_analyzer = DashboardAnalyzer(init_whoop_client())
    return dashboard_analyzer


def _source_summary_from_history(data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Build source availability metadata for normalized history payloads."""
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


def _load_latest_export_data() -> Dict[str, Any]:
    """Load the latest WHOOP export from disk."""
    latest_export = DashboardAnalyzer.find_latest_export_dir(EXPORT_BASE_DIR)
    if latest_export is None:
        raise FileNotFoundError(f"No WHOOP exports found in {EXPORT_BASE_DIR}")
    return DashboardAnalyzer.load_from_export(latest_export)


def _build_history_payload_from_export(export_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build a full-history MCP payload from offline export data."""
    auth_status = export_data.get("authStatus") or {"status": "offline_export"}
    return {
        "authStatus": auth_status,
        "dataSource": export_data.get("dataSource"),
        "sources": _source_summary_from_history(export_data),
        "profile": export_data.get("profile") or {},
        "bodyMeasurements": export_data.get("bodyMeasurements") or {},
        "recovery": export_data.get("recovery") or [],
        "sleep": export_data.get("sleep") or [],
        "workouts": export_data.get("workouts") or [],
        "cycles": export_data.get("cycles") or [],
    }


async def _build_dashboard_snapshot_with_fallback(refresh: bool = False) -> Dict[str, Any]:
    """Return live dashboard data, falling back to exported data when needed."""
    analyzer = init_dashboard_analyzer()
    live_error: Optional[str] = None
    live_payload: Optional[Dict[str, Any]] = None

    try:
        live_payload = await analyzer.build_dashboard(refresh=refresh)
        if not live_payload.get("errorState"):
            return live_payload
        live_error = live_payload["errorState"].get("message")
    except Exception as exc:
        live_error = str(exc)

    try:
        export_data = _load_latest_export_data()
        offline_analyzer = DashboardAnalyzer(
            data=export_data,
            data_source=export_data.get("dataSource"),
        )
        offline_payload = await offline_analyzer.build_dashboard()
        if live_error:
            offline_payload["fallbackReason"] = live_error
        return offline_payload
    except Exception:
        if live_payload is not None:
            return live_payload
        raise


def _filter_rows_by_days(rows: List[Dict[str, Any]], days: int) -> List[Dict[str, Any]]:
    """Return rows within a trailing day window based on row['date']."""
    if days <= 0:
        return rows
    dated_rows = [row for row in rows if row.get("date")]
    if not dated_rows:
        return []
    latest = max(row["date"] for row in dated_rows)
    cutoff = shift_date(latest, -(days - 1))
    if not cutoff:
        return dated_rows
    return [row for row in dated_rows if row["date"] >= cutoff]


def _metric_series(payload: Dict[str, Any], metric: str) -> Dict[str, Any]:
    """Resolve metric aliases into dated series data."""
    normalized = metric.strip().lower()
    if normalized == "recovery":
        return {"metric": "recovery", "unit": "score", "rows": payload.get("series", {}).get("recovery", []), "valueKey": "recoveryScore"}
    if normalized == "sleep":
        return {"metric": "sleep", "unit": "hours", "rows": payload.get("series", {}).get("sleep", []), "valueKey": "actualHours"}
    if normalized == "hrv":
        return {"metric": "hrv", "unit": "ms", "rows": payload.get("series", {}).get("recovery", []), "valueKey": "hrv"}
    if normalized == "strain":
        return {"metric": "strain", "unit": "strain", "rows": payload.get("series", {}).get("cycles", []), "valueKey": "strain"}
    if normalized == "rhr":
        return {"metric": "rhr", "unit": "bpm", "rows": payload.get("series", {}).get("recovery", []), "valueKey": "restingHeartRate"}
    raise ValueError("Unsupported metric. Use one of: recovery, sleep, hrv, strain, rhr.")


def _average_of_last(values: List[Optional[float]], count: int) -> Optional[float]:
    """Average the trailing N values in a list."""
    return mean(values[-count:]) if values else None


def _trend_direction(current: Optional[float], previous: Optional[float]) -> str:
    """Convert a delta into an improving/declining/stable label."""
    if current is None or previous is None:
        return "stable"
    change = current - previous
    if abs(change) < 0.25:
        return "stable"
    return "improving" if change > 0 else "declining"
def build_tool_result(tool_name: str, data: Any = None, error: Optional[str] = None) -> Dict[str, Any]:
    """Format a consistent MCP tool response."""
    result = {
        "tool": tool_name,
        "timestamp": datetime.now().isoformat(),
    }
    if error:
        result["error"] = error
    else:
        result["data"] = data
    return result


def record_count(payload: Any) -> int:
    """Count WHOOP collection records when available."""
    if isinstance(payload, dict):
        records = payload.get("records")
        if isinstance(records, list):
            return len(records)
    if isinstance(payload, list):
        return len(payload)
    return 1 if payload is not None else 0


async def build_full_history_snapshot(refresh: bool = False) -> Dict[str, Any]:
    """Fetch the same WHOOP sources used by the dashboard as raw data."""
    client = init_whoop_client()
    analyzer = init_dashboard_analyzer()

    if refresh:
        client.clear_cache()

    auth_status = client.get_auth_status()
    if auth_status.get("status") == "no_tokens":
        try:
            return _build_history_payload_from_export(_load_latest_export_data())
        except Exception:
            return {
                "authStatus": auth_status,
                "dataSource": {
                    "mode": "live",
                    "label": "live",
                    "exportDate": None,
                    "exportDir": None,
                },
                "sources": {
                    "bodyMeasurements": {"available": False, "count": 0, "message": None},
                    "recovery": {"available": False, "count": 0, "message": None},
                    "sleep": {"available": False, "count": 0, "message": None},
                    "workouts": {"available": False, "count": 0, "message": None},
                    "cycles": {"available": False, "count": 0, "message": None},
                },
                "profile": {},
                "bodyMeasurements": {},
                "recovery": [],
                "sleep": [],
                "workouts": [],
                "cycles": [],
            }

    try:
        (
            profile_result,
            body_result,
            recovery_result,
            sleep_result,
            workout_result,
            cycle_result,
        ) = await asyncio.gather(
            analyzer._safe_fetch(client.get_user_profile()),
            analyzer._safe_fetch(client.get_body_measurements()),
            analyzer._safe_fetch(analyzer._fetch_all_records("/recovery")),
            analyzer._safe_fetch(analyzer._fetch_all_records("/activity/sleep")),
            analyzer._safe_fetch(analyzer._fetch_all_records("/activity/workout")),
            analyzer._safe_fetch(analyzer._fetch_all_records("/cycle")),
        )
    except Exception:
        try:
            return _build_history_payload_from_export(_load_latest_export_data())
        except Exception:
            return {
                "authStatus": auth_status,
                "dataSource": {
                    "mode": "live",
                    "label": "live",
                    "exportDate": None,
                    "exportDir": None,
                },
                "sources": {
                    "bodyMeasurements": {"available": False, "count": 0, "message": None},
                    "recovery": {"available": False, "count": 0, "message": None},
                    "sleep": {"available": False, "count": 0, "message": None},
                    "workouts": {"available": False, "count": 0, "message": None},
                    "cycles": {"available": False, "count": 0, "message": None},
                },
                "profile": {},
                "bodyMeasurements": {},
                "recovery": [],
                "sleep": [],
                "workouts": [],
                "cycles": [],
            }

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

    all_failed = (
        profile_result["error"]
        and body_result["error"]
        and recovery_result["error"]
        and sleep_result["error"]
        and workout_result["error"]
        and cycle_result["error"]
    )
    if all_failed:
        try:
            return _build_history_payload_from_export(_load_latest_export_data())
        except Exception:
            pass

    return {
        "authStatus": auth_status,
        "dataSource": {
            "mode": "live",
            "label": "live",
            "exportDate": None,
            "exportDir": None,
        },
        "sources": sources,
        "profile": profile_result["data"] or {},
        "bodyMeasurements": body_result["data"] or {},
        "recovery": recovery_result["data"] or [],
        "sleep": sleep_result["data"] or [],
        "workouts": workout_result["data"] or [],
        "cycles": cycle_result["data"] or [],
    }


def _rows_in_range(rows: List[Dict[str, Any]], start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """Filter rows by inclusive ISO date range."""
    return [
        row for row in rows
        if row.get("date") and start_date <= row["date"] <= end_date
    ]


def _aggregate_period_metrics(payload: Dict[str, Any], start_date: str, end_date: str) -> Dict[str, Any]:
    """Aggregate key WHOOP metrics across a date range."""
    recovery_rows = _rows_in_range(payload.get("series", {}).get("recovery", []), start_date, end_date)
    sleep_rows = _rows_in_range(payload.get("series", {}).get("sleep", []), start_date, end_date)
    workout_rows = _rows_in_range(payload.get("series", {}).get("workouts", []), start_date, end_date)
    cycle_rows = _rows_in_range(payload.get("series", {}).get("cycles", []), start_date, end_date)

    return {
        "avgRecovery": mean([row.get("recoveryScore") for row in recovery_rows]),
        "avgHrv": mean([row.get("hrv") for row in recovery_rows]),
        "avgRestingHeartRate": mean([row.get("restingHeartRate") for row in recovery_rows]),
        "avgSleepHours": mean([row.get("actualHours") for row in sleep_rows]),
        "avgSleepPerformance": mean([row.get("sleepPerformance") for row in sleep_rows]),
        "workoutCount": len(workout_rows),
        "avgWorkoutStrain": mean([row.get("totalStrain") for row in workout_rows]),
        "avgCycleStrain": mean([row.get("strain") for row in cycle_rows]),
    }


def _next_day_recovery_map(recovery_rows: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """Map each date to the following day's recovery score."""
    by_date = {row.get("date"): row.get("recoveryScore") for row in recovery_rows if row.get("date")}
    shifted: Dict[str, Optional[float]] = {}
    for day in by_date:
        next_day = shift_date(day, 1)
        if next_day is not None:
            shifted[day] = by_date.get(next_day)
    return shifted


def _pair_series(
    x_by_date: Dict[str, Optional[float]],
    y_by_date: Dict[str, Optional[float]],
) -> Dict[str, Any]:
    """Build aligned x/y series and metadata."""
    dates = sorted(set(x_by_date) & set(y_by_date))
    paired_dates = [
        date for date in dates
        if x_by_date[date] is not None and y_by_date[date] is not None
    ]
    xs = [x_by_date[date] for date in paired_dates]
    ys = [y_by_date[date] for date in paired_dates]
    value = pearson(xs, ys)
    return {
        "value": value,
        "label": correlation_label(value),
        "samples": len(paired_dates),
    }


def _filter_raw_collection_by_days(
    records: List[Dict[str, Any]],
    timestamp_field: str,
    days: int,
) -> List[Dict[str, Any]]:
    """Filter raw WHOOP records by a trailing day window."""
    if days <= 0:
        return list(records)
    dated = [row for row in records if isinstance(row.get(timestamp_field), str) and len(row[timestamp_field]) >= 10]
    if not dated:
        return []
    latest = max(row[timestamp_field][:10] for row in dated)
    cutoff = shift_date(latest, -(days - 1))
    if cutoff is None:
        return dated
    return [row for row in dated if row[timestamp_field][:10] >= cutoff]


def _is_number(value: Any) -> bool:
    """True when value is a finite numeric type."""
    return isinstance(value, (int, float))

@mcp.tool()
def get_whoop_auth_status() -> Dict[str, Any]:
    """Get WHOOP authentication status"""
    print("Tool called: get_whoop_auth_status", file=sys.stderr)
    
    try:
        init_whoop_client()
        status = whoop_client.get_auth_status()
        result = build_tool_result("get_whoop_auth_status", data=status)
        print(f"Auth status result: {status['status']}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_auth_status: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_auth_status", error=str(e))

@mcp.tool()
async def get_whoop_profile() -> Dict[str, Any]:
    """Get WHOOP user profile information"""
    print("Tool called: get_whoop_profile", file=sys.stderr)
    
    try:
        init_whoop_client()
        data = await whoop_client.get_user_profile()
        result = build_tool_result("get_whoop_profile", data=data)
        print(f"Profile result: {data.get('first_name', 'N/A')}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_profile: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_profile", error=str(e))

@mcp.tool()
async def get_whoop_body_measurements() -> Dict[str, Any]:
    """Get WHOOP user body measurements."""
    print("Tool called: get_whoop_body_measurements", file=sys.stderr)

    try:
        init_whoop_client()
        data = await whoop_client.get_body_measurements()
        result = build_tool_result("get_whoop_body_measurements", data=data)
        print("Body measurements retrieved", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_body_measurements: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_body_measurements", error=str(e))


@mcp.tool()
async def get_whoop_workouts(
    limit: int = 5,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    next_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Get WHOOP workout data"""
    print(
        f"Tool called: get_whoop_workouts (limit={limit}, start_date={start_date}, "
        f"end_date={end_date}, next_token={next_token})",
        file=sys.stderr,
    )
    
    try:
        init_whoop_client()
        data = await whoop_client.get_workouts(
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            next_token=next_token,
        )
        result = build_tool_result("get_whoop_workouts", data=data)
        print(f"Workouts result: {record_count(data)} records", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_workouts: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_workouts", error=str(e))

@mcp.tool()
async def get_whoop_recovery(
    limit: int = 5,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    next_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Get WHOOP recovery data"""
    print(
        f"Tool called: get_whoop_recovery (limit={limit}, start_date={start_date}, "
        f"end_date={end_date}, next_token={next_token})",
        file=sys.stderr,
    )
    
    try:
        init_whoop_client()
        data = await whoop_client.get_recovery(
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            next_token=next_token,
        )
        result = build_tool_result("get_whoop_recovery", data=data)
        print(f"Recovery result: {record_count(data)} records", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_recovery: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_recovery", error=str(e))


@mcp.tool()
async def get_whoop_sleep(
    limit: int = 5,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    next_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Get WHOOP sleep data"""
    print(
        f"Tool called: get_whoop_sleep (limit={limit}, start_date={start_date}, "
        f"end_date={end_date}, next_token={next_token})",
        file=sys.stderr,
    )

    try:
        init_whoop_client()
        data = await whoop_client.get_sleep(
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            next_token=next_token,
        )
        result = build_tool_result("get_whoop_sleep", data=data)
        print(f"Sleep result: {record_count(data)} records", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_sleep: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_sleep", error=str(e))


@mcp.tool()
async def get_whoop_cycles(
    limit: int = 5,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    next_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Get WHOOP physiological cycle data"""
    print(
        f"Tool called: get_whoop_cycles (limit={limit}, start_date={start_date}, "
        f"end_date={end_date}, next_token={next_token})",
        file=sys.stderr,
    )

    try:
        init_whoop_client()
        data = await whoop_client.get_cycles(
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            next_token=next_token,
        )
        result = build_tool_result("get_whoop_cycles", data=data)
        print(f"Cycles result: {record_count(data)} records", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_cycles: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_cycles", error=str(e))


@mcp.tool()
async def get_whoop_dashboard_snapshot(refresh: bool = False) -> Dict[str, Any]:
    """Get the same analyzed dashboard payload used by the local WHOOP web app."""
    print(
        f"Tool called: get_whoop_dashboard_snapshot (refresh={refresh})",
        file=sys.stderr,
    )

    try:
        data = await _build_dashboard_snapshot_with_fallback(refresh=refresh)
        result = build_tool_result("get_whoop_dashboard_snapshot", data=data)
        print("Dashboard snapshot retrieved", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_dashboard_snapshot: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_dashboard_snapshot", error=str(e))


@mcp.tool()
async def get_whoop_full_history(refresh: bool = False) -> Dict[str, Any]:
    """Get all WHOOP data sources used by the dashboard as raw records."""
    print(
        f"Tool called: get_whoop_full_history (refresh={refresh})",
        file=sys.stderr,
    )

    try:
        data = await build_full_history_snapshot(refresh=refresh)
        result = build_tool_result("get_whoop_full_history", data=data)
        print("Full history snapshot retrieved", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error in get_whoop_full_history: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_full_history", error=str(e))


@mcp.tool()
async def analyze_whoop_trends(metric: str = "recovery", days: int = 30) -> Dict[str, Any]:
    """Analyze a WHOOP metric trend over a trailing window."""
    print(
        f"Tool called: analyze_whoop_trends (metric={metric}, days={days})",
        file=sys.stderr,
    )

    try:
        payload = await _build_dashboard_snapshot_with_fallback(refresh=False)
        metric_config = _metric_series(payload, metric)
        rows = _filter_rows_by_days(metric_config["rows"], days)
        value_key = metric_config["valueKey"]
        valid_rows = [row for row in rows if _is_number(row.get(value_key))]
        values = [row[value_key] for row in valid_rows]

        current_value = values[-1] if values else None
        recent_7 = _average_of_last(values, 7)
        previous_7 = mean(values[-14:-7]) if len(values) >= 14 else None
        recent_14 = _average_of_last(values, 14)
        recent_30 = _average_of_last(values, 30)
        wow_delta = delta(recent_7, previous_7)
        wow_percent = percent_change(recent_7, previous_7)

        best = max(valid_rows, key=lambda row: row[value_key], default=None)
        worst = min(valid_rows, key=lambda row: row[value_key], default=None)

        anomalies: List[Dict[str, Any]] = []
        if len(values) >= 3:
            average_value = statistics.mean(values)
            std_dev = statistics.pstdev(values)
            if std_dev > 0:
                threshold = std_dev * 2
                for row in valid_rows:
                    if abs(row[value_key] - average_value) > threshold:
                        anomalies.append(
                            {
                                "date": row.get("date"),
                                "value": row.get(value_key),
                                "zScoreApprox": round((row[value_key] - average_value) / std_dev, 2),
                            }
                        )

        result_data = {
            "metric": metric_config["metric"],
            "unit": metric_config["unit"],
            "windowDays": days,
            "currentValue": current_value,
            "averages": {
                "days7": recent_7,
                "days14": recent_14,
                "days30": recent_30,
            },
            "weekOverWeek": {
                "delta": wow_delta,
                "percentChange": wow_percent,
                "trendDirection": _trend_direction(recent_7, previous_7),
            },
            "bestInPeriod": {
                "date": best.get("date") if best else None,
                "value": best.get(value_key) if best else None,
            },
            "worstInPeriod": {
                "date": worst.get("date") if worst else None,
                "value": worst.get(value_key) if worst else None,
            },
            "anomalies": anomalies,
            "samples": len(valid_rows),
            "dataSource": payload.get("dataSource"),
        }
        return build_tool_result("analyze_whoop_trends", data=result_data)
    except Exception as e:
        print(f"Error in analyze_whoop_trends: {e}", file=sys.stderr)
        return build_tool_result("analyze_whoop_trends", error=str(e))


@mcp.tool()
async def compare_whoop_periods(
    start_date_1: str,
    end_date_1: str,
    start_date_2: str,
    end_date_2: str,
) -> Dict[str, Any]:
    """Compare key WHOOP metrics across two explicit date ranges."""
    print(
        "Tool called: compare_whoop_periods "
        f"({start_date_1}..{end_date_1} vs {start_date_2}..{end_date_2})",
        file=sys.stderr,
    )

    try:
        payload = await _build_dashboard_snapshot_with_fallback(refresh=False)
        period_1 = _aggregate_period_metrics(payload, start_date_1, end_date_1)
        period_2 = _aggregate_period_metrics(payload, start_date_2, end_date_2)

        delta_keys = [
            "avgRecovery",
            "avgHrv",
            "avgRestingHeartRate",
            "avgSleepHours",
            "avgSleepPerformance",
            "avgWorkoutStrain",
            "avgCycleStrain",
        ]
        deltas = {
            key: {
                "delta": delta(period_2.get(key), period_1.get(key)),
                "percentChange": percent_change(period_2.get(key), period_1.get(key)),
            }
            for key in delta_keys
        }
        deltas["workoutCount"] = {
            "delta": (
                (period_2.get("workoutCount") or 0) - (period_1.get("workoutCount") or 0)
            ),
            "percentChange": percent_change(
                float(period_2.get("workoutCount") or 0),
                float(period_1.get("workoutCount") or 0),
            ),
        }

        comparison = {
            "period1": {
                "startDate": start_date_1,
                "endDate": end_date_1,
                "metrics": period_1,
            },
            "period2": {
                "startDate": start_date_2,
                "endDate": end_date_2,
                "metrics": period_2,
            },
            "delta": deltas,
            "dataSource": payload.get("dataSource"),
        }
        return build_tool_result("compare_whoop_periods", data=comparison)
    except Exception as e:
        print(f"Error in compare_whoop_periods: {e}", file=sys.stderr)
        return build_tool_result("compare_whoop_periods", error=str(e))


@mcp.tool()
async def get_whoop_correlations(days: int = 90) -> Dict[str, Any]:
    """Compute relationship scores between major WHOOP metrics."""
    print(f"Tool called: get_whoop_correlations (days={days})", file=sys.stderr)

    try:
        payload = await _build_dashboard_snapshot_with_fallback(refresh=False)
        recovery_rows = _filter_rows_by_days(payload.get("series", {}).get("recovery", []), days)
        sleep_rows = _filter_rows_by_days(payload.get("series", {}).get("sleep", []), days)
        workout_rows = _filter_rows_by_days(payload.get("series", {}).get("workouts", []), days)

        recovery_by_date = {
            row.get("date"): row.get("recoveryScore")
            for row in recovery_rows
            if row.get("date")
        }
        next_day_recovery = _next_day_recovery_map(recovery_rows)
        sleep_perf_by_date = {
            row.get("date"): row.get("sleepPerformance")
            for row in sleep_rows
            if row.get("date")
        }
        sleep_hours_by_date = {
            row.get("date"): row.get("actualHours")
            for row in sleep_rows
            if row.get("date")
        }
        sleep_debt_by_date = {
            row.get("date"): row.get("debtHours")
            for row in sleep_rows
            if row.get("date")
        }
        sleep_consistency_by_date = {
            row.get("date"): row.get("sleepConsistency")
            for row in sleep_rows
            if row.get("date")
        }
        workout_strain_by_date = {
            row.get("date"): row.get("totalStrain")
            for row in workout_rows
            if row.get("date")
        }
        hrv_by_date = {
            row.get("date"): row.get("hrv")
            for row in recovery_rows
            if row.get("date")
        }

        correlations = [
            {
                "name": "Sleep performance vs next-day recovery",
                **_pair_series(sleep_perf_by_date, next_day_recovery),
            },
            {
                "name": "Sleep hours vs recovery",
                **_pair_series(sleep_hours_by_date, recovery_by_date),
            },
            {
                "name": "Sleep debt vs recovery",
                **_pair_series(sleep_debt_by_date, recovery_by_date),
            },
            {
                "name": "Workout strain vs next-day recovery",
                **_pair_series(workout_strain_by_date, next_day_recovery),
            },
            {
                "name": "HRV vs recovery",
                **_pair_series(hrv_by_date, recovery_by_date),
            },
            {
                "name": "Sleep consistency vs recovery",
                **_pair_series(sleep_consistency_by_date, recovery_by_date),
            },
        ]

        result_data = {
            "windowDays": days,
            "correlations": correlations,
            "dataSource": payload.get("dataSource"),
        }
        return build_tool_result("get_whoop_correlations", data=result_data)
    except Exception as e:
        print(f"Error in get_whoop_correlations: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_correlations", error=str(e))


@mcp.tool()
async def get_whoop_insights(days: int = 30) -> Dict[str, Any]:
    """Return narrative dashboard insights over a trailing day window."""
    print(f"Tool called: get_whoop_insights (days={days})", file=sys.stderr)

    try:
        history = await build_full_history_snapshot(refresh=False)
        profile = history.get("profile") or {}
        body = history.get("bodyMeasurements") or {}
        auth_status = history.get("authStatus") or {"status": "unknown"}

        filtered_recovery = _filter_raw_collection_by_days(
            history.get("recovery") or [],
            "created_at",
            days,
        )
        filtered_sleep = _filter_raw_collection_by_days(
            history.get("sleep") or [],
            "start",
            days,
        )
        filtered_workouts = _filter_raw_collection_by_days(
            history.get("workouts") or [],
            "start",
            days,
        )
        filtered_cycles = _filter_raw_collection_by_days(
            history.get("cycles") or [],
            "start",
            days,
        )

        filtered_history = {
            "bodyMeasurements": body,
            "recovery": filtered_recovery,
            "sleep": filtered_sleep,
            "workouts": filtered_workouts,
            "cycles": filtered_cycles,
        }

        analyzer = DashboardAnalyzer()
        scoped_payload = analyzer._build_payload(
            profile,
            body,
            auth_status,
            filtered_recovery,
            filtered_sleep,
            filtered_workouts,
            filtered_cycles,
            _source_summary_from_history(filtered_history),
            data_source=history.get("dataSource"),
        )
        result_data = {
            "windowDays": days,
            "insights": scoped_payload.get("insights") or [],
            "dataSource": scoped_payload.get("dataSource"),
        }
        return build_tool_result("get_whoop_insights", data=result_data)
    except Exception as e:
        print(f"Error in get_whoop_insights: {e}", file=sys.stderr)
        return build_tool_result("get_whoop_insights", error=str(e))

if __name__ == "__main__":
    transport = resolve_mcp_transport()
    if transport == "streamable-http":
        os.environ.setdefault("FASTMCP_HOST", resolve_streamable_http_host())
        os.environ.setdefault("FASTMCP_PORT", str(resolve_streamable_http_port()))

    print(
        f"Starting Final WHOOP MCP Server with FastMCP (transport={transport})...",
        file=sys.stderr,
    )

    # Initialize WHOOP client early
    init_whoop_client()

    print("FastMCP server ready", file=sys.stderr)
    # Run the FastMCP server
    mcp.run(transport=transport)
