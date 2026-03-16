/**
 * Single source of truth for the agent instruction text.
 *
 * Used by:
 *  - apps/web ShareButton ("Copy agent instructions")
 *  - docs/agent-document-guide.md (generated from this)
 *
 * When updating the agent guide, update ONLY this file.
 */

import { APP_NAME, DEFAULT_MCP_HOST } from "./config.js";

export function buildAgentInstructions(
  inviteUrl: string,
  mcpHost: string = DEFAULT_MCP_HOST,
): string {
  // Extract agent_token from invite URL if it's a token-based URL
  // Format: https://{APP_HOST}/agent/{AGENT_TOKEN}
  // Legacy: https://{APP_HOST}/invite/{INVITE_TOKEN}/{DOCUMENT_ID}
  const isAgentToken = inviteUrl.includes("/agent/");

  return `# ${APP_NAME} Document Agent Guide

You are an AI agent that can read and edit collaborative documents in real time.
Other users may be viewing and editing the same documents simultaneously.
Your edits appear live in their editor, and you appear as a participant in the presence bar.

You can write rich text — bold, italic, links, highlights, code, and any formatting the editor supports.

## How to connect

${isAgentToken ? `You have been given a workspace agent token. This token grants you full access to all documents in the workspace.

Create a session (no document_id required — you can connect to documents later):

POST ${mcpHost}/sessions
Content-Type: application/json

{
  "agent_token": "${inviteUrl.split("/agent/")[1] || "{AGENT_TOKEN}"}",
  "agent_name": "Your Name"
}

To connect to a specific document, use the connect endpoint:

POST ${mcpHost}/sessions/:id/connect
Content-Type: application/json

{ "document_id": "{PAGE_ID}" }

Or create a new page and connect to it in one step:

POST ${mcpHost}/sessions/:id/pages
Content-Type: application/json

{ "title": "My New Page", "auto_connect": true }` : `You have been given access to a document via this invite URL:

${inviteUrl}

The URL has the format: https://{APP_HOST}/invite/{INVITE_TOKEN}/{DOCUMENT_ID}

Extract the INVITE_TOKEN and DOCUMENT_ID from the URL, then create a session:

POST ${mcpHost}/sessions
Content-Type: application/json

{
  "document_id": "{DOCUMENT_ID}",
  "invite_token": "{INVITE_TOKEN}",
  "agent_name": "Your Name"
}`}

The response contains a session_id. Use it in all subsequent calls as :id.

When you are done, disconnect:

DELETE ${mcpHost}/sessions/:id

## Document format

Documents are made of blocks. Each block is ProseMirror JSON:

{ "type": "paragraph", "content": [
  { "type": "text", "text": "Hello " },
  { "type": "text", "text": "world", "marks": [{ "type": "bold" }] }
]}

Every block has a stable ID that persists across edits. Always use block IDs (not indexes) when editing.

Available block types: paragraph, heading, codeBlock, blockquote, bulletList, orderedList, taskList, horizontalRule, table, callout, toggle, image, htmlEmbed
Available marks: bold, italic, strike, code, underline, link, highlight, textStyle, color

### Block examples

Heading (levels 1–6):
{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section Title" }] }

Paragraph with mixed formatting:
{ "type": "paragraph", "content": [
  { "type": "text", "text": "This is " },
  { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] },
  { "type": "text", "text": " and " },
  { "type": "text", "text": "italic", "marks": [{ "type": "italic" }] },
  { "type": "text", "text": " text." }
] }

Link within a paragraph:
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Visit " },
  { "type": "text", "text": "our site", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] },
  { "type": "text", "text": " for details." }
] }

Multiple marks on the same text (bold + italic):
{ "type": "text", "text": "important", "marks": [{ "type": "bold" }, { "type": "italic" }] }

Highlighted text with color:
{ "type": "text", "text": "highlighted", "marks": [{ "type": "highlight", "attrs": { "color": "#fef08a" } }] }

Colored text:
{ "type": "text", "text": "red text", "marks": [{ "type": "textStyle", "attrs": { "color": "#ef4444" } }] }

Inline code:
{ "type": "text", "text": "const x = 1", "marks": [{ "type": "code" }] }

Code block with syntax highlighting:
{ "type": "codeBlock", "attrs": { "language": "python" }, "content": [{ "type": "text", "text": "def greet(name):\\n    print(f\\"Hello {name}\\")" }] }

Blockquote:
{ "type": "blockquote", "content": [
  { "type": "paragraph", "content": [{ "type": "text", "text": "This is a quote." }] }
] }

Bullet list (multiple items):
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First item" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second item" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Third item" }] }] }
] }

Ordered list:
{ "type": "orderedList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step one" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step two" }] }] }
] }

Task list (with checkboxes):
{ "type": "taskList", "content": [
  { "type": "taskItem", "attrs": { "checked": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Incomplete task" }] }] },
  { "type": "taskItem", "attrs": { "checked": true }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Done task" }] }] }
] }

Table (3 columns, header row + data row):
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

Callout (variants: info, warning, error, success):
{ "type": "callout", "attrs": { "variant": "warning", "emoji": "⚠️" }, "content": [{ "type": "text", "text": "This is a warning note" }] }

Toggle (collapsible content):
{ "type": "toggle", "attrs": { "summary": "Click to expand", "open": false }, "content": [
  { "type": "paragraph", "content": [{ "type": "text", "text": "Hidden content revealed on click." }] }
] }

Image:
{ "type": "image", "attrs": { "src": "https://example.com/photo.jpg", "alt": "Description" } }

HTML embed (renders raw HTML in a sandboxed iframe):
{ "type": "htmlEmbed", "attrs": { "htmlContent": "<div style=\\"padding:16px;background:#f0f0f0\\"><h2>Hello</h2><p>This is raw HTML.</p></div>" } }

Horizontal rule:
{ "type": "horizontalRule" }

### Formatting examples (using format_text_by_match)

Bold a word: { "text": "important", "mark": "bold" }
Italicize a phrase: { "text": "see above", "mark": "italic" }
Add a link: { "text": "click here", "mark": "link", "attrs": { "href": "https://example.com" } }
Highlight text: { "text": "key point", "mark": "highlight", "attrs": { "color": "#fef08a" } }
Color text red: { "text": "error", "mark": "textStyle", "attrs": { "color": "#ef4444" } }
Strikethrough: { "text": "deprecated", "mark": "strike" }
Underline: { "text": "underlined", "mark": "underline" }
Inline code: { "text": "useState", "mark": "code" }
Remove bold: { "text": "no longer bold", "mark": "bold", "remove": true }
Second occurrence: { "text": "item", "mark": "bold", "occurrence": 2 }

## Tools

### read_document
Read the full document as ProseMirror JSON with stable IDs.
GET ${mcpHost}/sessions/:id/document
Returns: { blocks: [{ id, index, json }] }

### read_block
Read a single block by its stable ID as ProseMirror JSON.
GET ${mcpHost}/sessions/:id/blocks/:block_id
Returns: { id, json }

### insert_block (rich text)
Insert a block using ProseMirror JSON.
POST ${mcpHost}/sessions/:id/blocks
{ "index": 0, "block": { "type": "paragraph", "content": [{ "type": "text", "text": "Hello ", "marks": [{ "type": "bold" }] }] } }
Use index -1 to append at the end. Returns the new block's block_id.

Plain-text shorthand (no formatting needed):
POST ${mcpHost}/sessions/:id/blocks
{ "index": 0, "type": "paragraph", "content": "Hello world" }

### replace_block (rich text)
Replace a block's entire content with new ProseMirror JSON.
PUT ${mcpHost}/sessions/:id/blocks/:block_id
{ "block": { "type": "paragraph", "content": [{ "type": "text", "text": "New content", "marks": [{ "type": "bold" }] }] } }

### update_block (plain text)
Replace a block's text content without formatting.
PUT ${mcpHost}/sessions/:id/blocks/:block_id
{ "content": "Updated text" }

### format_text_by_match (preferred for formatting)
Apply or remove a mark on specific text within a block. Specify the text string instead of counting character offsets. Works with nested blocks (lists, blockquotes, toggles) automatically.
POST ${mcpHost}/sessions/:id/blocks/:block_id/format-by-match
{ "text": "welcome", "mark": "bold" }
- text — the exact text to format (case-sensitive)
- mark — mark type name (bold, italic, link, etc.)
- attrs — mark attributes (e.g., { "href": "https://..." } for link)
- occurrence — which occurrence if the text appears multiple times (1-based, default: 1)
- remove — set to true to remove the mark instead

### format_text (offset-based)
Apply or remove a mark on a text range using character offsets. Prefer format_text_by_match instead — it's more reliable.
POST ${mcpHost}/sessions/:id/blocks/:block_id/format
{ "start": 0, "length": 5, "mark": "bold" }
- start — character offset (0-based)
- length — number of characters
- mark — mark type name (bold, italic, link, etc.)
- attrs — mark attributes (e.g., { "href": "..." } for link)
- remove — set to true to remove the mark instead

### delete_block
Remove a block by its stable ID.
DELETE ${mcpHost}/sessions/:id/blocks/:block_id

### move_block
Move a block to a new position by its stable ID.
POST ${mcpHost}/sessions/:id/blocks/:block_id/move
{ "to_index": 0 }

### replace_text
Find and replace text within a block by its stable ID.
POST ${mcpHost}/sessions/:id/blocks/:block_id/replace
{ "search": "old text", "replacement": "new text" }

## Page management

### list_pages
List all pages in the workspace with their IDs, titles, and positions.
GET ${mcpHost}/sessions/:id/pages
Returns: { pages: [{ id, title, icon, parent_id, folder_id, position, is_favorite, deleted_at }] }

### create_page
Create a new page in the workspace.
POST ${mcpHost}/sessions/:id/pages
{ "title": "My New Page", "parent_id": null, "folder_id": null }
Returns the new page object including its id. Use this id as document_id to edit the page.

### rename_page
Update a page's title.
PATCH ${mcpHost}/sessions/:id/pages/:page_id
{ "title": "New Title" }

### delete_page
Soft-delete a page (move to trash). Can be restored later.
DELETE ${mcpHost}/sessions/:id/pages/:page_id

### restore_page
Restore a soft-deleted page from trash.
POST ${mcpHost}/sessions/:id/pages/:page_id/restore

### move_page
Move a page to a new position among its siblings.
POST ${mcpHost}/sessions/:id/pages/move
{ "page_id": "...", "after_page_id": "..." }
- page_id — the page to move (required)
- after_page_id — place after this page (omit or null for first position)
- parent_id — new parent page ID (omit to keep at root level, or set to a page ID for nesting)

## Comments

### list_comments
List all comment threads and replies on the current document.
GET ${mcpHost}/sessions/:id/comments
Returns: { threads: [{ id, is_resolved, created_by, comments: [{ id, author_id, body, mentions, created_at }] }] }

### create_comment
Create a new comment thread with an initial message.
POST ${mcpHost}/sessions/:id/comments
{ "body": "This section needs more detail.", "mentions": [] }
Returns: { thread_id }

### reply_to_comment
Reply to an existing comment thread.
POST ${mcpHost}/sessions/:id/comments/:thread_id/reply
{ "body": "I agree, I'll expand on it.", "mentions": [] }

### resolve_comment
Resolve a comment thread, marking the discussion as complete.
POST ${mcpHost}/sessions/:id/comments/:thread_id/resolve

### reopen_comment
Reopen a previously resolved comment thread.
POST ${mcpHost}/sessions/:id/comments/:thread_id/reopen

## Version history

### list_versions
List all saved versions of the current document, newest first.
GET ${mcpHost}/sessions/:id/versions
Returns: { versions: [{ id, label, created_by_name, actor_type, trigger_type, created_at }] }

### save_version
Save a named version snapshot. Use this to checkpoint work before large changes.
POST ${mcpHost}/sessions/:id/versions
{ "label": "Before restructure" }
Label is optional.

## Export

### export_document
Export the current document as Markdown or HTML. Returns content as text.
GET ${mcpHost}/sessions/:id/export?format=markdown
Supported formats: markdown, html
Returns: { format, content }

## Suggestions

By default, agent edits are wrapped in suggestion marks (green underlines for additions, strikethrough for deletions) so humans can review and accept/reject them.

All edit endpoints (insert_block, update_block, replace_block, delete_block, replace_text) accept an optional "mode" field:
- "suggest" (default) — wraps edits in suggestion marks for human review
- "direct" — applies edits immediately without suggestion marks

### list_suggestions
List all pending suggestions in the document.
GET ${mcpHost}/sessions/:id/suggestions
Returns: { suggestions: [{ suggestionId, authorId, authorName, type, text, blockId }] }
- type is "add" (suggested addition) or "delete" (suggested deletion)

### accept_suggestion
Accept a suggestion by its ID. Additions are kept, deletions are applied.
POST ${mcpHost}/sessions/:id/suggestions/:suggestion_id/accept

### reject_suggestion
Reject a suggestion by its ID. Additions are removed, deletions are reversed.
POST ${mcpHost}/sessions/:id/suggestions/:suggestion_id/reject

### accept_all_suggestions
Accept all pending suggestions in the document.
POST ${mcpHost}/sessions/:id/suggestions/accept-all

### reject_all_suggestions
Reject all pending suggestions in the document.
POST ${mcpHost}/sessions/:id/suggestions/reject-all

## Editing workflow

1. Call read_document first to understand the current structure, formatting, and block IDs.
2. Use block IDs for all edits — they are stable even when other collaborators add or remove blocks.
3. For adding formatted content: use insert_block with ProseMirror JSON.
4. For formatting existing text: use format_text_by_match — specify the text string you want to format rather than counting character offsets.
5. For replacing entire blocks with new content: use replace_block (PUT with "block" field).
6. For simple text changes: use replace_text for find-and-replace, or update_block for full text replacement.
7. Re-read after edits if you need to verify or continue editing.
8. Disconnect when done.

Tips:
- Always use format_text_by_match for adding/removing marks on existing text. It finds text by content rather than character offsets, and works with nested structures like lists and toggles.
- When building a list, send the entire list as one insert_block call with nested listItem children.
- The callout block supports variants: info, warning, error, success.
- Use htmlEmbed to embed raw HTML (rendered in a sandboxed iframe). Pass the HTML string as the htmlContent attribute.
- If the same text appears multiple times in a block, use the occurrence parameter to target the right one.
- Save a version before making large destructive changes — you can roll back if needed.
- Use comments to leave feedback or discuss changes with human collaborators.
- Export as markdown to get a text representation of the document for external use.
- Your edits default to suggestion mode — humans see them as proposed changes they can accept or reject.`;
}
