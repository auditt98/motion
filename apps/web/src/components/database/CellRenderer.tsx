import type { ColumnType } from "@motion/shared";
import { Avatar, Tooltip } from "@weave-design-system/react";

interface CellRendererProps {
  value: unknown;
  columnType: ColumnType;
  onToggleCheckbox?: () => void;
}

/** Warm-editorial hues for select/status pills, assigned deterministically per option value. */
const PILL_HUES = [
  "var(--color-forest)",
  "var(--color-gold)",
  "var(--color-teal)",
  "var(--color-rust)",
  "var(--color-textSecondary)",
];

function hueFor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return PILL_HUES[h % PILL_HUES.length];
}

function SelectPill({ value }: { value: string }) {
  const hue = hueFor(value);
  return (
    <span
      className="inline-block truncate"
      style={{
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.5,
        background: `color-mix(in srgb, ${hue} 15%, transparent)`,
        color: hue,
      }}
    >
      {value}
    </span>
  );
}

export function CellRenderer({ value, columnType, onToggleCheckbox }: CellRendererProps) {
  switch (columnType) {
    case "text":
      return <span className="truncate">{value != null ? String(value) : ""}</span>;

    case "number":
      return (
        <span className="truncate text-right w-full block tabular-nums">
          {value != null ? String(value) : ""}
        </span>
      );

    case "select":
      if (!value) return null;
      return <SelectPill value={String(value)} />;

    case "multi_select": {
      if (!Array.isArray(value) || value.length === 0) return null;
      return (
        <div className="flex gap-1 flex-wrap">
          {value.map((v, i) => (
            <SelectPill key={i} value={String(v)} />
          ))}
        </div>
      );
    }

    case "date":
      if (!value) return null;
      try {
        const d = new Date(String(value));
        return (
          <span className="truncate" style={{ color: "var(--color-textSecondary)" }}>
            {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        );
      } catch {
        return <span className="truncate">{String(value)}</span>;
      }

    case "checkbox":
      return (
        <label
          className="flex items-center justify-center w-full cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheckbox?.();
          }}
        >
          <input
            type="checkbox"
            checked={value === true}
            onChange={() => onToggleCheckbox?.()}
            className="w-4 h-4 rounded cursor-pointer accent-current"
            style={{ accentColor: "var(--color-rust)" }}
          />
        </label>
      );

    case "person":
      if (!value) return null;
      const personName = typeof value === "object" && value !== null && "name" in value
        ? String((value as { name: string }).name)
        : String(value);
      return (
        <div className="flex items-center gap-1.5 truncate">
          <Avatar name={personName} size="sm" />
          <span className="truncate">{personName}</span>
        </div>
      );

    case "url":
      if (!value) return null;
      return (
        <Tooltip content={String(value)}>
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate underline"
            style={{ color: "var(--color-rust)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </a>
        </Tooltip>
      );

    default:
      return <span className="truncate">{value != null ? String(value) : ""}</span>;
  }
}
