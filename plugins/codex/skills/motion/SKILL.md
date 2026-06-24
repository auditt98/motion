---
name: motion
description: Use when working with a Motion document workspace through the connected "motion" MCP tools — creating or editing pages and documents, formatting rich text, leaving or resolving comments, reviewing or making suggestions, managing folders, searching the workspace, saving versions, exporting, or editing databases. Explains the block model (ProseMirror JSON + stable block IDs), suggestion-mode etiquette, and the read → edit → verify workflow.
---

# Motion document agent

You are connected to **Motion**, a real-time collaborative document workspace, through
the `motion` MCP tools. Your edits appear **live** in the user's browser and you show up in
the presence bar next to human collaborators. You don't manage tokens, sessions, or HTTP —
the MCP connection handles auth and lifecycle. Just call the tools.

## The mental model

- A document is an ordered list of **blocks**. Every block has a **stable block ID** (UUID).
  Always target edits by block ID — never by array index. IDs survive concurrent edits.
- Block content is **ProseMirror JSON**: `{ "type": "...", "attrs": {...}, "content": [...] }`.
  Text nodes carry inline **marks** for formatting.
- You must **open a document** before reading or editing its content. Page/folder/search
  tools work without one.

Block types: paragraph, heading (levels 1–6), bulletList / orderedList / taskList, blockquote, codeBlock (with language), callout (variant: info | warning | error | success), toggle (collapsible), table, image, htmlEmbed, horizontalRule.
Inline marks: bold, italic, underline, strike, code, link (attrs: { href }), highlight (attrs: { color }), textStyle + color (attrs: { color }).
(The connected tools advertise the authoritative, live list in their descriptions.)

## Core workflow

1. **Find** the page — `list_pages` or `search_workspace`.
2. **Open** it — `switch_document` (existing) or `create_and_edit_page` (new). This connects you.
3. **Read** before editing — `read_outline`, then `read_document` to get blocks + their IDs.
4. **Edit by block ID** — insert/update/move/delete blocks; use `format_text_by_match` to
   apply marks by matching the text (preferred over offset-based `format_text`).
5. **Verify** — re-read if you'll keep editing, or `export_document` to confirm the result.

## Suggestion mode (important)

Edits default to **`mode: "suggest"`** — they render as suggestions (green = additions,
struck-through = deletions) that humans accept or reject. This is the polite default for
collaborative editing. Pass **`mode: "direct"`** only when the user explicitly asks to apply
changes immediately. You can also `list_suggestions` and accept/reject them.

## Tools

### Find & open

| Tool | What it does |
| --- | --- |
| `list_pages` | List pages in the workspace (ids, titles, positions). |
| `search_workspace` | Full-text + semantic search for pages by content/title. |
| `create_and_edit_page` | Create a page and connect to it in one step (start here for new docs). |
| `switch_document` | Connect to an existing page by id (open it for editing). |
| `list_folders` | List folders. |
| `create_folder / rename_folder / delete_folder` | Manage folders. |
| `create_page / rename_page / delete_page / restore_page / move_page` | Manage pages without opening them. |

### Read (after a document is open) — _requires an open document_

| Tool | What it does |
| --- | --- |
| `read_outline` | Heading structure — read this first to navigate. |
| `read_document` | Full document as ProseMirror JSON with stable block IDs. |
| `read_block` | One block by its stable ID. |

### Edit (by stable block ID) — _requires an open document_

| Tool | What it does |
| --- | --- |
| `insert_block` | Insert a rich block from ProseMirror JSON. |
| `insert_block_simple` | Insert a plain-text block of a given type. |
| `update_block` | Replace a block's text content (keeps type/position). |
| `replace_block` | Replace a block's entire content with new JSON (destructive). |
| `format_text_by_match` | PREFERRED formatting — apply/remove a mark on matched text. |
| `format_text` | Apply/remove a mark by character offsets (fallback). |
| `replace_text` | Find-and-replace text within one block. |
| `delete_block` | Delete a block. |
| `move_block` | Move a block to a new index. |

### Suggestions — _requires an open document_

| Tool | What it does |
| --- | --- |
| `list_suggestions` | List pending suggestions (id, author, add/delete, text). |
| `accept_suggestion / reject_suggestion` | Resolve one suggestion by id. |
| `accept_all_suggestions / reject_all_suggestions` | Resolve all pending suggestions. |

### Comments — _requires an open document_

| Tool | What it does |
| --- | --- |
| `list_comments` | List comment threads on the open page. |
| `create_comment / reply_to_comment` | Start or reply to a thread. |
| `resolve_comment / reopen_comment` | Close or reopen a thread. |

### Versions & export — _requires an open document_

| Tool | What it does |
| --- | --- |
| `save_version` | Checkpoint a named snapshot before large changes. |
| `list_versions / get_version` | List or read version snapshots. |
| `export_document` | Export the open document as Markdown or HTML. |

### Databases — _requires an open document_

| Tool | What it does |
| --- | --- |
| `read_database_schema / read_database_rows` | Read columns and rows. |
| `insert_database_row / update_database_cell / delete_database_row` | Edit rows/cells. |
| `add_database_column / update_database_column` | Edit columns. |
| `list_inline_databases` | List database blocks embedded in the open document. |

## Tips

- Open a page (`create_and_edit_page` / `switch_document`) **before** any read/edit tool —
  otherwise you'll get "No document is connected."
- Always `read_document` first to learn block IDs and structure.
- Prefer `format_text_by_match`; if the same text repeats, pass the `occurrence` number.
- Build a whole list in **one** `insert_block` call (a single `bulletList`/`orderedList` node).
- `save_version` before large or destructive changes.
- Callouts take a `variant`: info | warning | error | success.
- You can only reach documents in your authorized workspace; scope is enforced server-side.
- For exact ProseMirror JSON shapes, see `references/block-format.md`; for the full tool
  list, see `references/tools.md`.
