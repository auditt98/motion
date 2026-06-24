import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomBytes } from "node:crypto";

/**
 * OAuth 2.1 for AI agents. The Motion MCP server is BOTH the authorization
 * server and the resource server:
 *
 *   - Discovery:   /.well-known/oauth-protected-resource  (RFC 9728)
 *                  /.well-known/oauth-authorization-server (RFC 8414)
 *   - DCR:         POST /oauth/register                    (RFC 7591)
 *   - Authorize:   GET  /oauth/authorize  → redirects to the web consent page
 *   - Approve:     POST /oauth/authorize/approve  (called by the web consent page
 *                  with the human's Supabase JWT; mints a scoped grant + code)
 *   - Token:       POST /oauth/token   (authorization_code + PKCE, refresh_token)
 *
 * User identity comes from Supabase (the human is already logged into the web
 * app). Access/refresh tokens are opaque and stored as SHA-256 hashes in
 * `agent_grants`, so revocation and expiry are enforced by a DB lookup.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MCP_PUBLIC_URL = process.env.MCP_PUBLIC_URL ?? "";
const WEB_APP_URL = process.env.WEB_APP_URL ?? "https://motion-web.pages.dev";

const ACCESS_TTL_SECONDS = 3600; // 1 hour; refreshed within the grant's lifetime
const AUTH_CODE_TTL_SECONDS = 600; // 10 minutes
const SUPPORTED_SCOPES = ["documents:read", "documents:write", "comments:write", "workspace:read"];

export interface AccessPrincipal {
  workspaceId: string;
  agentName: string;
  role: string;
  mode: string;
  grantId: string;
}

// ── small helpers ───────────────────────────────────────────────────────────

const sha256 = (input: string): string => createHash("sha256").update(input).digest("base64url");
const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
const nowPlus = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

function publicBaseUrl(req: IncomingMessage): string {
  if (MCP_PUBLIC_URL) return MCP_PUBLIC_URL.replace(/\/$/, "");
  const host = req.headers.host ?? "localhost";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

function send(res: ServerResponse, status: number, data: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function readRaw(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function readParams(req: IncomingMessage): Promise<Record<string, string>> {
  const raw = await readRaw(req);
  if (!raw) return {};
  const ct = (req.headers["content-type"] ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  // default: application/x-www-form-urlencoded
  return Object.fromEntries(new URLSearchParams(raw));
}

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  return res.ok;
}

async function sbPatch(table: string, filter: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

/** Resolve the Supabase user from their access token (proves who is consenting). */
async function resolveUser(jwt: string): Promise<{ id: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { id: "dev-user" };
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ? { id: user.id } : null;
}

async function workspaceRole(userId: string, workspaceId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return "owner";
  const rows = await sbGet<{ role: string }>(
    `workspace_members?user_id=eq.${encodeURIComponent(userId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=role&limit=1`,
  );
  return rows.length ? rows[0].role : null;
}

// ── discovery metadata ──────────────────────────────────────────────────────

export function metadataProtectedResource(req: IncomingMessage, res: ServerResponse): void {
  const base = publicBaseUrl(req);
  send(res, 200, {
    resource: base,
    authorization_servers: [base],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Motion",
  });
}

export function metadataAuthServer(req: IncomingMessage, res: ServerResponse): void {
  const base = publicBaseUrl(req);
  send(res, 200, {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SUPPORTED_SCOPES,
  });
}

/** The protected-resource metadata URL, for WWW-Authenticate on 401. */
export function resourceMetadataUrl(req: IncomingMessage): string {
  return `${publicBaseUrl(req)}/.well-known/oauth-protected-resource`;
}

// ── dynamic client registration (RFC 7591) ──────────────────────────────────

export async function register(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readParams(req);
  const redirectUris = Array.isArray((body as Record<string, unknown>).redirect_uris)
    ? ((body as Record<string, unknown>).redirect_uris as string[])
    : [];
  if (!redirectUris.length) {
    send(res, 400, { error: "invalid_redirect_uri", error_description: "redirect_uris is required" });
    return;
  }
  const clientId = `mcp_${randomToken(18)}`;
  const ok = await sbInsert("oauth_clients", {
    client_id: clientId,
    client_name: body.client_name ?? "MCP Client",
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
  });
  if (!ok) {
    send(res, 500, { error: "server_error", error_description: "Could not register client" });
    return;
  }
  send(res, 201, {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: body.client_name ?? "MCP Client",
  });
}

async function getClient(clientId: string): Promise<{ client_id: string; redirect_uris: string[] } | null> {
  const rows = await sbGet<{ client_id: string; redirect_uris: string[] }>(
    `oauth_clients?client_id=eq.${encodeURIComponent(clientId)}&select=client_id,redirect_uris&limit=1`,
  );
  return rows.length ? rows[0] : null;
}

// ── authorize → redirect the browser to the web consent page ─────────────────

export async function authorize(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const q = url.searchParams;
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const responseType = q.get("response_type") ?? "";
  const codeChallenge = q.get("code_challenge") ?? "";
  const codeChallengeMethod = q.get("code_challenge_method") ?? "";

  const client = clientId ? await getClient(clientId) : null;
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    // Can't safely redirect to an unverified URI — show a plain error.
    send(res, 400, { error: "invalid_request", error_description: "Unknown client_id or unregistered redirect_uri." });
    return;
  }

  const fail = (error: string, description: string): void => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    const state = q.get("state");
    if (state) u.searchParams.set("state", state);
    res.writeHead(302, { Location: u.toString() });
    res.end();
  };

  if (responseType !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (!codeChallenge || codeChallengeMethod !== "S256")
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");

  // Hand off to the web app's consent UI (the human is logged in there).
  const consent = new URL(`${WEB_APP_URL.replace(/\/$/, "")}/agent-consent`);
  for (const key of ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"]) {
    const v = q.get(key);
    if (v) consent.searchParams.set(key, v);
  }
  consent.searchParams.set("authorization_endpoint", `${publicBaseUrl(req)}/oauth/authorize/approve`);
  res.writeHead(302, { Location: consent.toString() });
  res.end();
}

// ── approve (called by the web consent page) ─────────────────────────────────

export async function approve(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = req.headers["authorization"];
  const jwt = !auth || Array.isArray(auth) ? null : /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  if (!jwt) {
    send(res, 401, { error: "login_required", error_description: "Sign in to Motion to approve." });
    return;
  }
  const user = await resolveUser(jwt);
  if (!user) {
    send(res, 401, { error: "invalid_token", error_description: "Could not verify your Motion session." });
    return;
  }

  const body = await readParams(req);
  const clientId = body.client_id ?? "";
  const redirectUri = body.redirect_uri ?? "";
  const workspaceId = body.workspace_id ?? "";
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    send(res, 400, { error: "invalid_request", error_description: "Unknown client or redirect_uri." });
    return;
  }
  if (!workspaceId) {
    send(res, 400, { error: "invalid_request", error_description: "workspace_id is required." });
    return;
  }
  const role = await workspaceRole(user.id, workspaceId);
  if (!role) {
    send(res, 403, { error: "access_denied", error_description: "You are not a member of that workspace." });
    return;
  }

  const expiresInDays = Number(body.expires_in_days ?? "7");
  const refreshExpiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0 ? nowPlus(expiresInDays * 86400) : null;

  // Draft grant (no tokens yet — activated at the token endpoint).
  const grantId = randomBytes(16).toString("hex");
  const grantOk = await sbInsert("agent_grants", {
    id: grantId,
    workspace_id: workspaceId,
    created_by: user.id === "dev-user" ? null : user.id,
    client_id: clientId,
    agent_name: body.agent_name || "AI Agent",
    scope_type: body.scope_type || "workspace",
    scope_target_id: body.scope_target_id || null,
    role: body.grant_role || "editor",
    mode: body.mode || "suggest",
    oauth_scopes: (body.scope || "").split(/\s+/).filter(Boolean),
    refresh_expires_at: refreshExpiresAt,
    status: "pending",
  });
  if (!grantOk) {
    send(res, 500, { error: "server_error", error_description: "Could not create the grant." });
    return;
  }

  const code = randomToken();
  const codeOk = await sbInsert("oauth_authorization_codes", {
    code_hash: sha256(code),
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: body.code_challenge,
    code_challenge_method: body.code_challenge_method || "S256",
    grant_id: grantId,
    scope: body.scope ?? null,
    expires_at: nowPlus(AUTH_CODE_TTL_SECONDS),
  });
  if (!codeOk) {
    send(res, 500, { error: "server_error", error_description: "Could not issue an authorization code." });
    return;
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (body.state) redirect.searchParams.set("state", body.state);
  send(res, 200, { redirect: redirect.toString() });
}

// ── token (authorization_code + PKCE, refresh_token) ─────────────────────────

interface CodeRow {
  code_hash: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  grant_id: string;
  scope: string | null;
  expires_at: string;
  used_at: string | null;
}

interface GrantRow {
  id: string;
  refresh_expires_at: string | null;
  oauth_scopes: string[];
  status: string;
  revoked_at: string | null;
}

export async function token(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readParams(req);
  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    const { code, code_verifier: verifier, client_id: clientId, redirect_uri: redirectUri } = body;
    if (!code || !verifier) {
      send(res, 400, { error: "invalid_request", error_description: "code and code_verifier are required." });
      return;
    }
    const rows = await sbGet<CodeRow>(
      `oauth_authorization_codes?code_hash=eq.${encodeURIComponent(sha256(code))}&select=*&limit=1`,
    );
    const codeRow = rows[0];
    if (!codeRow || codeRow.used_at || new Date(codeRow.expires_at) < new Date()) {
      send(res, 400, { error: "invalid_grant", error_description: "Authorization code is invalid or expired." });
      return;
    }
    if (codeRow.client_id !== clientId || codeRow.redirect_uri !== redirectUri) {
      send(res, 400, { error: "invalid_grant", error_description: "client_id/redirect_uri mismatch." });
      return;
    }
    if (sha256(verifier) !== codeRow.code_challenge) {
      send(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed." });
      return;
    }
    await sbPatch("oauth_authorization_codes", `code_hash=eq.${encodeURIComponent(codeRow.code_hash)}`, {
      used_at: new Date().toISOString(),
    });

    const grants = await sbGet<GrantRow>(`agent_grants?id=eq.${encodeURIComponent(codeRow.grant_id)}&select=*&limit=1`);
    const grant = grants[0];
    if (!grant || grant.revoked_at) {
      send(res, 400, { error: "invalid_grant", error_description: "Grant not found or revoked." });
      return;
    }

    const tokens = await issueTokens(grant.id, grant.refresh_expires_at);
    send(res, 200, {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: tokens.refreshToken,
      scope: (grant.oauth_scopes ?? []).join(" ") || codeRow.scope || "",
    });
    return;
  }

  if (grantType === "refresh_token") {
    const refresh = body.refresh_token;
    if (!refresh) {
      send(res, 400, { error: "invalid_request", error_description: "refresh_token is required." });
      return;
    }
    const grants = await sbGet<GrantRow>(
      `agent_grants?refresh_token_hash=eq.${encodeURIComponent(sha256(refresh))}&status=eq.active&select=*&limit=1`,
    );
    const grant = grants[0];
    if (!grant || grant.revoked_at || (grant.refresh_expires_at && new Date(grant.refresh_expires_at) < new Date())) {
      send(res, 400, { error: "invalid_grant", error_description: "Refresh token is invalid or expired." });
      return;
    }
    const tokens = await issueTokens(grant.id, grant.refresh_expires_at);
    send(res, 200, {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: tokens.refreshToken,
      scope: (grant.oauth_scopes ?? []).join(" "),
    });
    return;
  }

  send(res, 400, { error: "unsupported_grant_type", error_description: `Unsupported grant_type: ${grantType ?? "(none)"}` });
}

async function issueTokens(grantId: string, refreshExpiresAt: string | null): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  await sbPatch("agent_grants", `id=eq.${encodeURIComponent(grantId)}`, {
    access_token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    access_expires_at: nowPlus(ACCESS_TTL_SECONDS),
    refresh_expires_at: refreshExpiresAt,
    status: "active",
  });
  return { accessToken, refreshToken };
}

/** Resource-server check: validate a Bearer access token. Returns the principal or null. */
export async function validateAccessToken(token: string): Promise<AccessPrincipal | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const rows = await sbGet<{
    id: string;
    workspace_id: string;
    agent_name: string;
    role: string;
    mode: string;
    access_expires_at: string | null;
    revoked_at: string | null;
    status: string;
  }>(
    `agent_grants?access_token_hash=eq.${encodeURIComponent(sha256(token))}&status=eq.active&select=id,workspace_id,agent_name,role,mode,access_expires_at,revoked_at,status&limit=1`,
  );
  const grant = rows[0];
  if (!grant || grant.revoked_at) return null;
  if (grant.access_expires_at && new Date(grant.access_expires_at) < new Date()) return null;

  // best-effort last_used_at (fire and forget)
  void sbPatch("agent_grants", `id=eq.${encodeURIComponent(grant.id)}`, { last_used_at: new Date().toISOString() });

  return {
    workspaceId: grant.workspace_id,
    agentName: grant.agent_name,
    role: grant.role,
    mode: grant.mode,
    grantId: grant.id,
  };
}
