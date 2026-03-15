#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [[ -z "${WHOOP_CLIENT_ID:-}" || -z "${WHOOP_CLIENT_SECRET:-}" ]]; then
  echo "WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set (env or .env)." >&2
  exit 1
fi

echo "Step 1/2: re-running local WHOOP OAuth setup..."
python3 setup.py --client-id "${WHOOP_CLIENT_ID}" --client-secret "${WHOOP_CLIENT_SECRET}"

echo "Step 2/2: uploading refreshed tokens to Cloudflare KV..."
python3 scripts/bootstrap_whoop_to_cf.py "$@"

echo "WHOOP relink complete."
