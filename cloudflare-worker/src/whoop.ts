import type { Env, WhoopTokenRecord } from "./types";

export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_TOKEN_KV_KEY = "whoop:user:primary";
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type CollectionArgs = {
  end_date?: string;
  limit?: number;
  next_token?: string;
  start_date?: string;
};

type FetchFn = typeof fetch;

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

async function safeErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (_error) {
    return "<unavailable>";
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function buildWhoopCollectionParams(args: CollectionArgs): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(args.limit ?? 5),
  };

  if (args.start_date) {
    params.start = args.start_date;
  }
  if (args.end_date) {
    params.end = args.end_date;
  }
  if (args.next_token) {
    params.nextToken = args.next_token;
  }

  return params;
}

export function shouldRefreshToken(expiresAtIso: string | undefined, nowMs = Date.now()): boolean {
  if (!expiresAtIso) {
    return true;
  }

  const expiresAt = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAt)) {
    return true;
  }

  return expiresAt - nowMs <= TOKEN_REFRESH_BUFFER_MS;
}

export async function loadWhoopTokenRecord(
  env: Env,
  key = WHOOP_TOKEN_KV_KEY,
): Promise<WhoopTokenRecord | null> {
  const raw = await env.OAUTH_KV.get(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WhoopTokenRecord;
  } catch (_error) {
    throw new Error(
      "WHOOP token record is malformed in KV. Run scripts/bootstrap_whoop_to_cf.py again.",
    );
  }
}

export async function saveWhoopTokenRecord(
  env: Env,
  record: WhoopTokenRecord,
  key = WHOOP_TOKEN_KV_KEY,
): Promise<void> {
  await env.OAUTH_KV.put(key, JSON.stringify(record));
}

export function buildWhoopAuthStatus(record: WhoopTokenRecord | null, nowMs = Date.now()) {
  if (!record) {
    return {
      hint: "Bootstrap WHOOP tokens to KV using scripts/bootstrap_whoop_to_cf.py.",
      status: "no_tokens",
    };
  }

  const expiresAt = Date.parse(record.expires_at);
  const hasRefreshToken = Boolean(record.refresh_token);
  const isExpired = Number.isNaN(expiresAt) || expiresAt <= nowMs;

  return {
    created_at: record.updated_at,
    expires_at: record.expires_at,
    has_refresh_token: hasRefreshToken,
    status: isExpired ? "expired" : "valid",
    token_type: record.token_type ?? "Bearer",
  };
}

export async function refreshWhoopTokens(
  env: Env,
  currentRecord: WhoopTokenRecord,
  fetchFn: FetchFn = fetch,
): Promise<WhoopTokenRecord> {
  if (!currentRecord.refresh_token) {
    throw new Error(
      "WHOOP refresh token is missing. Run scripts/relink_whoop_cf.sh and then scripts/bootstrap_whoop_to_cf.py.",
    );
  }

  if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) {
    throw new Error("WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be configured as Worker secrets.");
  }

  const formBody = new URLSearchParams({
    client_id: env.WHOOP_CLIENT_ID,
    client_secret: env.WHOOP_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: currentRecord.refresh_token,
  });

  const response = await fetchFn(WHOOP_TOKEN_URL, {
    body: formBody,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await safeErrorBody(response);
    throw new Error(
      `WHOOP token refresh failed (${response.status}): ${body}. If refresh is revoked, run scripts/relink_whoop_cf.sh then scripts/bootstrap_whoop_to_cf.py.`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };

  if (!payload.access_token) {
    throw new Error(
      "WHOOP token refresh response did not include access_token. Re-run scripts/relink_whoop_cf.sh.",
    );
  }

  const expiresInSeconds = toNumber(payload.expires_in, 3600);
  const refreshed: WhoopTokenRecord = {
    access_token: payload.access_token,
    expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    refresh_token: payload.refresh_token ?? currentRecord.refresh_token,
    scope: payload.scope ?? currentRecord.scope,
    token_type: payload.token_type ?? currentRecord.token_type ?? "Bearer",
    updated_at: nowIso(),
  };

  await saveWhoopTokenRecord(env, refreshed);
  return refreshed;
}

export async function getValidWhoopTokenRecord(
  env: Env,
  fetchFn: FetchFn = fetch,
): Promise<WhoopTokenRecord> {
  const record = await loadWhoopTokenRecord(env);
  if (!record) {
    throw new Error(
      "No WHOOP tokens found in Cloudflare KV. Run scripts/bootstrap_whoop_to_cf.py first.",
    );
  }

  if (shouldRefreshToken(record.expires_at)) {
    return refreshWhoopTokens(env, record, fetchFn);
  }

  return record;
}

async function whoopGet(
  env: Env,
  endpoint: string,
  params?: Record<string, string>,
  fetchFn: FetchFn = fetch,
): Promise<unknown> {
  let record = await getValidWhoopTokenRecord(env, fetchFn);

  const makeRequest = async (accessToken: string) => {
    const url = new URL(`${WHOOP_API_BASE}/${endpoint.replace(/^\/+/, "")}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    return fetchFn(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "GET",
    });
  };

  let response = await makeRequest(record.access_token);

  // Retry once with a forced refresh on token/auth errors.
  if (response.status === 401) {
    record = await refreshWhoopTokens(env, record, fetchFn);
    response = await makeRequest(record.access_token);
  }

  if (!response.ok) {
    const body = await safeErrorBody(response);
    throw new Error(`WHOOP API request failed (${response.status}): ${body}`);
  }

  return response.json();
}

export function assertAllowedWhoopUser(accessEmail: string, allowedEmail: string): void {
  if (!allowedEmail) {
    throw new Error("WHOOP_ALLOWED_EMAIL is required for single-user access control.");
  }

  if (normalizeEmail(accessEmail) !== normalizeEmail(allowedEmail)) {
    throw new Error(`Access user ${accessEmail} is not authorized for WHOOP tool execution.`);
  }
}

export async function getWhoopAuthStatus(env: Env) {
  const record = await loadWhoopTokenRecord(env);
  return buildWhoopAuthStatus(record);
}

export async function getWhoopProfile(env: Env, fetchFn: FetchFn = fetch) {
  return whoopGet(env, "/user/profile/basic", undefined, fetchFn);
}

export async function getWhoopBodyMeasurements(env: Env, fetchFn: FetchFn = fetch) {
  return whoopGet(env, "/user/measurement/body", undefined, fetchFn);
}

export async function getWhoopWorkouts(
  env: Env,
  args: CollectionArgs,
  fetchFn: FetchFn = fetch,
) {
  return whoopGet(env, "/activity/workout", buildWhoopCollectionParams(args), fetchFn);
}

export async function getWhoopRecovery(
  env: Env,
  args: CollectionArgs,
  fetchFn: FetchFn = fetch,
) {
  return whoopGet(env, "/recovery", buildWhoopCollectionParams(args), fetchFn);
}

export async function getWhoopSleep(env: Env, args: CollectionArgs, fetchFn: FetchFn = fetch) {
  return whoopGet(env, "/activity/sleep", buildWhoopCollectionParams(args), fetchFn);
}

export async function getWhoopCycles(env: Env, args: CollectionArgs, fetchFn: FetchFn = fetch) {
  return whoopGet(env, "/cycle", buildWhoopCollectionParams(args), fetchFn);
}
