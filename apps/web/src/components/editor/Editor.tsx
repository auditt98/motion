import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TipTapEditor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import type * as Y from "yjs";
import type YPartyKitProvider from "y-partykit/provider";
import { EditorToolbar } from "./EditorToolbar";
import { getSchemaExtensions } from "@motion/editor-extensions";
import { SlashCommandExtension } from "@/extensions/slash-command/slash-command";
import { HtmlEmbedNodeView } from "@/extensions/blocks/html-embed";
import { SuggestionModeExtension } from "./SuggestionModePlugin";

// Schema extensions shared with the MCP server — single source of truth
const schemaExtensions = getSchemaExtensions();

interface EditorProps {
  ydoc: Y.Doc;
  provider: YPartyKitProvider;
  userName?: string;
  userId?: string;
  onEditorReady?: (editor: TipTapEditor) => void;
  onCommentClick?: (threadId: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  suggestionMode?: boolean;
  onToggleSuggestionMode?: () => void;
  suggestionCount?: number;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function Editor({
  ydoc,
  provider,
  userName,
  userId,
  onEditorReady,
  onCommentClick,
  onImageUpload,
  suggestionMode,
  onToggleSuggestionMode,
  suggestionCount,
  onAcceptAll,
  onRejectAll,
}: EditorProps) {
  const handleImageFiles = async (
    editor: TipTapEditor,
    files: FileList | File[],
    pos?: number,
  ) => {
    if (!onImageUpload) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    for (const file of imageFiles) {
      // Insert placeholder at position
      const insertPos = pos ?? editor.state.selection.anchor;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, {
          type: "paragraph",
          content: [{ type: "text", text: `Uploading ${file.name}...` }],
        })
        .run();

      const url = await onImageUpload(file);
      if (url) {
        // Replace the placeholder paragraph with the actual image
        // Find the placeholder node we just inserted
        const { doc } = editor.state;
        let placeholderPos: number | null = null;
        doc.descendants((node, nodePos) => {
          if (
            placeholderPos === null &&
            node.isTextblock &&
            node.textContent === `Uploading ${file.name}...`
          ) {
            placeholderPos = nodePos;
          }
        });
        if (placeholderPos !== null) {
          const node = doc.nodeAt(placeholderPos);
          if (node) {
            editor
              .chain()
              .focus()
              .deleteRange({
                from: placeholderPos,
                to: placeholderPos + node.nodeSize,
              })
              .insertContentAt(placeholderPos, {
                type: "image",
                attrs: { src: url },
              })
              .run();
          }
        } else {
          // Fallback: just insert at cursor
          editor.chain().focus().setImage({ src: url }).run();
        }
      }
    }
  };

  const editor = useEditor(
    {
      extensions: [
        // Shared schema extensions (same as MCP server)
        ...schemaExtensions,
        // Client-only extensions
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider,
          render: (user: Record<string, string>) => {
            const cursor = document.createElement("span");
            cursor.classList.add("collaboration-cursor__caret");
            cursor.setAttribute("data-client-id", String(user.clientId || ""));
            cursor.style.borderColor = user.color || "#6b7280";

            const label = document.createElement("span");
            label.classList.add("collaboration-cursor__label");
            label.style.backgroundColor = user.color || "#6b7280";
            label.textContent = user.name || "Anonymous";
            label.setAttribute("data-client-id", String(user.clientId || ""));

            if (String(user.isAgent) === "true") {
              cursor.setAttribute("data-is-agent", "true");
              label.setAttribute("data-is-agent", "true");
              if (user.status) {
                label.setAttribute("data-agent-status", user.status);
              }
            }

            cursor.appendChild(label);
            return cursor;
          },
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands...",
        }),
        // Override the Link from shared extensions with client-specific styling
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-blue-600 underline cursor-pointer hover:text-blue-800",
          },
        }),
        HtmlEmbedNodeView,
        SlashCommandExtension,
        SuggestionModeExtension.configure({
          authorId: userId ?? "",
          authorName: userName ?? "Anonymous",
        }),
      ],
      editorProps: {
        attributes: {
          class: "tiptap prose prose-gray max-w-none focus:outline-none",
        },
        handleClick: (_view, _pos, event) => {
          // Detect clicks on comment highlights
          const target = event.target as HTMLElement;
          const commentEl = target.closest("[data-comment-thread-id]");
          if (commentEl) {
            const threadId = commentEl.getAttribute("data-comment-thread-id");
            if (threadId && onCommentClick) {
              onCommentClick(threadId);
              return true;
            }
          }
          return false;
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (moved || !event.dataTransfer?.files?.length) return false;
          const files = Array.from(event.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (!files.length) return false;
          event.preventDefault();
          const coordinates = _view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (editor && coordinates) {
            handleImageFiles(editor, files, coordinates.pos);
          }
          return true;
        },
        handlePaste: (_view, event) => {
          const files = event.clipboardData?.files;
          if (!files?.length) return false;
          const imageFiles = Array.from(files).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (!imageFiles.length) return false;
          event.preventDefault();
          if (editor) {
            handleImageFiles(editor, imageFiles);
          }
          return true;
        },
      },
      onCreate: ({ editor }) => {
        editor.commands.focus("start");
        onEditorReady?.(editor);
      },
    },
    [ydoc, provider],
  );

  if (!editor) {
    return <div className="animate-pulse h-32 bg-gray-50 rounded" />;
  }

  return (
    <div>
      <EditorToolbar
        editor={editor}
        onImageUpload={onImageUpload}
        suggestionMode={suggestionMode}
        onToggleSuggestionMode={onToggleSuggestionMode}
        suggestionCount={suggestionCount}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
