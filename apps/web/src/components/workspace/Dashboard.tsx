import { useMemo, type ReactNode, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import type { User } from "@supabase/supabase-js";
import type { PageItem, FolderItem } from "@/hooks/useWorkspace";
import type { RecentPage, AgentActivityItem } from "@/hooks/usePageActivity";
import { PageIcon } from "@/components/shared/PageIcon";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Avatar } from "@weave-design-system/react";

interface DashboardProps {
  user: User;
  pages: PageItem[];
  folders: FolderItem[];
  recentPages: RecentPage[];
  agentActivity: AgentActivityItem[];
  members: MemberWithUser[];
  membersLoading: boolean;
  onCreatePage: (title?: string, parentId?: string | null, folderId?: string | null) => Promise<PageItem | null>;
  onCreateDatabase: (title?: string, folderId?: string | null) => Promise<PageItem | null>;
  onCreateFolder: (name?: string) => Promise<FolderItem | null>;
  onMovePageToFolder: (pageId: string, folderId: string | null) => void;
  onImport: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function initialsOf(name: string): string {
  return (name || "AI").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  color: "var(--color-textTertiary)",
};

const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  color: "var(--color-textPrimary)",
};

// --- Quick-start tile ---

function QuickTile({ color, title, subtitle, icon, onClick }: {
  color: string; title: string; subtitle: string; icon: ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col text-left transition-all hover:-translate-y-0.5"
      style={{ padding: 16, gap: 11, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-white)" }}
    >
      <span
        className="flex items-center justify-center"
        style={{ width: 34, height: 34, borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, var(--color-white))`, color }}
      >
        {icon}
      </span>
      <div className="flex flex-col" style={{ gap: 2 }}>
        <span className="text-sm font-semibold" style={{ color: "var(--color-textPrimary)" }}>{title}</span>
        <span className="text-xs" style={{ color: "var(--color-textTertiary)" }}>{subtitle}</span>
      </div>
    </button>
  );
}

// --- Main dashboard ---

export function Dashboard({
  user,
  pages,
  recentPages,
  agentActivity,
  members,
  membersLoading,
  onCreatePage,
  onCreateDatabase,
  onCreateFolder,
  onImport,
}: DashboardProps) {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const { resolvedDisplayName: rawName } = useUserProfile(user.id, user.email);
  const displayName = capitalize(rawName);

  const now = new Date();
  const dateStr = `${now.toLocaleDateString("en-US", { weekday: "long" })} · ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`.toUpperCase();

  const subtitle =
    agentActivity.length > 0
      ? `${agentActivity[0].actor_name || "An agent"} has been active — ${agentActivity.length} recent update${agentActivity.length > 1 ? "s" : ""} in your workspace.`
      : "Pick up where you left off, or start something new.";

  const recent = useMemo(() => {
    const fromVisits = recentPages.map((rp) => ({
      id: rp.page_id,
      title: rp.title,
      icon: rp.icon,
      pageType: pages.find((p) => p.id === rp.page_id)?.page_type,
      meta: `Opened ${timeAgo(rp.last_visited)}`,
    }));
    if (fromVisits.length > 0) return fromVisits.slice(0, 6);
    return [...pages]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6)
      .map((p) => ({ id: p.id, title: p.title, icon: p.icon, pageType: p.page_type, meta: `Edited ${timeAgo(p.updated_at)}` }));
  }, [recentPages, pages]);

  async function handleCreatePage() {
    const page = await onCreatePage();
    if (page) navigate(`/page/${page.id}`);
  }
  async function handleCreateDatabase() {
    const page = await onCreateDatabase();
    if (page) navigate(`/page/${page.id}`);
  }

  const topbar = (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: "0 28px", borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-textSecondary)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        <span className="text-sm font-medium" style={{ color: "var(--color-textPrimary)" }}>Home</span>
      </div>
      <button
        onClick={handleCreatePage}
        className="flex items-center hover:opacity-90"
        style={{ gap: 7, padding: "8px 14px", borderRadius: 8, background: "var(--color-rust)", color: "var(--color-white)", fontSize: 14, fontWeight: 600 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
        New page
      </button>
    </div>
  );

  const tiles = (
    <div className="grid" style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
      <QuickTile
        color="var(--color-rust)" title="New doc" subtitle="Rich-text page" onClick={handleCreatePage}
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
      />
      <QuickTile
        color="var(--color-teal)" title="Database" subtitle="Structured view" onClick={handleCreateDatabase}
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>}
      />
      <QuickTile
        color="var(--color-gold)" title="New folder" subtitle="Group pages" onClick={() => onCreateFolder()}
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
      />
      <QuickTile
        color="var(--color-forest)" title="Import" subtitle="Notion, Docs, MD" onClick={onImport}
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
      />
    </div>
  );

  const recentSection = (
    <section className="flex flex-col" style={{ gap: 4 }}>
      <div className="flex items-center" style={{ padding: "0 2px 6px" }}>
        <h2 style={{ ...sectionHeading, fontSize: 22 }}>Recent</h2>
      </div>
      <div className="flex flex-col">
        {recent.length === 0 ? (
          <p className="text-sm" style={{ padding: "13px 6px", color: "var(--color-textTertiary)" }}>
            Nothing yet — create your first page above.
          </p>
        ) : (
          recent.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/page/${r.id}`)}
              className="flex items-center text-left transition-colors hover:opacity-80"
              style={{ gap: 13, padding: "13px 6px", borderBottom: "1px solid var(--color-border)" }}
            >
              <PageIcon icon={r.icon} pageType={r.pageType} />
              <div className="flex flex-col min-w-0 flex-1" style={{ gap: 2 }}>
                <span className="truncate text-sm font-medium" style={{ color: "var(--color-textPrimary)" }}>{r.title}</span>
                <span className="text-xs" style={{ color: "var(--color-textTertiary)" }}>{r.meta}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );

  const agentPanel = (
    <div
      className="flex flex-col"
      style={{ gap: 16, padding: 18, borderRadius: 14, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--color-teal)" }} />
        <h2 style={{ ...sectionHeading, fontSize: 16, fontWeight: 600 }}>Agent activity</h2>
        <div className="flex-1" />
        <span className="inline-flex items-center" style={{ gap: 5, padding: "3px 8px", borderRadius: 999, background: "var(--color-teal-light)" }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--color-teal)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--color-teal)" }}>LIVE</span>
        </span>
      </div>
      <div className="flex flex-col" style={{ gap: 15 }}>
        {agentActivity.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-textTertiary)" }}>No agent activity yet.</p>
        ) : (
          agentActivity.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/page/${item.page_id}`)}
              className="flex text-left transition-opacity hover:opacity-80"
              style={{ gap: 11 }}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, borderRadius: 999, background: "var(--color-teal-light)", color: "var(--color-teal)", fontSize: 10, fontWeight: 600 }}
              >
                {initialsOf(item.actor_name || "AI")}
              </span>
              <div className="flex flex-col min-w-0" style={{ gap: 1 }}>
                <span className="text-sm" style={{ color: "var(--color-textPrimary)", lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 600 }}>{item.actor_name || "An agent"}</span> edited a page
                </span>
                <span className="text-xs truncate" style={{ color: "var(--color-textTertiary)" }}>{item.page_title} · {timeAgo(item.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const teamSection = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center" style={{ gap: 8, padding: "0 2px" }}>
        <h2 style={{ ...sectionHeading, fontSize: 16 }}>Team</h2>
        {!membersLoading && <span className="text-xs" style={{ color: "var(--color-textTertiary)" }}>{members.length}</span>}
        <div className="flex-1" />
        <button onClick={() => navigate("/settings")} className="text-xs hover:opacity-80" style={{ color: "var(--color-rust)", fontWeight: 600 }}>Manage</button>
      </div>
      {membersLoading ? (
        <p className="text-sm" style={{ color: "var(--color-textTertiary)", padding: "0 2px" }}>Loading…</p>
      ) : (
        members.slice(0, 6).map((m) => {
          const name = m.user.display_name || m.user.email.split("@")[0];
          return (
            <div key={m.id} className="flex items-center" style={{ gap: 11, padding: "8px 4px" }}>
              <Avatar name={name} src={m.user.avatar_url || undefined} size="sm" />
              <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "var(--color-textPrimary)" }}>{name}</span>
              <span className="text-xs capitalize" style={{ color: "var(--color-textTertiary)" }}>{m.role}</span>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {topbar}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto" style={{ maxWidth: 1120, padding: isMobile ? "24px 20px 40px" : "34px 40px 48px" }}>
          {/* Greeting */}
          <div className="flex flex-col" style={{ gap: 8, marginBottom: 30 }}>
            <div style={eyebrow}>{dateStr}</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 28 : 36, fontWeight: 450, lineHeight: 1.12, color: "var(--color-textPrimary)" }}>
              {getGreeting()}, {displayName}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.45, color: "var(--color-textSecondary)" }}>{subtitle}</p>
          </div>

          {/* Columns */}
          <div className="flex" style={{ gap: 36, flexDirection: isMobile ? "column" : "row" }}>
            <div className="flex flex-col" style={{ gap: 28, flex: 1, minWidth: 0 }}>
              <section className="flex flex-col" style={{ gap: 12 }}>
                <div style={eyebrow}>QUICK START</div>
                {tiles}
              </section>
              {recentSection}
            </div>
            <div className="flex flex-col" style={{ gap: 22, width: isMobile ? "100%" : 340, flexShrink: 0 }}>
              {agentPanel}
              {teamSection}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
