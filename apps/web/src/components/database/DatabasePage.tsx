import { useEffect, useCallback, useState } from "react";
import { useParams } from "react-router";
import * as Y from "yjs";
import type { PageVersion } from "@motion/shared";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useYjsProvider } from "@/hooks/useYjsProvider";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { usePageActivity } from "@/hooks/usePageActivity";
import { useDatabase } from "@/hooks/useDatabase";
import { useVersionHistory } from "@/hooks/useVersionHistory";
import { usePresence } from "@/hooks/usePresence";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useDatabaseCursors } from "@/hooks/useDatabaseCursors";
import { SyncStatusIndicator } from "../editor/SyncStatusIndicator";
import { PresenceBar } from "../workspace/PresenceBar";
import { ShareButton } from "../workspace/ShareButton";
import { VersionHistory } from "../editor/VersionHistory";
import { TableView } from "./TableView";
import { Button, Tooltip, useToast } from "@weave-design-system/react";

export function DatabasePage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { user } = useAuth();
  const { workspaceId } = useWorkspaceContext();
  const { recordVisit } = usePageActivity(workspaceId, user?.id ?? null);
  const { resolvedDisplayName: userName } = useUserProfile(user?.id, user?.email);

  useEffect(() => {
    if (pageId) {
      recordVisit(pageId);
    }
  }, [pageId, recordVisit]);

  if (!pageId) {
    return <div className="p-8" style={{ color: "var(--color-textSecondary)" }}>No page selected</div>;
  }

  return (
    <DatabasePageInner
      key={pageId}
      documentId={pageId}
      userName={userName}
      userId={user?.id ?? ""}
      workspaceId={workspaceId}
    />
  );
}

function TopBarDivider() {
  return (
    <div
      className="w-px h-5 mx-1.5"
      style={{ background: "var(--color-border)" }}
    />
  );
}

/** Convert a Yjs snapshot to database meta + rows for preview */
function snapshotToDatabase(snapshot: Uint8Array): { columns: any[]; rows: any[] } {
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, snapshot);

  const meta = tempDoc.getMap("database_meta");
  const rowsArray = tempDoc.getArray("database_rows");

  const columns = (meta.get("columns") as any[]) || [];
  const rows: any[] = [];
  rowsArray.forEach((item) => {
    if (item instanceof Y.Map) {
      const obj: Record<string, unknown> = {};
      item.forEach((v, k) => { obj[k] = v; });
      rows.push(obj);
    }
  });

  tempDoc.destroy();
  return { columns, rows };
}

function DatabasePageInner({
  documentId,
  userName,
  userId,
  workspaceId,
}: {
  documentId: string;
  userName: string;
  userId: string;
  workspaceId: string | null;
}) {
  const { ydoc, provider, idbSynced } = useYjsProvider(documentId, userName);
  const syncStatus = useSyncStatus(ydoc);
  const peers = usePresence(provider);
  const { cursors: dbCursors, setLocalCursor: setLocalDbCursor } = useDatabaseCursors(provider);

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
  } = useDatabase(ydoc, documentId);

  const {
    versions,
    saveVersion,
    getSnapshot,
    labelVersion,
  } = useVersionHistory(documentId, workspaceId);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(viewConfig.filters.length > 0);
  const { toast } = useToast();

  // Version history handlers
  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((v) => !v);
  }, []);

  const handleSaveVersion = useCallback(
    (label?: string) => {
      saveVersion({ label, userId, userName });
    },
    [saveVersion, userId, userName],
  );

  const handleRestoreVersion = useCallback(
    async (version: PageVersion) => {
      // Save pre-restore snapshot
      await saveVersion({
        label: "Before restore",
        userId,
        userName,
      });

      const snapshot = await getSnapshot(version.id);
      if (!snapshot) return;

      // Restore by applying the snapshot to the current doc
      Y.applyUpdate(ydoc, snapshot);
      toast({ title: "Version restored", variant: "info", duration: 3000 });
    },
    [saveVersion, getSnapshot, ydoc, userId, userName, toast],
  );

  const handleToggleFilter = useCallback(() => {
    setShowFilterBar((v) => {
      if (v) {
        // Clear filters when hiding
        updateViewConfig({ filters: [] });
      }
      return !v;
    });
  }, [updateViewConfig]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme">
      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <SyncStatusIndicator status={syncStatus} />
        <div className="flex-1" />

        <PresenceBar peers={peers} followingClientId={null} onFollowPeer={() => {}} onGoToPeer={() => {}} />
        <TopBarDivider />

        <div className="flex items-center gap-1">
          {/* Filter toggle */}
          <Tooltip content="Filter">
            <Button
              variant={showFilterBar ? "primary" : "ghost"}
              size="sm"
              onClick={handleToggleFilter}
              aria-label="Filter"
              style={{ minWidth: "28px", padding: "4px 8px" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 3h12L9 8.5V12l-2 1V8.5L2 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </Tooltip>

          {/* Version history toggle */}
          <Tooltip content="Version history">
            <Button
              variant={showVersionHistory ? "primary" : "ghost"}
              size="sm"
              onClick={handleToggleVersionHistory}
              aria-label="Version history"
              style={{ minWidth: "28px", padding: "4px 8px" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3.5V8L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </Button>
          </Tooltip>
        </div>

        <TopBarDivider />

        <div className="flex items-center gap-1">
          <ShareButton pageId={documentId} />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {idbSynced ? (
            <>
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
                cellCursors={dbCursors}
                onCellFocus={setLocalDbCursor}
              />

              {/* Footer status bar */}
              <div
                className="flex items-center px-4 py-1.5 text-xs shrink-0"
                style={{
                  borderTop: "1px solid var(--color-border)",
                  color: "var(--color-textSecondary)",
                }}
              >
                {rows.length} row{rows.length !== 1 ? "s" : ""}
                {visibleColumns.length < columns.length && (
                  <span className="ml-2">
                    · {columns.length - visibleColumns.length} column{columns.length - visibleColumns.length !== 1 ? "s" : ""} hidden
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-textSecondary)" }}>
              Loading database...
            </div>
          )}
        </div>

        {/* Version history panel */}
        <div
          className="overflow-y-auto shrink-0"
          style={{
            width: showVersionHistory ? "288px" : "0px",
            transition: "width 0.25s ease",
            overflow: "hidden",
            borderLeft: showVersionHistory ? "1px solid var(--color-border)" : "none",
            background: "var(--color-surface)",
          }}
        >
          <VersionHistory
            versions={versions}
            selectedVersionId={null}
            onSelectVersion={() => {}}
            onRestoreVersion={handleRestoreVersion}
            onSaveVersion={handleSaveVersion}
            onLabelVersion={labelVersion}
            onClose={handleToggleVersionHistory}
          />
        </div>
      </div>
    </div>
  );
}
