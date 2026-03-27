import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Button, Avatar, Tooltip, Modal } from "@weave-design-system/react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useInvitations } from "@/hooks/useInvitations";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { buildAgentInstructions } from "@motion/shared";
import type { PageAccessLevel, PublicAccessLevel } from "@motion/shared";

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
}

export function ShareButton({ pageId }: { pageId?: string }) {
  const { workspaceId } = useWorkspaceContext();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside (desktop only)
  useEffect(() => {
    if (!open || isMobile) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, isMobile]);

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share
      </Button>

      {open && isMobile ? (
        <Modal open={open} onClose={() => setOpen(false)}>
          <Modal.Header>Share</Modal.Header>
          <Modal.Body>
            <SharePopover
              workspaceId={workspaceId}
              pageId={pageId}
              onClose={() => setOpen(false)}
              inline
            />
          </Modal.Body>
        </Modal>
      ) : open ? (
        <SharePopover
          workspaceId={workspaceId}
          pageId={pageId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{
        background: checked ? "var(--color-rust)" : "var(--color-border)",
      }}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform"
        style={{
          background: "var(--color-white)",
          transform: checked ? "translate(17px, 2px)" : "translate(2px, 2px)",
        }}
      />
    </button>
  );
}

function SharePopover({
  workspaceId,
  pageId,
  onClose,
  inline,
}: {
  workspaceId: string | null;
  pageId?: string;
  onClose: () => void;
  inline?: boolean;
}) {
  const navigate = useNavigate();
  const { sendInvitation } = useInvitations(workspaceId);
  const { links, createLink } = useInviteLinks(workspaceId);
  const {
    permissions,
    accessList,
    togglePublic,
    setPublicSlug,
    setPublicAccessLevel,
    toggleRestricted,
    addAccess,
    removeAccess,
    updateAccessLevel,
  } = usePagePermissions(pageId, workspaceId);
  const { members } = useWorkspaceMembers(workspaceId);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [slugError, setSlugError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // Sync slug input with current permissions
  useEffect(() => {
    if (permissions?.public_slug) {
      setSlugInput(permissions.public_slug);
    }
  }, [permissions?.public_slug]);

  // Members available to add to access list (not already in list)
  const availableMembers = useMemo(() => {
    const accessUserIds = new Set(accessList.map((e) => e.user_id));
    return members.filter(
      (m) => !accessUserIds.has(m.user_id) && m.role !== "owner" && m.role !== "admin",
    );
  }, [members, accessList]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return [];
    const q = memberSearch.toLowerCase();
    return availableMembers.filter(
      (m) =>
        m.user.email.toLowerCase().includes(q) ||
        m.user.display_name?.toLowerCase().includes(q),
    );
  }, [availableMembers, memberSearch]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError("");

    const result = await sendInvitation(email.trim(), "member");

    if (result && "error" in result && result.error) {
      setError(
        result.error.includes("duplicate")
          ? "Already invited"
          : "Failed to invite",
      );
    } else {
      setEmail("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    }

    setSending(false);
  }

  async function handleCopyLink() {
    let token: string;

    // Reuse existing active link or create new one
    const activeLink = links.find((l) => l.is_active);
    if (activeLink) {
      token = activeLink.token;
    } else {
      const link = await createLink("member");
      if (!link) return;
      token = link.token;
    }

    const url = pageId
      ? `${window.location.origin}/invite/${token}/${pageId}`
      : `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyAgentInstructions() {
    let token: string;

    const activeLink = links.find((l) => l.is_active);
    if (activeLink) {
      token = activeLink.token;
    } else {
      const link = await createLink("member");
      if (!link) return;
      token = link.token;
    }

    const inviteUrl = pageId
      ? `${window.location.origin}/invite/${token}/${pageId}`
      : `${window.location.origin}/invite/${token}`;

    const instructions = buildAgentInstructions(inviteUrl);
    await navigator.clipboard.writeText(instructions);
    setCopiedAgent(true);
    setTimeout(() => setCopiedAgent(false), 2000);
  }

  async function handleCopyPublicUrl() {
    const slug = permissions?.public_slug || pageId;
    const url = `${window.location.origin}/p/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedPublic(true);
    setTimeout(() => setCopiedPublic(false), 2000);
  }

  async function handleSaveSlug() {
    const trimmed = slugInput.trim().toLowerCase();
    if (!trimmed) {
      // Clear custom slug
      await setPublicSlug(null);
      setSlugError("");
      return;
    }
    if (!isValidSlug(trimmed)) {
      setSlugError("3-64 chars, lowercase letters, numbers, and hyphens only");
      return;
    }
    setSlugError("");
    const result = await setPublicSlug(trimmed);
    if (!result) {
      setSlugError("Slug already taken");
    }
  }

  const isPublic = permissions?.is_public ?? false;
  const isRestricted = permissions?.is_restricted ?? false;

  return (
    <div className={inline ? "w-full" : "absolute right-0 top-full mt-2 w-96 bg-theme border border-theme rounded-lg shadow-lg z-50 max-h-[80vh] overflow-y-auto"}>
      <div className="p-4">
        {/* Invite people */}
        <h3 className="text-sm font-medium text-theme-primary mb-3">
          Invite people
        </h3>

        <form onSubmit={handleInvite} className="space-y-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-2.5 py-1.5 border border-theme rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-border) focus:border-transparent"
            style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full py-1.5 rounded-lg text-sm disabled:opacity-50"
            style={{ background: "var(--color-text-primary)", color: "var(--color-bg)" }}
          >
            {sent ? "Sent!" : sending ? "Sending..." : "Send invite"}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}

        {/* Publish to web */}
        {pageId && (
          <div className="border-t border-theme pt-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-sm font-medium text-theme-primary">Publish to web</span>
              </div>
              <ToggleSwitch
                checked={isPublic}
                onChange={(v) => togglePublic(v)}
                label="Publish to web"
              />
            </div>

            {isPublic && (
              <div className="space-y-2 ml-5">
                {/* Public URL */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="flex-1 text-xs truncate px-2 py-1 rounded"
                    style={{ background: "var(--color-surface)", color: "var(--color-text-secondary)" }}
                  >
                    /p/{permissions?.public_slug || pageId}
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleCopyPublicUrl}>
                    {copiedPublic ? "Copied!" : "Copy"}
                  </Button>
                </div>

                {/* Custom slug */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value)}
                      placeholder="custom-slug"
                      className="flex-1 px-2 py-1 border border-theme rounded text-xs focus:outline-none"
                      style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
                    />
                    <Button variant="ghost" size="sm" onClick={handleSaveSlug}>
                      Save
                    </Button>
                  </div>
                  {slugError && (
                    <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{slugError}</p>
                  )}
                </div>

                {/* Public access level */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-secondary">Anyone with the link can</span>
                  <select
                    value={permissions?.public_access_level ?? "view"}
                    onChange={(e) => setPublicAccessLevel(e.target.value as PublicAccessLevel)}
                    className="text-xs px-1.5 py-0.5 border border-theme rounded"
                    style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
                  >
                    <option value="view">View</option>
                    <option value="comment">Comment</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Restrict access */}
        {pageId && (
          <div className="border-t border-theme pt-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-sm font-medium text-theme-primary">Restrict access</span>
              </div>
              <ToggleSwitch
                checked={isRestricted}
                onChange={(v) => toggleRestricted(v)}
                label="Restrict access"
              />
            </div>

            {isRestricted && (
              <div className="space-y-2 ml-5">
                <p className="text-xs text-theme-secondary">
                  Only people listed below and workspace admins can access this page.
                </p>

                {/* Add member search */}
                <div className="relative">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members to add..."
                    className="w-full px-2 py-1 border border-theme rounded text-xs focus:outline-none"
                    style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
                  />
                  {filteredMembers.length > 0 && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 border border-theme rounded shadow-lg z-10 max-h-32 overflow-y-auto"
                      style={{ background: "var(--color-bg)" }}
                    >
                      {filteredMembers.map((m) => (
                        <button
                          key={m.user_id}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-theme-surface text-left"
                          onClick={() => {
                            addAccess(m.user_id, "edit");
                            setMemberSearch("");
                          }}
                        >
                          <Avatar name={m.user.display_name || m.user.email} size="sm" />
                          <span className="text-theme-primary truncate">
                            {m.user.display_name || m.user.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Access list */}
                <div className="space-y-1">
                  {accessList.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 py-1">
                      <Avatar
                        name={entry.user?.display_name || entry.user?.email || "?"}
                        size="sm"
                      />
                      <span className="flex-1 text-xs truncate text-theme-primary">
                        {entry.user?.display_name || entry.user?.email}
                      </span>
                      <select
                        value={entry.access_level}
                        onChange={(e) =>
                          updateAccessLevel(entry.user_id, e.target.value as PageAccessLevel)
                        }
                        className="text-xs px-1 py-0.5 border border-theme rounded"
                        style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
                      >
                        <option value="view">View</option>
                        <option value="comment">Comment</option>
                        <option value="edit">Edit</option>
                      </select>
                      <Tooltip content="Remove access">
                        <button
                          onClick={() => removeAccess(entry.user_id)}
                          className="text-theme-secondary hover:text-theme-primary"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Links section */}
        <div className="border-t border-theme pt-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-theme-secondary rounded hover:bg-theme-surface"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {copied ? "Copied!" : "Copy invite link"}
          </button>
          {pageId && (
            <button
              onClick={handleCopyAgentInstructions}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-theme-secondary rounded hover:bg-theme-surface"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z" />
                <circle cx="12" cy="14" r="2" />
              </svg>
              {copiedAgent ? "Copied!" : "Copy agent instructions"}
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-theme-secondary rounded hover:bg-theme-surface"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Manage members
          </button>
        </div>
      </div>
    </div>
  );
}
