import { useEffect, useRef, useState } from "react";
import type { ColumnType } from "@motion/shared";

interface AddColumnMenuProps {
  onAdd: (name: string, type: ColumnType, options?: string[]) => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const TYPE_OPTIONS: Array<{ type: ColumnType; label: string; icon: string }> = [
  { type: "text", label: "Text", icon: "Aa" },
  { type: "number", label: "Number", icon: "#" },
  { type: "select", label: "Select", icon: "\u25BD" },
  { type: "multi_select", label: "Multi-select", icon: "\u2630" },
  { type: "date", label: "Date", icon: "\uD83D\uDCC5" },
  { type: "checkbox", label: "Checkbox", icon: "\u2611" },
  { type: "person", label: "Person", icon: "\uD83D\uDC64" },
  { type: "url", label: "URL", icon: "\uD83D\uDD17" },
];

export function AddColumnMenu({ onAdd, onClose, triggerRef }: AddColumnMenuProps) {
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<ColumnType>("text");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Position relative to trigger
  useEffect(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
  }, [triggerRef]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSubmit = () => {
    const finalName = name.trim() || "Column";
    onAdd(finalName, selectedType);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg shadow-lg overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        width: "220px",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
      }}
    >
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
            e.stopPropagation();
          }}
          placeholder="Column name"
          className="w-full px-2 py-1.5 text-sm rounded bg-transparent outline-none"
          style={{
            color: "var(--color-textPrimary)",
            border: "1px solid var(--color-border)",
          }}
        />
      </div>

      <div
        className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--color-textSecondary)" }}
      >
        Column type
      </div>

      <div className="pb-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => {
              const finalName = name.trim() || opt.label;
              onAdd(finalName, opt.type);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:opacity-80"
            style={{
              color: "var(--color-textPrimary)",
              background: selectedType === opt.type ? "var(--color-rustLight)" : "transparent",
            }}
          >
            <span className="text-xs w-5 text-center opacity-60">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <div
        className="px-3 py-2"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <button
          onClick={handleSubmit}
          className="w-full text-center py-1.5 text-sm font-medium rounded"
          style={{
            background: "var(--color-rust)",
            color: "var(--color-white, #fff)",
          }}
        >
          Add column
        </button>
      </div>
    </div>
  );
}
