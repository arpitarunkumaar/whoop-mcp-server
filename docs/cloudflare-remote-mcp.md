# Cloudflare Remote MCP Deployment (WHOOP + Access)

This repo now includes a Cloudflare Worker MCP server in `cloudflare-worker/` for remote usage.

## 1. Prerequisites

- Cloudflare account with Workers + Zero Trust.
- Access for SaaS OIDC app (Cloudflare One).
- WHOOP developer app with scopes:
  - `read:profile`
  - `read:workout`
  - `read:sleep`
  - `read:recovery`
  - `read:cycles`
  - `read:body_measurement`
  - `offline`
- Node.js + npm.

## 2. Create Access for SaaS app

In Cloudflare One:

1. Go to **Access controls** -> **Applications** -> **Add application**.
2. Choose **SaaS** with **OIDC**.
3. Add redirect URIs:
   - `http://localhost:8788/callback`
   - `https://<worker-name>.<subdomain>.workers.dev/callback`
4. Save and copy:
   - Client ID
   - Client Secret
   - Authorization endpoint
   - Token endpoint
   - JWKS endpoint
5. Add an Access policy that allows only your user identity.

## 3. Configure Worker project

```bash
cd cloudflare-worker
npm install
```

Create the KV namespace and bind it in `cloudflare-worker/wrangler.jsonc`:

```bash
npx wrangler kv namespace create OAUTH_KV
```

Set Worker secrets:

```bash
npx wrangler secret put ACCESS_CLIENT_ID
npx wrangler secret put ACCESS_CLIENT_SECRET
npx wrangler secret put ACCESS_TOKEN_URL
npx wrangler secret put ACCESS_AUTHORIZATION_URL
npx wrangler secret put ACCESS_JWKS_URL
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put WHOOP_CLIENT_ID
npx wrangler secret put WHOOP_CLIENT_SECRET
npx wrangler secret put WHOOP_ALLOWED_EMAIL
```

For `COOKIE_ENCRYPTION_KEY`, generate a random value:

```bash
openssl rand -hex 32
```

## 4. Bootstrap WHOOP token record into KV

Run local WHOOP OAuth first (if not already done):

```bash
python3 setup.py --client-id "$WHOOP_CLIENT_ID" --client-secret "$WHOOP_CLIENT_SECRET"
```

Export Cloudflare API credentials:

```bash
export CLOUDFLARE_API_TOKEN="<api-token-with-kv-write>"
export CLOUDFLARE_ACCOUNT_ID="<account-id>"
export CLOUDFLARE_KV_NAMESPACE_ID="<oauth-kv-namespace-id>"
```

Upload local encrypted tokens to KV key `whoop:user:primary`:

```bash
python3 scripts/bootstrap_whoop_to_cf.py
```

## 5. Local integration test

Configure `cloudflare-worker/.dev.vars` from `.dev.vars.example`, then:

```bash
cd cloudflare-worker
npm run dev
```

Use MCP Inspector in another terminal:

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect to:

- `http://localhost:8788/mcp`

Then verify tools:

- `get_whoop_auth_status`
- `get_whoop_recovery` (or another dataset tool)

## 6. Deploy to Cloudflare

```bash
cd cloudflare-worker
npm run deploy
```

Remote endpoint:

- `https://<worker-name>.<subdomain>.workers.dev/mcp`

## 7. Connect Claude Desktop via `mcp-remote`

In Claude Desktop config:

```json
{
  "mcpServers": {
    "whoop_remote": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<worker-name>.<subdomain>.workers.dev/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop and complete browser auth flow when prompted.

## 8. Relink flow (refresh revoked / token invalid)

Re-run local WHOOP login and upload the new token record:

```bash
scripts/relink_whoop_cf.sh
```

The script accepts optional `bootstrap_whoop_to_cf.py` flags such as:

```bash
scripts/relink_whoop_cf.sh --account-id ... --namespace-id ... --api-token ...
```
