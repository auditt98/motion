import { useState, useMemo, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getSchemaExtensions } from "@motion/editor-extensions";
import { Button, Badge } from "@weave-design-system/react";
import { diffWords } from "diff";
import type { PageVersion } from "@motion/shared";

const schemaExtensions = getSchemaExtensions();

// ── Block-level extraction ──────────────────────────────────────────────

interface Block {
  type: string;
  attrs?: Record<string, unknown>;
  text: string;
}

function extractBlocks(doc: Record<string, unknown>): Block[] {
  const content = doc.content as Record<string, unknown>[] | undefined;
  if (!content) return [];
  return content.map((node) => ({
    type: node.type as string,
    attrs: node.attrs as Record<string, unknown> | undefined,
    text: nodeToText(node),
  }));
}

function nodeToText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) || "";
  if (node.type === "hardBreak") return "\n";
  const content = node.content as Record<string, unknown>[] | undefined;
  if (!content) return "";
  return content.map(nodeToText).join("");
}

// ── Diff rendering ──────────────────────────────────────────────────────

function renderWordDiff(oldText: string, newText: string): ReactNode[] {
  const parts = diffWords(oldText, newText);
  return parts.map((part, i) => {
    if (part.added) return <span key={i} className="diff-added">{part.value}</span>;
    if (part.removed) return <span key={i} className="diff-removed">{part.value}</span>;
    return <span key={i}>{part.value}</span>;
  });
}

function BlockWrapper({
  type,
  attrs,
  children,
}: {
  type: string;
  attrs?: Record<string, unknown>;
  children: ReactNode;
}) {
  switch (type) {
    case "heading": {
      const level = (attrs?.level as number) || 1;
      if (level === 1) return <h1>{children}</h1>;
      if (level === 2) return <h2>{children}</h2>;
      return <h3>{children}</h3>;
    }
    case "codeBlock":
      return <pre><code>{children}</code></pre>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "horizontalRule":
      return <hr />;
    default:
      return <p>{children}</p>;
  }
}

function DiffView({
  currentDoc,
  versionDoc,
}: {
  currentDoc: Record<string, unknown>;
  versionDoc: Record<string, unknown>;
}) {
  const diff = useMemo(() => {
    const currentBlocks = extractBlocks(currentDoc);
    const versionBlocks = extractBlocks(versionDoc);
    const maxLen = Math.max(currentBlocks.length, versionBlocks.length);
    const result: ReactNode[] = [];

    for (let i = 0; i < maxLen; i++) {
      const cur = currentBlocks[i];
      const ver = versionBlocks[i];

      if (cur && ver) {
        const type = cur.type;
        const attrs = cur.attrs;
        if (cur.text === ver.text) {
          result.push(<BlockWrapper key={i} type={type} attrs={attrs}>{cur.text}</BlockWrapper>);
        } else {
          result.push(
            <BlockWrapper key={i} type={type} attrs={attrs}>
              {renderWordDiff(ver.text, cur.text)}
            </BlockWrapper>,
          );
        }
      } else if (cur && !ver) {
        result.push(
          <BlockWrapper key={i} type={cur.type} attrs={cur.attrs}>
            <span className="diff-added">{cur.text}</span>
          </BlockWrapper>,
        );
      } else if (!cur && ver) {
        result.push(
          <BlockWrapper key={i} type={ver.type} attrs={ver.attrs}>
            <span className="diff-removed">{ver.text}</span>
          </BlockWrapper>,
        );
      }
    }
    return result;
  }, [currentDoc, versionDoc]);

  return <div className="version-diff-content tiptap">{diff}</div>;
}

// ── Main component ──────────────────────────────────────────────────────

type ViewMode = "diff" | "preview";

interface VersionPreviewProps {
  content: Record<string, unknown>;
  currentDoc: Record<string, unknown>;
  version: PageVersion;
  onRestore: () => void;
  onClose: () => void;
}

export function VersionPreview({
  content,
  currentDoc,
  version,
  onRestore,
  onClose,
}: VersionPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("diff");

  const editor = useEditor(
    {
      extensions: schemaExtensions,
      content,
      editable: false,
      editorProps: {
        attributes: {
          class: "tiptap prose prose-gray max-w-none",
        },
      },
    },
    [content],
  );

  const formattedDate = new Date(version.created_at).toLocaleString();
  const authorName = version.created_by_name || "System";

  return (
    <div className="version-preview">
      <div className="version-preview-banner">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Revisions
        </Button>

        <div className="version-preview-info">
          <span className="version-preview-title">
            {version.label || formattedDate}
          </span>
          <span className="version-preview-meta">{authorName}</span>
        </div>

        <div className="version-preview-actions">
          <div className="version-view-toggle">
            <button
              className={`version-view-btn ${viewMode === "diff" ? "active" : ""}`}
              onClick={() => setViewMode("diff")}
              type="button"
            >
              Diff
            </button>
            <button
              className={`version-view-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
              type="button"
            >
              Preview
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={onRestore}>
            Restore
          </Button>
        </div>
      </div>
      <div className="version-preview-editor">
        <div className="max-w-3xl mx-auto px-8 py-12">
          {viewMode === "diff" ? (
            <DiffView currentDoc={currentDoc} versionDoc={content} />
          ) : editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="animate-pulse h-32 bg-theme-surface rounded" />
          )}
        </div>
      </div>
    </div>
  );
}
