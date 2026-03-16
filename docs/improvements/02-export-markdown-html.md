# Export (Markdown + HTML)

## Problem

Users can't export documents to any format. Content is locked inside Nexus with no way to share outside the workspace (email a report, paste into Slack) or migrate away. Data portability is a critical trust signal — users won't invest in a tool they can't leave.

## Priority

**Sprint 2.** ~1–2 days of effort. High trust impact.

## What to Build

### 1. ProseMirror JSON to Markdown serializer

New utility `apps/web/src/utils/exportMarkdown.ts`:

Walk the ProseMirror JSON tree and convert each node type:

| Node Type | Markdown Output |
|-----------|----------------|
| paragraph | plain text + newline |
| heading (level 1-3) | `#` / `##` / `###` |
| bulletList + listItem | `- item` |
| orderedList + listItem | `1. item` |
| taskList + taskItem | `- [ ]` / `- [x]` |
| blockquote | `> text` |
| codeBlock | ` ```lang\ncode\n``` ` |
| horizontalRule | `---` |
| table | `| col | col |` with alignment row |
| image | `![alt](src)` |
| callout | `> **Info:** text` (or similar convention) |
| toggle | `<details><summary>title</summary>content</details>` |

Inline marks:

| Mark | Markdown |
|------|----------|
| bold | `**text**` |
| italic | `*text*` |
| code | `` `text` `` |
| strikethrough | `~~text~~` |
| link | `[text](href)` |
| underline | `<u>text</u>` (no native MD) |
| highlight | pass through as plain text |

### 2. ProseMirror JSON to HTML serializer

New utility `apps/web/src/utils/exportHTML.ts`:

Use TipTap's built-in `generateHTML(json, extensions)` with the shared schema extensions from `packages/editor-extensions`. This is nearly free — TipTap handles the full conversion.

Wrap output in a minimal HTML document with basic styling:
```html
<!DOCTYPE html>
<html>
<head><title>{pageTitle}</title>
<style>body { font-family: system-ui; max-width: 720px; margin: 0 auto; padding: 2rem; }</style>
</head>
<body>{content}</body>
</html>
```

### 3. Export UI

Add export options to two locations:

**Page context menu** (three-dot menu in sidebar):
- "Export as Markdown"
- "Export as HTML"

**Editor header** (next to share button):
- Download icon or "Export" dropdown

Implementation:
- Get document JSON via `editor.getJSON()`
- Run through the appropriate serializer
- Trigger browser file download (`Blob` + `URL.createObjectURL` + `<a download>`)
- Filename: `{page-title}.md` or `{page-title}.html`

## Files to Modify

- `apps/web/src/utils/exportMarkdown.ts` (new)
- `apps/web/src/utils/exportHTML.ts` (new)
- `apps/web/src/components/workspace/PageTree.tsx` — add export to context menu
- `apps/web/src/components/editor/EditorPage.tsx` — add export button/dropdown

## Verification

1. Open a document with varied content (headings, lists, code, images, tables)
2. Export as Markdown → opens/downloads `.md` file → content is valid Markdown
3. Export as HTML → opens/downloads `.html` file → renders correctly in a browser
4. Verify round-trip: Markdown output should be readable and correctly formatted
5. Edge cases: empty document, document with only images, very long document

## Dependencies

None. Can ship independently.
