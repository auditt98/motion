# WS-A — Workspace & File/Folder Management

**Status:** Ready to start · **Effort:** L (decomposable; quick wins ≈ 1 week)

Scope is **UI/organization only** — no agent-facing surface changes (so no
`agent-guide.ts`/MCP updates) until/unless page nesting is later exposed to the
agent API. Markdown editing is **out of scope** for this initiative.

All work targets the **live** sidebar
[MotionSidebar.tsx](../../apps/web/src/components/workspace/MotionSidebar.tsx)
(`MotionSidebarContent`, rendered by
[AppLayout.tsx](../../apps/web/src/components/layout/AppLayout.tsx) L265/L398)
and the data hook
[useWorkspace.ts](../../apps/web/src/hooks/useWorkspace.ts).

---

## Verified current state

- **Dead code (confirmed):**
  [Sidebar.tsx](../../apps/web/src/components/workspace/Sidebar.tsx) imports
  [PageTree.tsx](../../apps/web/src/components/workspace/PageTree.tsx), but
  **nothing imports `Sidebar.tsx`** — a self-contained dead cluster (~34 KB).
  The live tree is `MotionSidebar`.
- **Organization is flat:** pages grouped by `folder_id` (non-nestable folders)
  + an unfiled bucket. `pages.parent_id` exists in the schema **with indexes**
  ([migration 002](../../supabase/migrations/002_pages.sql)) but the UI never
  renders nesting (`MotionSidebar` filters `!p.parent_id && !p.folder_id`).
- **Sidebar search is naive** `title.includes()`. The real hybrid FTS+semantic
  backend (`search_pages` RPC, [migration 015](../../supabase/migrations/015_search_index.sql))
  is wired only into the Cmd+K `CommandPalette` via `useSearch.ts`.
- **No bulk operations** — every op in `useWorkspace.ts` is single-page.
- **Reorder is race-prone** — `movePage` does N sequential awaited Supabase
  UPDATEs on position renumber; no transaction.
- **`page_activity` already records views/edits** (per-page, human|agent) →
  ready source for a "Recent" section.

---

## Plan

### Phase 0 — Dead-code resolution (0.5 day)
Delete `Sidebar.tsx` + `PageTree.tsx` in a **standalone cleanup commit** (verify
`pnpm typecheck && pnpm build` stay green). Confirms `MotionSidebar` as the
single source of truth before any sidebar work.

> **Decision to confirm at kickoff:** is this truly retired, or an in-progress
> migration we should finish *into* instead? (Evidence says retired.)

### Phase 1 — Quick wins (3–5 days)
1. **Sidebar search upgrade** — swap inline `title.includes()` for the
   `search_pages` RPC (reuse `useSearch.ts`) so sidebar search matches Cmd+K and
   hits body text. *(Note: body text lags up to the 30-min snapshot cadence.)*
2. **Recent pages section** — from `page_activity` views, in the sidebar.
3. **Breadcrumb bar** — in [EditorPage](../../apps/web/src/components/editor/EditorPage.tsx)
   top area (becomes meaningful once nesting lands in Ph3).

### Phase 2 — Bulk operations (3–4 days)
Multi-select (shift/cmd-click) in `MotionSidebar` → bulk move-to-folder /
delete / favorite. Add **batched RPCs** to `useWorkspace.ts` with optimistic
update + reconcile.

### Phase 3 — Page nesting (1–1.5 weeks)
Surface `parent_id`: recursive render + expand/collapse + **drag-to-nest** in
`MotionSidebar`, with **cycle prevention** and position scoped per parent.
Custom tree component (Weave v0.1.0 has no Tree). Ship **without** per-page
permission inheritance in v1 (rely on workspace membership).

> **Design decision:** folders vs nesting overlap. Recommended: **coexist** —
> folders stay as flat top-level grouping; nesting adds page→page hierarchy
> inside. (Alternatives: nesting replaces folders, or folders gain `parent_id`.)

### Phase 4 — Reorder hardening (2–3 days)
Move the renumber loop into a single security-definer Postgres RPC; update
`movePage` to call it. Fixes the concurrent-reorder race.

---

## Risks

- Editing the wrong sidebar (mitigated by Phase 0).
- Drag-to-nest `parent_id` cycles → must guard.
- RLS does not enforce page-level access on descendants; naive nesting + a
  restricted page could leak/hide. (Deferring inheritance keeps v1 contained but
  document the limitation.)
- Optimistic reorder UI desyncing from DB until Phase 4 lands.

## Out of scope (this cycle)
Markdown source mode, markdown-paste, serializer hardening, nested *folders*,
permission inheritance, attachments/files subsystem, agent access to the tree.
