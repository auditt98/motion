import { useState } from "react";
import { Button } from "@weave-design-system/react";
import type { PageItem } from "@/hooks/useWorkspace";
import { PageIcon } from "@/components/shared/PageIcon";

interface TrashPanelProps {
  pages: PageItem[];
  onRestore: (pageId: string) => void;
  onPermanentlyDelete: (pageId: string) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function TrashPanel({ pages, onRestore, onPermanentlyDelete, onClose }: TrashPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          maxHeight: "60vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-textPrimary)" }}>
              Trash
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-theme-surface"
            style={{ color: "var(--color-textSecondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info notice */}
        <div
          className="px-5 py-2.5 text-xs shrink-0"
          style={{
            color: "var(--color-textSecondary)",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          Items in trash are automatically deleted after 30 days.
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--color-textSecondary)", opacity: 0.5 }}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="text-sm" style={{ color: "var(--color-textSecondary)" }}>
                Trash is empty
              </span>
            </div>
          ) : (
            <div className="py-1">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-theme-surface"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  {/* Icon + title */}
                  <PageIcon icon={page.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--color-textPrimary)" }}>
                      {page.title || "Untitled"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
                      {page.deleted_at ? timeAgo(page.deleted_at) : ""}
                    </div>
                  </div>

                  {/* Actions */}
                  {confirmDeleteId === page.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
                        Delete forever?
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          onPermanentlyDelete(page.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => onRestore(page.id)}>
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(page.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
