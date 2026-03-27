import { useEffect, useRef, useState } from "react";
import type { ColumnType, DatabaseColumn } from "@motion/shared";

interface CellEditorProps {
  value: unknown;
  column: DatabaseColumn;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export function CellEditor({ value, column, onCommit, onCancel }: CellEditorProps) {
  switch (column.type) {
    case "text":
    case "url":
      return (
        <TextInput
          value={value != null ? String(value) : ""}
          onCommit={onCommit}
          onCancel={onCancel}
          type={column.type === "url" ? "url" : "text"}
        />
      );

    case "number":
      return (
        <TextInput
          value={value != null ? String(value) : ""}
          onCommit={(v) => onCommit(v === "" ? null : Number(v))}
          onCancel={onCancel}
          type="number"
        />
      );

    case "date":
      return (
        <TextInput
          value={value != null ? String(value) : ""}
          onCommit={onCommit}
          onCancel={onCancel}
          type="date"
        />
      );

    case "select":
      return (
        <SelectEditor
          value={value != null ? String(value) : ""}
          options={column.options ?? []}
          onCommit={onCommit}
          onCancel={onCancel}
          multi={false}
        />
      );

    case "multi_select":
      return (
        <SelectEditor
          value={Array.isArray(value) ? value.map(String) : []}
          options={column.options ?? []}
          onCommit={onCommit}
          onCancel={onCancel}
          multi={true}
        />
      );

    case "checkbox":
      // Checkbox is handled inline via CellRenderer — no separate editor needed
      return null;

    case "person":
      return (
        <TextInput
          value={value != null ? String(value) : ""}
          onCommit={onCommit}
          onCancel={onCancel}
          type="text"
          placeholder="Enter name..."
        />
      );

    default:
      return (
        <TextInput
          value={value != null ? String(value) : ""}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      );
  }
}

function TextInput({
  value,
  onCommit,
  onCancel,
  type = "text",
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  type?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCancel(); // close editor, value already committed
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
      onBlur={() => onCancel()}
      className="w-full text-sm bg-transparent outline-none"
      style={{ color: "var(--color-textPrimary)" }}
    />
  );
}

function SelectEditor({
  value,
  options,
  onCommit,
  onCancel,
  multi,
}: {
  value: string | string[];
  options: string[];
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  multi: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(
    multi ? (Array.isArray(value) ? value : []) : value ? [String(value)] : [],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (multi) {
          onCommit(selected);
        } else {
          onCancel();
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [multi, selected, onCommit, onCancel]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (opt: string) => {
    if (multi) {
      setSelected((prev) =>
        prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
      );
    } else {
      onCommit(opt);
    }
  };

  const handleAddOption = () => {
    if (!search.trim()) return;
    if (multi) {
      setSelected((prev) => [...prev, search.trim()]);
    } else {
      onCommit(search.trim());
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        minWidth: "180px",
        maxHeight: "240px",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if (e.key === "Enter" && filtered.length === 0 && search.trim()) {
            e.preventDefault();
            handleAddOption();
          }
          e.stopPropagation();
        }}
        placeholder="Search or add..."
        className="w-full px-3 py-2 text-sm bg-transparent outline-none"
        style={{
          color: "var(--color-textPrimary)",
          borderBottom: "1px solid var(--color-border)",
        }}
      />
      <div className="overflow-y-auto max-h-[180px]">
        {filtered.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80 flex items-center gap-2"
            style={{
              color: "var(--color-textPrimary)",
              background: selected.includes(opt) ? "var(--color-rustLight)" : "transparent",
            }}
          >
            {multi && (
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                readOnly
                className="w-3.5 h-3.5"
              />
            )}
            {opt}
          </button>
        ))}
        {search.trim() && !options.includes(search.trim()) && (
          <button
            onClick={handleAddOption}
            className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80"
            style={{ color: "var(--color-rust)" }}
          >
            + Add "{search.trim()}"
          </button>
        )}
      </div>
      {multi && (
        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={() => onCommit(selected)}
            className="text-sm font-medium"
            style={{ color: "var(--color-rust)" }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
