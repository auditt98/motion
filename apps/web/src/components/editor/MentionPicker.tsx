import { useEffect, useRef, useState } from "react";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";

interface MentionPickerProps {
  members: MemberWithUser[];
  query: string;
  onSelect: (member: MemberWithUser) => void;
  onClose: () => void;
}

export function MentionPicker({
  members,
  query,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    const name = (m.user.display_name || "").toLowerCase();
    const email = m.user.email.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div className="mention-picker">
        <div className="mention-picker-empty">No members found</div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="mention-picker">
      {filtered.map((member, index) => (
        <button
          key={member.user.id}
          className={`mention-picker-item ${index === selectedIndex ? "selected" : ""}`}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => onSelect(member)}
          type="button"
        >
          <div className="mention-picker-avatar">
            {member.user.avatar_url ? (
              <img
                src={member.user.avatar_url}
                alt=""
                className="mention-picker-avatar-img"
              />
            ) : (
              <span className="mention-picker-avatar-fallback">
                {(member.user.display_name || member.user.email)[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mention-picker-info">
            <span className="mention-picker-name">
              {member.user.display_name || member.user.email.split("@")[0]}
            </span>
            <span className="mention-picker-email">{member.user.email}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
