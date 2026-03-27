import type { ColumnType } from "@motion/shared";
import { Badge, Avatar, Tooltip } from "@weave-design-system/react";

interface CellRendererProps {
  value: unknown;
  columnType: ColumnType;
  onToggleCheckbox?: () => void;
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
      return <Badge>{String(value)}</Badge>;

    case "multi_select": {
      if (!Array.isArray(value) || value.length === 0) return null;
      return (
        <div className="flex gap-1 flex-wrap">
          {value.map((v, i) => (
            <Badge key={i}>{String(v)}</Badge>
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
