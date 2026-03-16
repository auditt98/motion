import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Button, Tooltip } from "@weave-design-system/react";
import {
  findAllSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  type SuggestionInfo,
} from "./SuggestionModePlugin";

interface SuggestionPopoverProps {
  editor: Editor;
  currentUserId: string;
}

export function SuggestionPopover({ editor, currentUserId }: SuggestionPopoverProps) {
  const [activeSuggestion, setActiveSuggestion] =
    useState<SuggestionInfo | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  const detectSuggestion = useCallback(() => {
    if (!editor.view) return;

    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    const node = $pos.parent;

    // Check if the cursor is inside a suggestion mark
    const marks = $pos.marks();
    const suggestionMark = marks.find(
      (m) =>
        m.type.name === "suggestionAdd" ||
        m.type.name === "suggestionDelete",
    );

    if (!suggestionMark) {
      setActiveSuggestion(null);
      setCoords(null);
      return;
    }

    // Don't show popover for the user's own suggestions
    if (suggestionMark.attrs.authorId === currentUserId) {
      setActiveSuggestion(null);
      setCoords(null);
      return;
    }

    // Find the full suggestion range
    const suggestions = findAllSuggestions(editor.view);
    const match = suggestions.find(
      (s) =>
        s.suggestionId === suggestionMark.attrs.suggestionId &&
        from >= s.from &&
        from <= s.to,
    );

    if (match) {
      setActiveSuggestion(match);
      // Use viewport coordinates directly (we render with position: fixed)
      const domCoords = editor.view.coordsAtPos(match.from);
      setCoords({
        top: domCoords.top,
        left: domCoords.left,
      });
    } else {
      setActiveSuggestion(null);
      setCoords(null);
    }
  }, [editor]);

  useEffect(() => {
    const handler = () => detectSuggestion();
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor, detectSuggestion]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setActiveSuggestion(null);
        setCoords(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!activeSuggestion || !coords) return null;

  const timeAgo = formatTimeAgo(activeSuggestion.createdAt);

  return (
    <div
      ref={popoverRef}
      className="suggestion-popover"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        transform: "translateY(-100%) translateY(-8px)",
      }}
    >
      <div className="suggestion-popover-header">
        <span className="suggestion-popover-author">
          {activeSuggestion.authorName}
        </span>
        <span className="suggestion-popover-time">{timeAgo}</span>
      </div>
      <div className="suggestion-popover-type">
        {activeSuggestion.type === "add" ? "Suggested addition" : "Suggested deletion"}
      </div>
      <div className="suggestion-popover-actions">
        <Tooltip content="Accept suggestion">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              acceptSuggestion(editor.view, activeSuggestion.suggestionId);
              setActiveSuggestion(null);
              setCoords(null);
            }}
            style={{ color: "var(--color-forest)" }}
            aria-label="Accept"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 8 6.5 11.5 13 5" />
            </svg>
            Accept
          </Button>
        </Tooltip>
        <Tooltip content="Reject suggestion">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              rejectSuggestion(editor.view, activeSuggestion.suggestionId);
              setActiveSuggestion(null);
              setCoords(null);
            }}
            style={{ color: "var(--color-rust)" }}
            aria-label="Reject"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
            Reject
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
