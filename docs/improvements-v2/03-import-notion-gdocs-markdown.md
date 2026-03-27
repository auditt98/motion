# Import from Notion, Google Docs, and Markdown

## Problem

The biggest barrier to adopting Motion is existing content. Teams have hundreds of documents in Notion, Google Docs, and Markdown files. Without an import path, they must start from scratch or manually recreate content. No team will switch editors if they can't bring their documents with them.

## Priority

~2-3 days of effort. High adoption impact -- directly removes the #1 migration blocker.

## What to Build

### 1. Import modal UI

Add an "Import" option to the Dashboard (next to "New page" and "New folder") and to the sidebar "+" menu. Clicking opens a modal with format selection:

| Format | Input | Method |
|--------|-------|--------|
| **Markdown** | `.md` file(s) | File picker or drag-and-drop |
| **HTML** | `.html` file(s) | File picker or drag-and-drop |
| **Notion Export** | `.zip` file | File picker (Notion "Export" produces a ZIP with Markdown + CSV) |
| **Google Docs** | Paste HTML or `.docx` | Paste from clipboard or file upload |

Each format card shows:
- Icon + format name
- Brief description ("Import .md files with headings, lists, and code blocks")
- Supported features (what formatting will be preserved)

### 2. Markdown importer

Parse Markdown files into ProseMirror JSON that matches Motion's editor schema.

**Approach:** Use a Markdown-to-ProseMirror parser. Options:
- `prosemirror-markdown` (built-in ProseMirror package) -- parse Markdown to PM doc
- `marked` or `markdown-it` to parse to HTML, then use the DOMParser approach
- TipTap's `editor.commands.setContent(htmlString)` which handles HTML-to-PM conversion

**Supported Markdown elements:**
- Headings (h1-h6) -> heading nodes
- Bold, italic, strikethrough, inline code -> marks
- Bullet lists, ordered lists, task lists -> list nodes
- Code blocks (with language) -> codeBlock nodes
- Blockquotes -> blockquote nodes
- Links -> link marks
- Images (inline and reference) -> image nodes (download and re-upload to Supabase Storage)
- Tables -> table nodes
- Horizontal rules -> horizontalRule nodes

**What won't be preserved:** Custom Notion blocks (databases, embeds, synced blocks), page links (converted to plain text).

### 3. HTML importer

Parse HTML into ProseMirror JSON using TipTap's built-in HTML parsing:

```typescript
// TipTap handles HTML -> PM conversion natively
editor.commands.setContent(htmlString);
```

This handles Google Docs paste (which copies as HTML to clipboard) automatically.

For `.html` file upload, read the file contents and pass through the same path.

### 4. Notion export importer

Notion's "Export" feature produces a ZIP file containing:
- Markdown files (one per page)
- CSV files (for database views)
- Image files in subdirectories

**Import flow:**
1. User uploads the ZIP file
2. Extract ZIP in the browser using `JSZip` or the native `DecompressionStream` API
3. Walk the file tree:
   - For each `.md` file: create a new page, import using the Markdown importer
   - For each directory: create a folder
   - For images referenced in Markdown: upload to Supabase Storage, rewrite image URLs
   - Skip `.csv` files (database views -- show a note about unsupported content)
4. Preserve the folder hierarchy from Notion's export structure
5. Show progress bar with file count and current file name

### 5. Google Docs import

Two methods:

**A. Paste from clipboard (simplest):**
- User copies content from Google Docs (Cmd+A, Cmd+C)
- Pastes into a new Motion page
- TipTap's paste handling converts HTML clipboard data to PM nodes
- This already partially works -- test and fix any edge cases

**B. `.docx` file upload (stretch):**
- Use `mammoth.js` to convert DOCX to HTML
- Pass the HTML through the HTML importer
- Handles formatting, headings, lists, tables, images

### 6. Import service / utility

Create a shared import utility:

```typescript
// apps/web/src/utils/import.ts

interface ImportResult {
  title: string;           // derived from filename or first heading
  content: JSONContent;    // ProseMirror JSON
  images: ImportedImage[]; // images to upload
}

function importMarkdown(markdown: string): ImportResult;
function importHTML(html: string): ImportResult;
async function importNotionZip(file: File): Promise<ImportResult[]>;
async function importDocx(file: File): Promise<ImportResult>;
```

### 7. Batch import with progress

For ZIP imports (potentially dozens of files):

- Show a progress modal with: total files, current file, progress bar
- Create pages sequentially (to avoid overwhelming Supabase/PartyKit)
- After completion: "Imported 24 pages into folder 'Notion Import'" with a link to the folder
- Error handling: skip failed files, show summary at the end

## Files to Modify

- `apps/web/src/components/workspace/ImportModal.tsx` (new) -- import UI
- `apps/web/src/utils/importMarkdown.ts` (new) -- Markdown parser
- `apps/web/src/utils/importHTML.ts` (new) -- HTML parser
- `apps/web/src/utils/importNotion.ts` (new) -- Notion ZIP handler
- `apps/web/src/components/workspace/Dashboard.tsx` -- add "Import" button
- `apps/web/src/components/workspace/MotionSidebar.tsx` -- add "Import" to menu
- `apps/web/src/hooks/useWorkspace.ts` -- update `createPage()` to accept initial content
- `package.json` (apps/web) -- add `jszip` dependency (for ZIP extraction)

## Verification

1. Import a single `.md` file -> new page created with correct formatting (headings, lists, code blocks, bold/italic)
2. Import multiple `.md` files -> one page created per file
3. Import a Notion ZIP export -> folder structure preserved, all pages imported
4. Images in Markdown -> uploaded to Supabase Storage, displayed in editor
5. Paste from Google Docs -> formatting preserved (headings, lists, tables)
6. Upload `.html` file -> content imported with formatting
7. Large import (50+ files) -> progress bar shows, all pages created, summary displayed
8. File with unsupported content -> imports what it can, shows warning about skipped elements
9. Imported content syncs to other peers via Yjs

## Dependencies

None. Could benefit from page templates (for mapping Notion template content) but works independently.
