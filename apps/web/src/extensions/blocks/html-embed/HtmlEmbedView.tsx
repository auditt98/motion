import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";

const MIN_HEIGHT = 60;
const DEFAULT_HEIGHT = 200;

export function HtmlEmbedView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const htmlContent = (node.attrs.htmlContent as string) || "";
  const savedHeight = (node.attrs.height as number | null) ?? DEFAULT_HEIGHT;

  const [isEditing, setIsEditing] = useState(!htmlContent);
  const [isInteractive, setIsInteractive] = useState(false);
  const [draft, setDraft] = useState(htmlContent);
  const [height, setHeight] = useState(savedHeight);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Sync draft when content changes externally (collaborative edit)
  useEffect(() => {
    if (!isEditing) {
      setDraft(node.attrs.htmlContent || "");
    }
  }, [node.attrs.htmlContent, isEditing]);

  // Sync height when attribute changes externally
  useEffect(() => {
    const h = node.attrs.height as number | null;
    if (h && !resizingRef.current) {
      setHeight(h);
    }
  }, [node.attrs.height]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Click outside to exit interactive mode
  useEffect(() => {
    if (!isInteractive) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsInteractive(false);
      }
    }

    // Delay to avoid catching the double-click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isInteractive]);

  const handleSave = useCallback(() => {
    updateAttributes({ htmlContent: draft });
    if (draft) {
      setIsEditing(false);
    }
  }, [draft, updateAttributes]);

  // --- Drag to resize ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = height;

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

  // Double-click to enter interactive mode
  const handleDoubleClick = useCallback(() => {
    if (!isEditing && htmlContent) {
      setIsInteractive(true);
    }
  }, [isEditing, htmlContent]);

  return (
    <NodeViewWrapper
      className={`html-embed-block ${selected ? "selected" : ""} ${isInteractive ? "interactive" : ""}`}
    >
      <div ref={containerRef}>
        <div className="html-embed-header" contentEditable={false}>
          <span className="html-embed-label">{"</>"} HTML</span>
          <div className="html-embed-actions">
            {htmlContent && !isEditing && (
              <span className="html-embed-hint">
                {isInteractive ? "Click outside to exit" : "Double-click to interact"}
              </span>
            )}
            {htmlContent && (
              <button
                className="html-embed-toggle-btn"
                onClick={() => {
                  if (isEditing) {
                    handleSave();
                  } else {
                    setIsInteractive(false);
                    setIsEditing(true);
                  }
                }}
                type="button"
              >
                {isEditing ? "Preview" : "Edit"}
              </button>
            )}
          </div>
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
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
                e.stopPropagation();
              }}
              placeholder="Paste your HTML here..."
              spellCheck={false}
            />
          </div>
        ) : htmlContent ? (
          <div className="html-embed-preview-container" contentEditable={false}>
            {/* Overlay blocks interaction when locked */}
            {!isInteractive && (
              <div
                className="html-embed-overlay"
                onDoubleClick={handleDoubleClick}
              />
            )}
            <iframe
              ref={iframeRef}
              className="html-embed-preview"
              style={{ height: `${height}px` }}
              srcDoc={htmlContent}
              sandbox="allow-scripts allow-same-origin"
              title="HTML embed preview"
            />
            {/* Resize handle */}
            <div
              className="html-embed-resize-handle"
              onMouseDown={handleResizeStart}
              contentEditable={false}
            >
              <svg width="16" height="6" viewBox="0 0 16 6" fill="currentColor">
                <rect x="0" y="0" width="16" height="2" rx="1" />
                <rect x="0" y="4" width="16" height="2" rx="1" />
              </svg>
            </div>
          </div>
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
      </div>
    </NodeViewWrapper>
  );
}
