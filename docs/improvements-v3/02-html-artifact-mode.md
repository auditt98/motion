# WS-B — HTML Artifact Editing Mode

**Status:** Design pass required before build · **Effort:** L–XL (~3–5 weeks for the full, secure version)

A **new `htmlArtifact` page type**: edit raw HTML in a code editor with a live,
**fully interactive** (JS-executing) preview panel — like a Claude artifact.
Decision is **full capability**: live co-editing + agent authoring + interactive
preview.

> This is **not** a format swap on existing documents and **not** a view toggle.
> Rich-text docs and HTML artifacts are different content shapes that cannot
> round-trip; the artifact is its own `page_type`.

---

## Why a new page type (architecture fit)

- `page_type` routing already exists (`document | database`,
  [migration 016](../../supabase/migrations/016_page_type.sql);
  `PageRouter` in [AppLayout.tsx](../../apps/web/src/components/layout/AppLayout.tsx)).
  Adding `htmlArtifact` follows the established `database` precedent.
- An HTML artifact stores **raw HTML as a `Y.Text`** (collaboratively editable
  via `y-codemirror`), kept **separate from** the ProseMirror `XmlFragment`. The
  preview is derived, not stored.
- A sandboxed-iframe block already exists
  ([html-embed](../../apps/web/src/extensions/blocks/html-embed/index.ts)) — but
  its `allow-same-origin` sandbox is **unsafe** for arbitrary JS. WS-B must fix
  this and ideally retrofit `htmlEmbed` onto the same hardened host.

## Approach (phased)

1. **P0 — Security spike (blocking).** Decide the sandbox host: separate
   subdomain / Cloudflare Worker / `null`-origin iframe + strict CSP. No JS runs
   until this is settled. Output: a proof-of-concept that executes untrusted JS
   with no access to Supabase session, cookies, or the parent origin.
2. **P1 — Page type + storage.** `page_type` CHECK migration, `PageType` union
   in [packages/shared/src/types.ts](../../packages/shared/src/types.ts),
   `createHtmlArtifact`, `Y.Text` storage, `PageRouter` branch.
3. **P2 — Editor + preview.** CodeMirror HTML editor + sandboxed preview pane
   (split view; custom, no Weave split component).
4. **P3 — Live co-editing.** `y-codemirror` binding so the `Y.Text` syncs over
   PartyKit like documents do (presence/cursors reuse existing awareness).
5. **P4 — Search + versions.** Branch snapshot/search-index extraction on
   `page_type` (the artifact body is `Y.Text`, not the XmlFragment).
6. **P5 — Agent authoring.** New MCP HTTP endpoints + `Y.Text` editing
   primitive for agents (raw-HTML read/write), then update **all three
   surfaces** (`http.ts`, `agent-guide.ts`, `Status.md`). Agents author
   artifacts externally (consistent with "agents connect externally, no inline
   chat" — they edit via MCP, not a panel).
7. **P6 — Hardening.** Finalize CSP, public-share policy for JS previews,
   retrofit `htmlEmbed` onto the hardened sandbox.

## Open decisions (resolve at WS-B kickoff)

- **Public JS previews** — are artifacts shareable via `/p/:slug` with JS
  enabled? (Biggest security/policy call.)
- **Sandbox host** — subdomain vs Worker vs null-origin+CSP.
- **External resources** — may artifact JS fetch third-party scripts/CDNs, or
  is it self-contained only?
- **Agent primitive shape** — do agents edit whole-document HTML, or a
  structured/regioned API?
- **Templates** — ship starter templates (the "new artifact" experience)?

## Key risks

- Sandbox escape exposing Supabase session / Yjs cache (the existing model's
  flaw).
- Fork sprawl: search / MCP / export / restore become no-ops unless every path
  branches on `page_type`.
- Public JS preview is inherently dangerous — needs an explicit policy.
- Second content shape doubles the surface area of "what is a page."

## De-scope lever
If timeline pressures, ship **P0–P2** (single-editor artifact + secure
interactive preview) first and add **P3 co-editing / P5 agent authoring** in a
fast-follow. Drops ~L–XL to ~M without compromising the security foundation.
