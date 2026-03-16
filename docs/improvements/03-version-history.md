# Version History

## Problem

There is no way to see past versions of a document, undo collaborative changes, or attribute edits to specific users over time. The PartyKit server stores Yjs snapshots for crash recovery, but these are not user-facing. When AI agents edit documents, users have no way to see "what changed" or roll back to a previous state.

## Priority

**Sprint 3.** ~2–3 days of effort. Critical trust feature, especially for AI collaboration.

## What to Build (MVP — Yjs Snapshots)

### 1. DB migration: `page_versions` table

New migration `supabase/migrations/011_page_versions.sql`:

```sql
CREATE TABLE page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES pages(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot bytea NOT NULL,           -- Yjs encoded state
  created_by uuid REFERENCES users(id),
  created_by_name text,              -- denormalized for display
  actor_type text DEFAULT 'human',   -- 'human' or 'agent'
  label text,                        -- optional user-provided name
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_page_versions_lookup ON page_versions(page_id, created_at DESC);
```

RLS: workspace members can read versions for pages in their workspace.

### 2. Snapshot capture logic

Capture Yjs snapshots at these events:

- **Auto-save**: every 10 minutes of active editing (debounced)
- **Agent disconnect**: when an AI agent session ends (via MCP server)
- **Manual save**: user clicks "Save version" button
- **Before restore**: always snapshot current state before restoring an older version

Implementation in `useYjsProvider.ts` or a new `useVersionHistory.ts` hook:
```typescript
const snapshot = Y.encodeStateAsUpdate(ydoc);
await supabase.from('page_versions').insert({
  page_id, workspace_id, snapshot: snapshot,
  created_by: userId, created_by_name: userName,
});
```

### 3. Version retention policy

- Keep last 50 versions per page
- On each new snapshot, delete oldest if count > 50
- Consider keeping all "labeled" versions regardless of limit

### 4. Version history panel

New component `apps/web/src/components/editor/VersionHistory.tsx`:

- Side panel (similar to comments sidebar) toggled from editor header
- Timeline list of versions, newest first
- Each entry shows: relative timestamp ("2 hours ago"), author name/avatar, actor type badge (human vs agent), optional label
- Click a version to preview it in a read-only overlay
- "Restore this version" button with confirmation
- "Label this version" — add a name like "Before agent review"

### 5. Version preview & restore

**Preview:**
- Create a temporary Y.Doc, apply the stored snapshot
- Render in a read-only TipTap editor instance overlaid on the current document
- Show visual diff if feasible (highlight differences), or just show the old version

**Restore:**
- Snapshot current state first (so restore is itself reversible)
- Apply the old snapshot as a new Yjs update: `Y.applyUpdate(ydoc, storedSnapshot)`
- This is CRDT-safe — creates a new update rather than destructively overwriting
- All connected peers see the restore in real-time

## Files to Modify

- `supabase/migrations/011_page_versions.sql` (new)
- `apps/web/src/hooks/useVersionHistory.ts` (new)
- `apps/web/src/components/editor/VersionHistory.tsx` (new)
- `apps/web/src/components/editor/EditorPage.tsx` — add version history toggle button
- `apps/mcp-server/src/tools.ts` — trigger snapshot on agent session end (optional)

## Verification

1. Edit a document → wait for auto-snapshot → see version in history panel
2. Click a version → preview shows the old document state
3. Restore a version → document reverts, all peers see the change
4. Restore creates a "pre-restore" snapshot → can undo the restore
5. Agent edits a document → agent version appears with agent badge
6. Manually label a version → label persists and is visible

## Dependencies

None strictly, but benefits from Sprint 1 (trash) being done — if a user accidentally restores the wrong version, they need confidence they can recover.
