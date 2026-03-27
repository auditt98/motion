import { useCallback, useEffect, useRef, useState } from "react";
import type { DatabaseColumn, ColumnType, DatabaseViewConfig } from "@motion/shared";
import type { DatabaseRow } from "@/hooks/useDatabase";
import type { CellCursor } from "@/hooks/useDatabaseCursors";
import { ColumnHeader, AddColumnButton } from "./ColumnHeader";
import { CellRenderer } from "./CellRenderer";
import { CellEditor } from "./CellEditor";
import { AddColumnMenu } from "./AddColumnMenu";
import { FilterBar } from "./FilterBar";
import { Button, Tooltip } from "@weave-design-system/react";

interface TableViewProps {
  columns: DatabaseColumn[];
  visibleColumns: DatabaseColumn[];
  allColumns: DatabaseColumn[];
  rows: DatabaseRow[];
  viewConfig: DatabaseViewConfig;
  onAddColumn: (name: string, type: ColumnType, options?: string[]) => void;
  onUpdateColumn: (columnId: string, updates: Partial<Pick<DatabaseColumn, "name" | "type" | "width" | "options">>) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddRow: (values?: Record<string, unknown>) => string | null;
  onUpdateCell: (rowId: string, columnId: string, value: unknown) => void;
  onDeleteRow: (rowId: string) => void;
  onUpdateViewConfig: (updates: Partial<DatabaseViewConfig>) => void;
  cellCursors?: CellCursor[];
  onCellFocus?: (rowId: string | null, columnId: string | null) => void;
}

interface EditingCell {
  rowId: string;
  columnId: string;
}

export function TableView({
  columns,
  visibleColumns,
  allColumns,
  rows,
  viewConfig,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onAddRow,
  onUpdateCell,
  onDeleteRow,
  onUpdateViewConfig,
  cellCursors = [],
  onCellFocus,
}: TableViewProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [activeCell, setActiveCell] = useState<EditingCell | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showAddColumn, setShowAddColumn] = useState(false);
  const addColBtnRef = useRef<HTMLDivElement>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editingCell) return;
      if (!activeCell || rows.length === 0 || visibleColumns.length === 0) return;

      const rowIdx = rows.findIndex((r) => r.id === activeCell.rowId);
      const colIdx = visibleColumns.findIndex((c) => c.id === activeCell.columnId);
      if (rowIdx === -1 || colIdx === -1) return;

      let nextRow = rowIdx;
      let nextCol = colIdx;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          nextRow = Math.max(0, rowIdx - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          nextRow = Math.min(rows.length - 1, rowIdx + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextCol = Math.max(0, colIdx - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          nextCol = Math.min(visibleColumns.length - 1, colIdx + 1);
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            if (colIdx > 0) {
              nextCol = colIdx - 1;
            } else if (rowIdx > 0) {
              nextRow = rowIdx - 1;
              nextCol = visibleColumns.length - 1;
            }
          } else {
            if (colIdx < visibleColumns.length - 1) {
              nextCol = colIdx + 1;
            } else if (rowIdx < rows.length - 1) {
              nextRow = rowIdx + 1;
              nextCol = 0;
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          if (visibleColumns[colIdx].type !== "checkbox") {
            setEditingCell({ rowId: activeCell.rowId, columnId: activeCell.columnId });
          }
          return;
        case "Delete":
        case "Backspace":
          if (selectedRows.size > 0) {
            e.preventDefault();
            for (const rowId of selectedRows) {
              onDeleteRow(rowId);
            }
            setSelectedRows(new Set());
          }
          return;
        case "Escape":
          setActiveCell(null);
          return;
        default:
          return;
      }

      setActiveCell({ rowId: rows[nextRow].id, columnId: visibleColumns[nextCol].id });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCell, editingCell, rows, visibleColumns, selectedRows, onDeleteRow]);

  const handleCellClick = useCallback(
    (rowId: string, columnId: string, columnType: ColumnType) => {
      setActiveCell({ rowId, columnId });
      onCellFocus?.(rowId, columnId);
      if (columnType === "checkbox") return;
      setEditingCell({ rowId, columnId });
    },
    [onCellFocus],
  );

  // Clear cursor when clicking away
  useEffect(() => {
    if (!activeCell) {
      onCellFocus?.(null, null);
    }
  }, [activeCell, onCellFocus]);

  const handleCellCommit = useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      onUpdateCell(rowId, columnId, value);
      setEditingCell(null);
    },
    [onUpdateCell],
  );

  const handleToggleCheckbox = useCallback(
    (rowId: string, columnId: string, currentValue: unknown) => {
      onUpdateCell(rowId, columnId, currentValue !== true);
    },
    [onUpdateCell],
  );

  const handleSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      onUpdateViewConfig({ sorts: [{ columnId, direction }] });
    },
    [onUpdateViewConfig],
  );

  const handleHideColumn = useCallback(
    (columnId: string) => {
      onUpdateViewConfig({ hiddenColumns: [...viewConfig.hiddenColumns, columnId] });
    },
    [onUpdateViewConfig, viewConfig.hiddenColumns],
  );

  const handleResizeColumn = useCallback(
    (columnId: string, width: number) => {
      onUpdateViewConfig({ columnWidths: { ...viewConfig.columnWidths, [columnId]: width } });
    },
    [onUpdateViewConfig, viewConfig.columnWidths],
  );

  const handleToggleRowSelection = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleToggleAllRows = useCallback(() => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => r.id)));
    }
  }, [selectedRows.size, rows]);

  const handleDeleteSelected = useCallback(() => {
    for (const rowId of selectedRows) {
      onDeleteRow(rowId);
    }
    setSelectedRows(new Set());
  }, [selectedRows, onDeleteRow]);

  const getSortDirection = (columnId: string): "asc" | "desc" | null => {
    const sort = viewConfig.sorts.find((s) => s.columnId === columnId);
    return sort?.direction ?? null;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <FilterBar
        columns={allColumns}
        filters={viewConfig.filters}
        onUpdateFilters={(filters) => onUpdateViewConfig({ filters })}
      />

      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 text-sm"
          style={{
            background: "var(--color-rustLight)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span style={{ color: "var(--color-rust)", fontWeight: 500 }}>
            {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""} selected
          </span>
          <Button variant="ghost" size="sm" onClick={handleDeleteSelected}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table
          style={{ borderCollapse: "separate", borderSpacing: 0 }}
        >
          <colgroup>
            <col style={{ width: "44px" }} />
            {visibleColumns.map((col) => (
              <col key={col.id} style={{ width: col.width }} />
            ))}
            <col style={{ width: "44px" }} />
          </colgroup>
          {/* Header */}
          <thead>
            <tr>
              {/* Row selector header */}
              <th
                className="sticky top-0 z-10"
                style={{
                  background: "var(--color-surface)",
                  borderBottom: "2px solid var(--color-border)",
                  padding: "0 12px",
                }}
              >
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedRows.size === rows.length}
                  onChange={handleToggleAllRows}
                  className="w-3.5 h-3.5 cursor-pointer"
                  style={{ accentColor: "var(--color-rust)" }}
                />
              </th>

              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className="sticky top-0 z-10 text-left p-0"
                  style={{
                    background: "var(--color-surface)",
                    borderBottom: "2px solid var(--color-border)",
                    borderRight: "1px solid var(--color-border)",
                  }}
                >
                  <ColumnHeader
                    column={col}
                    sortDirection={getSortDirection(col.id)}
                    onSort={(dir) => handleSort(col.id, dir)}
                    onRename={(name) => onUpdateColumn(col.id, { name })}
                    onChangeType={(type) => onUpdateColumn(col.id, { type })}
                    onHide={() => handleHideColumn(col.id)}
                    onDelete={() => onDeleteColumn(col.id)}
                    onResize={(width) => handleResizeColumn(col.id, width)}
                  />
                </th>
              ))}

              {/* Add column */}
              <th
                className="sticky top-0 z-10"
                style={{
                  background: "var(--color-surface)",
                  borderBottom: "2px solid var(--color-border)",
                  width: "44px",
                }}
              >
                <div ref={addColBtnRef}>
                  <AddColumnButton onClick={() => setShowAddColumn(!showAddColumn)} />
                  {showAddColumn && (
                    <AddColumnMenu
                      onAdd={onAddColumn}
                      onClose={() => setShowAddColumn(false)}
                      triggerRef={addColBtnRef}
                    />
                  )}
                </div>
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedRows.has(row.id);
              const isHovered = hoveredRowId === row.id;

              return (
                <tr
                  key={row.id}
                  onMouseEnter={() => setHoveredRowId(row.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  style={{
                    background: isSelected
                      ? "var(--color-rustLight)"
                      : isHovered
                        ? "var(--color-overlay, rgba(0,0,0,0.02))"
                        : "transparent",
                  }}
                >
                  {/* Row selector */}
                  <td
                    style={{
                      padding: "0 12px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRowSelection(row.id)}
                      className="w-3.5 h-3.5 cursor-pointer"
                      style={{ accentColor: "var(--color-rust)" }}
                    />
                  </td>

                  {visibleColumns.map((col) => {
                    const isEditing =
                      editingCell?.rowId === row.id && editingCell?.columnId === col.id;
                    const isActive =
                      activeCell?.rowId === row.id && activeCell?.columnId === col.id;
                    const remoteCursor = cellCursors.find(
                      (c) => c.rowId === row.id && c.columnId === col.id
                    );

                    return (
                      <td
                        key={col.id}
                        className="relative text-sm cursor-pointer"
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid var(--color-border)",
                          borderRight: "1px solid var(--color-border)",
                          color: "var(--color-textPrimary)",
                          background: isEditing ? "var(--color-rustLight)" : undefined,
                          outline: remoteCursor
                            ? `2px solid ${remoteCursor.color}`
                            : isActive && !isEditing
                              ? "2px solid var(--color-rust)"
                              : undefined,
                          outlineOffset: "-2px",
                        }}
                        onClick={() => handleCellClick(row.id, col.id, col.type)}
                      >
                        {/* Remote cursor label */}
                        {remoteCursor && (
                          <div
                            className="absolute -top-4 left-0 px-1 py-0.5 text-[10px] leading-none rounded-t whitespace-nowrap z-10"
                            style={{
                              background: remoteCursor.color,
                              color: "#fff",
                            }}
                          >
                            {remoteCursor.name}
                          </div>
                        )}
                        {isEditing ? (
                          <CellEditor
                            value={row[col.id]}
                            column={col}
                            onCommit={(value) => handleCellCommit(row.id, col.id, value)}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          <CellRenderer
                            value={row[col.id]}
                            columnType={col.type}
                            onToggleCheckbox={
                              col.type === "checkbox"
                                ? () => handleToggleCheckbox(row.id, col.id, row[col.id])
                                : undefined
                            }
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Empty space after last column */}
                  <td style={{ borderBottom: "1px solid var(--color-border)" }} />
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {rows.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            style={{ color: "var(--color-textSecondary)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
            <span className="text-sm">No rows yet</span>
          </div>
        )}

        {/* Add row */}
        <button
          onClick={() => onAddRow()}
          className="flex items-center gap-2 px-4 py-3 text-sm w-full transition-colors"
          style={{ color: "var(--color-textSecondary)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-textPrimary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-textSecondary)"}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          New row
        </button>
      </div>
    </div>
  );
}
