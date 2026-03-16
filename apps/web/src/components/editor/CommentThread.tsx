import { useState } from "react";
import type { CommentThreadWithComments, CommentWithAuthor } from "@motion/shared";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { CommentComposer } from "./CommentComposer";

interface CommentThreadProps {
  thread: CommentThreadWithComments;
  highlightedText: string;
  isActive: boolean;
  currentUserId: string;
  members: MemberWithUser[];
  onReply: (threadId: string, body: string, mentions: string[]) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDelete: (commentId: string) => void;
  onClick: () => void;
}

function renderCommentBody(body: string): React.ReactNode[] {
  const parts = body.split(/(@\[.+?\]\(.+?\))/g);
  return parts.map((part, i) => {
    const match = part.match(/@\[(.+?)\]\((.+?)\)/);
    if (match) {
      return (
        <span key={i} className="mention-tag">
          @{match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: CommentWithAuthor;
  currentUserId: string;
  onDelete: (id: string) => void;
}) {
  const author = comment.author;
  const displayName =
    author.display_name || author.email.split("@")[0];

  return (
    <div className="comment-item">
      <div className="comment-item-header">
        <div className="comment-item-avatar">
          {author.avatar_url ? (
            <img src={author.avatar_url} alt="" className="comment-avatar-img" />
          ) : (
            <span className="comment-avatar-fallback">
              {displayName[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <span className="comment-item-name">{displayName}</span>
        <span className="comment-item-time">{timeAgo(comment.created_at)}</span>
        {comment.author_id === currentUserId && (
          <button
            className="comment-item-delete"
            onClick={() => onDelete(comment.id)}
            title="Delete comment"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        )}
      </div>
      <div className="comment-item-body">{renderCommentBody(comment.body)}</div>
    </div>
  );
}

export function CommentThread({
  thread,
  highlightedText,
  isActive,
  currentUserId,
  members,
  onReply,
  onResolve,
  onReopen,
  onDelete,
  onClick,
}: CommentThreadProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const rootComment = thread.comments[0];
  const replies = thread.comments.slice(1);
  const hasReplies = replies.length > 0;

  if (!rootComment) return null;

  const showReplies = expanded || isActive;

  return (
    <div
      className={`comment-thread-card ${isActive ? "active" : ""} ${thread.is_resolved ? "resolved" : ""}`}
      onClick={onClick}
    >
      {/* Highlighted text quote */}
      {highlightedText && (
        <div className="comment-thread-quote">{highlightedText}</div>
      )}

      {/* Root comment */}
      <CommentItem
        comment={rootComment}
        currentUserId={currentUserId}
        onDelete={onDelete}
      />

      {/* Replies */}
      {hasReplies && !showReplies && (
        <button
          className="comment-thread-expand"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          type="button"
        >
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </button>
      )}

      {showReplies &&
        replies.map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            currentUserId={currentUserId}
            onDelete={onDelete}
          />
        ))}

      {/* Reply composer */}
      {showReplyComposer ? (
        <div className="comment-thread-reply-composer">
          <CommentComposer
            members={members}
            onSubmit={(body, mentions) => {
              onReply(thread.id, body, mentions);
              setShowReplyComposer(false);
            }}
            onCancel={() => setShowReplyComposer(false)}
            placeholder="Reply..."
          />
        </div>
      ) : (
        <div className="comment-thread-footer">
          <button
            className="comment-thread-reply-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowReplyComposer(true);
              setExpanded(true);
            }}
            type="button"
          >
            Reply
          </button>
          {thread.is_resolved ? (
            <button
              className="comment-thread-resolve-btn"
              onClick={(e) => {
                e.stopPropagation();
                onReopen(thread.id);
              }}
              type="button"
            >
              Reopen
            </button>
          ) : (
            <button
              className="comment-thread-resolve-btn"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(thread.id);
              }}
              type="button"
              title="Resolve thread"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7l3 3 5-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
