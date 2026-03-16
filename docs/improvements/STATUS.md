# Improvements Tracker

Last updated: 2026-03-20

## Overview

| # | Feature | Status | Spec |
|---|---------|--------|------|
| 01 | Trash & Soft Delete | Done | [01-trash-soft-delete.md](01-trash-soft-delete.md) |
| 02 | Export (Markdown + HTML) | Done | [02-export-markdown-html.md](02-export-markdown-html.md) |
| 03 | Version History | Done | [03-version-history.md](03-version-history.md) |
| 04 | Suggestion Mode | Done | [04-suggestion-mode.md](04-suggestion-mode.md) |
| 05 | Image Upload | Done | [05-image-upload.md](05-image-upload.md) |
| 06 | Full-Text Search | Not started | [06-full-text-search.md](06-full-text-search.md) |
| 07 | Notifications | Not started | [07-notifications.md](07-notifications.md) |
| 08 | Page Templates | Not started | [08-page-templates.md](08-page-templates.md) |
| 09 | Page Links & Backlinks | Not started | [09-page-links-backlinks.md](09-page-links-backlinks.md) |
| 10 | Agent Quick Actions | Not started | [10-agent-quick-actions.md](10-agent-quick-actions.md) |
| 11 | Cursor Following | Not started | [11-cursor-following.md](11-cursor-following.md) |
| 12 | Keyboard Shortcuts | Partial | [12-keyboard-shortcuts.md](12-keyboard-shortcuts.md) |

**Progress: 5 done, 1 partial, 6 not started**

---

## Notes

### Done

**01 — Trash & Soft Delete**
- Migration `010_soft_delete.sql` adds `deleted_at` and `deleted_by` columns
- `TrashPanel` component with restore and permanent delete
- Sidebar integration with trash count badge

**02 — Export (Markdown + HTML)**
- `ExportMenu` component with HTML, Markdown, and PDF options
- Dedicated export utilities: `exportHTML.ts`, `exportMarkdown.ts`, `exportPDF.ts`
- Auto-derives filename from first heading

**05 — Image Upload**
- `useImageUpload` hook uploads to Supabase Storage `page-images` bucket
- Drag-and-drop, paste, and file picker all supported
- Migration `011_page_images_bucket.sql` creates bucket with RLS policies
- 10 MB limit, PNG/JPEG/GIF/WebP/SVG

**03 — Version History**
- Migrations `012_page_versions.sql` and `013_page_versions_snapshot_to_text.sql` create `page_versions` table
- `VersionHistory` component with version list, labeling, and restore
- `VersionPreview` component with diff and preview modes (word-level change highlighting)
- `useVersionHistory` hook with real-time subscriptions, manual save, snapshot retrieval

**04 — Suggestion Mode**
- Two marks: `SuggestionAddMark` (subtle green underline) and `SuggestionDeleteMark` (gray strikethrough) in shared extensions
- `SuggestionModePlugin` — intercepts text input and keystrokes (handleTextInput/handleKeyDown) to wrap edits in suggestion marks
- Backspacing over your own pending suggestions deletes them normally (typo-friendly)
- `SuggestionPopover` — Accept/Reject popover for other users' suggestions only (hidden for your own)
- Toolbar toggle: Editing (default for humans) / Suggesting mode + bulk Accept All / Reject All
- MCP tools default to `mode: "suggest"` — agents propose changes as suggestions by default
- Suggestion count badge in editor header
- No database table needed — suggestions are CRDT marks that sync via Yjs

### Partial

**12 — Keyboard Shortcuts**
- `Cmd+K` opens command palette (`CommandPalette` component)
- Missing: shortcut overlay (`Cmd+/`), toolbar tooltips with shortcut hints, onboarding toast
