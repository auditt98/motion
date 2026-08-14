import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@weave-design-system/react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Feather, Bot, ShieldCheck, GoogleLogo, GitHubLogo } from "../shared/icons";

/**
 * OAuth consent screen. The Motion MCP server's /oauth/authorize redirects the
 * browser here with the OAuth request params. The signed-in human picks the
 * workspace, role, mode, and expiry, then we POST to the server's approve
 * endpoint (with their Supabase session) which mints a scoped grant + code and
 * returns the redirect back to the agent client.
 */

interface Workspace {
  id: string;
  name: string;
}

const ROLES = [
  { value: "viewer", label: "Viewer — read only" },
  { value: "commenter", label: "Commenter — read + comment" },
  { value: "editor", label: "Editor — read + write" },
];
const MODES = [
  { value: "suggest", label: "Suggest — edits are reviewable" },
  { value: "direct", label: "Direct — edits apply immediately" },
];
const EXPIRIES = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "0", label: "No expiry" },
];

function useOAuthParams() {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      clientId: p.get("client_id") ?? "",
      redirectUri: p.get("redirect_uri") ?? "",
      state: p.get("state") ?? "",
      codeChallenge: p.get("code_challenge") ?? "",
      codeChallengeMethod: p.get("code_challenge_method") ?? "S256",
      scope: p.get("scope") ?? "",
      resource: p.get("resource") ?? "",
      approveEndpoint: p.get("authorization_endpoint") ?? "",
      clientName: p.get("client_name") ?? "An AI agent",
    };
  }, []);
}

export function AgentConsentPage() {
  const oauth = useOAuthParams();
  const { user, loading: authLoading } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [role, setRole] = useState("editor");
  const [mode, setMode] = useState("suggest");
  const [expiry, setExpiry] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign-in returns to this exact URL, so the OAuth params are preserved.
  const [signingIn, setSigningIn] = useState(false);

  async function signInWith(provider: "google" | "github") {
    setSigningIn(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    });
    if (error) {
      setError(error.message);
      setSigningIn(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(name)")
        .eq("user_id", user.id);
      const list: Workspace[] = (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.workspace_id as string,
        name: ((r.workspaces as { name?: string } | null)?.name as string) ?? "Workspace",
      }));
      setWorkspaces(list);
      if (list.length) setWorkspaceId((w) => w || list[0].id);
    })();
  }, [user]);

  const invalidRequest = !oauth.clientId || !oauth.redirectUri || !oauth.approveEndpoint || !oauth.codeChallenge;

  function denyAndReturn() {
    if (!oauth.redirectUri) return;
    const u = new URL(oauth.redirectUri);
    u.searchParams.set("error", "access_denied");
    if (oauth.state) u.searchParams.set("state", oauth.state);
    window.location.href = u.toString();
  }

  async function approve() {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) {
        setError("Your session expired. Please sign in again.");
        setSubmitting(false);
        return;
      }
      const resp = await fetch(oauth.approveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          client_id: oauth.clientId,
          redirect_uri: oauth.redirectUri,
          state: oauth.state,
          code_challenge: oauth.codeChallenge,
          code_challenge_method: oauth.codeChallengeMethod,
          scope: oauth.scope,
          resource: oauth.resource,
          workspace_id: workspaceId,
          scope_type: "workspace",
          grant_role: role,
          mode,
          expires_in_days: expiry,
          agent_name: oauth.clientName,
        }),
      });
      const json = (await resp.json()) as { redirect?: string; error_description?: string; error?: string };
      if (resp.ok && json.redirect) {
        window.location.href = json.redirect;
        return;
      }
      setError(json.error_description || json.error || "Authorization failed.");
    } catch {
      setError("Could not reach the Motion server. Try again.");
    }
    setSubmitting(false);
  }

  const page = (children: ReactNode) => (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-2)" }}
      >
        <div className="flex items-center gap-2 px-7 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Feather size={18} style={{ color: "var(--color-rust)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17, color: "var(--color-textPrimary)" }}>
            Motion
          </span>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );

  const agentIdentity = (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 38, height: 38, borderRadius: 999, background: "color-mix(in srgb, var(--color-teal) 14%, var(--color-surface))", color: "var(--color-teal)" }}
      >
        <Bot size={20} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "var(--color-textPrimary)" }}>
          {oauth.clientName}
        </div>
        <div className="flex items-center gap-1" style={{ color: "var(--color-textSecondary)", fontSize: 12 }}>
          <ShieldCheck size={12} style={{ color: "var(--color-forest)" }} />
          <span style={{ fontFamily: "var(--font-mono)" }}>Connecting over OAuth</span>
        </div>
      </div>
    </div>
  );

  const labelStyle = { color: "var(--color-textSecondary)", fontSize: 13, fontWeight: 600 } as const;
  const selectStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-textPrimary)",
    fontSize: 14,
  } as const;

  if (authLoading) {
    return page(<div style={{ color: "var(--color-textSecondary)" }}>Loading…</div>);
  }

  if (invalidRequest) {
    return page(
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", color: "var(--color-textPrimary)", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
          Invalid authorization request
        </h1>
        <p style={{ color: "var(--color-textSecondary)", fontSize: 14 }}>
          This page is opened automatically by an agent. Start the connection from Claude or Codex.
        </p>
      </div>,
    );
  }

  if (!user) {
    return page(
      <div className="flex flex-col gap-4">
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: "var(--color-rust)" }}>
            AUTHORIZE ACCESS
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", color: "var(--color-textPrimary)", fontSize: 24, fontWeight: 500, marginTop: 6 }}>
            Sign in to continue
          </h1>
          <p style={{ color: "var(--color-textSecondary)", fontSize: 14, marginTop: 4 }}>
            Authorize the agent below to act in your Motion workspace.
          </p>
        </div>
        {agentIdentity}
        {error && <div style={{ color: "var(--color-rust)", fontSize: 13 }}>{error}</div>}
        <Button variant="primary" disabled={signingIn} onClick={() => void signInWith("google")}>
          <span className="flex items-center justify-center" style={{ gap: 8 }}>
            <GoogleLogo size={16} />
            {signingIn ? "Redirecting…" : "Continue with Google"}
          </span>
        </Button>
        <Button variant="ghost" disabled={signingIn} onClick={() => void signInWith("github")}>
          <span className="flex items-center justify-center" style={{ gap: 8 }}>
            <GitHubLogo size={16} />
            Continue with GitHub
          </span>
        </Button>
      </div>,
    );
  }

  return page(
    <div className="flex flex-col gap-5">
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: "var(--color-rust)" }}>
          AUTHORIZE ACCESS
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", color: "var(--color-textPrimary)", fontSize: 24, fontWeight: 500, marginTop: 6 }}>
          An agent wants to connect
        </h1>
        <p style={{ color: "var(--color-textSecondary)", fontSize: 14, marginTop: 4 }}>
          It will act in your workspace with the access you choose below. Scoped,
          expiring, and revocable anytime in Settings → Members &amp; agents.
        </p>
      </div>
      {agentIdentity}

      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Workspace</span>
        <select style={selectStyle} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Role</span>
        <select style={selectStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <span style={labelStyle}>Mode</span>
          <select style={selectStyle} value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <span style={labelStyle}>Expires</span>
          <select style={selectStyle} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {EXPIRIES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={{ color: "var(--color-rust)", fontSize: 13 }}>{error}</div>}

      <div className="flex gap-3 pt-1">
        <Button variant="ghost" onClick={denyAndReturn}>
          Don&apos;t allow
        </Button>
        <div className="flex-1" />
        <Button variant="primary" onClick={approve} disabled={submitting || !workspaceId}>
          {submitting ? "Authorizing…" : "Authorize access"}
        </Button>
      </div>
    </div>,
  );
}
