import { useState, useRef, useCallback, useEffect } from "react";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { MentionPicker } from "./MentionPicker";

interface CommentComposerProps {
  members: MemberWithUser[];
  onSubmit: (body: string, mentions: string[]) => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Map from display text position to raw body with @[name](id) tokens */
interface MentionEntry {
  displayName: string;
  userId: string;
  /** Position of "@name" in displayText */
  displayStart: number;
  displayEnd: number;
}

function buildRawBody(displayText: string, mentions: MentionEntry[]): string {
  // Sort mentions by position descending so replacements don't shift earlier positions
  const sorted = [...mentions].sort(
    (a, b) => b.displayStart - a.displayStart,
  );
  let raw = displayText;
  for (const m of sorted) {
    const token = `@[${m.displayName}](${m.userId})`;
    raw = raw.slice(0, m.displayStart) + token + raw.slice(m.displayEnd);
  }
  return raw;
}

export function CommentComposer({
  members,
  onSubmit,
  onCancel,
  placeholder = "Add a comment...",
  autoFocus = true,
}: CommentComposerProps) {
  const [displayText, setDisplayText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionEntries, setMentionEntries] = useState<MentionEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [displayText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDisplayText(value);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }

    // Remove mention entries whose text no longer matches at their position
    setMentionEntries((prev) =>
      prev.filter((m) => {
        const text = value.slice(m.displayStart, m.displayEnd);
        return text === `@${m.displayName}`;
      }),
    );
  };

  const handleMentionSelect = useCallback(
    (member: MemberWithUser) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = displayText.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");
      const textAfterCursor = displayText.slice(cursorPos);

      const displayName =
        member.user.display_name || member.user.email.split("@")[0];
      const displayToken = `@${displayName}`;

      const newDisplayText =
        displayText.slice(0, atIndex) + displayToken + " " + textAfterCursor;

      const entry: MentionEntry = {
        displayName,
        userId: member.user.id,
        displayStart: atIndex,
        displayEnd: atIndex + displayToken.length,
      };

      setDisplayText(newDisplayText);
      setMentionEntries((prev) => [...prev, entry]);
      setMentionQuery(null);

      // Refocus textarea
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = atIndex + displayToken.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [displayText],
  );

  const handleSubmit = () => {
    const trimmed = displayText.trim();
    if (!trimmed) return;
    const rawBody = buildRawBody(displayText, mentionEntries);
    const mentionIds = mentionEntries.map((m) => m.userId);
    onSubmit(rawBody.trim(), mentionIds);
    setDisplayText("");
    setMentionEntries([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) return; // let MentionPicker handle keys
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="comment-composer">
      <div className="comment-composer-input-wrapper">
        <textarea
          ref={textareaRef}
          className="comment-composer-textarea"
          value={displayText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
        />
        {mentionQuery !== null && (
          <div className="comment-composer-mention-picker">
            <MentionPicker
              members={members}
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={() => setMentionQuery(null)}
            />
          </div>
        )}
      </div>
      <div className="comment-composer-actions">
        <button
          className="comment-composer-btn cancel"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="comment-composer-btn submit"
          onClick={handleSubmit}
          disabled={!displayText.trim()}
          type="button"
        >
          Comment
        </button>
      </div>
    </div>
  );
}
