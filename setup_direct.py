#!/usr/bin/env python3
"""
Direct WHOOP OAuth Setup — bypasses the third-party broker.
Spins up a local callback server so WHOOP redirects straight to your machine.

Usage:
    python3 setup_direct.py --client-id YOUR_ID --client-secret YOUR_SECRET
"""

import argparse
import os
import sys
import json
import secrets
import webbrowser
import urllib.parse
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from src.auth_manager import TokenManager

# ── Config ────────────────────────────────────────────────────────────────────
WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
DEFAULT_SCOPES = (
    "read:profile read:workout read:sleep read:recovery "
    "read:cycles read:body_measurement offline"
)

class Colors:
    OK      = '\033[92m'
    INFO    = '\033[94m'
    WARN    = '\033[93m'
    FAIL    = '\033[91m'
    HEADER  = '\033[95m'
    BOLD    = '\033[1m'
    END     = '\033[0m'

def c(text, color): print(f"{color}{text}{Colors.END}")

# ── Callback handler ──────────────────────────────────────────────────────────
_auth_code = None
_server_done = threading.Event()
_expected_state = None  # set before the browser opens

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "error" in params:
            error = params.get("error", ["unknown"])[0]
            body = f"<h2>Authorization failed: {error}</h2>".encode()
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(body)
            _server_done.set()
            return

        received_state = params.get("state", [None])[0]
        if received_state != _expected_state:
            body = b"<h2>State mismatch - possible CSRF. Please try again.</h2>"
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(body)
            _server_done.set()
            return

        if "code" in params:
            _auth_code = params["code"][0]
            body = b"<h2>Authorization successful! You can close this tab.</h2>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

        _server_done.set()

    def log_message(self, *args):
        pass  # suppress request logs


def run_server(host, port):
    server = HTTPServer((host, port), CallbackHandler)
    server.handle_request()  # handle exactly one request then exit


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Direct WHOOP OAuth setup")
    parser.add_argument("--client-id",     required=True, help="WHOOP app Client ID")
    parser.add_argument("--client-secret", required=True, help="WHOOP app Client Secret")
    parser.add_argument(
        "--callback-host",
        default="127.0.0.1",
        help="Local host for the OAuth callback server.",
    )
    parser.add_argument(
        "--callback-port",
        type=int,
        default=8786,
        help="Local port for the OAuth callback server.",
    )
    parser.add_argument(
        "--scopes",
        default=DEFAULT_SCOPES,
        help=(
            "Space-separated WHOOP scopes to request. This must match the scopes "
            "configured on your WHOOP developer app."
        ),
    )
    args = parser.parse_args()
    redirect_uri = f"http://{args.callback_host}:{args.callback_port}/callback"

    c("=" * 60, Colors.HEADER)
    c("🏃 WHOOP Direct OAuth Setup", Colors.HEADER)
    c("=" * 60, Colors.HEADER)
    print()

    c("Before continuing, add this Redirect URI to your WHOOP Developer app:", Colors.INFO)
    c(f"  {redirect_uri}", Colors.BOLD)
    c("Requested scopes:", Colors.INFO)
    c(f"  {args.scopes}", Colors.BOLD)
    print()

    # Start local callback server in background
    t = threading.Thread(
        target=run_server, args=(args.callback_host, args.callback_port), daemon=True
    )
    t.start()

    # Generate a random state value for CSRF protection
    global _expected_state
    _expected_state = secrets.token_urlsafe(16)

    # Build the WHOOP authorization URL
    auth_params = {
        "client_id":     args.client_id,
        "redirect_uri":  redirect_uri,
        "response_type": "code",
        "scope":         args.scopes,
        "state":         _expected_state,
    }
    auth_url = f"{WHOOP_AUTH_URL}?{urllib.parse.urlencode(auth_params)}"

    c("Opening browser for WHOOP authorization...", Colors.INFO)
    c("Log in and click Authorize. This page will close automatically.", Colors.WARN)
    print()
    webbrowser.open(auth_url)

    # Wait for callback (timeout 120s)
    completed = _server_done.wait(timeout=120)
    if not completed or not _auth_code:
        c("❌ Timed out waiting for authorization. Please try again.", Colors.FAIL)
        sys.exit(1)

    c("✅ Authorization code received!", Colors.OK)

    # Exchange code for tokens directly with WHOOP
    c("\n🔄 Exchanging code for tokens...", Colors.INFO)
    resp = requests.post(
        WHOOP_TOKEN_URL,
        data={
            "grant_type":    "authorization_code",
            "code":          _auth_code,
            "redirect_uri":  redirect_uri,
            "client_id":     args.client_id,
            "client_secret": args.client_secret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )

    if resp.status_code != 200:
        c(f"❌ Token exchange failed ({resp.status_code}): {resp.text}", Colors.FAIL)
        sys.exit(1)

    token_data = resp.json()
    token_data["success"] = True  # TokenManager expects this field

    # Save tokens
    c("💾 Saving tokens...", Colors.INFO)
    TokenManager().save_tokens(token_data)
    c("✅ Tokens saved successfully!", Colors.OK)

    # Print Claude Desktop config
    server_path = Path(__file__).parent / "src" / "whoop_mcp_server.py"
    config = {
        "mcpServers": {
            "whoop": {
                "command": sys.executable,
                "args": [str(server_path.absolute())],
                "env": {"PYTHONPATH": str(Path(__file__).parent / "src")}
            }
        }
    }

    print()
    c("🎉 Setup complete! Add this to your Claude Desktop config:", Colors.HEADER)
    c("  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json", Colors.INFO)
    print()
    print(json.dumps(config, indent=2))
    print()
    c("Then restart Claude Desktop.", Colors.WARN)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        c("\n⚠️  Cancelled.", Colors.WARN)
        sys.exit(1)
