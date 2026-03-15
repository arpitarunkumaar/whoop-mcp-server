export type AccessUserProps = {
  accessToken: string;
  email: string;
  name: string;
  sub: string;
};

export type OAuthStatePayload = {
  clientId: string;
  oauthReqInfo: unknown;
  createdAt: string;
};

export type WhoopTokenRecord = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  token_type?: string;
  scope?: string;
  updated_at: string;
};

export interface Env {
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_JWKS_URL: string;
  ACCESS_TOKEN_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  WHOOP_ALLOWED_EMAIL: string;
  WHOOP_CLIENT_ID: string;
  WHOOP_CLIENT_SECRET: string;
}
