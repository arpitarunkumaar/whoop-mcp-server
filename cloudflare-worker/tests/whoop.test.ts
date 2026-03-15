import { describe, expect, it, vi } from "vitest";
import type { Env, WhoopTokenRecord } from "../src/types";
import {
  assertAllowedWhoopUser,
  buildWhoopAuthStatus,
  buildWhoopCollectionParams,
  refreshWhoopTokens,
  shouldRefreshToken,
} from "../src/whoop";

function buildEnv(overrides?: Partial<Env>): Env {
  return {
    ACCESS_AUTHORIZATION_URL: "https://access.example/authorize",
    ACCESS_CLIENT_ID: "client-id",
    ACCESS_CLIENT_SECRET: "client-secret",
    ACCESS_JWKS_URL: "https://access.example/jwks",
    ACCESS_TOKEN_URL: "https://access.example/token",
    COOKIE_ENCRYPTION_KEY: "cookie-key",
    MCP_OBJECT: {} as DurableObjectNamespace,
    OAUTH_KV: {
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    WHOOP_ALLOWED_EMAIL: "owner@example.com",
    WHOOP_CLIENT_ID: "whoop-client-id",
    WHOOP_CLIENT_SECRET: "whoop-client-secret",
    ...overrides,
  };
}

describe("shouldRefreshToken", () => {
  it("returns false for token that expires well after refresh buffer", () => {
    const now = Date.parse("2026-03-15T10:00:00.000Z");
    const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
    expect(shouldRefreshToken(expiresAt, now)).toBe(false);
  });

  it("returns true for token expiring inside the refresh buffer", () => {
    const now = Date.parse("2026-03-15T10:00:00.000Z");
    const expiresAt = new Date(now + 2 * 60 * 1000).toISOString();
    expect(shouldRefreshToken(expiresAt, now)).toBe(true);
  });

  it("returns true for already expired token", () => {
    const now = Date.parse("2026-03-15T10:00:00.000Z");
    const expiresAt = new Date(now - 60 * 1000).toISOString();
    expect(shouldRefreshToken(expiresAt, now)).toBe(true);
  });

  it("returns true when expiry is missing", () => {
    expect(shouldRefreshToken(undefined, Date.now())).toBe(true);
  });
});

describe("buildWhoopCollectionParams", () => {
  it("maps start_date/end_date/next_token to WHOOP query fields", () => {
    const params = buildWhoopCollectionParams({
      end_date: "2026-03-15",
      limit: 10,
      next_token: "NEXT123",
      start_date: "2026-03-01",
    });

    expect(params).toEqual({
      end: "2026-03-15",
      limit: "10",
      nextToken: "NEXT123",
      start: "2026-03-01",
    });
  });
});

describe("single-user allowlist", () => {
  it("allows matching email", () => {
    expect(() => assertAllowedWhoopUser("owner@example.com", "owner@example.com")).not.toThrow();
  });

  it("rejects non-matching email", () => {
    expect(() => assertAllowedWhoopUser("other@example.com", "owner@example.com")).toThrow(
      "not authorized",
    );
  });
});

describe("refreshWhoopTokens", () => {
  const record: WhoopTokenRecord = {
    access_token: "old-access",
    expires_at: "2026-03-15T10:00:00.000Z",
    refresh_token: "refresh-token",
    token_type: "Bearer",
    updated_at: "2026-03-15T09:00:00.000Z",
  };

  it("fails with relink guidance when refresh token is revoked", async () => {
    const env = buildEnv();
    const fetchFn = vi.fn(async () => new Response("invalid_grant", { status: 400 })) as typeof fetch;

    await expect(refreshWhoopTokens(env, record, fetchFn)).rejects.toThrow("relink_whoop_cf.sh");
  });
});

describe("buildWhoopAuthStatus", () => {
  it("returns no_tokens when token record is missing", () => {
    expect(buildWhoopAuthStatus(null)).toMatchObject({ status: "no_tokens" });
  });

  it("returns expired for expired token", () => {
    const now = Date.parse("2026-03-15T10:00:00.000Z");
    const record: WhoopTokenRecord = {
      access_token: "access",
      expires_at: "2026-03-15T09:00:00.000Z",
      refresh_token: "refresh",
      updated_at: "2026-03-15T08:00:00.000Z",
    };
    expect(buildWhoopAuthStatus(record, now)).toMatchObject({ status: "expired" });
  });
});
