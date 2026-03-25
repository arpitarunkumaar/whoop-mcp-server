#!/usr/bin/env python3
"""
WHOOP OAuth Setup.
Spins up a local callback server so WHOOP redirects straight to your machine.

Usage:
    python3 setup.py --client-id YOUR_ID --client-secret YOUR_SECRET
"""

import argparse
import html
import os
import sys
import json
import secrets
import webbrowser
import urllib.parse
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

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


SETUPTOOLS_COMMANDS = {
    "build",
    "build_py",
    "build_ext",
    "sdist",
    "bdist",
    "bdist_wheel",
    "bdist_egg",
    "install",
    "develop",
    "egg_info",
    "dist_info",
    "clean",
    "check",
    "rotate",
}

SETUPTOOLS_QUERY_FLAGS = {
    "--help",
    "-h",
    "--help-commands",
    "--name",
    "--version",
    "--fullname",
    "--author",
    "--author-email",
    "--maintainer",
    "--maintainer-email",
    "--contact",
    "--contact-email",
    "--url",
    "--license",
    "--description",
    "--long-description",
    "--platforms",
    "--classifiers",
    "--keywords",
    "--provides",
    "--requires",
    "--obsoletes",
}


def should_run_setuptools(argv: list[str]) -> bool:
    """Return True when setup.py is being invoked as a packaging entrypoint."""
    args = argv[1:]
    if any(flag in SETUPTOOLS_QUERY_FLAGS for flag in args):
        return True

    for arg in args:
        if arg.startswith("-"):
            continue
        return arg in SETUPTOOLS_COMMANDS

    return False

# ── Callback handler ──────────────────────────────────────────────────────────
_auth_code = None
_callback_error = None
_server_done = threading.Event()
_expected_state = None  # set before the browser opens

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code, _callback_error
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "error" in params:
            error = params.get("error", ["unknown"])[0]
            error_description = params.get("error_description", [""])[0]
            error_hint = params.get("error_hint", [""])[0]
            _callback_error = {
                "error": error,
                "error_description": error_description,
                "error_hint": error_hint,
            }

            c(f"OAuth callback error: {error}", Colors.FAIL)
            if error_description:
                c(f"Description: {error_description}", Colors.WARN)
            if error_hint:
                c(f"Hint: {error_hint}", Colors.WARN)

            details = ""
            if error_description:
                details += f"<p>{html.escape(error_description)}</p>"
            if error_hint:
                details += f"<p>{html.escape(error_hint)}</p>"
            body = f"<h2>Authorization failed: {html.escape(error)}</h2>{details}".encode()
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(body)
            _server_done.set()
            return

        received_state = params.get("state", [None])[0]
        if received_state != _expected_state:
            _callback_error = {
                "error": "state_mismatch",
                "error_description": "State mismatch - possible CSRF. Please try again.",
                "error_hint": "",
            }
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
    import requests

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
    from src.auth_manager import TokenManager

    parser = argparse.ArgumentParser(description="Direct WHOOP OAuth setup")
    parser.add_argument("--client-id",     required=True, help="WHOOP app Client ID")
    parser.add_argument("--client-secret", required=True, help="WHOOP app Client Secret")
    parser.add_argument(
        "--redirect-uri",
        default=None,
        help=(
            "Full redirect URI to use. Must exactly match a registered WHOOP app "
            "redirect URI and include host+port for the local callback server."
        ),
    )
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

    if args.redirect_uri:
        parsed_redirect = urllib.parse.urlparse(args.redirect_uri)
        if parsed_redirect.scheme != "http":
            parser.error("--redirect-uri must use http:// for local callback handling.")
        if not parsed_redirect.hostname or not parsed_redirect.port:
            parser.error(
                "--redirect-uri must include host and port, "
                "for example http://127.0.0.1:8786/callback"
            )
        callback_host = parsed_redirect.hostname
        callback_port = parsed_redirect.port
        redirect_uri = args.redirect_uri
    else:
        callback_host = args.callback_host
        callback_port = args.callback_port
        redirect_uri = f"http://{callback_host}:{callback_port}/callback"

    c("=" * 60, Colors.HEADER)
    c("🏃 WHOOP Direct OAuth Setup", Colors.HEADER)
    c("=" * 60, Colors.HEADER)
    print()

    c("Before continuing, add this Redirect URI to your WHOOP Developer app:", Colors.INFO)
    c(f"  {redirect_uri}", Colors.BOLD)
    c("This value must exactly match one of your WHOOP app redirect URIs.", Colors.WARN)
    c("Requested scopes:", Colors.INFO)
    c(f"  {args.scopes}", Colors.BOLD)
    print()

    global _auth_code, _callback_error
    _auth_code = None
    _callback_error = None
    _server_done.clear()

    # Start local callback server in background
    t = threading.Thread(
        target=run_server, args=(callback_host, callback_port), daemon=True
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

    # Preflight the auth URL so provider-side client errors are surfaced immediately.
    try:
        probe = requests.get(auth_url, allow_redirects=False, timeout=15)
        redirect_location = probe.headers.get("Location") or probe.headers.get("location")
        if probe.status_code in {301, 302, 303, 307, 308} and redirect_location:
            parsed_location = urllib.parse.urlparse(redirect_location)
            if parsed_location.path.endswith("/oauth/oauth2/fallbacks/error"):
                error_params = urllib.parse.parse_qs(parsed_location.query)
                error = error_params.get("error", ["unknown"])[0]
                error_description = error_params.get("error_description", [""])[0]
                error_hint = error_params.get("error_hint", [""])[0]

                c("❌ WHOOP rejected the OAuth request before login.", Colors.FAIL)
                c(f"Error: {error}", Colors.FAIL)
                if error_description:
                    c(f"Description: {error_description}", Colors.WARN)
                if error_hint:
                    c(f"Hint: {error_hint}", Colors.WARN)
                c("Check WHOOP client ID/secret and registered redirect URI.", Colors.WARN)
                sys.exit(1)
    except requests.RequestException as exc:
        c(f"⚠️ Preflight check skipped: {exc}", Colors.WARN)

    c("Opening browser for WHOOP authorization...", Colors.INFO)
    c("Log in and click Authorize. This page will close automatically.", Colors.WARN)
    print()
    webbrowser.open(auth_url)

    # Wait for callback (timeout 120s)
    completed = _server_done.wait(timeout=120)
    if not completed or not _auth_code:
        if _callback_error:
            c(f"❌ Authorization failed: {_callback_error['error']}", Colors.FAIL)
            if _callback_error.get("error_description"):
                c(_callback_error["error_description"], Colors.WARN)
            if _callback_error.get("error_hint"):
                c(_callback_error["error_hint"], Colors.WARN)
        else:
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
    token_data["success"] = True  # Backward compatibility with old token payload checks.
    token_data["client_id"] = args.client_id
    token_data["client_secret"] = args.client_secret

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
    if should_run_setuptools(sys.argv):
        from setuptools import setup as setuptools_setup

        setuptools_setup()
    else:
        try:
            main()
        except KeyboardInterrupt:
            c("\n⚠️  Cancelled.", Colors.WARN)
            sys.exit(1)
