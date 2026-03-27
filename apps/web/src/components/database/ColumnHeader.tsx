import { useCallback, useRef, useState } from "react";
import type { DatabaseColumn, ColumnType } from "@motion/shared";
import { Tooltip } from "@weave-design-system/react";

interface ColumnHeaderProps {
  column: DatabaseColumn;
  sortDirection: "asc" | "desc" | null;
  onSort: (direction: "asc" | "desc") => void;
  onRename: (name: string) => void;
  onChangeType: (type: ColumnType) => void;
  onHide: () => void;
  onDelete: () => void;
  onResize: (width: number) => void;
}

const TYPE_ICONS: Record<ColumnType, string> = {
  text: "Aa",
  number: "#",
  select: "\u25BD",
  multi_select: "\u2630",
  date: "\uD83D\uDCC5",
  checkbox: "\u2611",
  person: "\uD83D\uDC64",
  url: "\uD83D\uDD17",
};

const TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  person: "Person",
  url: "URL",
};

const ALL_TYPES: ColumnType[] = ["text", "number", "select", "multi_select", "date", "checkbox", "person", "url"];

export function ColumnHeader({
  column,
  sortDirection,
  onSort,
  onRename,
  onChangeType,
  onHide,
  onDelete,
  onResize,
}: ColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const handleRenameSubmit = useCallback(() => {
    if (renameValue.trim()) {
      onRename(renameValue.trim());
    }
    setRenaming(false);
    setMenuOpen(false);
  }, [renameValue, onRename]);

  // Resize handle
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = column.width;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(100, Math.min(600, startWidth + delta));
        onResize(newWidth);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [column.width, onResize],
  );

  return (
    <div
      ref={headerRef}
      className="relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium select-none group"
      style={{
        color: "var(--color-textSecondary)",
      }}
    >
      <span className="text-xs opacity-60">{TYPE_ICONS[column.type]}</span>

      {renaming ? (
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") {
              setRenaming(false);
              setMenuOpen(false);
            }
            e.stopPropagation();
          }}
          onBlur={handleRenameSubmit}
          autoFocus
          className="flex-1 bg-transparent outline-none text-xs font-medium"
          style={{ color: "var(--color-textPrimary)" }}
        />
      ) : (
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex-1 text-left truncate hover:opacity-80"
        >
          {column.name}
        </button>
      )}

      {sortDirection && (
        <span className="text-[10px]">{sortDirection === "asc" ? "\u2191" : "\u2193"}</span>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:opacity-100"
        style={{ background: "var(--color-rust)" }}
      />

      {/* Column menu */}
      {menuOpen && !renaming && (
        <ColumnMenu
          menuRef={menuRef}
          column={column}
          typeMenuOpen={typeMenuOpen}
          onSetTypeMenuOpen={setTypeMenuOpen}
          onSort={onSort}
          onRename={() => {
            setRenameValue(column.name);
            setRenaming(true);
          }}
          onChangeType={(type) => {
            onChangeType(type);
            setTypeMenuOpen(false);
            setMenuOpen(false);
          }}
          onHide={() => {
            onHide();
            setMenuOpen(false);
          }}
          onDelete={() => {
            onDelete();
            setMenuOpen(false);
          }}
          onClose={() => {
            setMenuOpen(false);
            setTypeMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ColumnMenu({
  menuRef,
  column,
  typeMenuOpen,
  onSetTypeMenuOpen,
  onSort,
  onRename,
  onChangeType,
  onHide,
  onDelete,
  onClose,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  column: DatabaseColumn;
  typeMenuOpen: boolean;
  onSetTypeMenuOpen: (open: boolean) => void;
  onSort: (direction: "asc" | "desc") => void;
  onRename: () => void;
  onChangeType: (type: ColumnType) => void;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="absolute top-full left-0 z-50 rounded-lg shadow-lg py-1 min-w-[180px]"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <MenuItem onClick={onRename}>Rename</MenuItem>
        <MenuItem onClick={() => onSetTypeMenuOpen(!typeMenuOpen)}>
          Type: {TYPE_LABELS[column.type]}
        </MenuItem>
        {typeMenuOpen && (
          <div
            className="mx-2 my-1 rounded-md py-1"
            style={{ background: "var(--color-bg)" }}
          >
            {ALL_TYPES.map((t) => (
              <MenuItem
                key={t}
                onClick={() => onChangeType(t)}
                active={column.type === t}
              >
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </MenuItem>
            ))}
          </div>
        )}
        <div className="h-px mx-2 my-1" style={{ background: "var(--color-border)" }} />
        <MenuItem onClick={() => { onSort("asc"); onClose(); }}>Sort ascending</MenuItem>
        <MenuItem onClick={() => { onSort("desc"); onClose(); }}>Sort descending</MenuItem>
        <div className="h-px mx-2 my-1" style={{ background: "var(--color-border)" }} />
        <MenuItem onClick={onHide}>Hide column</MenuItem>
        <MenuItem onClick={onDelete} danger>Delete column</MenuItem>
      </div>
    </>
  );
}

function MenuItem({
  onClick,
  children,
  active,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
      style={{
        color: danger ? "var(--color-rust)" : "var(--color-textPrimary)",
        background: active ? "var(--color-rustLight)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

export function AddColumnButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Add column">
      <button
        onClick={onClick}
        className="flex items-center justify-center px-3 py-1.5 text-xs hover:opacity-80"
        style={{
          color: "var(--color-textSecondary)",
          minWidth: "40px",
        }}
      >
        +
      </button>
    </Tooltip>
  );
}
