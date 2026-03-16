import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Button, Tooltip } from "@weave-design-system/react";

interface EditorToolbarProps {
  editor: Editor;
  onImageUpload?: (file: File) => Promise<string | null>;
  suggestionMode?: boolean;
  onToggleSuggestionMode?: () => void;
  suggestionCount?: number;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function EditorToolbar({
  editor,
  onImageUpload,
  suggestionMode = false,
  onToggleSuggestionMode,
  suggestionCount = 0,
  onAcceptAll,
  onRejectAll,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="flex items-center gap-0.5 mb-16 p-1 rounded-lg sticky top-0 z-10 flex-wrap"
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        tooltip="Bold (⌘B)"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        tooltip="Italic (⌘I)"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        tooltip="Underline (⌘U)"
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        tooltip="Strikethrough (⌘⇧X)"
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        tooltip="Inline Code (⌘E)"
      >
        <code className="text-xs">&lt;/&gt;</code>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        tooltip="Heading 1 (⌘⇧1)"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        tooltip="Heading 2 (⌘⇧2)"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        tooltip="Heading 3 (⌘⇧3)"
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        tooltip="Bullet List (⌘⇧8)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        tooltip="Ordered List (⌘⇧9)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
          <text x="2" y="8" fontSize="8" fill="currentColor" stroke="none">1</text>
          <text x="2" y="14" fontSize="8" fill="currentColor" stroke="none">2</text>
          <text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">3</text>
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        tooltip="Task List (⌘⇧7)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="6" height="6" rx="1" /><path d="M5 8l1 1 2-2" /><line x1="13" y1="8" x2="21" y2="8" />
          <rect x="3" y="13" width="6" height="6" rx="1" /><line x1="13" y1="16" x2="21" y2="16" />
        </svg>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        tooltip="Blockquote (⌘⇧B)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        tooltip="Code Block (⌘⌥C)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        tooltip="Divider"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={false}
        onClick={() => {
          if (onImageUpload) {
            fileInputRef.current?.click();
          } else {
            const url = window.prompt("Image URL");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }
        }}
        tooltip="Image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && onImageUpload) {
            const url = await onImageUpload(file);
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }
          // Reset so the same file can be selected again
          e.target.value = "";
        }}
      />
      <ToolbarButton
        active={false}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        tooltip="Table"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Suggestion mode toggle */}
      {onToggleSuggestionMode && (
        <Tooltip content={suggestionMode ? "Switch to Editing mode" : "Switch to Suggesting mode"}>
          <Button
            variant={suggestionMode ? "primary" : "ghost"}
            size="sm"
            onClick={onToggleSuggestionMode}
            aria-label="Toggle suggestion mode"
            style={{
              minWidth: "28px",
              padding: "4px 8px",
              gap: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {suggestionMode ? (
                /* Pencil with line — suggesting */
                <>
                  <path d="M12 20h9" strokeLinecap="round" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </>
              ) : (
                /* Pencil — editing */
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              )}
            </svg>
            <span className="text-xs">{suggestionMode ? "Suggesting" : "Editing"}</span>
          </Button>
        </Tooltip>
      )}

      {/* Bulk accept/reject — visible when suggestions exist */}
      {suggestionCount > 0 && (
        <>
          <Tooltip content="Accept all suggestions">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAcceptAll}
              aria-label="Accept all suggestions"
              style={{ color: "var(--color-forest)", minWidth: "28px", padding: "4px 6px" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 8 6.5 11.5 13 5" />
              </svg>
            </Button>
          </Tooltip>
          <Tooltip content="Reject all suggestions">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRejectAll}
              aria-label="Reject all suggestions"
              style={{ color: "var(--color-rust)", minWidth: "28px", padding: "4px 6px" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </Button>
          </Tooltip>
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  tooltip,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <Button
        variant={active ? "primary" : "ghost"}
        size="sm"
        onClick={onClick}
        aria-label={tooltip}
        style={{
          minWidth: "28px",
          padding: "4px 6px",
        }}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="w-px h-5 mx-1" style={{ background: "var(--color-border)" }} />;
}
