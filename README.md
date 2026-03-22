# WHOOP MCP Server

Connect WHOOP data to Claude Desktop through MCP. This server authenticates with WHOOP, fetches fitness/recovery datasets, and exposes them as MCP tools.

## What It Can Do

- Return WHOOP profile and body measurements.
- Return workouts, recovery, sleep, and cycles with date filters and pagination.
- Return an analyzed dashboard snapshot for quick trend views.
- Return full raw history used by the dashboard.
- Return precomp analytics for trends, period comparisons, correlations + narrative insights.
- Export flattened CSV for spreadsheet & pandas workflows.
- Keep tokens encrypted locally and refresh them automatically.

## MCP Tools

- `get_whoop_auth_status`: token/auth health.
- `get_whoop_profile`: WHOOP profile.
- `get_whoop_body_measurements`: body measurement record.
- `get_whoop_workouts(limit, start_date, end_date, next_token)`: workouts.
- `get_whoop_recovery(limit, start_date, end_date, next_token)`: recovery records.
- `get_whoop_sleep(limit, start_date, end_date, next_token)`: sleep records.
- `get_whoop_cycles(limit, start_date, end_date, next_token)`: cycle records.
- `get_whoop_dashboard_snapshot(refresh)`: aggregated dashboard payload.
- `get_whoop_full_history(refresh)`: raw history payload.
- `analyze_whoop_trends(metric, days)`: trend stats for `recovery|sleep|hrv|strain|rhr`.
- `compare_whoop_periods(start_date_1, end_date_1, start_date_2, end_date_2)`: side-by-side period comparison.
- `get_whoop_correlations(days)`: pairwise metric correlations (sleep/recovery/strain/HRV relationships).
- `get_whoop_insights(days)`: dashboard-style narrative insights for the selected trailing window.

Dates use `YYYY-MM-DD`.

## Requirements

- Python 3.10+ (3.11 ideally)
- Active WHOOP account
- Claude Desktop

## Install

```bash
git clone https://github.com/arpitarunkumaar/whoop-mcp-server.git
cd whoop-mcp-server
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -r requirements.txt
```

## Authorize WHOOP

Use the direct local OAuth flow (no third-party auth broker):

```bash
python3.11 setup.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

## Claude Desktop Setup

Claude config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

Use absolute paths:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "/absolute/path/to/python3",
      "args": ["/absolute/path/to/whoop-mcp-server/src/whoop_mcp_server.py"],
      "env": {
        "PYTHONPATH": "/absolute/path/to/whoop-mcp-server/src"
      }
    }
  }
}
```

Restart Claude Desktop after saving config.

## Quick Verification

Ask Claude:

- "Run `get_whoop_auth_status`."
- "Show my last 7 days of recovery and sleep."

## Local Dashboard

- Run `python3.11 src/whoop_dashboard_server.py` to start the local web dashboard.
- Open `http://localhost:8765` in your browser to view recovery, sleep, and workout trends.

## CSV Export

Generate JSON + CSV in one run:

```bash
python3.11 scripts/export_whoop_data.py --csv
```

Generate only JSON:

```bash
python3.11 scripts/export_whoop_data.py
```

CSV files are written into the selected export directory (for example `storage/exports/whoop-export-YYYYMMDDTHHMMSSZ/`):

- `recovery.csv`
- `sleep.csv`
- `workouts.csv`
- `cycles.csv`
- `daily_summary.csv`
- `csv_manifest.json` (row counts + metadata)

## Essential Notes

- Token storage path: `~/.whoop-mcp-server/`
- Logs: use `LOG_LEVEL` and optional `LOG_FILE` environment variables.
- Export utility (optional): `python scripts/export_whoop_data.py`
- If refresh fails after moving tokens between machines, set:
  - `WHOOP_CLIENT_ID`
  - `WHOOP_CLIENT_SECRET`
- If your `~/.whoop-mcp-server/tokens.json` was created before client credentials were persisted, re-run setup once so refresh remains stable:
  - `python3.11 setup.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET`

## Troubleshooting

- `No valid access token available`:
  - Re-run `python3.11 setup.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET`
- Claude does not show WHOOP tools:
  - Confirm absolute paths in `claude_desktop_config.json`
  - Ensure `PYTHONPATH` points to `<repo>/src`
  - Restart Claude Desktop

## License

MIT. See [LICENSE](LICENSE).
