import { Buffer } from "node:buffer";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { AccessUserProps, Env, OAuthStatePayload } from "./types";

const STATE_TTL_SECONDS = 10 * 60;
const OAUTH_STATE_KEY_PREFIX = "oauth:state:";

type EnvWithOAuthProvider = Env & { OAUTH_PROVIDER: OAuthHelpers };

function oauthStateKey(stateToken: string): string {
  return `${OAUTH_STATE_KEY_PREFIX}${stateToken}`;
}

function randomStateToken(): string {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function parseJwt(token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new Error("JWT must contain 3 parts.");
  }
  return {
    data: `${header}.${payload}`,
    header: parseJson<{ kid?: string }>(Buffer.from(header, "base64url").toString()),
    payload: parseJson<Record<string, unknown>>(Buffer.from(payload, "base64url").toString()),
    signature,
  };
}

async function fetchAccessPublicKey(env: Env, kid: string): Promise<CryptoKey> {
  const response = await fetch(env.ACCESS_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Access JWKS (${response.status}).`);
  }
  const jwks = (await response.json()) as { keys?: Array<JsonWebKey & { kid: string }> };
  const jwk = jwks.keys?.find((entry) => entry.kid === kid);
  if (!jwk) {
    throw new Error("Matching JWKS key was not found for Access id_token.");
  }
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5",
    },
    false,
    ["verify"],
  );
}

async function verifyAccessIdToken(env: Env, idToken: string): Promise<AccessUserProps> {
  const jwt = parseJwt(idToken);
  if (!jwt.header.kid) {
    throw new Error("Access id_token is missing a key id.");
  }

  const key = await fetchAccessPublicKey(env, jwt.header.kid);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Buffer.from(jwt.signature, "base64url"),
    Buffer.from(jwt.data),
  );

  if (!verified) {
    throw new Error("Unable to verify Access id_token signature.");
  }

  const payload = jwt.payload;
  const email = payload.email;
  const name = payload.name;
  const sub = payload.sub;
  const exp = payload.exp;

  if (typeof email !== "string" || typeof name !== "string" || typeof sub !== "string") {
    throw new Error("Access id_token is missing required claims (email/name/sub).");
  }
  if (typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Access id_token is expired.");
  }

  return {
    accessToken: "",
    email,
    name,
    sub,
  };
}

function buildAccessAuthorizeUrl(request: Request, env: Env, state: string): string {
  const authorizeUrl = new URL(env.ACCESS_AUTHORIZATION_URL);
  authorizeUrl.searchParams.set("client_id", env.ACCESS_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", new URL("/callback", request.url).href);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl.toString();
}

async function storeOAuthState(env: Env, stateToken: string, oauthReqInfo: AuthRequest) {
  const payload: OAuthStatePayload = {
    clientId: oauthReqInfo.clientId ?? "",
    createdAt: new Date().toISOString(),
    oauthReqInfo,
  };
  await env.OAUTH_KV.put(oauthStateKey(stateToken), JSON.stringify(payload), {
    expirationTtl: STATE_TTL_SECONDS,
  });
}

async function readOAuthState(env: Env, stateToken: string): Promise<AuthRequest> {
  const key = oauthStateKey(stateToken);
  const raw = await env.OAUTH_KV.get(key);
  if (!raw) {
    throw new Error("Invalid or expired OAuth state.");
  }

  const parsed = parseJson<OAuthStatePayload>(raw);
  if (!parsed.oauthReqInfo) {
    throw new Error("OAuth state payload is missing request metadata.");
  }
  await env.OAUTH_KV.delete(key);
  return parsed.oauthReqInfo as AuthRequest;
}

async function exchangeCodeForAccessTokens(
  request: Request,
  env: EnvWithOAuthProvider,
): Promise<{ access_token: string; id_token: string }> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("Missing OAuth code from Access callback.");
  }

  const response = await fetch(env.ACCESS_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: new URL("/callback", request.url).href,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Access token exchange failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };

  if (!payload.access_token || !payload.id_token) {
    throw new Error("Access token response is missing access_token or id_token.");
  }

  return {
    access_token: payload.access_token,
    id_token: payload.id_token,
  };
}

export async function handleAccessRequest(
  request: Request,
  env: EnvWithOAuthProvider,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/authorize") {
    const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    if (!oauthReqInfo.clientId) {
      return new Response("Invalid OAuth client request.", { status: 400 });
    }

    const stateToken = randomStateToken();
    await storeOAuthState(env, stateToken, oauthReqInfo);
    return Response.redirect(buildAccessAuthorizeUrl(request, env, stateToken), 302);
  }

  if (request.method === "GET" && url.pathname === "/callback") {
    try {
      const stateToken = url.searchParams.get("state");
      if (!stateToken) {
        return new Response("Missing OAuth state in callback.", { status: 400 });
      }

      const oauthReqInfo = await readOAuthState(env, stateToken);
      if (!oauthReqInfo.clientId) {
        return new Response("OAuth request context is incomplete.", { status: 400 });
      }

      const tokens = await exchangeCodeForAccessTokens(request, env);
      const idTokenClaims = await verifyAccessIdToken(env, tokens.id_token);

      const props: AccessUserProps = {
        accessToken: tokens.access_token,
        email: idTokenClaims.email,
        name: idTokenClaims.name,
        sub: idTokenClaims.sub,
      };

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        metadata: {
          label: props.name,
        },
        props,
        request: oauthReqInfo,
        scope: oauthReqInfo.scope,
        userId: props.sub,
      });

      return Response.redirect(redirectTo, 302);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown callback error.";
      return new Response(message, { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
}
