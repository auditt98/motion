import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import type { PageItem, FolderItem } from "@/hooks/useWorkspace";
import type { RecentPage } from "@/hooks/usePageActivity";
import { useSearch, type SearchResult } from "@/hooks/useSearch";
import { PageIcon } from "@/components/shared/PageIcon";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  pages: PageItem[];
  folders: FolderItem[];
  recentPages: RecentPage[];
  workspaceId: string | null;
}

/** Minimum query length for server-side search */
const SERVER_SEARCH_THRESHOLD = 4;

export function CommandPalette({
  open,
  onClose,
  pages,
  folders,
  recentPages,
  workspaceId,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results: serverResults, loading, search, clear } = useSearch(workspaceId);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      clear();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, clear]);

  // Trigger server search when query changes
  useEffect(() => {
    if (query.trim().length >= SERVER_SEARCH_THRESHOLD) {
      search(query);
    } else {
      clear();
    }
  }, [query, search, clear]);

  // Use server results when available, otherwise fall back to client-side title filter
  const useServerResults = query.trim().length >= SERVER_SEARCH_THRESHOLD;

  type ResultItem = {
    id: string;
    title: string;
    icon: string | null;
    folderName: string | null;
    snippet: string | null;
  };

  const results: ResultItem[] = (() => {
    if (!query.trim()) {
      // No query → show recent pages
      return recentPages.slice(0, 10).map((rp) => ({
        id: rp.page_id,
        title: rp.title,
        icon: rp.icon,
        folderName: null,
        snippet: null,
      }));
    }

    if (useServerResults && serverResults.length > 0) {
      // Server-side results with content snippets
      return serverResults.map((sr) => ({
        id: sr.page_id,
        title: sr.title,
        icon: pages.find((p) => p.id === sr.page_id)?.icon || null,
        folderName: (() => {
          const page = pages.find((p) => p.id === sr.page_id);
          if (!page?.folder_id) return null;
          return folders.find((f) => f.id === page.folder_id)?.name || null;
        })(),
        snippet: sr.snippet,
      }));
    }

    // Short query → client-side title filter
    return pages
      .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        title: p.title,
        icon: p.icon,
        folderName: p.folder_id
          ? folders.find((f) => f.id === p.folder_id)?.name || null
          : null,
        snippet: null,
      }));
  })();

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  const selectResult = useCallback(
    (id: string) => {
      navigate(`/page/${id}`);
      onClose();
    },
    [navigate, onClose],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        selectResult(results[selectedIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4 sm:px-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-textSecondary)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and content..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "var(--color-textPrimary)" }}
          />
          {loading && (
            <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
              Searching...
            </span>
          )}
          <kbd
            className="hidden sm:inline-block px-1.5 py-0.5 text-xs rounded"
            style={{
              color: "var(--color-textSecondary)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-textSecondary)" }}>
              {loading ? "Searching..." : query ? "No pages found" : "No recent pages"}
            </div>
          ) : (
            <>
              {!query && (
                <div
                  className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--color-textSecondary)" }}
                >
                  Recent
                </div>
              )}
              {useServerResults && serverResults.length > 0 && (
                <div
                  className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--color-textSecondary)" }}
                >
                  Content results
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => selectResult(result.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className="flex flex-col gap-0.5 w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    background: index === selectedIndex ? "var(--color-bg)" : "transparent",
                    color: index === selectedIndex ? "var(--color-textPrimary)" : "var(--color-textSecondary)",
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <PageIcon icon={result.icon} />
                    <span className="truncate" style={{ color: "var(--color-textPrimary)" }}>
                      {result.title}
                    </span>
                    {result.folderName && (
                      <span
                        className="text-xs shrink-0 ml-auto"
                        style={{ color: "var(--color-textSecondary)" }}
                      >
                        {result.folderName}
                      </span>
                    )}
                  </div>
                  {result.snippet && (
                    <div
                      className="text-xs truncate pl-6"
                      style={{ color: "var(--color-textSecondary)" }}
                      dangerouslySetInnerHTML={{
                        __html: result.snippet.replace(
                          /\*\*(.*?)\*\*/g,
                          '<mark style="background:var(--color-rustLight);color:var(--color-textPrimary);border-radius:2px;padding:0 2px">$1</mark>',
                        ),
                      }}
                    />
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 flex items-center gap-4 text-xs"
          style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-textSecondary)" }}
        >
          <span>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>↵</kbd> open
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
