/**
 * Single source of truth for the Motion agent **skill** + the MCP server's
 * `instructions`, and the generated `docs/agent-document-guide.md`.
 *
 * Edit this file, then run `pnpm --filter @motion/shared generate:agent-docs`
 * to regenerate:
 *   - skills/motion/SKILL.md (+ references)
 *   - plugins/claude/skills/motion/* and plugins/codex/skills/motion/*
 *   - docs/agent-document-guide.md
 *
 * The MCP server imports `MCP_SERVER_INSTRUCTIONS` directly so the server's
 * initialize `instructions` field stays in sync with the skill.
 */
import { APP_NAME } from "./config.js";

/** User-facing block types the agent can create (the connected tools expose the live list). */
export const SKILL_BLOCK_TYPES = [
  "paragraph",
  "heading (levels 1–6)",
  "bulletList / orderedList / taskList",
  "blockquote",
  "codeBlock (with language)",
  "callout (variant: info | warning | error | success)",
  "toggle (collapsible)",
  "table",
  "image",
  "htmlEmbed",
  "horizontalRule",
] as const;

/** User-facing inline marks. */
export const SKILL_MARKS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link (attrs: { href })",
  "highlight (attrs: { color })",
  "textStyle + color (attrs: { color })",
] as const;

/** The MCP tool catalogue, grouped. Names match `registerAllTools` in the server. */
export const SKILL_TOOLS: { group: string; needsDoc: boolean; tools: [string, string][] }[] = [
  {
    group: "Find & open",
    needsDoc: false,
    tools: [
      ["list_pages", "List pages in the workspace (ids, titles, positions)."],
      ["search_workspace", "Full-text + semantic search for pages by content/title."],
      ["create_and_edit_page", "Create a page and connect to it in one step (start here for new docs)."],
      ["switch_document", "Connect to an existing page by id (open it for editing)."],
      ["list_folders", "List folders."],
      ["create_folder / rename_folder / delete_folder", "Manage folders."],
      ["create_page / rename_page / delete_page / restore_page / move_page", "Manage pages without opening them."],
    ],
  },
  {
    group: "Read (after a document is open)",
    needsDoc: true,
    tools: [
      ["read_outline", "Heading structure — read this first to navigate."],
      ["read_document", "Full document as ProseMirror JSON with stable block IDs."],
      ["read_block", "One block by its stable ID."],
    ],
  },
  {
    group: "Edit (by stable block ID)",
    needsDoc: true,
    tools: [
      ["insert_block", "Insert a rich block from ProseMirror JSON."],
      ["insert_block_simple", "Insert a plain-text block of a given type."],
      ["update_block", "Replace a block's text content (keeps type/position)."],
      ["replace_block", "Replace a block's entire content with new JSON (destructive)."],
      ["format_text_by_match", "PREFERRED formatting — apply/remove a mark on matched text."],
      ["format_text", "Apply/remove a mark by character offsets (fallback)."],
      ["replace_text", "Find-and-replace text within one block."],
      ["delete_block", "Delete a block."],
      ["move_block", "Move a block to a new index."],
    ],
  },
  {
    group: "Suggestions",
    needsDoc: true,
    tools: [
      ["list_suggestions", "List pending suggestions (id, author, add/delete, text)."],
      ["accept_suggestion / reject_suggestion", "Resolve one suggestion by id."],
      ["accept_all_suggestions / reject_all_suggestions", "Resolve all pending suggestions."],
    ],
  },
  {
    group: "Comments",
    needsDoc: true,
    tools: [
      ["list_comments", "List comment threads on the open page."],
      ["create_comment / reply_to_comment", "Start or reply to a thread."],
      ["resolve_comment / reopen_comment", "Close or reopen a thread."],
    ],
  },
  {
    group: "Versions & export",
    needsDoc: true,
    tools: [
      ["save_version", "Checkpoint a named snapshot before large changes."],
      ["list_versions / get_version", "List or read version snapshots."],
      ["export_document", "Export the open document as Markdown or HTML."],
    ],
  },
  {
    group: "Databases",
    needsDoc: true,
    tools: [
      ["read_database_schema / read_database_rows", "Read columns and rows."],
      ["insert_database_row / update_database_cell / delete_database_row", "Edit rows/cells."],
      ["add_database_column / update_database_column", "Edit columns."],
      ["list_inline_databases", "List database blocks embedded in the open document."],
    ],
  },
];

/** Concise instructions injected into the MCP server's initialize result. */
export const MCP_SERVER_INSTRUCTIONS = `${APP_NAME} is a real-time collaborative document workspace. You join documents as a live peer alongside human editors; your cursor and edits appear to them instantly.

WORKFLOW: Use list_pages or search_workspace to find a page, then create_and_edit_page (new) or switch_document (existing) to open it before reading or editing content. Use read_outline / read_document to understand structure, then edit by STABLE BLOCK ID (never array index).

EDITS DEFAULT TO "suggest" MODE — they appear as reviewable suggestions (green = added, struck = deleted) that humans accept or reject. Pass mode:"direct" only when the user explicitly asks to apply changes immediately. Prefer format_text_by_match (match text) over format_text (offsets). Save a version before large destructive changes.`;

/** Frontmatter `description` — both Claude and Codex use this to decide when to load the skill. */
export const SKILL_DESCRIPTION = `Use when working with a ${APP_NAME} document workspace through the connected "motion" MCP tools — creating or editing pages and documents, formatting rich text, leaving or resolving comments, reviewing or making suggestions, managing folders, searching the workspace, saving versions, exporting, or editing databases. Explains the block model (ProseMirror JSON + stable block IDs), suggestion-mode etiquette, and the read → edit → verify workflow.`;

const GENERATED_BANNER = `<!-- GENERATED FILE — do not edit by hand.
     Source: packages/shared/src/skill.ts
     Regenerate: pnpm --filter @motion/shared generate:agent-docs -->`;

function toolTable(): string {
  const lines: string[] = [];
  for (const { group, needsDoc, tools } of SKILL_TOOLS) {
    lines.push(`\n### ${group}${needsDoc ? " — _requires an open document_" : ""}\n`);
    lines.push("| Tool | What it does |");
    lines.push("| --- | --- |");
    for (const [name, desc] of tools) lines.push(`| \`${name}\` | ${desc} |`);
  }
  return lines.join("\n");
}

/** The skill body (without frontmatter). */
function skillBody(): string {
  return `# ${APP_NAME} document agent

You are connected to **${APP_NAME}**, a real-time collaborative document workspace, through
the \`motion\` MCP tools. Your edits appear **live** in the user's browser and you show up in
the presence bar next to human collaborators. You don't manage tokens, sessions, or HTTP —
the MCP connection handles auth and lifecycle. Just call the tools.

## The mental model

- A document is an ordered list of **blocks**. Every block has a **stable block ID** (UUID).
  Always target edits by block ID — never by array index. IDs survive concurrent edits.
- Block content is **ProseMirror JSON**: \`{ "type": "...", "attrs": {...}, "content": [...] }\`.
  Text nodes carry inline **marks** for formatting.
- You must **open a document** before reading or editing its content. Page/folder/search
  tools work without one.

Block types: ${SKILL_BLOCK_TYPES.join(", ")}.
Inline marks: ${SKILL_MARKS.join(", ")}.
(The connected tools advertise the authoritative, live list in their descriptions.)

## Core workflow

1. **Find** the page — \`list_pages\` or \`search_workspace\`.
2. **Open** it — \`switch_document\` (existing) or \`create_and_edit_page\` (new). This connects you.
3. **Read** before editing — \`read_outline\`, then \`read_document\` to get blocks + their IDs.
4. **Edit by block ID** — insert/update/move/delete blocks; use \`format_text_by_match\` to
   apply marks by matching the text (preferred over offset-based \`format_text\`).
5. **Verify** — re-read if you'll keep editing, or \`export_document\` to confirm the result.

## Suggestion mode (important)

Edits default to **\`mode: "suggest"\`** — they render as suggestions (green = additions,
struck-through = deletions) that humans accept or reject. This is the polite default for
collaborative editing. Pass **\`mode: "direct"\`** only when the user explicitly asks to apply
changes immediately. You can also \`list_suggestions\` and accept/reject them.

## Tools
${toolTable()}

## Tips

- Open a page (\`create_and_edit_page\` / \`switch_document\`) **before** any read/edit tool —
  otherwise you'll get "No document is connected."
- Always \`read_document\` first to learn block IDs and structure.
- Prefer \`format_text_by_match\`; if the same text repeats, pass the \`occurrence\` number.
- Build a whole list in **one** \`insert_block\` call (a single \`bulletList\`/\`orderedList\` node).
- \`save_version\` before large or destructive changes.
- Callouts take a \`variant\`: info | warning | error | success.
- You can only reach documents in your authorized workspace; scope is enforced server-side.
- For exact ProseMirror JSON shapes, see \`references/block-format.md\`; for the full tool
  list, see \`references/tools.md\`.`;
}

/** Full SKILL.md content (frontmatter + body). */
export function buildSkillMarkdown(): string {
  const frontmatter = `---
name: motion
description: ${SKILL_DESCRIPTION}
---`;
  return `${frontmatter}\n\n${skillBody()}\n`;
}

/** references/block-format.md */
export function buildBlockFormatReference(): string {
  return `${GENERATED_BANNER}

# Block format reference (ProseMirror JSON)

Every block is a ProseMirror node. Text lives in \`content\` as \`text\` nodes with optional \`marks\`.

## Headings & paragraphs
\`\`\`json
{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] }
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Plain and " },
  { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] }
] }
\`\`\`

## Marks (inline formatting)
\`\`\`json
{ "type": "text", "text": "link", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] }
{ "type": "text", "text": "warn", "marks": [{ "type": "highlight", "attrs": { "color": "#fef08a" } }] }
{ "type": "text", "text": "red",  "marks": [{ "type": "textStyle", "attrs": { "color": "#dc2626" } }] }
\`\`\`
Available marks: ${SKILL_MARKS.join(", ")}.

## Lists (send the whole list as one block)
\`\`\`json
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second" }] }] }
] }
\`\`\`
Task lists use \`taskList\` → \`taskItem\` (\`attrs: { checked: boolean }\`).

## Code, quote, callout, toggle
\`\`\`json
{ "type": "codeBlock", "attrs": { "language": "ts" }, "content": [{ "type": "text", "text": "const x = 1;" }] }
{ "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Quoted" }] }] }
{ "type": "callout", "attrs": { "variant": "info", "emoji": "ℹ️" }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Note" }] }] }
{ "type": "toggle", "attrs": { "summary": "Details", "open": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Hidden" }] }] }
\`\`\`

## Media & embeds
\`\`\`json
{ "type": "image", "attrs": { "src": "https://…", "alt": "Diagram" } }
{ "type": "htmlEmbed", "attrs": { "htmlContent": "<iframe …></iframe>", "height": 400 } }
{ "type": "horizontalRule" }
\`\`\`
`;
}

/** references/tools.md */
export function buildToolReference(): string {
  return `${GENERATED_BANNER}

# ${APP_NAME} MCP tools

The connected \`motion\` MCP server exposes these tools; each tool's own description (with
parameters) is authoritative. Tools marked _requires an open document_ need
\`create_and_edit_page\` or \`switch_document\` first.
${toolTable()}

## Edit mode

Every editing tool accepts \`mode\`: \`"suggest"\` (default — reviewable) or \`"direct"\` (applied
immediately). Stick with \`"suggest"\` unless the user asks otherwise.
`;
}

/** docs/agent-document-guide.md — human-readable mirror of the skill. */
export function buildAgentDocMarkdown(): string {
  return `${GENERATED_BANNER}

${skillBody()}

---

${buildBlockFormatReference().replace(GENERATED_BANNER + "\n\n", "")}

---

${buildToolReference().replace(GENERATED_BANNER + "\n\n", "")}
`;
}
