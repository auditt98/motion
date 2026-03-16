# Suggestion Mode (Tracked Changes)

## Problem

There is no way to propose edits without directly applying them. In a collaborative environment — especially with AI agents — users need a "Suggesting" mode (like Google Docs) where changes appear as proposals with Accept/Reject controls. The competitor Proof already ships this feature. Without it, AI agent edits are direct and uncontrolled, which undermines trust.

## Priority

**Sprint 4.** ~3–5 days of effort. Highest competitive impact — this is the key differentiator for human-AI collaboration.

## What to Build

### 1. Suggestion mark extensions

Add two new marks to the TipTap schema in `packages/editor-extensions/`:

**`suggestion-add` mark** (proposed insertion):
- Attributes: `suggestionId` (uuid), `authorId`, `authorName`, `createdAt`
- Rendering: green background highlight, slight opacity
- Text inside this mark is proposed new content

**`suggestion-delete` mark** (proposed deletion):
- Attributes: `suggestionId` (uuid), `authorId`, `authorName`, `createdAt`
- Rendering: red background, strikethrough text
- Text inside this mark is proposed for removal

Both marks are CRDT-compatible — they travel through Yjs like any other mark, so suggestions sync in real-time across all peers.

### 2. Suggestion mode toggle

Add a mode toggle to the editor toolbar:

- **Editing** mode (default): edits apply directly as they do today
- **Suggesting** mode: all edits are wrapped in suggestion marks

Implementation: a ProseMirror plugin that intercepts transactions when in suggesting mode:

- **Typing new text**: wraps inserted characters in a `suggestion-add` mark
- **Deleting text**: instead of removing characters, wraps them in a `suggestion-delete` mark (text stays visible but is marked for deletion)
- **Replacing text**: combination of `suggestion-delete` on the old text + `suggestion-add` on the new text

The plugin groups consecutive edits by the same author into a single suggestion (same `suggestionId`).

### 3. Accept / Reject UI

**Inline popover** — clicking on suggested text shows a floating popover:
- Author avatar + name
- Timestamp
- "Accept" button (green checkmark)
- "Reject" button (red X)

**Accept behavior:**
- `suggestion-add`: remove the mark, keep the text (text becomes permanent)
- `suggestion-delete`: remove the mark AND the text (deletion is applied)

**Reject behavior:**
- `suggestion-add`: remove the mark AND the text (insertion is undone)
- `suggestion-delete`: remove the mark, keep the text (deletion is cancelled)

**Bulk actions in toolbar** (visible when suggestions exist):
- "Accept all" — accept every suggestion in the document
- "Reject all" — reject every suggestion
- "Accept all from [Author]" — filter by author

### 4. Suggestion count indicator

Show a badge in the editor header: "3 suggestions" — clickable to cycle through them.

### 5. Agent suggestion mode via MCP

Add a `mode` parameter to agent write tools in `apps/mcp-server/src/tools.ts`:

- `insert_block(... mode: "suggest")` — wraps the inserted content in `suggestion-add` marks
- `update_block(... mode: "suggest")` — wraps old content in `suggestion-delete`, new content in `suggestion-add`
- `replace_text(... mode: "suggest")` — same pattern

This lets users configure their AI agent to propose changes rather than apply them directly. The agent's suggestions appear like any human's — with the agent's name, timestamp, and accept/reject controls.

### 6. Suggestions persistence

Suggestions are marks in the Yjs document — they persist automatically through CRDT sync. No separate database table needed. They survive page reload, browser close, and peer sync.

Optionally: track suggestion count in `page_activity` for the dashboard feed ("Agent proposed 5 changes to Project Brief").

## Files to Modify

- `packages/editor-extensions/src/extensions.ts` — add `suggestion-add` and `suggestion-delete` marks
- `packages/editor-extensions/src/SuggestionModePlugin.ts` (new) — ProseMirror plugin for transaction interception
- `apps/web/src/components/editor/SuggestionPopover.tsx` (new) — accept/reject popover
- `apps/web/src/components/editor/EditorToolbar.tsx` — add mode toggle + bulk actions
- `apps/web/src/components/editor/EditorPage.tsx` — add suggestion count indicator
- `apps/mcp-server/src/tools.ts` — add `mode` parameter to write tools
- `apps/mcp-server/src/yjs-peer.ts` — implement suggestion mark application

## Verification

1. Toggle to Suggesting mode → type text → text appears with green highlight
2. Delete text in Suggesting mode → text gets red strikethrough instead of disappearing
3. Click a suggestion → popover appears with Accept/Reject
4. Accept an addition → green highlight disappears, text stays
5. Reject an addition → text and highlight both disappear
6. Accept a deletion → text disappears
7. Reject a deletion → strikethrough disappears, text stays
8. Suggestions sync in real-time between two browser tabs
9. Agent uses `mode: "suggest"` → suggestions appear with agent's name
10. "Accept all" → all suggestions resolved at once

## Dependencies

Best done after Sprints 1–3 (trust foundation), so users have safety nets when testing suggestion mode.
