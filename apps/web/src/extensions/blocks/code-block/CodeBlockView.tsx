import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";

export function CodeBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const language = (node.attrs.language as string) || "";
  const collapsed = node.attrs.collapsed === true;

  const toggleCollapse = useCallback(() => {
    updateAttributes({ collapsed: !collapsed });
  }, [collapsed, updateAttributes]);

  return (
    <NodeViewWrapper
      as="div"
      className={`code-block-wrapper${selected ? " ProseMirror-selectednode" : ""}`}
    >
      {/* Clickable header bar */}
      <div
        className="code-block-header"
        contentEditable={false}
        onClick={toggleCollapse}
        role="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand code block" : "Collapse code block"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          className="code-block-chevron"
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="code-block-lang">{language || "Code"}</span>
      </div>

      {/* Code content */}
      <pre className="code-block-pre" style={collapsed ? { display: "none" } : undefined}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
