#!/usr/bin/env python3
"""
WHOOP MCP Server

A Model Context Protocol server that provides access to WHOOP fitness data
through MCP-compatible clients such as Claude Desktop and Codex using FastMCP.
"""
import asyncio
import sys
from datetime import datetime
from typing import Dict, Any, Optional

from mcp.server.fastmcp import FastMCP

# Import our WHOOP client
from dashboard_analysis import DashboardAnalyzer
from whoop_client import WhoopClient
from validation import validate_collection_filters

# Create FastMCP server
mcp = FastMCP("whoop-mcp-server")

# Global WHOOP client
whoop_client = None
dashboard_analyzer = None


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
        return {
            "authStatus": auth_status,
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

    return {
        "authStatus": auth_status,
        "sources": sources,
        "profile": profile_result["data"] or {},
        "bodyMeasurements": body_result["data"] or {},
        "recovery": recovery_result["data"] or [],
        "sleep": sleep_result["data"] or [],
        "workouts": workout_result["data"] or [],
        "cycles": cycle_result["data"] or [],
    }

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
    
    validation_error = validate_collection_filters(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        next_token=next_token,
    )
    if validation_error:
        return build_tool_result("get_whoop_workouts", error=validation_error)

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
    
    validation_error = validate_collection_filters(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        next_token=next_token,
    )
    if validation_error:
        return build_tool_result("get_whoop_recovery", error=validation_error)

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

    validation_error = validate_collection_filters(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        next_token=next_token,
    )
    if validation_error:
        return build_tool_result("get_whoop_sleep", error=validation_error)

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

    validation_error = validate_collection_filters(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        next_token=next_token,
    )
    if validation_error:
        return build_tool_result("get_whoop_cycles", error=validation_error)

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
        analyzer = init_dashboard_analyzer()
        data = await analyzer.build_dashboard(refresh=refresh)
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

if __name__ == "__main__":
    print("Starting Final WHOOP MCP Server with FastMCP...", file=sys.stderr)
    
    # Initialize WHOOP client early
    init_whoop_client()
    
    print("FastMCP server ready", file=sys.stderr)
    # Run the FastMCP server
    mcp.run()
