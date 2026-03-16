# Version History — Brainstorm

**Date:** 2026-03-20
**Status:** Ready for implementation

## What We're Building

A version history feature that lets users see past states of their documents, preview old versions side-by-side with the current document, and restore any previous version. Especially critical for AI collaboration — when agents edit documents, users need to see "what changed" and roll back if needed.

## Why This Approach

We challenged five key decisions from the original spec (`docs/improvements/03-version-history.md`):

### 1. Restore via content replacement (not Y.applyUpdate)
The original spec proposed `Y.applyUpdate(ydoc, storedSnapshot)` for restore, but Yjs updates are additive — this merges old state into current rather than replacing it. Instead: decode snapshot → temp Y.Doc → ProseMirror JSON → `editor.commands.setContent()`. Pre-restore snapshot ensures reversibility.

### 2. Server-side snapshots in PartyKit (not client-side hook)
Client-side capture only works with open browser tabs, creates duplicates across tabs, and can't detect agent disconnects. PartyKit already has the Y.Doc in memory — it's the natural place for snapshot logic.

### 3. Session boundary + 30-min timer (not fixed 10-min timer)
A fixed timer creates noise. Primary trigger: snapshot when the last peer disconnects (natural session boundary). Safety net: 30-min timer for long continuous sessions.

### 4. Side-by-side preview (not read-only overlay)
Overlay replaces the current doc, losing context. Side-by-side lets users compare current vs. old version visually before deciding to restore.

### 5. No retention limit for MVP
Ship faster. Add time-based or count-based cleanup later when storage becomes a concern.

## Key Decisions

- Snapshots stored as `bytea` in Supabase `page_versions` table
- PartyKit server handles all snapshot capture (session boundary, timer, manual via HTTP endpoint)
- Preview renders in a separate read-only TipTap instance (side-by-side with live editor)
- Restore creates a pre-restore snapshot automatically, then replaces editor content
- Version panel follows the CommentSidebar pattern (side panel with toggle button)

## Open Questions

- Should the side-by-side preview be resizable?
- Visual diff highlighting (green/red) — future enhancement?
- PartyKit env var configuration for Supabase credentials
