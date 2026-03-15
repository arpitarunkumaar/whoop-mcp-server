#!/usr/bin/env python3
"""
Bootstrap local WHOOP OAuth tokens into Cloudflare KV for the remote MCP Worker.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = REPO_ROOT / "src"
sys.path.insert(0, str(SRC_DIR))

from auth_manager import TokenManager  # noqa: E402

DEFAULT_KEY = "whoop:user:primary"
CF_KV_PUT_URL = (
    "https://api.cloudflare.com/client/v4/accounts/{account_id}"
    "/storage/kv/namespaces/{namespace_id}/values/{key}"
)


def resolve_expires_at(tokens: dict) -> str:
    expires_at = tokens.get("expires_at")
    if isinstance(expires_at, str) and expires_at:
        return expires_at

    timestamp = tokens.get("timestamp")
    expires_in = tokens.get("expires_in")
    if isinstance(timestamp, (int, float)) and isinstance(expires_in, (int, float)):
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc) + timedelta(seconds=expires_in)
        return dt.isoformat()

    fallback = datetime.now(tz=timezone.utc) + timedelta(minutes=30)
    return fallback.isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload local WHOOP encrypted tokens into Cloudflare KV."
    )
    parser.add_argument("--account-id", default=os.getenv("CLOUDFLARE_ACCOUNT_ID"))
    parser.add_argument("--namespace-id", default=os.getenv("CLOUDFLARE_KV_NAMESPACE_ID"))
    parser.add_argument("--api-token", default=os.getenv("CLOUDFLARE_API_TOKEN"))
    parser.add_argument("--key", default=DEFAULT_KEY)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def require(name: str, value: str | None) -> str:
    if not value:
        raise SystemExit(
            f"Missing {name}. Set it via flag or environment variable before running this script."
        )
    return value


def main() -> int:
    args = parse_args()
    account_id = require("CLOUDFLARE_ACCOUNT_ID / --account-id", args.account_id)
    namespace_id = require("CLOUDFLARE_KV_NAMESPACE_ID / --namespace-id", args.namespace_id)
    api_token = require("CLOUDFLARE_API_TOKEN / --api-token", args.api_token)

    token_manager = TokenManager()
    tokens = token_manager.load_tokens()
    if not tokens:
        raise SystemExit("No local WHOOP tokens found. Run setup.py OAuth flow first.")

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not access_token or not refresh_token:
        raise SystemExit("Local tokens are incomplete (access_token/refresh_token missing).")

    payload = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": resolve_expires_at(tokens),
        "token_type": tokens.get("token_type", "Bearer"),
        "scope": tokens.get("scope"),
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }

    if args.dry_run:
        masked = {
            **payload,
            "access_token": f"{payload['access_token'][:6]}...",
            "refresh_token": f"{payload['refresh_token'][:6]}...",
        }
        print(json.dumps(masked, indent=2))
        return 0

    encoded_key = quote(args.key, safe="")
    url = CF_KV_PUT_URL.format(
        account_id=account_id,
        namespace_id=namespace_id,
        key=encoded_key,
    )
    response = requests.put(
        url,
        data=json.dumps(payload),
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    if response.status_code != 200:
        raise SystemExit(
            f"Cloudflare KV write failed ({response.status_code}): {response.text}"
        )

    print(
        f"Uploaded WHOOP token record to KV key '{args.key}' in namespace '{namespace_id}'."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
