import { useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { Feather, UsersRound, Sparkles, GitBranch, GitHubLogo, GoogleLogo } from "../shared/icons";

type Provider = "google" | "github";

const FOREST = "#2E4034";
const CREAM = "#F4EFE4";
const SAGE = "#B9C4B6";
const GOLD = "#E9C77E";

const oauthButtonStyle: CSSProperties = {
  gap: 10,
  padding: "12px 14px",
  borderRadius: 8,
  background: "var(--color-white)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
  fontWeight: 600,
  fontSize: 14,
};

/**
 * Sign-in is OAuth only. Who may create an account is enforced server-side by
 * the `before-user-created` auth hook (see migration 020) — not by this page.
 */
export function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const { isMobile } = useBreakpoint();

  async function oauth(provider: Provider) {
    setError(null);
    setPending(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Return to wherever they started — an invite or agent-consent URL carries
      // params we must not drop.
      options: { redirectTo: window.location.href },
    });
    if (error) {
      setError(error.message);
      setPending(null);
    }
  }

  const brandPanel = (
    <div
      className="flex flex-col justify-between relative overflow-hidden"
      style={{ width: 560, flexShrink: 0, background: FOREST, padding: 56 }}
    >
      <Feather
        size={380}
        style={{ position: "absolute", right: -60, bottom: -40, color: "#3A4E40", opacity: 0.5 }}
      />
      <div className="flex items-center gap-2.5 relative">
        <Feather size={24} style={{ color: GOLD }} />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 25, color: CREAM }}>
          Motion
        </span>
      </div>

      <div className="relative" style={{ maxWidth: 440 }}>
        <div
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: 1.6, color: GOLD }}
        >
          AI-NATIVE KNOWLEDGE
        </div>
        <h1
          style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 42, lineHeight: 1.15, color: CREAM, marginTop: 22 }}
        >
          Where people and agents write together.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: SAGE, marginTop: 22 }}>
          One living workspace for your docs, databases, and the agents that keep them current —
          synced in real time.
        </p>
        <ul className="flex flex-col" style={{ gap: 13, marginTop: 26 }}>
          {[
            [<UsersRound size={18} />, "Real-time multiplayer editing"],
            [<Sparkles size={18} />, "Agents you can see working alongside you"],
            [<GitBranch size={18} />, "Two-way sync with your GitHub repos"],
          ].map(([icon, label], i) => (
            <li key={i} className="flex items-center" style={{ gap: 12, color: "#E4DCCB" }}>
              <span style={{ color: GOLD, display: "inline-flex" }}>{icon}</span>
              <span style={{ fontSize: 14.5 }}>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative" style={{ maxWidth: 440 }}>
        <p
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: 18, lineHeight: 1.45, color: "#EFE7D6" }}
        >
          &ldquo;Motion replaced three tools for our team. The agents feel like real
          teammates.&rdquo;
        </p>
        <div className="flex items-center" style={{ gap: 10, marginTop: 14 }}>
          <div
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 999, background: "#42584A", color: GOLD, fontSize: 12, fontWeight: 600 }}
          >
            R
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: CREAM }}>Rina Okafor</div>
            <div style={{ fontSize: 12, color: "#9DAB99" }}>Head of Product, Northwind</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      {!isMobile && brandPanel}
      <div className="flex-1 flex items-center justify-center" style={{ padding: 24 }}>
        <div className="flex flex-col" style={{ width: 380, maxWidth: "100%", gap: 7 }}>
          <div
            style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, letterSpacing: 1.4, color: "var(--color-text-secondary)" }}
          >
            WELCOME BACK
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--color-text-primary)" }}>
            Sign in to Motion
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--color-text-secondary)" }}>
            Continue to your workspace with your work account.
          </p>

          <div className="flex flex-col" style={{ gap: 10, paddingTop: 18 }}>
            <button
              onClick={() => oauth("google")}
              disabled={pending !== null}
              className="flex items-center justify-center disabled:opacity-60"
              style={oauthButtonStyle}
            >
              <GoogleLogo size={18} />
              {pending === "google" ? "Redirecting…" : "Continue with Google"}
            </button>
            <button
              onClick={() => oauth("github")}
              disabled={pending !== null}
              className="flex items-center justify-center disabled:opacity-60"
              style={oauthButtonStyle}
            >
              <GitHubLogo size={18} />
              {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
            </button>
          </div>

          {error && (
            <div
              style={{ fontSize: 13, color: "var(--color-error)", background: "var(--color-error-light)", padding: "8px 11px", borderRadius: 8, marginTop: 14 }}
            >
              {error}
            </div>
          )}

          <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-secondary)", paddingTop: 16 }}>
            Motion is limited to Kelas Sekejap accounts. Your account is created the first time you
            sign in — no separate signup. If you need access, ask an admin to invite you.
          </p>
        </div>
      </div>
    </div>
  );
}
