import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@weave-design-system/react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useInvitations } from "@/hooks/useInvitations";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { buildAgentInstructions } from "@motion/shared";

export function ShareButton({ pageId }: { pageId?: string }) {
  const { workspaceId } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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

      {open && (
        <SharePopover
          workspaceId={workspaceId}
          pageId={pageId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function SharePopover({
  workspaceId,
  pageId,
  onClose,
}: {
  workspaceId: string | null;
  pageId?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { sendInvitation } = useInvitations(workspaceId);
  const { links, createLink } = useInviteLinks(workspaceId);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAgent, setCopiedAgent] = useState(false);

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

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Invite people
        </h3>

        <form onSubmit={handleInvite} className="space-y-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {sent ? "Sent!" : sending ? "Sending..." : "Send invite"}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}

        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-50"
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
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-50"
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
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-50"
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

