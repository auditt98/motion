import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode, Mark } from "@tiptap/pm/model";
import type { CommentThreadWithComments } from "@motion/shared";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { CommentThread } from "./CommentThread";
import { CommentComposer } from "./CommentComposer";

export interface PendingComment {
  from: number;
  to: number;
  text: string;
}

interface CommentSidebarProps {
  editor: Editor | null;
  threads: CommentThreadWithComments[];
  currentUserId: string;
  members: MemberWithUser[];
  pendingComment: PendingComment | null;
  focusThreadId: string | null;
  onCreateThread: (body: string, mentions: string[]) => Promise<string | null>;
  onReply: (threadId: string, body: string, mentions: string[]) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDelete: (commentId: string) => void;
  onClose: () => void;
  onClearPending: () => void;
  onClearFocus: () => void;
}

/** Extract the text content covered by a comment mark with a given thread ID */
function getHighlightedText(
  editor: Editor | null,
  threadId: string,
): string {
  if (!editor) return "";
  const texts: string[] = [];
  editor.state.doc.descendants((node: PMNode, _pos: number) => {
    if (node.isText) {
      const hasMark = node.marks.some(
        (m: Mark) =>
          m.type.name === "comment" &&
          m.attrs.commentThreadId === threadId,
      );
      if (hasMark) {
        texts.push(node.text || "");
      }
    }
  });
  const joined = texts.join("");
  if (joined.length > 80) return joined.slice(0, 77) + "...";
  return joined;
}

/** Find the document position of the first occurrence of a comment mark */
function findCommentPosition(
  editor: Editor | null,
  threadId: string,
): number | null {
  if (!editor) return null;
  let foundPos: number | null = null;
  editor.state.doc.descendants((node: PMNode, pos: number) => {
    if (foundPos !== null) return false;
    if (node.isText) {
      const hasMark = node.marks.some(
        (m: Mark) =>
          m.type.name === "comment" &&
          m.attrs.commentThreadId === threadId,
      );
      if (hasMark) {
        foundPos = pos;
        return false;
      }
    }
  });
  return foundPos;
}

export function CommentSidebar({
  editor,
  threads,
  currentUserId,
  members,
  pendingComment,
  focusThreadId,
  onCreateThread,
  onReply,
  onResolve,
  onReopen,
  onDelete,
  onClose,
  onClearPending,
  onClearFocus,
}: CommentSidebarProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const threadRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll to new comment composer when a pending comment arrives
  useEffect(() => {
    if (pendingComment && composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [pendingComment]);

  // When a highlight is clicked in the editor, scroll to and focus that thread
  useEffect(() => {
    if (!focusThreadId) return;
    setActiveThreadId(focusThreadId);

    // If the thread is resolved and we're hiding resolved, show them
    const thread = threads.find((t) => t.id === focusThreadId);
    if (thread?.is_resolved && !showResolved) {
      setShowResolved(true);
    }

    // Scroll to the thread card
    setTimeout(() => {
      const el = threadRefs.current.get(focusThreadId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);

    onClearFocus();
  }, [focusThreadId, threads, showResolved, onClearFocus]);

  const filteredThreads = useMemo(
    () =>
      showResolved
        ? threads
        : threads.filter((t) => !t.is_resolved),
    [threads, showResolved],
  );

  const unresolvedCount = threads.filter((t) => !t.is_resolved).length;

  const handleThreadClick = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      const pos = findCommentPosition(editor, threadId);
      if (pos !== null && editor) {
        editor.commands.setTextSelection(pos);
        editor.commands.scrollIntoView();
      }
    },
    [editor],
  );

  const handleNewCommentSubmit = useCallback(
    async (body: string, mentions: string[]) => {
      if (!pendingComment || !editor) return;

      const threadId = await onCreateThread(body, mentions);
      if (!threadId) return;

      // Apply comment mark to the selected text
      const { from, to } = pendingComment;
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setMark("comment", { commentThreadId: threadId })
        .run();

      onClearPending();
    },
    [editor, pendingComment, onCreateThread, onClearPending],
  );

  return (
    <div className="comment-sidebar">
      <div className="comment-sidebar-header">
        <div className="comment-sidebar-title">
          <span>Comments</span>
          {unresolvedCount > 0 && (
            <span className="comment-sidebar-badge">{unresolvedCount}</span>
          )}
        </div>
        <div className="comment-sidebar-actions">
          <button
            className={`comment-sidebar-filter ${showResolved ? "active" : ""}`}
            onClick={() => setShowResolved((v) => !v)}
            title={showResolved ? "Hide resolved" : "Show resolved"}
            type="button"
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
          <button
            className="comment-sidebar-close"
            onClick={onClose}
            title="Close comments"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="comment-sidebar-list">
        {/* New comment composer (triggered from bubble menu) */}
        {pendingComment && (
          <div ref={composerRef} className="comment-thread-card active">
            <div className="comment-thread-quote">
              {pendingComment.text.length > 80
                ? pendingComment.text.slice(0, 77) + "..."
                : pendingComment.text}
            </div>
            <CommentComposer
              members={members}
              onSubmit={handleNewCommentSubmit}
              onCancel={onClearPending}
              placeholder="Add a comment..."
            />
          </div>
        )}

        {filteredThreads.length === 0 && !pendingComment ? (
          <div className="comment-sidebar-empty">
            {showResolved
              ? "No comments yet"
              : "No open comments"}
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <div
              key={thread.id}
              ref={(el) => {
                if (el) threadRefs.current.set(thread.id, el);
                else threadRefs.current.delete(thread.id);
              }}
            >
            <CommentThread
              thread={thread}
              highlightedText={getHighlightedText(editor, thread.id)}
              isActive={activeThreadId === thread.id}
              currentUserId={currentUserId}
              members={members}
              onReply={onReply}
              onResolve={onResolve}
              onReopen={onReopen}
              onDelete={onDelete}
              onClick={() => handleThreadClick(thread.id)}
            />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
