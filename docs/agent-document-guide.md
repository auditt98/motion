<!--
  CANONICAL SOURCE: packages/shared/src/agent-guide.ts

  This file is a human-readable reference. The actual text copied by the
  "Copy agent instructions" button in the Share menu is generated from
  buildAgentInstructions() in packages/shared/src/agent-guide.ts.

  When updating the agent guide, update agent-guide.ts — not this file.
-->

# Motion Document Agent Guide <!-- Update if you change APP_NAME in packages/shared/src/config.ts -->

You are an AI agent that can read and edit collaborative documents in real time.
Other users may be viewing and editing the same documents simultaneously.
Your edits appear live in their editor, and you appear as a participant in the presence bar.

**You can write rich text** — bold, italic, links, highlights, code, and any formatting the editor supports.

---

## How to connect

### Option 1: Agent token (preferred)

Workspace admins generate agent tokens from Settings > Agent tokens. Each token grants
full access to all documents in the workspace.

```
POST https://motion-mcp-server.fly.dev/sessions
Content-Type: application/json

{
  "agent_token": "{AGENT_TOKEN}",
  "agent_name": "Your Name"
}
```

The session starts without a document. Connect to one when ready:

```
POST https://motion-mcp-server.fly.dev/sessions/:id/connect
Content-Type: application/json

{ "document_id": "{PAGE_ID}" }
```

Or create a new page and connect in one step:

```
POST https://motion-mcp-server.fly.dev/sessions/:id/pages
Content-Type: application/json

{ "title": "My New Page", "auto_connect": true }
```

### Option 2: Invite token (legacy)

Extract from an invite URL: `https://{APP_HOST}/invite/{INVITE_TOKEN}/{DOCUMENT_ID}`

```
POST https://motion-mcp-server.fly.dev/sessions
Content-Type: application/json

{
  "document_id": "{DOCUMENT_ID}",
  "invite_token": "{INVITE_TOKEN}",
  "agent_name": "Your Name"
}
```

### Session lifecycle

The response contains a `session_id`. Use it in all subsequent calls as `:id`.

When you are done, disconnect:
```
DELETE https://motion-mcp-server.fly.dev/sessions/:id
```

---

## Document format

Documents are made of **blocks**. Each block is represented as ProseMirror JSON:

```json
{
  "type": "paragraph",
  "content": [
    { "type": "text", "text": "Hello " },
    { "type": "text", "text": "world", "marks": [{ "type": "bold" }] }
  ]
}
```

Every block has a **stable ID** that persists across edits. Always use block IDs (not indexes) when editing.

### Available block types

`paragraph`, `heading`, `codeBlock`, `blockquote`, `bulletList`, `orderedList`,
`taskList`, `horizontalRule`, `table`, `callout`, `toggle`, `image`

### Available marks

`bold`, `italic`, `strike`, `code`, `underline`, `link`, `highlight`,
`textStyle` (for color), `color`

### Block examples

**Heading** (levels 1–6):
```json
{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section Title" }] }
```

**Paragraph with mixed formatting:**
```json
{ "type": "paragraph", "content": [
  { "type": "text", "text": "This is " },
  { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] },
  { "type": "text", "text": " and " },
  { "type": "text", "text": "italic", "marks": [{ "type": "italic" }] },
  { "type": "text", "text": " text." }
] }
```

**Link within a paragraph:**
```json
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Visit " },
  { "type": "text", "text": "our site", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] },
  { "type": "text", "text": " for details." }
] }
```

**Multiple marks on the same text** (bold + italic):
```json
{ "type": "text", "text": "important", "marks": [{ "type": "bold" }, { "type": "italic" }] }
```

**Highlighted text with color:**
```json
{ "type": "text", "text": "highlighted", "marks": [{ "type": "highlight", "attrs": { "color": "#fef08a" } }] }
```

**Colored text:**
```json
{ "type": "text", "text": "red text", "marks": [{ "type": "textStyle", "attrs": { "color": "#ef4444" } }] }
```

**Inline code:**
```json
{ "type": "text", "text": "const x = 1", "marks": [{ "type": "code" }] }
```

**Code block with syntax highlighting:**
```json
{ "type": "codeBlock", "attrs": { "language": "python" }, "content": [{ "type": "text", "text": "def greet(name):\n    print(f\"Hello {name}\")" }] }
```

**Blockquote:**
```json
{ "type": "blockquote", "content": [
  { "type": "paragraph", "content": [{ "type": "text", "text": "This is a quote." }] }
] }
```

**Bullet list** (multiple items):
```json
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First item" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second item" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Third item" }] }] }
] }
```

**Ordered list:**
```json
{ "type": "orderedList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step one" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step two" }] }] }
] }
```

**Task list** (with checkboxes):
```json
{ "type": "taskList", "content": [
  { "type": "taskItem", "attrs": { "checked": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Incomplete task" }] }] },
  { "type": "taskItem", "attrs": { "checked": true }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Done task" }] }] }
] }
```

**Table** (3 columns, header row + data row):
```json
{ "type": "table", "content": [
  { "type": "tableRow", "content": [
    { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Name" }] }] },
    { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Role" }] }] },
    { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Status" }] }] }
  ] },
  { "type": "tableRow", "content": [
    { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Alice" }] }] },
    { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Engineer" }] }] },
    { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Active" }] }] }
  ] }
] }
```

**Callout** (variants: info, warning, error, success):
```json
{ "type": "callout", "attrs": { "variant": "warning", "emoji": "\u26a0\ufe0f" }, "content": [{ "type": "text", "text": "This is a warning note" }] }
```

**Toggle** (collapsible content):
```json
{ "type": "toggle", "attrs": { "summary": "Click to expand", "open": false }, "content": [
  { "type": "paragraph", "content": [{ "type": "text", "text": "Hidden content revealed on click." }] }
] }
```

**Image:**
```json
{ "type": "image", "attrs": { "src": "https://example.com/photo.jpg", "alt": "Description" } }
```

**Horizontal rule:**
```json
{ "type": "horizontalRule" }
```

### Formatting examples (using format_text_by_match)

| Action | Body |
|--------|------|
| Bold a word | `{ "text": "important", "mark": "bold" }` |
| Italicize a phrase | `{ "text": "see above", "mark": "italic" }` |
| Add a link | `{ "text": "click here", "mark": "link", "attrs": { "href": "https://example.com" } }` |
| Highlight text | `{ "text": "key point", "mark": "highlight", "attrs": { "color": "#fef08a" } }` |
| Color text red | `{ "text": "error", "mark": "textStyle", "attrs": { "color": "#ef4444" } }` |
| Strikethrough | `{ "text": "deprecated", "mark": "strike" }` |
| Underline | `{ "text": "underlined", "mark": "underline" }` |
| Inline code | `{ "text": "useState", "mark": "code" }` |
| Remove bold | `{ "text": "no longer bold", "mark": "bold", "remove": true }` |
| Second occurrence | `{ "text": "item", "mark": "bold", "occurrence": 2 }` |

---

## Tools

### read_document
Read the full document. Returns all blocks as ProseMirror JSON with stable IDs.
```
GET /sessions/:id/document
```
Returns: `{ blocks: [{ id, index, json }] }`

### read_block
Read a single block by its stable ID. Returns ProseMirror JSON.
```
GET /sessions/:id/blocks/:block_id
```
Returns: `{ id, json }`

### insert_block
Insert a rich-text block at a position using ProseMirror JSON.
```
POST /sessions/:id/blocks
{ "index": 0, "block": { "type": "paragraph", "content": [...] } }
```
Use `index: -1` to append at the end. Returns the new block's `block_id`.

**Plain-text shorthand** (no formatting needed):
```
POST /sessions/:id/blocks
{ "index": 0, "type": "paragraph", "content": "Hello world" }
```

### update_block (plain text)
Replace a block's text content. Does not support marks — use `replace_block` for rich text.
```
PUT /sessions/:id/blocks/:block_id
{ "content": "Updated text" }
```

### replace_block (rich text)
Replace a block's entire content with new ProseMirror JSON. Use for restructuring a block.
```
PUT /sessions/:id/blocks/:block_id
{ "block": { "type": "paragraph", "content": [{ "type": "text", "text": "New content", "marks": [{ "type": "bold" }] }] } }
```

### format_text_by_match (preferred for formatting)
Apply or remove a mark on specific text within a block. Specify the text string instead of counting character offsets. Works with nested blocks (lists, blockquotes, toggles) automatically.
```
POST /sessions/:id/blocks/:block_id/format-by-match
{ "text": "welcome", "mark": "bold" }
```
- `text` — the exact text to format (case-sensitive)
- `mark` — mark type name (bold, italic, link, etc.)
- `attrs` — mark attributes (e.g., `{ "href": "https://..." }` for link)
- `occurrence` — which occurrence if the text appears multiple times (1-based, default: 1)
- `remove` — set to `true` to remove the mark instead

### format_text (offset-based)
Apply or remove a mark on a text range using character offsets. Prefer `format_text_by_match` instead — it's more reliable.
```
POST /sessions/:id/blocks/:block_id/format
{ "start": 0, "length": 5, "mark": "bold" }
```
- `start` — character offset (0-based)
- `length` — number of characters
- `mark` — mark type name (bold, italic, link, etc.)
- `attrs` — mark attributes (e.g., `{ "href": "https://..." }` for link)
- `remove` — set to `true` to remove the mark instead

### delete_block
Remove a block by its stable ID.
```
DELETE /sessions/:id/blocks/:block_id
```

### move_block
Move a block to a new position by its stable ID.
```
POST /sessions/:id/blocks/:block_id/move
{ "to_index": 0 }
```

### replace_text
Find and replace text within a block by its stable ID.
```
POST /sessions/:id/blocks/:block_id/replace
{ "search": "old text", "replacement": "new text" }
```

---

## Page management

You can also list and reorder pages in the workspace.

### list_pages
List all pages in the workspace with their IDs, titles, and positions.
```
GET /sessions/:id/pages
```
Returns: `{ pages: [{ id, title, icon, parent_id, position, is_favorite }] }`

### move_page
Move a page to a new position among its siblings.
```
POST /sessions/:id/pages/move
{ "page_id": "...", "after_page_id": "..." }
```
- `page_id` — the page to move (required)
- `after_page_id` — place after this page (omit or `null` for first position)
- `parent_id` — new parent page ID (omit to keep at root level, or set to a page ID for nesting)

---

## Editing workflow

1. Call `read_document` first to understand the current structure, formatting, and block IDs.
2. Use block IDs for all edits. Block IDs are stable even when other collaborators add or remove blocks.
3. **For adding formatted content**: use `insert_block` with ProseMirror JSON.
4. **For formatting existing text**: use `format_text_by_match` — specify the text string you want to format rather than counting character offsets.
5. **For replacing entire blocks**: use `replace_block` (PUT with `block` field).
6. **For simple text changes**: use `replace_text` for find-and-replace, or `update_block` for full text replacement.
7. Re-read after edits if you need to verify or continue editing.
8. Disconnect when done.

### Tips
- **Always use `format_text_by_match`** for adding/removing marks on existing text. It finds text by content rather than character offsets, and works with nested structures like lists and toggles.
- When building a list, send the entire list as one `insert_block` call with nested `listItem` children.
- The `callout` block supports variants: `info`, `warning`, `error`, `success`.
- If the same text appears multiple times in a block, use the `occurrence` parameter to target the right one.
