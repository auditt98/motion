import { useState, useRef, useEffect } from "react";
import type { DatabaseColumn, DatabaseViewConfig, ColumnType } from "@motion/shared";
import { Badge, Button } from "@weave-design-system/react";

interface FilterBarProps {
  columns: DatabaseColumn[];
  filters: DatabaseViewConfig["filters"];
  onUpdateFilters: (filters: DatabaseViewConfig["filters"]) => void;
}

const OPERATORS_BY_TYPE: Record<ColumnType, Array<{ value: string; label: string }>> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "not_equals", label: "\u2260" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "gte", label: "\u2265" },
    { value: "lte", label: "\u2264" },
  ],
  select: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "is_empty", label: "is empty" },
  ],
  multi_select: [
    { value: "contains", label: "contains" },
    { value: "is_empty", label: "is empty" },
  ],
  date: [
    { value: "equals", label: "is" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "is_empty", label: "is empty" },
  ],
  checkbox: [
    { value: "is_checked", label: "is checked" },
    { value: "is_unchecked", label: "is unchecked" },
  ],
  person: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "is_empty", label: "is empty" },
  ],
  url: [
    { value: "contains", label: "contains" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
};

const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty", "is_checked", "is_unchecked"]);

export function FilterBar({ columns, filters, onUpdateFilters }: FilterBarProps) {
  const [addingFilter, setAddingFilter] = useState(false);

  if (filters.length === 0 && !addingFilter) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-wrap"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      {filters.map((filter, index) => {
        const col = columns.find((c) => c.id === filter.columnId);
        if (!col) return null;
        return (
          <Badge key={index}>
            <span className="flex items-center gap-1 text-xs">
              {col.name} {filter.operator} {!NO_VALUE_OPERATORS.has(filter.operator) && `"${filter.value}"`}
              <button
                onClick={() => {
                  const next = filters.filter((_, i) => i !== index);
                  onUpdateFilters(next);
                }}
                className="ml-1 opacity-60 hover:opacity-100"
              >
                x
              </button>
            </span>
          </Badge>
        );
      })}

      {addingFilter ? (
        <AddFilterForm
          columns={columns}
          onAdd={(filter) => {
            onUpdateFilters([...filters, filter]);
            setAddingFilter(false);
          }}
          onCancel={() => setAddingFilter(false)}
        />
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setAddingFilter(true)}>
          + Add filter
        </Button>
      )}
    </div>
  );
}

function AddFilterForm({
  columns,
  onAdd,
  onCancel,
}: {
  columns: DatabaseColumn[];
  onAdd: (filter: { columnId: string; operator: string; value: string }) => void;
  onCancel: () => void;
}) {
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [operator, setOperator] = useState("");
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const selectedCol = columns.find((c) => c.id === columnId);
  const operators = selectedCol ? OPERATORS_BY_TYPE[selectedCol.type] || [] : [];

  useEffect(() => {
    if (operators.length > 0 && !operator) {
      setOperator(operators[0].value);
    }
  }, [columnId, operators, operator]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  const needsValue = !NO_VALUE_OPERATORS.has(operator);

  return (
    <div ref={formRef} className="flex items-center gap-1.5">
      <select
        value={columnId}
        onChange={(e) => {
          setColumnId(e.target.value);
          setOperator("");
          setValue("");
        }}
        className="text-xs px-2 py-1 rounded bg-transparent outline-none"
        style={{
          color: "var(--color-textPrimary)",
          border: "1px solid var(--color-border)",
        }}
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={operator}
        onChange={(e) => setOperator(e.target.value)}
        className="text-xs px-2 py-1 rounded bg-transparent outline-none"
        style={{
          color: "var(--color-textPrimary)",
          border: "1px solid var(--color-border)",
        }}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {needsValue && (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd({ columnId, operator, value });
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Value..."
          className="text-xs px-2 py-1 rounded bg-transparent outline-none w-24"
          style={{
            color: "var(--color-textPrimary)",
            border: "1px solid var(--color-border)",
          }}
          autoFocus
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAdd({ columnId, operator, value })}
      >
        Apply
      </Button>
    </div>
  );
}
