import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type * as Y from "yjs";
import { useDatabase } from "@/hooks/useDatabase";
import { TableView } from "@/components/database/TableView";

const MIN_HEIGHT = 120;

export function InlineDatabaseView({
  node,
  updateAttributes,
  selected,
  editor,
  extension,
}: NodeViewProps) {
  const databaseId = node.attrs.databaseId as string | null;
  const title = (node.attrs.title as string) || "Untitled Database";
  const pageId = (extension.options as any).pageId as string || "unknown";

  // Get ydoc from the Collaboration extension
  const ydoc = useMemo(() => {
    const collab = editor.extensionManager.extensions.find(
      (e) => e.name === "collaboration",
    );
    return (collab?.options as any)?.document as Y.Doc | null ?? null;
  }, [editor]);

  // Auto-assign databaseId on first render
  useEffect(() => {
    if (!databaseId) {
      updateAttributes({ databaseId: crypto.randomUUID() });
    }
  }, [databaseId, updateAttributes]);

  const {
    columns,
    visibleColumns,
    rows,
    viewConfig,
    addColumn,
    updateColumn,
    deleteColumn,
    addRow,
    updateCell,
    deleteRow,
    updateViewConfig,
  } = useDatabase(ydoc, pageId, databaseId ?? undefined);

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  const handleTitleCommit = useCallback(() => {
    const trimmed = titleDraft.trim() || "Untitled Database";
    updateAttributes({ title: trimmed });
    setEditingTitle(false);
  }, [titleDraft, updateAttributes]);

  // --- Height resize ---
  const [height, setHeight] = useState<number | null>(node.attrs.height as number | null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sync height from collaborative edits
  useEffect(() => {
    if (!resizingRef.current) {
      setHeight(node.attrs.height as number | null);
    }
  }, [node.attrs.height]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current =
        height ?? tableContainerRef.current?.offsetHeight ?? 300;

      function onMouseMove(ev: MouseEvent) {
        const delta = ev.clientY - startYRef.current;
        const newHeight = Math.max(MIN_HEIGHT, startHeightRef.current + delta);
        setHeight(newHeight);
      }

      function onMouseUp(ev: MouseEvent) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        resizingRef.current = false;

        const delta = ev.clientY - startYRef.current;
        const finalHeight = Math.max(MIN_HEIGHT, startHeightRef.current + delta);
        setHeight(finalHeight);
        updateAttributes({ height: Math.round(finalHeight) });
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height, updateAttributes],
  );

  const handleResetHeight = useCallback(() => {
    setHeight(null);
    updateAttributes({ height: null });
  }, [updateAttributes]);

  // Don't render until we have a databaseId
  if (!databaseId) {
    return (
      <NodeViewWrapper className="inline-database-block">
        <div contentEditable={false} style={{ padding: "1rem", color: "var(--color-textSecondary)" }}>
          Initializing database...
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={`inline-database-block${selected ? " ProseMirror-selectednode" : ""}`}
      data-drag-handle=""
    >
      <div contentEditable={false}>
        {/* Header with editable title */}
        <div className="inline-db-header flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--color-textSecondary)", flexShrink: 0 }}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleCommit();
                if (e.key === "Escape") {
                  setTitleDraft(title);
                  setEditingTitle(false);
                }
                e.stopPropagation();
              }}
              onBlur={handleTitleCommit}
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm font-medium"
              style={{ color: "var(--color-textPrimary)" }}
            />
          ) : (
            <button
              onClick={() => {
                setTitleDraft(title);
                setEditingTitle(true);
              }}
              className="text-sm font-medium hover:opacity-80 text-left flex-1 truncate"
              style={{ color: "var(--color-textPrimary)" }}
            >
              {title}
            </button>
          )}
          <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Scrollable table container */}
        <div
          ref={tableContainerRef}
          style={height != null ? { height: `${height}px`, overflow: "auto" } : undefined}
        >
          <TableView
            columns={columns}
            visibleColumns={visibleColumns}
            allColumns={columns}
            rows={rows}
            viewConfig={viewConfig}
            onAddColumn={addColumn}
            onUpdateColumn={updateColumn}
            onDeleteColumn={deleteColumn}
            onAddRow={addRow}
            onUpdateCell={updateCell}
            onDeleteRow={deleteRow}
            onUpdateViewConfig={updateViewConfig}
          />
        </div>

        {/* Resize handle */}
        <div
          className="inline-database-resize-handle"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResetHeight}
        >
          <svg width="16" height="6" viewBox="0 0 16 6" fill="currentColor">
            <rect x="0" y="0" width="16" height="2" rx="1" />
            <rect x="0" y="4" width="16" height="2" rx="1" />
          </svg>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
