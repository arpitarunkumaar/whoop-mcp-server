# WHOOP Cloudflare Worker MCP

This directory contains the remote MCP server implementation for Cloudflare Workers:

- Transport: Streamable HTTP (`/mcp`)
- Auth: Cloudflare Access OAuth (`/authorize`, `/token`, `/register`, `/callback`)
- WHOOP token source: Cloudflare KV key `whoop:user:primary`

For full setup and deployment steps, use:

- [`../docs/cloudflare-remote-mcp.md`](../docs/cloudflare-remote-mcp.md)
