import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";

export function HtmlEmbedView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const htmlContent = (node.attrs.htmlContent as string) || "";
  const [isEditing, setIsEditing] = useState(!htmlContent);
  const [draft, setDraft] = useState(htmlContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync draft when content changes externally (collaborative edit)
  useEffect(() => {
    if (!isEditing) {
      setDraft(node.attrs.htmlContent || "");
    }
  }, [node.attrs.htmlContent, isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    updateAttributes({ htmlContent: draft });
    if (draft) {
      setIsEditing(false);
    }
  }, [draft, updateAttributes]);

  // Auto-resize iframe to match content height
  useEffect(() => {
    if (!isEditing && iframeRef.current && htmlContent) {
      const iframe = iframeRef.current;
      const handleLoad = () => {
        try {
          const height =
            iframe.contentDocument?.documentElement?.scrollHeight;
          if (height) {
            iframe.style.height = `${height + 16}px`;
          }
        } catch {
          // sandbox may prevent access
        }
      };
      iframe.addEventListener("load", handleLoad);
      return () => iframe.removeEventListener("load", handleLoad);
    }
  }, [isEditing, htmlContent]);

  return (
    <NodeViewWrapper
      className={`html-embed-block ${selected ? "selected" : ""}`}
    >
      <div className="html-embed-header" contentEditable={false}>
        <span className="html-embed-label">{"</>"} HTML</span>
        {htmlContent && (
          <button
            className="html-embed-toggle-btn"
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            type="button"
          >
            {isEditing ? "Preview" : "Edit"}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="html-embed-editor">
          <textarea
            ref={textareaRef}
            className="html-embed-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter to save and preview
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
              // Prevent ProseMirror from handling keystrokes
              e.stopPropagation();
            }}
            placeholder="Paste your HTML here..."
            spellCheck={false}
          />
        </div>
      ) : htmlContent ? (
        <iframe
          ref={iframeRef}
          className="html-embed-preview"
          srcDoc={htmlContent}
          sandbox="allow-scripts"
          title="HTML embed preview"
        />
      ) : (
        <div
          className="html-embed-empty"
          onClick={() => setIsEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditing(true);
          }}
        >
          Click to add HTML content
        </div>
      )}
    </NodeViewWrapper>
  );
}
