# Improvements v3 — Status

Initiative opened 2026-06-18. See [00-overview.md](00-overview.md).

| WS | Workstream | Phase | Status | Notes |
|----|-----------|-------|--------|-------|
| A | Workspace & file/folder management | Ph0 Dead-code cleanup | Not started | Retire dead `Sidebar.tsx` + `PageTree.tsx`; `MotionSidebar` is canonical |
| A | " | Ph1 Quick wins | Not started | Sidebar search via `search_pages` RPC, Recent pages, breadcrumbs |
| A | " | Ph2 Bulk operations | Not started | Multi-select + batched move/delete/favorite RPCs |
| A | " | Ph3 Page nesting | Not started | Surface `parent_id`; recursive tree + drag-to-nest; no perm inheritance v1 |
| A | " | Ph4 Reorder hardening | Not started | Batched security-definer reorder RPC |
| B | HTML artifact mode (full) | Design pass | Not started | New `htmlArtifact` page type; sandbox security spike is blocking |
| C | Two-way GitHub sync | Design + spec | Not started | Detailed spec deferred; merge/conflict policy is the open hard problem |

**Legend:** Not started · In progress · Blocked · Done

**Decisions log (2026-06-18):** sequencing A→B→C · HTML = new page type, full
capability · GitHub = two-way · markdown editing out of scope.
