# Page Links & Backlinks

## Problem

Pages are isolated — there's no way to link between documents or see which pages reference each other. Interconnected knowledge is the core value proposition of tools like Notion and Roam. Without links, Nexus is a collection of isolated documents rather than a connected knowledge base.

## Priority

**Sprint 9.** ~2–3 days of effort. High stickiness impact.

## What to Build

### 1. @page mention in editor

Add a `pageMention` inline node to the TipTap schema:

- Triggered by typing `@` followed by a page name (reuse the existing mention picker pattern from comments)
- Renders as a clickable chip/pill: `📄 Page Title`
- Attributes: `pageId`, `pageTitle`
- Clicking navigates to the linked page
- The mention picker should filter pages in the current workspace

### 2. Backlinks panel

When viewing a page, show a "Backlinks" section (in the sidebar or below the document):

- Lists all pages that contain a `pageMention` node pointing to the current page
- Each backlink shows: source page title, the surrounding text context
- Click to navigate to the source page

### 3. Backlink indexing

Two approaches:

**Option A — Query on demand:**
- When opening a page, scan all workspace pages' Yjs docs for `pageMention` nodes with matching `pageId`
- Expensive for large workspaces but simple to implement

**Option B — Database index (recommended):**
- Add a `page_links` table: `source_page_id`, `target_page_id`, `created_at`
- Update on each document save (extract all `pageMention` nodes, sync the link table)
- Query backlinks via: `SELECT * FROM page_links WHERE target_page_id = ?`

### 4. Link updates on page rename

When a page is renamed:
- Update `pageTitle` attribute in all `pageMention` nodes that reference it
- If using the database index, the `page_links` table is unaffected (references by ID)

### 5. Broken link handling

When a linked page is deleted (moved to trash):
- The mention chip shows a "Page deleted" state (greyed out, non-clickable)
- If the page is restored from trash, the link becomes active again

## Files to Modify

- `packages/editor-extensions/src/extensions.ts` — add `pageMention` node type
- `apps/web/src/components/editor/PageMentionPicker.tsx` (new) — page search dropdown
- `apps/web/src/components/editor/BacklinksPanel.tsx` (new)
- `supabase/migrations/014_page_links.sql` (new, if using Option B)
- `apps/web/src/hooks/useBacklinks.ts` (new)
- `apps/web/src/components/editor/EditorPage.tsx` — add backlinks panel

## Verification

1. Type `@` in editor → page picker appears → select a page → page mention chip inserted
2. Click the chip → navigates to the linked page
3. On the linked page → backlinks panel shows the source page
4. Rename the source page → mention chip updates to new title
5. Delete the linked page → chip shows "deleted" state
6. Restore from trash → chip becomes active again

## Dependencies

Benefits from Sprint 1 (soft delete) for broken link handling.
