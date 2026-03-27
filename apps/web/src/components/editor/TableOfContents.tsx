import { useState } from "react";
import { Button, Tooltip } from "@weave-design-system/react";
import type { TocEntry } from "@/hooks/useTableOfContents";

interface TableOfContentsProps {
  entries: TocEntry[];
  activeId: string | null;
  onEntryClick: (entry: TocEntry) => void;
  onClose: () => void;
}

const INDENT: Record<number, number> = { 1: 0, 2: 16, 3: 32 };

export function TableOfContents({
  entries,
  activeId,
  onEntryClick,
  onClose,
}: TableOfContentsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="toc-sidebar">
      <div className="toc-sidebar-header">
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-textPrimary)",
          }}
        >
          Contents
        </span>
        <Tooltip content="Close">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close table of contents"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </Button>
        </Tooltip>
      </div>

      <div className="toc-sidebar-list">
        {entries.length === 0 ? (
          <div className="toc-sidebar-empty">
            Add headings (H1, H2, H3) to see a document outline here.
          </div>
        ) : (
          entries.map((entry) => {
            const isActive = entry.id === activeId;
            const isHovered = entry.id === hoveredId;

            return (
              <div
                key={entry.id}
                className={`toc-entry ${isActive ? "active" : ""}`}
                style={{
                  paddingLeft: 8 + INDENT[entry.level],
                  background: isActive
                    ? undefined
                    : isHovered
                      ? "var(--color-overlay)"
                      : undefined,
                }}
                onClick={() => onEntryClick(entry)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {entry.text || "Untitled"}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
