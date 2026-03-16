# Trash & Soft Delete

## Problem

Deleting a page is permanent and irreversible. The current `deletePage()` in `useWorkspace.ts` calls `.delete()` on the Supabase `pages` table, which cascades to all comment threads, comments, and page activity. One accidental click destroys shared work with no recovery. No serious team will adopt a tool with this risk.

## Priority

**Sprint 1 — Do first.** Fastest win with the highest trust impact. ~1 day of effort.

## What to Build

### 1. DB Migration: Add soft-delete columns to `pages`

New migration `supabase/migrations/010_soft_delete.sql`:

- Add `deleted_at timestamptz DEFAULT NULL` column
- Add `deleted_by uuid REFERENCES users(id)` column
- Update all RLS read policies to include `WHERE deleted_at IS NULL`
- Remove or modify CASCADE rules so comments/threads are preserved when a page is soft-deleted
- Add index on `(workspace_id, deleted_at)` for efficient trash queries

### 2. Update delete logic in `useWorkspace.ts`

Change `deletePage()` from:
```typescript
await supabase.from("pages").delete().eq("id", pageId);
```
To:
```typescript
await supabase.from("pages").update({
  deleted_at: new Date().toISOString(),
  deleted_by: userId,
}).eq("id", pageId);
```

Filter out deleted pages from the pages list (should be handled automatically by updated RLS policies).

### 3. Trash UI in sidebar

Add a "Trash" section at the bottom of the sidebar (below Settings):

- Clicking opens a panel listing soft-deleted pages
- Each entry shows: page title, icon, when it was deleted, who deleted it
- **Restore** button — sets `deleted_at = NULL`, `deleted_by = NULL`
- **Delete permanently** button — hard delete with confirmation dialog ("This cannot be undone")
- Empty state: "Trash is empty"

### 4. Auto-purge after 30 days

- Supabase edge function or pg_cron job that runs daily
- Deletes pages where `deleted_at < NOW() - INTERVAL '30 days'`
- Show "Items in trash are automatically deleted after 30 days" notice in the trash panel

## Files to Modify

- `supabase/migrations/010_soft_delete.sql` (new)
- `apps/web/src/hooks/useWorkspace.ts` — update `deletePage()`
- `apps/web/src/components/workspace/Sidebar.tsx` — add Trash section
- `apps/web/src/components/workspace/TrashPanel.tsx` (new) — trash list UI

## Verification

1. Delete a page → it disappears from sidebar but appears in Trash
2. Open Trash → see deleted page with metadata
3. Restore → page reappears in sidebar with all comments intact
4. Delete permanently → page is gone from both sidebar and trash
5. Verify RLS: other workspace members can also see/restore trashed pages
6. Verify: Yjs doc room in PartyKit is unaffected by soft delete

## Dependencies

None. Can ship independently.
