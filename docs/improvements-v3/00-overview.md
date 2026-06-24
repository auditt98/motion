# Improvements v3 — Initiative Overview

**Status:** Planning · **Opened:** 2026-06-18

Evolve Motion from an AI-native collaborative *document* editor into a broader
knowledge platform along three workstreams:

- **WS-A — Workspace & file/folder management** (UI)
- **WS-B — HTML artifact editing mode** (new page type, live interactive preview)
- **WS-C — Two-way GitHub sync** (workspace ↔ repository)

---

## Locked decisions (2026-06-18)

| Decision | Choice | Consequence |
|----------|--------|-------------|
| **Sequencing** | WS-A first → WS-B → WS-C | Cheapest, most-visible UX lands first; risky infra (GitHub) last, once its spec is locked |
| **HTML mode** | New `htmlArtifact` **page type** (not a format swap) | Distinct content shape alongside rich-text docs; no migration of existing docs |
| **HTML scope** | **Full**: live co-editing + agent authoring + interactive (JS) sandboxed preview | L–XL; requires a security spike before any JS runs |
| **GitHub** | **Two-way** sync (Motion ↔ GitHub) | The ambitious path; collides with CRDT/blockId invariants — needs a dedicated design pass |
| **Markdown editing** | **Out of scope** | No source mode, no markdown-paste, no serializer hardening this cycle |

> Detailed GitHub spec is deferred by request — WS-C below captures only the
> decisions and the design questions that must be answered before it starts.

---

## Architectural ground truth

These facts (verified against the code) reshaped the original requirements:

1. **Document content is a Yjs CRDT** (a ProseMirror doc in a PartyKit room),
   not markdown or HTML. The `pages` table has **no content column**
   ([supabase/migrations/002_pages.sql](../../supabase/migrations/002_pages.sql));
   durable copies are binary Yjs snapshots in `page_versions`
   ([party/document.ts](../../party/document.ts)). Markdown/HTML are **lossy
   import/export paths only**.
   → "Save as HTML instead of markdown" becomes "a new HTML *document type*."

2. **Headless server-side rendering already exists.** `exportAsMarkdown()` and
   `exportAsHTML()` run fully in Node with no browser
   ([apps/mcp-server/src/yjs-peer.ts](../../apps/mcp-server/src/yjs-peer.ts)).
   → The hardest part of GitHub sync (render a CRDT → a committable file) is
   solved. But the markdown serializer is **lossy** (drops callouts, toggles,
   inline databases, highlight/color/comment marks).

3. **A sandboxed-HTML block already exists** but uses an
   `allow-same-origin` iframe
   ([apps/web/src/extensions/blocks/html-embed](../../apps/web/src/extensions/blocks/html-embed/index.ts))
   — it can read the Supabase session and Yjs cache.
   → The "interactive preview" must run on a **separate origin + CSP** before
   executing arbitrary JS.

4. **`page_type` routing already exists** (`document | database`,
   [migration 016](../../supabase/migrations/016_page_type.sql)) — a clean
   extension point for `htmlArtifact`.

5. **No durable background-job system.** Everything is request-driven (Fly.io
   scales to zero) or in-CRDT. Two-way GitHub sync needs the project's **first
   persistent worker + job queue.**

6. **No attachments/files table.** Only inline images in a public bucket
   ([migration 011](../../supabase/migrations/011_page_images_bucket.sql)).
   "Sync files" has almost no backing store today.

---

## Cross-cutting risks

- **Lossy export** — markdown is not a faithful mirror; this is the central
  product tension for both an HTML/markdown export path and GitHub sync.
- **Two-way merge wall** — pulling git → Motion cannot preserve `blockId`s and
  has no CRDT-safe conflict resolution. This is the dominant WS-C risk.
- **Sandbox escape** — the existing iframe model is unsafe for untrusted JS;
  WS-B must fix this, and ideally retrofit the existing `htmlEmbed` block.
- **New-feature checklist** — any agent-facing capability must update all three
  surfaces (MCP HTTP API, `agent-guide.ts`, `Status.md`) per
  [CLAUDE.md](../../CLAUDE.md). WS-B and WS-C both add agent capabilities.

---

## Roadmap

```
WS-A  Workspace & file/folder        [START NOW]
      ├─ Ph0 dead-code cleanup
      ├─ Ph1 quick wins (sidebar search, recents, breadcrumbs)
      ├─ Ph2 bulk operations
      ├─ Ph3 page nesting
      └─ Ph4 reorder hardening

WS-B  HTML artifact mode             [DESIGN PASS REQUIRED before build]
      └─ sandbox security spike → page type → CodeMirror+preview → co-edit → agents

WS-C  Two-way GitHub sync            [DESIGN PASS + detailed spec REQUIRED]
      └─ decisions → config+jobs → render reuse → worker/commit → webhook ingest
```

See: [01-ui-file-folder-management.md](01-ui-file-folder-management.md) ·
[02-html-artifact-mode.md](02-html-artifact-mode.md) ·
[03-github-two-way-sync.md](03-github-two-way-sync.md) ·
[Status.md](Status.md)
