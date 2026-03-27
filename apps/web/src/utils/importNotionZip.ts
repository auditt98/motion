import JSZip from "jszip";
import { markdownToDoc } from "./importMarkdown";
import type { JSONContent } from "@tiptap/react";

export interface NotionImportPage {
  title: string;
  doc: JSONContent;
  /** Relative path within the ZIP (for folder hierarchy) */
  path: string;
  /** Images referenced in this page */
  images: Array<{ filename: string; blob: Blob }>;
}

/**
 * Clean a Notion export filename into a page title.
 * Notion appends a hex ID to filenames: "Page Title abc123def4.md" → "Page Title"
 */
function cleanNotionFilename(filename: string): string {
  // Remove .md extension
  let name = filename.replace(/\.md$/i, "");
  // Remove trailing Notion ID (space + 32 hex chars)
  name = name.replace(/\s+[a-f0-9]{32}$/i, "");
  // URL-decode
  name = decodeURIComponent(name);
  return name.trim() || "Untitled";
}

/**
 * Parse a Notion export ZIP file into an array of importable pages.
 */
export async function parseNotionZip(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<NotionImportPage[]> {
  const zip = await JSZip.loadAsync(file);
  const pages: NotionImportPage[] = [];

  // Collect all .md files
  const mdFiles: Array<{ path: string; file: JSZip.JSZipObject }> = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && relativePath.endsWith(".md")) {
      mdFiles.push({ path: relativePath, file: zipEntry });
    }
  });

  const total = mdFiles.length;

  for (let i = 0; i < mdFiles.length; i++) {
    const { path, file: zipEntry } = mdFiles[i];
    onProgress?.(i + 1, total);

    const markdown = await zipEntry.async("string");

    // Find images referenced in this markdown
    const imageRefs = extractImageRefs(markdown);
    const images: Array<{ filename: string; blob: Blob }> = [];

    // Resolve image paths relative to the .md file's directory
    const mdDir = path.substring(0, path.lastIndexOf("/") + 1);

    for (const ref of imageRefs) {
      const decodedRef = decodeURIComponent(ref);
      // Try path relative to the .md file
      const imagePath = mdDir + decodedRef;
      const imageFile = zip.file(imagePath) || zip.file(decodedRef);

      if (imageFile) {
        const blob = await imageFile.async("blob");
        const filename = decodedRef.split("/").pop() || "image.png";
        images.push({ filename, blob });
      }
    }

    // Convert markdown to PM JSON
    const { title: extractedTitle, doc } = markdownToDoc(markdown);

    // Prefer cleaned filename over extracted H1 for Notion exports
    const filenameTitle = cleanNotionFilename(path.split("/").pop() || "");
    const title = filenameTitle !== "Untitled" ? filenameTitle : extractedTitle;

    pages.push({ title, doc, path, images });
  }

  return pages;
}

/** Extract image reference paths from markdown content. */
function extractImageRefs(markdown: string): string[] {
  const refs: string[] = [];
  // Match ![alt](path) patterns
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(markdown)) !== null) {
    const src = match[1];
    // Skip external URLs
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
      refs.push(src);
    }
  }
  return refs;
}
