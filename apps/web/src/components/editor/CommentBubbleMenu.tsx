import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

interface CommentBubbleMenuProps {
  editor: Editor;
  onCommentClick: (selection: { from: number; to: number; text: string }) => void;
}

export function CommentBubbleMenu({
  editor,
  onCommentClick,
}: CommentBubbleMenuProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // keep editor selection
    e.stopPropagation();
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    onCommentClick({ from, to, text });
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        placement: "top",
        interactive: true,
      }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        if (e.isActive("codeBlock")) return false;
        return true;
      }}
    >
      <div className="comment-bubble-menu">
        <button
          className="comment-bubble-btn"
          onMouseDown={handleMouseDown}
          type="button"
          title="Add comment"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 2.5C2 2.22386 2.22386 2 2.5 2H13.5C13.7761 2 14 2.22386 14 2.5V10.5C14 10.7761 13.7761 11 13.5 11H9.70711L6.85355 13.8536C6.53857 14.1685 6 13.9464 6 13.5V11H2.5C2.22386 11 2 10.7761 2 10.5V2.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Comment</span>
        </button>
      </div>
    </BubbleMenu>
  );
}
