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
from urllib.parse import parse_qs, urlparse

from dashboard_analysis import DashboardAnalyzer
from whoop_client import WhoopClient


STATIC_ROOT = Path(__file__).resolve().parent / "web"
WHOOP_CLIENT = WhoopClient()
ANALYZER = DashboardAnalyzer(WHOOP_CLIENT)


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
        """Generate the live WHOOP dashboard payload."""
        try:
            query = parse_qs(query_string)
            refresh = query.get("refresh", ["0"])[0] in {"1", "true", "yes"}
            payload = asyncio.run(ANALYZER.build_dashboard(refresh=refresh))
            self._send_json(payload)
        except Exception as exc:  # pragma: no cover - exercised via manual smoke test
            self._send_json(
                {
                    "error": str(exc),
                    "hint": "Check WHOOP authentication and network access, then try again.",
                },
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

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
    parser = argparse.ArgumentParser(description="Run the WHOOP dashboard web app.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind.")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), DashboardRequestHandler)
    print(f"WHOOP dashboard available at http://{args.host}:{args.port}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping WHOOP dashboard server.", file=sys.stderr)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
