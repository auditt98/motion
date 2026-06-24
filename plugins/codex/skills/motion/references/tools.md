<!-- GENERATED FILE — do not edit by hand.
     Source: packages/shared/src/skill.ts
     Regenerate: pnpm --filter @motion/shared generate:agent-docs -->

# Motion MCP tools

The connected `motion` MCP server exposes these tools; each tool's own description (with
parameters) is authoritative. Tools marked _requires an open document_ need
`create_and_edit_page` or `switch_document` first.

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

## Edit mode

Every editing tool accepts `mode`: `"suggest"` (default — reviewable) or `"direct"` (applied
immediately). Stick with `"suggest"` unless the user asks otherwise.
