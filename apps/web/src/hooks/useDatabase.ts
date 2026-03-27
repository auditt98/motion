import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import type { DatabaseColumn, ColumnType, DatabaseViewConfig } from "@motion/shared";

export interface DatabaseRow {
  id: string;
  [columnId: string]: unknown;
}

const DEFAULT_COLUMN_WIDTH = 200;

function generateId() {
  return crypto.randomUUID();
}

function yMapToRow(ymap: Y.Map<unknown>): DatabaseRow {
  const obj: DatabaseRow = { id: ymap.get("id") as string };
  ymap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function readColumns(dbMeta: Y.Map<unknown>): DatabaseColumn[] {
  const raw = dbMeta.get("columns");
  if (Array.isArray(raw)) return raw;
  return [];
}

function getViewConfigKey(pageId: string, databaseId?: string) {
  return `database-view-${pageId}-${databaseId ?? "default"}`;
}

function loadViewConfig(pageId: string, databaseId?: string): DatabaseViewConfig {
  try {
    const stored = localStorage.getItem(getViewConfigKey(pageId, databaseId));
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { sorts: [], filters: [], hiddenColumns: [], columnOrder: [], columnWidths: {} };
}

function saveViewConfig(pageId: string, config: DatabaseViewConfig, databaseId?: string) {
  localStorage.setItem(getViewConfigKey(pageId, databaseId), JSON.stringify(config));
}

function applySort(rows: DatabaseRow[], sorts: DatabaseViewConfig["sorts"]): DatabaseRow[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { columnId, direction } of sorts) {
      const aVal = a[columnId];
      const bVal = b[columnId];
      const mul = direction === "asc" ? 1 : -1;

      if (aVal == null && bVal == null) continue;
      if (aVal == null) return 1 * mul;
      if (bVal == null) return -1 * mul;

      if (typeof aVal === "number" && typeof bVal === "number") {
        if (aVal !== bVal) return (aVal - bVal) * mul;
      } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        if (aVal !== bVal) return (aVal ? 1 : -1) * mul;
      } else {
        const cmp = String(aVal).localeCompare(String(bVal));
        if (cmp !== 0) return cmp * mul;
      }
    }
    return 0;
  });
}

function matchesFilter(
  value: unknown,
  operator: string,
  filterValue: string,
): boolean {
  const strVal = value == null ? "" : String(value);

  switch (operator) {
    case "contains":
      return strVal.toLowerCase().includes(filterValue.toLowerCase());
    case "equals":
      return strVal.toLowerCase() === filterValue.toLowerCase();
    case "not_equals":
      return strVal.toLowerCase() !== filterValue.toLowerCase();
    case "is_empty":
      return strVal === "" || value == null;
    case "is_not_empty":
      return strVal !== "" && value != null;
    case "gt":
      return Number(value) > Number(filterValue);
    case "lt":
      return Number(value) < Number(filterValue);
    case "gte":
      return Number(value) >= Number(filterValue);
    case "lte":
      return Number(value) <= Number(filterValue);
    case "before":
      return strVal < filterValue;
    case "after":
      return strVal > filterValue;
    case "is_checked":
      return value === true;
    case "is_unchecked":
      return value !== true;
    default:
      return true;
  }
}

function applyFilters(
  rows: DatabaseRow[],
  filters: DatabaseViewConfig["filters"],
): DatabaseRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((f) => matchesFilter(row[f.columnId], f.operator, f.value)),
  );
}

export function useDatabase(ydoc: Y.Doc | null, pageId: string, databaseId?: string) {
  const [columns, setColumns] = useState<DatabaseColumn[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [viewConfig, setViewConfig] = useState<DatabaseViewConfig>(() =>
    loadViewConfig(pageId, databaseId),
  );
  const [initialized, setInitialized] = useState(false);

  const metaKey = databaseId ? `db_meta_${databaseId}` : "database_meta";
  const rowsKey = databaseId ? `db_rows_${databaseId}` : "database_rows";
  const dbMeta = useMemo(() => ydoc?.getMap(metaKey) ?? null, [ydoc, metaKey]);
  const dbRows = useMemo(() => ydoc?.getArray(rowsKey) ?? null, [ydoc, rowsKey]);

  // Sync columns from Yjs
  useEffect(() => {
    if (!dbMeta) return;

    const syncColumns = () => setColumns(readColumns(dbMeta));
    syncColumns();

    dbMeta.observe(syncColumns);
    return () => dbMeta.unobserve(syncColumns);
  }, [dbMeta]);

  // Sync rows from Yjs
  useEffect(() => {
    if (!dbRows) return;

    const syncRows = () => {
      const result: DatabaseRow[] = [];
      dbRows.forEach((item) => {
        if (item instanceof Y.Map) {
          result.push(yMapToRow(item));
        }
      });
      setRows(result);
    };
    syncRows();

    dbRows.observeDeep(syncRows);
    return () => dbRows.unobserveDeep(syncRows);
  }, [dbRows]);

  // Initialize empty database with a default column
  useEffect(() => {
    if (!dbMeta || !dbRows || initialized) return;

    const existingCols = readColumns(dbMeta);
    if (existingCols.length === 0 && dbRows.length === 0) {
      dbMeta.set("columns", [
        { id: generateId(), name: "Name", type: "text" as ColumnType, width: DEFAULT_COLUMN_WIDTH },
      ]);
    }
    setInitialized(true);
  }, [dbMeta, dbRows, initialized]);

  // Persist view config to localStorage
  useEffect(() => {
    saveViewConfig(pageId, viewConfig, databaseId);
  }, [pageId, viewConfig, databaseId]);

  // Computed sorted & filtered rows
  const sortedFilteredRows = useMemo(() => {
    const filtered = applyFilters(rows, viewConfig.filters);
    return applySort(filtered, viewConfig.sorts);
  }, [rows, viewConfig.sorts, viewConfig.filters]);

  // Visible columns (respecting hidden + order)
  const visibleColumns = useMemo(() => {
    const hidden = new Set(viewConfig.hiddenColumns);
    let ordered = columns.filter((c) => !hidden.has(c.id));
    if (viewConfig.columnOrder.length > 0) {
      const orderMap = new Map(viewConfig.columnOrder.map((id, i) => [id, i]));
      ordered = ordered.sort((a, b) => {
        const ai = orderMap.get(a.id) ?? Infinity;
        const bi = orderMap.get(b.id) ?? Infinity;
        return ai - bi;
      });
    }
    // Apply stored widths
    return ordered.map((c) => ({
      ...c,
      width: viewConfig.columnWidths[c.id] ?? c.width ?? DEFAULT_COLUMN_WIDTH,
    }));
  }, [columns, viewConfig.hiddenColumns, viewConfig.columnOrder, viewConfig.columnWidths]);

  // --- Mutations ---

  const addColumn = useCallback(
    (name: string, type: ColumnType, options?: string[]) => {
      if (!dbMeta) return;
      const cols = readColumns(dbMeta);
      const newCol: DatabaseColumn = {
        id: generateId(),
        name,
        type,
        width: DEFAULT_COLUMN_WIDTH,
        ...(options ? { options } : {}),
      };
      dbMeta.set("columns", [...cols, newCol]);
    },
    [dbMeta],
  );

  const updateColumn = useCallback(
    (columnId: string, updates: Partial<Pick<DatabaseColumn, "name" | "type" | "width" | "options">>) => {
      if (!dbMeta) return;
      const cols = readColumns(dbMeta);
      dbMeta.set(
        "columns",
        cols.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
      );
    },
    [dbMeta],
  );

  const deleteColumn = useCallback(
    (columnId: string) => {
      if (!dbMeta || !dbRows) return;
      const cols = readColumns(dbMeta);
      dbMeta.set("columns", cols.filter((c) => c.id !== columnId));

      // Remove data from all rows
      ydoc?.transact(() => {
        dbRows.forEach((item) => {
          if (item instanceof Y.Map) {
            item.delete(columnId);
          }
        });
      });
    },
    [dbMeta, dbRows, ydoc],
  );

  const addRow = useCallback(
    (values?: Record<string, unknown>) => {
      if (!dbRows || !ydoc) return null;
      const rowMap = new Y.Map<unknown>();
      const rowId = generateId();

      ydoc.transact(() => {
        rowMap.set("id", rowId);
        if (values) {
          for (const [key, val] of Object.entries(values)) {
            rowMap.set(key, val);
          }
        }
        dbRows.push([rowMap]);
      });

      return rowId;
    },
    [dbRows, ydoc],
  );

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      if (!dbRows) return;
      for (let i = 0; i < dbRows.length; i++) {
        const item = dbRows.get(i);
        if (item instanceof Y.Map && item.get("id") === rowId) {
          item.set(columnId, value);
          return;
        }
      }
    },
    [dbRows],
  );

  const deleteRow = useCallback(
    (rowId: string) => {
      if (!dbRows) return;
      for (let i = 0; i < dbRows.length; i++) {
        const item = dbRows.get(i);
        if (item instanceof Y.Map && item.get("id") === rowId) {
          dbRows.delete(i, 1);
          return;
        }
      }
    },
    [dbRows],
  );

  const updateViewConfig = useCallback(
    (updates: Partial<DatabaseViewConfig>) => {
      setViewConfig((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  return {
    columns,
    visibleColumns,
    rows: sortedFilteredRows,
    allRows: rows,
    viewConfig,
    addColumn,
    updateColumn,
    deleteColumn,
    addRow,
    updateCell,
    deleteRow,
    updateViewConfig,
  };
}
