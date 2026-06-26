import { useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { Feather, UsersRound, Sparkles, GitBranch, GitHubLogo } from "../shared/icons";

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: unknown }>;
  onSignUp: (email: string, password: string) => Promise<{ error: unknown }>;
}

const FOREST = "#2E4034";
const CREAM = "#F4EFE4";
const SAGE = "#B9C4B6";
const GOLD = "#E9C77E";

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-white)",
  color: "var(--color-text-primary)",
  fontSize: 14,
  outline: "none",
};

export function AuthPage({ onSignIn, onSignUp }: AuthPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { isMobile } = useBreakpoint();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } =
      mode === "signin" ? await onSignIn(email, password) : await onSignUp(email, password);
    setLoading(false);
    if (error) setError((error as Error).message || "Something went wrong");
    else if (mode === "signup") setSignupSuccess(true);
  }

  async function oauth(provider: "google" | "github") {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
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

  const eyebrow = (text: string) => (
    <div
      style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, letterSpacing: 1.4, color: "var(--color-text-secondary)" }}
    >
      {text}
    </div>
  );

  function formPanel(children: React.ReactNode) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ padding: 24 }}>
        <div style={{ width: 380, maxWidth: "100%" }}>{children}</div>
      </div>
    );
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
        {!isMobile && brandPanel}
        {formPanel(
          <div className="flex flex-col" style={{ gap: 12 }}>
            <div style={{ fontSize: 40 }}>&#x2709;&#xfe0f;</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28, color: "var(--color-text-primary)" }}>
              Check your email
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            <button
              onClick={() => {
                setSignupSuccess(false);
                setMode("signin");
              }}
              style={{ alignSelf: "start", color: "var(--color-rust)", fontWeight: 600, fontSize: 14 }}
            >
              ← Back to sign in
            </button>
          </div>,
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      {!isMobile && brandPanel}
      {formPanel(
        <div className="flex flex-col" style={{ gap: 7 }}>
          {eyebrow(mode === "signin" ? "WELCOME BACK" : "GET STARTED")}
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--color-text-primary)" }}>
            {mode === "signin" ? "Sign in to Motion" : "Create your account"}
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--color-text-secondary)" }}>
            {mode === "signin" ? "Continue to your workspace." : "Start writing with people and agents."}
          </p>

          <div className="flex flex-col" style={{ gap: 10, paddingTop: 18 }}>
            <button
              onClick={() => oauth("github")}
              className="flex items-center justify-center"
              style={{ gap: 10, padding: "12px 14px", borderRadius: 8, background: "var(--color-white)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", fontWeight: 600, fontSize: 14 }}
            >
              <GitHubLogo size={18} /> Continue with GitHub
            </button>
          </div>

          <div className="flex items-center" style={{ gap: 12, padding: "12px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 14 }}>
            <div className="flex flex-col" style={{ gap: 7 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="focus:border-(--color-rust)"
                style={fieldStyle}
              />
            </div>
            <div className="flex flex-col" style={{ gap: 7 }}>
              <div className="flex items-center justify-between">
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>Password</label>
                {mode === "signin" && (
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-rust)" }}>Forgot password?</span>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••••••"
                className="focus:border-(--color-rust)"
                style={fieldStyle}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "var(--color-error)", background: "var(--color-error-light)", padding: "8px 11px", borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center disabled:opacity-60"
              style={{ padding: "13px 16px", borderRadius: 8, background: "var(--color-rust)", color: "#fff", fontWeight: 600, fontSize: 15 }}
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="flex justify-center" style={{ gap: 5, fontSize: 13.5, paddingTop: 14 }}>
            <span style={{ color: "var(--color-text-secondary)" }}>
              {mode === "signin" ? "New to Motion?" : "Already have an account?"}
            </span>
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              style={{ fontWeight: 600, color: "var(--color-rust)" }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>,
      )}
    </div>
  );
}
