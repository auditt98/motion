import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@weave-design-system/react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

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
  const { user, loading: authLoading, signIn } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [role, setRole] = useState("editor");
  const [mode, setMode] = useState("suggest");
  const [expiry, setExpiry] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline sign-in (so the OAuth params in the URL are preserved).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

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
        className="w-full max-w-md rounded-2xl p-7"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {children}
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
        <h1 style={{ color: "var(--color-textPrimary)", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
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
          <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: 1, color: "var(--color-rust)" }}>
            AUTHORIZE ACCESS
          </div>
          <h1 style={{ color: "var(--color-textPrimary)", fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            Sign in to continue
          </h1>
          <p style={{ color: "var(--color-textSecondary)", fontSize: 14, marginTop: 4 }}>
            <strong>{oauth.clientName}</strong> wants to connect to your Motion workspace.
          </p>
        </div>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={selectStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={selectStyle}
        />
        {error && <div style={{ color: "var(--color-rust)", fontSize: 13 }}>{error}</div>}
        <Button
          variant="primary"
          onClick={async () => {
            setSigningIn(true);
            setError(null);
            const result = await signIn(email, password);
            if (result && (result as { error?: unknown }).error) {
              setError("Sign in failed. Check your credentials.");
            }
            setSigningIn(false);
          }}
        >
          {signingIn ? "Signing in…" : "Sign in"}
        </Button>
      </div>,
    );
  }

  return page(
    <div className="flex flex-col gap-5">
      <div>
        <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: 1, color: "var(--color-rust)" }}>
          AUTHORIZE ACCESS
        </div>
        <h1 style={{ color: "var(--color-textPrimary)", fontSize: 22, fontWeight: 700, marginTop: 6 }}>
          {oauth.clientName} wants to connect
        </h1>
        <p style={{ color: "var(--color-textSecondary)", fontSize: 14, marginTop: 4 }}>
          It will act as an agent in your workspace with the access you choose below. Scoped,
          expiring, and revocable anytime in Settings → Members &amp; agents.
        </p>
      </div>

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
