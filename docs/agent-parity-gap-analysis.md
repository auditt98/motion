# Motion Agent Parity Gap Analysis

*Last updated: 2026-03-20*

This document tracks every action a human user can perform in the Motion UI and whether an AI agent can do the same via the MCP/HTTP API.

## Legend

- **Covered** — Agent has equivalent endpoint
- **Gap** — No agent endpoint exists
- **N/A** — Not applicable for agents (UI-only concern)

---

## 1. Document Editing

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| Read document | `GET /sessions/:id/document` | Covered |
| Read single block | `GET /sessions/:id/blocks/:bid` | Covered |
| Insert block (rich text) | `POST /sessions/:id/blocks` | Covered |
| Insert block (plain text) | `POST /sessions/:id/blocks` | Covered |
| Update block text | `PUT /sessions/:id/blocks/:bid` | Covered |
| Replace block (rich text) | `PUT /sessions/:id/blocks/:bid` | Covered |
| Delete block | `DELETE /sessions/:id/blocks/:bid` | Covered |
| Move block | `POST /sessions/:id/blocks/:bid/move` | Covered |
| Find and replace text | `POST /sessions/:id/blocks/:bid/replace` | Covered |
| Format text by match | `POST /sessions/:id/blocks/:bid/format-by-match` | Covered |
| Format text by offset | `POST /sessions/:id/blocks/:bid/format` | Covered |
| Insert image via URL | `POST /sessions/:id/blocks` (image block) | Covered |
| Upload image from file | — | **Gap** |
| Drag & drop to reorder blocks | `move_block` | Covered |
| Undo/Redo | — | **Gap** (Yjs history) |
| Slash command menu | N/A (UI interaction) | N/A |
| Keyboard shortcuts | N/A (UI interaction) | N/A |

### Gaps in Document Editing

1. **Image upload** — UI users can drag-drop or paste images which upload to Supabase Storage. Agents can only insert image blocks with existing URLs. Agent would need an upload endpoint.
2. **Undo/Redo** — UI has ProseMirror undo/redo. Agents have no equivalent. Could be implemented via Yjs UndoManager but low priority since agents can read-then-fix.

---

## 2. Page Management

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| List pages | `GET /sessions/:id/pages` | Covered |
| Create page | `POST /sessions/:id/pages` | Covered |
| Rename page | `PATCH /sessions/:id/pages/:pid` | Covered |
| Delete page (soft) | `DELETE /sessions/:id/pages/:pid` | Covered |
| Restore from trash | `POST /sessions/:id/pages/:pid/restore` | Covered |
| Permanently delete | — | **Gap** |
| Move page position | `POST /sessions/:id/pages/move` | Covered |
| Move page to folder | `move_page` (folder_id param) | Covered |
| Toggle favorite | — | **Gap** |
| Set page icon | — | **Gap** |
| Set page cover | — | **Gap** |
| View trash | `list_pages` (include_deleted) | Covered |
| Navigate to page | `POST /sessions/:id/connect` | Covered |

### Gaps in Page Management

3. **Permanently delete page** — UI has `permanentlyDeletePage()` which does a hard DELETE. Agent can only soft-delete.
4. **Toggle favorite** — UI can mark pages as favorites. No agent endpoint.
5. **Set page icon/cover** — UI can set emoji icons and cover images. No agent endpoint.

---

## 3. Folder Management

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| List folders | `GET /sessions/:id/folders` | Covered |
| Create folder | `POST /sessions/:id/folders` | Covered |
| Rename folder | `PATCH /sessions/:id/folders/:fid` | Covered |
| Delete folder | `DELETE /sessions/:id/folders/:fid` | Covered |
| Set folder icon/color | — | **Gap** |

### Gaps in Folder Management

6. **Set folder icon/color** — UI allows setting icon and color on folders. No agent endpoint.

---

## 4. Comments

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| List comment threads | `GET /sessions/:id/comments` | Covered |
| Create comment thread | `POST /sessions/:id/comments` | Covered |
| Reply to thread | `POST /sessions/:id/comments/:tid/reply` | Covered |
| Resolve thread | `POST /sessions/:id/comments/:tid/resolve` | Covered |
| Reopen thread | `POST /sessions/:id/comments/:tid/reopen` | Covered |
| Delete comment | — | **Gap** |
| Edit comment | — | **Gap** |
| @ mention users | Supported (mentions param) | Covered |

### Gaps in Comments

7. **Delete comment** — UI has `deleteComment()`. No agent endpoint.
8. **Edit comment** — UI doesn't have this either, so parity is maintained.

---

## 5. Suggestion Mode

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| Toggle editing/suggesting mode | All edit tools support `mode` param | Covered |
| Create suggestions (add/delete) | Default mode for agents | Covered |
| List suggestions | `GET /sessions/:id/suggestions` | Covered |
| Accept individual suggestion | `POST /sessions/:id/suggestions/:sid/accept` | Covered |
| Reject individual suggestion | `POST /sessions/:id/suggestions/:sid/reject` | Covered |
| Accept all | `POST /sessions/:id/suggestions/accept-all` | Covered |
| Reject all | `POST /sessions/:id/suggestions/reject-all` | Covered |

No gaps in suggestion mode.

---

## 6. Version History

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| List versions | `GET /sessions/:id/versions` | Covered |
| Save manual version | `POST /sessions/:id/versions` | Covered |
| Label a version | — | **Gap** |
| View version content | `get_version` (MCP only) | Covered |
| Restore a version | — | **Gap** |
| View word-level diff | — | **Gap** |

### Gaps in Version History

9. **Label a version** — UI has `labelVersion()` to rename versions. No agent endpoint.
10. **Restore a version** — UI can restore to a previous version. Agent cannot.
11. **View diff** — UI shows word-level diffs between versions. Agent would need diff computation server-side.

---

## 7. Export

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| Export as Markdown | `GET /sessions/:id/export?format=markdown` | Covered |
| Export as HTML | `GET /sessions/:id/export?format=html` | Covered |
| Export as PDF | — | **Gap** |

### Gaps in Export

12. **PDF export** — UI generates PDF via browser rendering. Not feasible server-side without a headless browser. Low priority.

---

## 8. Workspace Management

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| List workspaces | — | **Gap** |
| Switch workspace | — | **Gap** |
| Rename workspace | — | **Gap** |
| Delete workspace | — | **Gap** |
| View workspace members | — | **Gap** |
| Update member role | — | **Gap** |
| Remove member | — | **Gap** |
| Send email invitation | — | **Gap** |
| Create invite link | — | **Gap** |
| Revoke invitation | — | **Gap** |
| Toggle invite link | — | **Gap** |

### Gaps in Workspace Management

13. **Workspace CRUD** — Agents cannot list, switch, rename, or delete workspaces.
14. **Member management** — Agents cannot view members, update roles, or remove members.
15. **Invitation management** — Agents cannot send invitations or manage invite links.

*Note:* These are admin-level operations. Whether agents should have access is a design decision — you may intentionally keep these human-only.

---

## 9. Authentication & Presence

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| Sign in / sign up | N/A (agents use invite tokens) | N/A |
| View who's online | Presence via Yjs awareness | Covered |
| Agent shows in presence bar | Automatic via YjsPeer | Covered |
| Agent cursor position | Automatic via YjsPeer | Covered |
| Follow another user | — | N/A |
| Sync status indicator | — | N/A |

No actionable gaps.

---

## 10. Dashboard & Activity

| UI Action | Agent Endpoint | Status |
|-----------|---------------|--------|
| View recent pages | — | **Gap** |
| View page activity | — | **Gap** |
| Record page visit | — | **Gap** |
| Command palette search | — | **Gap** |

### Gaps in Dashboard

16. **Recent pages / activity** — UI tracks recent page visits and shows activity. Agents have no equivalent.
17. **Search** — No full-text search API for agents (Feature #06 not implemented for UI either).

---

## Summary

| Category | Covered | Gaps | N/A |
|----------|---------|------|-----|
| Document Editing | 11 | 2 | 2 |
| Page Management | 9 | 3 | 0 |
| Folder Management | 4 | 1 | 0 |
| Comments | 6 | 1 | 0 |
| Suggestions | 7 | 0 | 0 |
| Version History | 3 | 3 | 0 |
| Export | 2 | 1 | 0 |
| Workspace Management | 0 | 11 | 0 |
| Auth & Presence | 3 | 0 | 3 |
| Dashboard & Activity | 0 | 4 | 0 |
| **Total** | **45** | **26** | **5** |

## Priority Recommendations

### High Priority (agents feel broken without these)
1. **Toggle favorite** — simple PATCH, frequently used
2. **Permanently delete page** — needed to fully manage trash
3. **Delete comment** — complete comment lifecycle

### Medium Priority (useful but workarounds exist)
4. **Label version** — nice for organizing history
5. **Restore version** — important for rollback workflows
6. **Set page icon** — cosmetic but expected
7. **Image upload** — agents can use external URLs as workaround
8. **Folder icon/color** — cosmetic

### Low Priority (admin/power-user features)
9. **Workspace management** — admin operations, may be intentionally human-only
10. **Member/invitation management** — security-sensitive, keep human-only
11. **PDF export** — requires headless browser, low agent value
12. **Undo/redo** — agents can read-then-fix
13. **Recent pages / activity** — agents use `list_pages` instead
14. **Search** — not implemented in UI either
