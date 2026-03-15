import { describe, expect, it, vi } from "vitest";
import { handleAccessRequest } from "../src/access-handler";
import type { Env } from "../src/types";

type TestEnv = Env & {
  OAUTH_PROVIDER: {
    completeAuthorization: ReturnType<typeof vi.fn>;
    parseAuthRequest: ReturnType<typeof vi.fn>;
  };
};

function buildEnv(
  kvGet: ReturnType<typeof vi.fn>,
  kvDelete: ReturnType<typeof vi.fn>,
): TestEnv {
  return {
    ACCESS_AUTHORIZATION_URL: "https://access.example/authorize",
    ACCESS_CLIENT_ID: "client-id",
    ACCESS_CLIENT_SECRET: "client-secret",
    ACCESS_JWKS_URL: "https://access.example/jwks",
    ACCESS_TOKEN_URL: "https://access.example/token",
    COOKIE_ENCRYPTION_KEY: "cookie-key",
    MCP_OBJECT: {} as DurableObjectNamespace,
    OAUTH_KV: {
      delete: kvDelete,
      get: kvGet,
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    OAUTH_PROVIDER: {
      completeAuthorization: vi.fn(async () => ({ redirectTo: "https://client.example/callback" })),
      parseAuthRequest: vi.fn(),
    },
    WHOOP_ALLOWED_EMAIL: "owner@example.com",
    WHOOP_CLIENT_ID: "whoop-client-id",
    WHOOP_CLIENT_SECRET: "whoop-client-secret",
  };
}

describe("handleAccessRequest callback state handling", () => {
  it("does not delete OAuth state when JSON parsing fails", async () => {
    const kvGet = vi.fn(async () => "{");
    const kvDelete = vi.fn(async () => undefined);
    const env = buildEnv(kvGet, kvDelete);

    const response = await handleAccessRequest(
      new Request("https://worker.example/callback?state=token-1&code=code-1"),
      env as unknown as Parameters<typeof handleAccessRequest>[1],
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(kvDelete).not.toHaveBeenCalled();
  });

  it("does not delete OAuth state when request metadata is missing", async () => {
    const kvGet = vi.fn(async () =>
      JSON.stringify({
        clientId: "client-id",
        createdAt: "2026-03-15T00:00:00.000Z",
      }),
    );
    const kvDelete = vi.fn(async () => undefined);
    const env = buildEnv(kvGet, kvDelete);

    const response = await handleAccessRequest(
      new Request("https://worker.example/callback?state=token-2&code=code-2"),
      env as unknown as Parameters<typeof handleAccessRequest>[1],
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("OAuth state payload is missing request metadata.");
    expect(kvDelete).not.toHaveBeenCalled();
  });

  it("deletes OAuth state after successful validation", async () => {
    const kvGet = vi.fn(async () =>
      JSON.stringify({
        clientId: "client-id",
        createdAt: "2026-03-15T00:00:00.000Z",
        oauthReqInfo: {
          clientId: "client-id",
          scope: "openid",
        },
      }),
    );
    const kvDelete = vi.fn(async () => undefined);
    const env = buildEnv(kvGet, kvDelete);

    const response = await handleAccessRequest(
      new Request("https://worker.example/callback?state=token-3"),
      env as unknown as Parameters<typeof handleAccessRequest>[1],
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Missing OAuth code from Access callback.");
    expect(kvDelete).toHaveBeenCalledTimes(1);
    expect(kvDelete).toHaveBeenCalledWith("oauth:state:token-3");
  });
});
