import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import type { Editor as TipTapEditor } from "@tiptap/react";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import type { PageVersion } from "@motion/shared";
import { useAuth } from "@/hooks/useAuth";
import { useYjsProvider } from "@/hooks/useYjsProvider";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { usePageActivity } from "@/hooks/usePageActivity";
import { useComments } from "@/hooks/useComments";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useVersionHistory } from "@/hooks/useVersionHistory";
import { usePresence } from "@/hooks/usePresence";
import { useFollowing } from "@/hooks/useFollowing";
import { Editor } from "./Editor";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { FollowBanner } from "./FollowBanner";
import { PresenceBar } from "../workspace/PresenceBar";
import { ShareButton } from "../workspace/ShareButton";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { CommentBubbleMenu } from "./CommentBubbleMenu";
import { CommentSidebar, type PendingComment } from "./CommentSidebar";
import { Button, Tooltip, useToast } from "@weave-design-system/react";
import { ExportMenu } from "./ExportMenu";
import { VersionHistory } from "./VersionHistory";
import { VersionPreview } from "./VersionPreview";
import { SuggestionPopover } from "./SuggestionPopover";
import {
  findAllSuggestions,
  acceptAllSuggestions,
  rejectAllSuggestions,
} from "./SuggestionModePlugin";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";

type ActiveThreadId = string | null;

function TopBarDivider() {
  return (
    <div
      className="w-px h-5 mx-1.5"
      style={{ background: "var(--color-border)" }}
    />
  );
}

function TopBarToggleButton({
  active,
  onClick,
  tooltip,
  icon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  icon: React.ReactNode;
  count?: number;
}) {
  return (
    <Tooltip content={tooltip}>
      <div className="relative">
        <Button
          variant={active ? "primary" : "ghost"}
          size="sm"
          onClick={onClick}
          aria-label={tooltip}
          style={{ minWidth: "28px", padding: "4px 8px" }}
        >
          {icon}
        </Button>
        {count != null && count > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center pointer-events-none"
            style={{
              minWidth: "16px",
              height: "16px",
              borderRadius: "8px",
              background: "var(--color-rust)",
              color: "var(--color-white, #fff)",
              fontSize: "10px",
              fontWeight: 600,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

export function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { user } = useAuth();
  const { workspaceId } = useWorkspaceContext();
  const { recordVisit } = usePageActivity(workspaceId, user?.id ?? null);

  useEffect(() => {
    if (pageId) {
      recordVisit(pageId);
    }
  }, [pageId, recordVisit]);

  if (!pageId) {
    return <div className="p-8 text-gray-400">No page selected</div>;
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Anonymous";

  return (
    <EditorPageInner
      key={pageId}
      documentId={pageId}
      userName={userName}
      userId={user?.id ?? ""}
      workspaceId={workspaceId}
    />
  );
}

/** Convert a Yjs snapshot (Uint8Array) to ProseMirror-compatible JSON */
function snapshotToJSON(snapshot: Uint8Array): Record<string, unknown> {
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, snapshot);

  // yDocToProsemirrorJSON reads the "default" XML fragment that TipTap uses
  const json = yDocToProsemirrorJSON(tempDoc, "default");
  tempDoc.destroy();

  return json as Record<string, unknown>;
}

/** Inner component so hooks aren't called conditionally */
function EditorPageInner({
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
  const { ydoc, provider, idbSynced } = useYjsProvider(
    documentId,
    userName,
  );
  const syncStatus = useSyncStatus(ydoc);
  const peers = usePresence(provider);

  const [showComments, setShowComments] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [editorInstance, setEditorInstance] = useState<TipTapEditor | null>(null);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [focusThreadId, setFocusThreadId] = useState<ActiveThreadId>(null);

  // Keyboard shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Suggestion mode state — defaults to OFF for human users (Direct mode)
  const [suggestionMode, setSuggestionMode] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);

  // Version history state
  const [selectedVersion, setSelectedVersion] = useState<PageVersion | null>(null);
  const [previewContent, setPreviewContent] = useState<Record<string, unknown> | null>(null);

  const { toast } = useToast();

  // Cmd+/ keyboard shortcut for shortcuts overlay
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Onboarding toast — show once on first visit
  useEffect(() => {
    const key = "motion-shortcuts-hint-shown";
    if (localStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      toast({
        title: "Tip: Press / for commands, ⌘/ for all shortcuts",
        variant: "info",
        duration: 6000,
      });
      localStorage.setItem(key, "1");
    }, 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const {
    threads,
    createThread,
    addReply,
    resolveThread,
    reopenThread,
    deleteComment,
  } = useComments(documentId, workspaceId);

  const {
    versions,
    saveVersion,
    getSnapshot,
    labelVersion,
  } = useVersionHistory(documentId, workspaceId);

  const { members } = useWorkspaceMembers(workspaceId);
  const { upload: uploadImage } = useImageUpload(workspaceId, documentId);

  const { followingPeer, followPeer, goToPeer, stopFollowing } = useFollowing({
    provider,
    editor: editorInstance,
    peers,
  });

  const handleEditorReady = useCallback((editor: TipTapEditor) => {
    setEditorInstance(editor);
  }, []);

  const handleCommentHighlightClick = useCallback((threadId: string) => {
    setShowComments(true);
    setFocusThreadId(threadId);
  }, []);

  const handleBubbleComment = useCallback(
    (selection: { from: number; to: number; text: string }) => {
      setPendingComment(selection);
      setShowComments(true);
    },
    [],
  );

  const handleCreateThread = useCallback(
    async (body: string, mentions: string[]) => {
      if (!userId) return null;
      return createThread(userId, body, mentions);
    },
    [userId, createThread],
  );

  const handleReply = useCallback(
    (threadId: string, body: string, mentions: string[]) => {
      if (!userId) return;
      addReply(threadId, userId, body, mentions);
    },
    [userId, addReply],
  );

  const handleResolve = useCallback(
    (threadId: string) => {
      if (!userId) return;
      resolveThread(threadId, userId);
    },
    [userId, resolveThread],
  );

  // Version history handlers
  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((v) => {
      if (!v) setShowComments(false); // close comments when opening versions
      return !v;
    });
    // Close preview when closing the panel
    if (showVersionHistory) {
      setSelectedVersion(null);
      setPreviewContent(null);
    }
  }, [showVersionHistory]);

  const handleSelectVersion = useCallback(
    async (version: PageVersion) => {
      if (selectedVersion?.id === version.id) {
        // Deselect
        setSelectedVersion(null);
        setPreviewContent(null);
        return;
      }
      setSelectedVersion(version);
      const snapshot = await getSnapshot(version.id);
      if (snapshot) {
        const json = snapshotToJSON(snapshot);
        setPreviewContent(json);
      }
    },
    [selectedVersion, getSnapshot],
  );

  const handleRestoreVersion = useCallback(
    async (version: PageVersion) => {
      if (!editorInstance) return;

      // First: save a pre-restore snapshot
      await saveVersion({
        label: "Before restore",
        userId,
        userName,
      });

      // Get the snapshot and restore
      const snapshot = await getSnapshot(version.id);
      if (!snapshot) return;

      const json = snapshotToJSON(snapshot);
      editorInstance.commands.setContent(json);

      // Close preview
      setSelectedVersion(null);
      setPreviewContent(null);
    },
    [editorInstance, saveVersion, getSnapshot, userId, userName],
  );

  const handleSaveVersion = useCallback(
    (label?: string) => {
      saveVersion({ label, userId, userName });
    },
    [saveVersion, userId, userName],
  );

  const handleClosePreview = useCallback(() => {
    setSelectedVersion(null);
    setPreviewContent(null);
  }, []);

  // --- Suggestion mode handlers ---

  const handleToggleSuggestionMode = useCallback(() => {
    if (!editorInstance) return;
    const newMode = !suggestionMode;
    setSuggestionMode(newMode);
    (editorInstance.commands as any).setSuggestionMode(newMode);
  }, [editorInstance, suggestionMode]);

  const handleAcceptAll = useCallback(() => {
    if (!editorInstance?.view) return;
    acceptAllSuggestions(editorInstance.view);
  }, [editorInstance]);

  const handleRejectAll = useCallback(() => {
    if (!editorInstance?.view) return;
    rejectAllSuggestions(editorInstance.view);
  }, [editorInstance]);

  // Keep suggestion count in sync with editor state
  useEffect(() => {
    if (!editorInstance) return;
    const updateCount = () => {
      const suggestions = findAllSuggestions(editorInstance.view);
      const uniqueIds = new Set(suggestions.map((s) => s.suggestionId));
      setSuggestionCount(uniqueIds.size);
    };
    updateCount();
    editorInstance.on("transaction", updateCount);
    return () => {
      editorInstance.off("transaction", updateCount);
    };
  }, [editorInstance]);

  const unresolvedCount = threads.filter((t) => !t.is_resolved).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {/* Left: sync status */}
        <SyncStatusIndicator status={syncStatus} />
        <div className="flex-1" />

        {/* Group A: Presence */}
        <PresenceBar
          peers={peers}
          followingClientId={followingPeer?.clientId ?? null}
          onFollowPeer={followPeer}
          onGoToPeer={goToPeer}
        />

        <TopBarDivider />

        {/* Group B: Panel toggles */}
        <div className="flex items-center gap-1">
          {suggestionCount > 0 && (
            <TopBarToggleButton
              active={false}
              onClick={() => {
                /* scroll to first suggestion — future enhancement */
              }}
              tooltip={`${suggestionCount} pending suggestion${suggestionCount === 1 ? "" : "s"}`}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L10 5.5H14.5L11 8.5L12.5 13L8 10L3.5 13L5 8.5L1.5 5.5H6L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              count={suggestionCount}
            />
          )}

          <TopBarToggleButton
            active={showComments}
            onClick={() => {
              setShowComments((v) => {
                if (!v) setShowVersionHistory(false);
                return !v;
              });
            }}
            tooltip="Comments"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2.5C2 2.22386 2.22386 2 2.5 2H13.5C13.7761 2 14 2.22386 14 2.5V10.5C14 10.7761 13.7761 11 13.5 11H9.70711L6.85355 13.8536C6.53857 14.1685 6 13.9464 6 13.5V11H2.5C2.22386 11 2 10.7761 2 10.5V2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            count={unresolvedCount > 0 ? unresolvedCount : undefined}
          />

          <TopBarToggleButton
            active={showVersionHistory}
            onClick={handleToggleVersionHistory}
            tooltip="Version history"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3.5V8L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            }
            count={versions.length > 0 ? versions.length : undefined}
          />
        </div>

        <TopBarDivider />

        {/* Group C: Actions */}
        <div className="flex items-center gap-1">
          {editorInstance && <ExportMenu editor={editorInstance} />}
          <ShareButton pageId={documentId} />
        </div>
      </div>

      {followingPeer && (
        <FollowBanner peer={followingPeer} onStop={stopFollowing} />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Main editor pane */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-12">
            {idbSynced ? (
              <>
                <Editor
                  ydoc={ydoc}
                  provider={provider}
                  userName={userName}
                  userId={userId}
                  onEditorReady={handleEditorReady}
                  onCommentClick={handleCommentHighlightClick}
                  onImageUpload={uploadImage}
                  suggestionMode={suggestionMode}
                  onToggleSuggestionMode={handleToggleSuggestionMode}
                  suggestionCount={suggestionCount}
                  onAcceptAll={handleAcceptAll}
                  onRejectAll={handleRejectAll}
                />
                {editorInstance && (
                  <>
                    <CommentBubbleMenu
                      editor={editorInstance}
                      onCommentClick={handleBubbleComment}
                    />
                    <SuggestionPopover editor={editorInstance} currentUserId={userId} />
                  </>
                )}
              </>
            ) : (
              <div className="animate-pulse h-32 bg-gray-50 rounded" />
            )}
          </div>
        </div>

        {/* Side-by-side version preview — replaces sidebar when active */}
        {previewContent && selectedVersion && (
          <div className="version-preview-pane">
            <VersionPreview
              content={previewContent}
              currentDoc={editorInstance?.getJSON() as Record<string, unknown> ?? { type: "doc", content: [] }}
              version={selectedVersion}
              onRestore={() => handleRestoreVersion(selectedVersion)}
              onClose={handleClosePreview}
            />
          </div>
        )}

        {/* Comment sidebar */}
        <div className={`comment-sidebar-wrapper ${showComments ? "open" : ""}`}>
          <CommentSidebar
            editor={editorInstance}
            threads={threads}
            currentUserId={userId}
            members={members}
            pendingComment={pendingComment}
            focusThreadId={focusThreadId}
            onCreateThread={handleCreateThread}
            onReply={handleReply}
            onResolve={handleResolve}
            onReopen={reopenThread}
            onDelete={deleteComment}
            onClose={() => setShowComments(false)}
            onClearPending={() => setPendingComment(null)}
            onClearFocus={() => setFocusThreadId(null)}
          />
        </div>

        {/* Version history sidebar — hidden when previewing a version */}
        {!previewContent && (
          <div className={`version-sidebar-wrapper ${showVersionHistory ? "open" : ""}`}>
            <VersionHistory
              versions={versions}
              selectedVersionId={selectedVersion?.id ?? null}
              onSelectVersion={handleSelectVersion}
              onRestoreVersion={handleRestoreVersion}
              onLabelVersion={labelVersion}
              onSaveVersion={() => handleSaveVersion()}
              onClose={() => {
                setShowVersionHistory(false);
                setSelectedVersion(null);
                setPreviewContent(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
