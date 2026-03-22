#!/usr/bin/env python3
"""
Local WHOOP dashboard web server.
"""
import argparse
import asyncio
import json
import mimetypes
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse

from config import EXPORT_DIR
from dashboard_analysis import DashboardAnalyzer
from whoop_client import WhoopClient


STATIC_ROOT = Path(__file__).resolve().parent / "web"
WHOOP_CLIENT = WhoopClient()
ANALYZER = DashboardAnalyzer(WHOOP_CLIENT)
EXPORT_BASE_DIR = Path(EXPORT_DIR).expanduser().resolve()
OVERRIDE_EXPORT_DIR: Optional[Path] = None


class DashboardRequestHandler(BaseHTTPRequestHandler):
    """Serves static dashboard assets and the WHOOP analysis API."""

    server_version = "WhoopDashboard/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/dashboard":
            self._handle_dashboard_request(parsed.query)
            return

        self._serve_static(parsed.path)

    def log_message(self, format: str, *args: object) -> None:
        """Keep request logs readable."""
        print(f"[dashboard] {format % args}", file=sys.stderr)

    def _handle_dashboard_request(self, query_string: str) -> None:
        """Generate a live payload with offline export fallback."""
        try:
            query = parse_qs(query_string)
            refresh = query.get("refresh", ["0"])[0] in {"1", "true", "yes"}
            payload = asyncio.run(ANALYZER.build_dashboard(refresh=refresh))
            if payload.get("errorState"):
                offline_payload = self._load_offline_payload()
                if offline_payload:
                    self._send_json(offline_payload)
                    return
            self._send_json(payload)
        except Exception as exc:  # pragma: no cover - exercised via manual smoke test
            offline_payload = self._load_offline_payload()
            if offline_payload:
                self._send_json(offline_payload)
                return
            self._send_json(
                {
                    "error": str(exc),
                    "hint": "Check WHOOP authentication/network or provide an export via --export-dir.",
                },
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def _load_offline_payload(self) -> Optional[dict]:
        """Load the dashboard payload from exported WHOOP data."""
        try:
            export_dir = OVERRIDE_EXPORT_DIR
            if export_dir is None:
                export_dir = DashboardAnalyzer.find_latest_export_dir(EXPORT_BASE_DIR)
            if export_dir is None:
                return None
            exported = DashboardAnalyzer.load_from_export(export_dir)
            analyzer = DashboardAnalyzer(data=exported, data_source=exported.get("dataSource"))
            return asyncio.run(analyzer.build_dashboard())
        except Exception as exc:
            print(f"[dashboard] Offline fallback failed: {exc}", file=sys.stderr)
            return None

    def _serve_static(self, request_path: str) -> None:
        """Serve dashboard HTML, CSS, and JS assets."""
        if request_path in {"", "/"}:
            target = STATIC_ROOT / "index.html"
        else:
            target = (STATIC_ROOT / request_path.lstrip("/")).resolve()
            if not str(target).startswith(str(STATIC_ROOT.resolve())):
                self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
                return
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                target = STATIC_ROOT / "index.html"

        if not target.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_type, _ = mimetypes.guess_type(str(target))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self._send_no_cache_headers()
        self.end_headers()
        self.wfile.write(target.read_bytes())

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        """Write a JSON response."""
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_no_cache_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_no_cache_headers(self) -> None:
        """Force fresh assets while iterating on the local dashboard."""
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")


def main() -> None:
    """Start the local dashboard server."""
    global OVERRIDE_EXPORT_DIR
    parser = argparse.ArgumentParser(description="Run the WHOOP dashboard web app.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind.")
    parser.add_argument(
        "--export-dir",
        default=None,
        help="Optional specific WHOOP export directory to force offline mode fallback.",
    )
    args = parser.parse_args()
    if args.export_dir:
        OVERRIDE_EXPORT_DIR = Path(args.export_dir).expanduser().resolve()

    server = ThreadingHTTPServer((args.host, args.port), DashboardRequestHandler)
    print(f"WHOOP dashboard available at http://{args.host}:{args.port}", file=sys.stderr)
    if OVERRIDE_EXPORT_DIR:
        print(f"Offline export override: {OVERRIDE_EXPORT_DIR}", file=sys.stderr)
    else:
        print(f"Offline export base: {EXPORT_BASE_DIR}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping WHOOP dashboard server.", file=sys.stderr)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
