import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import type { PageItem, FolderItem } from "@/hooks/useWorkspace";
import type { RecentPage } from "@/hooks/usePageActivity";
import { PageIcon } from "@/components/shared/PageIcon";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  pages: PageItem[];
  folders: FolderItem[];
  recentPages: RecentPage[];
}

export function CommandPalette({
  open,
  onClose,
  pages,
  folders,
  recentPages,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to ensure the element is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build result list
  const results: Array<{ id: string; title: string; icon: string | null; folderName: string | null }> =
    query.trim()
      ? pages
          .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 12)
          .map((p) => ({
            id: p.id,
            title: p.title,
            icon: p.icon,
            folderName: p.folder_id
              ? folders.find((f) => f.id === p.folder_id)?.name || null
              : null,
          }))
      : recentPages.slice(0, 10).map((rp) => ({
          id: rp.page_id,
          title: rp.title,
          icon: rp.icon,
          folderName: null,
        }));

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
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
            placeholder="Search pages..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {query ? "No pages found" : "No recent pages"}
            </div>
          ) : (
            <>
              {!query && (
                <div className="px-4 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Recent
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => selectResult(result.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center gap-2 w-full px-4 py-2 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <PageIcon icon={result.icon} />
                  <span className="truncate">{result.title}</span>
                  {result.folderName && (
                    <span className="text-xs text-gray-400 shrink-0 ml-auto">
                      {result.folderName}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">↵</kbd> open
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
