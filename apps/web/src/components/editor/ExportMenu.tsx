import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Button, Tooltip } from "@weave-design-system/react";
import { exportAsHTML } from "@/utils/exportHTML";
import { exportAsMarkdown } from "@/utils/exportMarkdown";
import { exportAsPDF } from "@/utils/exportPDF";

interface ExportMenuProps {
  editor: Editor;
  pageTitle?: string;
}

function deriveTitle(editor: Editor): string {
  const json = editor.getJSON();
  const first = json.content?.[0];
  if (first?.type === "heading" && first.content) {
    return first.content.map((n: { text?: string }) => n.text || "").join("");
  }
  return "Untitled";
}

export function ExportMenu({ editor, pageTitle }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const title = pageTitle?.trim() || deriveTitle(editor);

  function handleExport(format: "html" | "markdown" | "pdf") {
    setOpen(false);
    switch (format) {
      case "html":
        exportAsHTML(editor, title);
        break;
      case "markdown":
        exportAsMarkdown(editor, title);
        break;
      case "pdf":
        exportAsPDF(editor, title);
        break;
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Export document">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(!open)}
          aria-label="Export document"
          style={{ minWidth: "28px", padding: "4px 8px" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </Button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
          <button
            onClick={() => handleExport("html")}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="text-gray-400 text-xs font-mono w-6">HTML</span>
            Export as HTML
          </button>
          <button
            onClick={() => handleExport("markdown")}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="text-gray-400 text-xs font-mono w-6">MD</span>
            Export as Markdown
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="text-gray-400 text-xs font-mono w-6">PDF</span>
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
