# WS-C — Two-Way GitHub Sync

**Status:** Design pass + detailed spec required before build · **Effort:** L–XL

Connect a workspace to a GitHub repo and keep folder structure, documents, and
files mirrored **bidirectionally** (Motion ↔ GitHub), with Motion-side changes
batched and committed automatically.

> Detailed spec is **deferred by request.** This doc captures the verified
> constraints and the decisions that must be answered before WS-C starts, so the
> later spec session is grounded.

---

## What already works in our favor

- **Headless render is solved.** `exportAsMarkdown()` / `exportAsHTML()` run in
  Node with no browser
  ([apps/mcp-server/src/yjs-peer.ts](../../apps/mcp-server/src/yjs-peer.ts)); a
  `YjsPeer` connects to any document's PartyKit room on demand. Rendering a doc
  → a committable file is a **proven capability**.
- **Page/folder tree is queryable** from Supabase (`listPages`/`listFolders`).
- **PartyKit already fires a debounced change callback** on every edit
  ([party/document.ts](../../party/document.ts)) — a natural enqueue trigger.

## What makes two-way the hard path

1. **The merge wall (dominant risk).** Pulling git → Motion means
   MD/HTML → ProseMirror JSON → `prosemirrorJSONToYDoc`, merged into a **live
   CRDT**. This **cannot preserve `blockId`s**, can't auto-merge against
   concurrent human edits, and there is **no conflict UI** today.
2. **Lossy markdown.** The serializer silently drops callouts, toggles, inline
   databases, highlight/color/comment marks. A `.md` mirror loses structure;
   a git→Motion round-trip compounds it.
3. **"Every update" ≠ a commit per edit.** Committing every change hits GitHub
   secondary rate limits and creates commit spam. Needs a **missing middle
   tier**: per-page idle debounce (~30–60s) + multi-page commit coalescing.
4. **No background worker.** Fly.io scales to zero; this needs the project's
   **first durable job queue + worker** that survives cold starts.
5. **"Sync files" has no backing store.** Only inline images in a public bucket
   exist — no attachments table. Real binary file sync is partly greenfield.

## Likely shape (to be confirmed in the spec)

- New tables: `workspace_github_config` (auth ref, repo, branch, format, path
  rules, last-synced cursor) and `github_sync_jobs` (durable queue, with
  `last_committed_path` per page so renames/moves become git renames).
- **Render stays in the MCP server** (reuse `yjs-peer.ts`); PartyKit/Supabase
  enqueue jobs the worker drains. Don't duplicate the serializer into PartyKit.
- Push via the **GitHub Git Data API** (build tree → commit → update ref) for
  atomic multi-page commits; per-repo lock to avoid non-fast-forward rejects.
- Inbound: GitHub push webhook → parse changed files → import pipeline → merge
  into the live `Y.Doc`, **accepting `blockId` regeneration + a defined conflict
  policy**.

## Decisions required before build

- **Commit format** — markdown (clean diffs, lossy) vs HTML (faithful, ugly
  diffs) vs ProseMirror JSON (lossless, not human-readable) vs **both** (`.md`
  for humans + a `.json` sidecar for faithful round-trip). The round-trip
  requirement strongly favors a lossless sidecar.
- **Conflict policy** — page edited in Motion *and* GitHub between syncs:
  last-write-wins? reject? branch? (No UI exists; this must be designed.)
- **Cadence** — acceptable debounce window and commit frequency; is a 1–2 min
  delay fine?
- **Repo tree shape** — flat `folder/page.md` (2 levels) vs surfacing WS-A page
  nesting. How are unfiled / favorited / trashed / database pages represented?
- **Scope** — one repo per workspace, or selectable subtrees? One branch?
- **Auth** — GitHub **App** (best for org installs, webhooks, rate limits) vs
  OAuth vs PAT. Two-way + webhooks points to a GitHub App.
- **Files** — does "sync files" mean inline/cover images (URLs today) or real
  attachments (a separate prerequisite feature)?
- **Initial backfill** — first sync may commit hundreds of pages, each needing a
  peer connection; define acceptable time/cost.

## Dependencies
- Benefits from WS-A page nesting (determines repo tree shape).
- Commit-format choice interacts with WS-B (artifacts are HTML, not markdown).
- Adds agent-facing endpoints → must update all three surfaces per
  [CLAUDE.md](../../CLAUDE.md).
