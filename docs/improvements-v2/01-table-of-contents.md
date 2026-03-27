# Table of Contents / Document Outline

## Problem

Long documents are unusable without navigation. Users scroll endlessly looking for sections, lose their place, and can't quickly share "look at section X" references. Every serious document editor (Notion, Google Docs, Confluence) has an auto-generated outline. Without it, Motion can't serve as a daily-driver for long-form content like specs, RFCs, or meeting notes.

## Priority

~1-2 days of effort. Small scope, high daily impact. Should ship early.

## What to Build

### 1. Auto-generated heading outline panel

Add a `TableOfContents` component that reads the document's heading structure (h1, h2, h3) in real time from the TipTap editor instance.

Display as a collapsible panel on the left side of the editor area (or as a floating overlay toggled from the top bar):

- Nested list reflecting heading hierarchy (h1 > h2 > h3)
- Each entry shows the heading text (truncated to ~60 chars)
- Click an entry to smooth-scroll to that heading in the editor
- Current section highlighted based on scroll position (intersection observer or scroll offset)
- Updates live as the document is edited (headings added, removed, renamed)

### 2. Toggle button in editor top bar

Add a TOC toggle button in the `EditorPage` top bar (alongside the existing comments, versions, and export buttons):

- Icon: list/outline icon
- Tooltip: "Table of contents"
- Toggles the outline panel visibility
- State persisted in localStorage per user

### 3. Reading the heading structure

Use the TipTap editor API to extract headings:

```typescript
const headings: { level: number; text: string; id: string; pos: number }[] = [];
editor.state.doc.descendants((node, pos) => {
  if (node.type.name === "heading") {
    headings.push({
      level: node.attrs.level,
      text: node.textContent,
      id: node.attrs.blockId, // stable block UUID
      pos,
    });
  }
});
```

Re-run on every editor `update` event (debounced 300ms for performance).

### 4. Scroll-to-heading

When the user clicks a TOC entry:

```typescript
const pos = editor.state.doc.resolve(headingPos);
editor.commands.setTextSelection(pos);
editor.commands.scrollIntoView();
```

Or use `document.querySelector(`[data-block-id="${blockId}"]`)?.scrollIntoView({ behavior: 'smooth' })` if block IDs are rendered as data attributes.

### 5. Active section tracking

Use an `IntersectionObserver` on heading elements (or compute from scroll position) to highlight the current section in the TOC panel. This provides a "you are here" indicator as the user scrolls.

### 6. MCP server support (stretch)

Add a `read_outline` MCP tool that returns the heading structure with block IDs. This lets agents navigate by section name:

```json
[
  { "level": 1, "text": "Introduction", "blockId": "abc-123" },
  { "level": 2, "text": "Background", "blockId": "def-456" }
]
```

## Files to Modify

- `apps/web/src/components/editor/TableOfContents.tsx` (new) -- outline panel component
- `apps/web/src/components/editor/EditorPage.tsx` -- add TOC toggle button + panel to layout
- `apps/web/src/hooks/useTableOfContents.ts` (new) -- extract headings from editor, track active section
- `apps/mcp-server/src/tools.ts` -- add `read_outline` tool (stretch)
- `apps/mcp-server/src/yjs-peer.ts` -- add `readOutline()` method (stretch)

## Verification

1. Open a document with multiple headings (h1, h2, h3) -> TOC panel shows the heading tree
2. Click a TOC entry -> editor scrolls to that heading
3. Scroll through document -> TOC highlights the current section
4. Add/remove/rename a heading -> TOC updates within 1 second
5. Close and reopen the TOC panel -> state persisted
6. Document with no headings -> TOC panel shows empty state ("No headings in this document")
7. (Stretch) Call `read_outline` MCP tool -> returns heading list with block IDs

## Dependencies

None. Uses only existing TipTap editor APIs and stable block IDs already in the document.
