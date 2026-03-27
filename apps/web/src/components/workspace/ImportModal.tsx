import { useState, useCallback, useRef } from "react";
import { Modal, Button, AlertBanner } from "@weave-design-system/react";
import type { FolderItem } from "@/hooks/useWorkspace";
import type { JSONContent } from "@tiptap/react";
import { markdownToDoc } from "@/utils/importMarkdown";
import { htmlToDoc } from "@/utils/importHTML";
import { docxToDoc } from "@/utils/importDocx";
import { parseNotionZip } from "@/utils/importNotionZip";

type ImportFormat = "markdown" | "html" | "notion" | "docx";

export interface ImportPage {
  title: string;
  doc: JSONContent;
  images?: Array<{ filename: string; blob: Blob }>;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  folders: FolderItem[];
  onImportPages: (
    pages: ImportPage[],
    folderId: string | null,
  ) => Promise<void>;
}

const FORMAT_CONFIG: Record<
  ImportFormat,
  { label: string; accept: string; multiple: boolean; description: string }
> = {
  markdown: {
    label: "Markdown",
    accept: ".md,.markdown",
    multiple: true,
    description: "Import .md files with headings, lists, and code blocks",
  },
  html: {
    label: "HTML",
    accept: ".html,.htm",
    multiple: true,
    description: "Import .html files with formatting preserved",
  },
  notion: {
    label: "Notion Export",
    accept: ".zip",
    multiple: false,
    description: "Import a Notion export ZIP with pages and images",
  },
  docx: {
    label: "Google Docs / Word",
    accept: ".docx",
    multiple: true,
    description: "Import .docx files from Google Docs or Microsoft Word",
  },
};

const FORMATS: ImportFormat[] = ["markdown", "html", "notion", "docx"];

export function ImportModal({
  open,
  onClose,
  folders,
  onImportPages,
}: ImportModalProps) {
  const [activeFormat, setActiveFormat] = useState<ImportFormat>("markdown");
  const [parsedPages, setParsedPages] = useState<ImportPage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = FORMAT_CONFIG[activeFormat];

  const reset = useCallback(() => {
    setParsedPages([]);
    setError(null);
    setProgress(null);
  }, []);

  const handleFormatChange = useCallback(
    (format: ImportFormat) => {
      setActiveFormat(format);
      reset();
    },
    [reset],
  );

  const handleClose = useCallback(() => {
    reset();
    setImporting(false);
    onClose();
  }, [onClose, reset]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setParsedPages([]);

      try {
        const pages: ImportPage[] = [];

        if (activeFormat === "notion") {
          const file = files[0];
          if (!file) return;
          const notionPages = await parseNotionZip(file, (current, total) =>
            setProgress({ current, total }),
          );
          pages.push(
            ...notionPages.map((p) => ({
              title: p.title,
              doc: p.doc,
              images: p.images,
            })),
          );
          setProgress(null);
        } else {
          for (const file of Array.from(files)) {
            if (activeFormat === "markdown") {
              const text = await file.text();
              const result = markdownToDoc(text);
              const title =
                result.title !== "Untitled"
                  ? result.title
                  : file.name.replace(/\.(md|markdown)$/i, "");
              pages.push({ title, doc: result.doc });
            } else if (activeFormat === "html") {
              const text = await file.text();
              const result = htmlToDoc(text);
              const title =
                result.title !== "Untitled"
                  ? result.title
                  : file.name.replace(/\.(html|htm)$/i, "");
              pages.push({ title, doc: result.doc });
            } else if (activeFormat === "docx") {
              const result = await docxToDoc(file);
              pages.push({ title: result.title, doc: result.doc });
            }
          }
        }

        if (pages.length === 0) {
          setError("No importable pages found in the selected file(s).");
          return;
        }

        setParsedPages(pages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to parse file(s)",
        );
      }
    },
    [activeFormat],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleImport = useCallback(async () => {
    if (parsedPages.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await onImportPages(parsedPages, selectedFolderId);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed",
      );
      setImporting(false);
    }
  }, [parsedPages, selectedFolderId, onImportPages, handleClose]);

  return (
    <Modal open={open} onClose={handleClose}>
      <Modal.Header onClose={handleClose}>
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--color-textPrimary)" }}
        >
          Import
        </h2>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          {/* Format tabs */}
          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ background: "var(--color-surface)" }}
          >
            {FORMATS.map((format) => (
              <button
                key={format}
                onClick={() => handleFormatChange(format)}
                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{
                  background:
                    activeFormat === format
                      ? "var(--color-bg)"
                      : "transparent",
                  color:
                    activeFormat === format
                      ? "var(--color-textPrimary)"
                      : "var(--color-textSecondary)",
                  boxShadow:
                    activeFormat === format
                      ? "0 1px 2px rgba(0,0,0,0.05)"
                      : "none",
                }}
              >
                {FORMAT_CONFIG[format].label}
              </button>
            ))}
          </div>

          {/* Description */}
          <p
            className="text-sm"
            style={{ color: "var(--color-textSecondary)" }}
          >
            {config.description}
          </p>

          {/* Drop zone */}
          {parsedPages.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 py-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors hover:border-(--color-rust)"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-textSecondary)",
              }}
            >
              {/* Upload icon */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div className="text-center">
                <span className="text-sm font-medium">
                  Drop files here or click to browse
                </span>
                <p className="text-xs mt-1" style={{ opacity: 0.7 }}>
                  {config.accept.replace(/\./g, "").replace(/,/g, ", ")}
                  {config.multiple ? " (multiple files)" : ""}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={config.accept}
                multiple={config.multiple}
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Progress indicator for ZIP parsing */}
          {progress && (
            <div className="text-sm" style={{ color: "var(--color-textSecondary)" }}>
              Parsing files... {progress.current} / {progress.total}
            </div>
          )}

          {/* Parsed pages list */}
          {parsedPages.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--color-textSecondary)" }}
                >
                  {parsedPages.length} page{parsedPages.length !== 1 ? "s" : ""}{" "}
                  to import
                </span>
                <button
                  onClick={reset}
                  className="text-xs underline"
                  style={{ color: "var(--color-textSecondary)" }}
                >
                  Clear
                </button>
              </div>
              <div
                className="max-h-48 overflow-y-auto rounded-lg border divide-y"
                style={{
                  borderColor: "var(--color-border)",
                }}
              >
                {parsedPages.map((page, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                    style={{ color: "var(--color-textPrimary)" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate">{page.title}</span>
                    {page.images && page.images.length > 0 && (
                      <span
                        className="text-xs ml-auto shrink-0"
                        style={{ color: "var(--color-textSecondary)" }}
                      >
                        {page.images.length} image
                        {page.images.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Folder selector */}
          {parsedPages.length > 0 && folders.length > 0 && (
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--color-textSecondary)" }}
              >
                Import into folder
              </label>
              <select
                value={selectedFolderId || ""}
                onChange={(e) =>
                  setSelectedFolderId(e.target.value || null)
                }
                className="w-full px-3 py-1.5 text-sm rounded-md border"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-bg)",
                  color: "var(--color-textPrimary)",
                }}
              >
                <option value="">No folder (root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <AlertBanner variant="error" message={error} />
          )}
        </div>
      </Modal.Body>

      {/* Footer with import button */}
      {parsedPages.length > 0 && (
        <div
          className="flex justify-end gap-2 px-6 py-4 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={importing}
          >
            {importing
              ? "Importing..."
              : `Import ${parsedPages.length} page${parsedPages.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </Modal>
  );
}
