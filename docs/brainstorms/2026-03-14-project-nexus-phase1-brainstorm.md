# Project Nexus — Phase 1 Brainstorm

*March 14, 2026*

---

## What We're Building

An AI-native, real-time collaborative workspace — a Notion competitor built on three pillars:

1. **True multiplayer** — Live cursors, selections, presence across every content type
2. **AI agents as document participants** — Agents edit alongside humans in real-time via CRDT, with visible cursors and tool-based interaction
3. **Local-first performance** — Instant UI, offline-capable, sync in the background

## Why This Approach

Notion's architecture was designed pre-AI and cloud-only. Retrofitting real-time multiplayer, local-first performance, and AI-as-collaborator into their existing system is architecturally difficult. Starting fresh lets us build these as first-class primitives rather than bolt-ons.

---

## Key Decisions

### Scope & Platform

| Decision | Choice | Rationale |
|---|---|---|
| Phase 1 platform | **Web-only** (React + Vite) | Faster iteration, simpler deployment. Tauri desktop deferred to later phase |
| Block types | **All 16+** as PRD specifies | Funded team can handle the scope. TipTap extensions cover most of these |
| AI agents | **Ship in Phase 1** | Core differentiator — validate thesis early, don't build a Notion clone for 9 months first |
| Agent MVP experience | **Inline @mention + live cursor** | The "wow moment" — watch an AI agent edit your document in real-time |
| Timeline | **6+ months** for working alpha | Comfortable pace for the ambitious scope (all blocks + AI agents) |

### Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **React 19 + Vite + TypeScript** | Team strength, largest TipTap ecosystem, SPA (no SSR needed) |
| Editor | **TipTap (ProseMirror)** | Most mature, best Yjs integration via y-prosemirror, extensive extension ecosystem |
| CRDT | **Yjs** | Battle-tested, fastest benchmarks, de facto standard for collaborative editors |
| Sync server | **PartyKit (Cloudflare Durable Objects)** | Purpose-built for collaborative apps on Workers. Native Yjs support via y-partykit. Per-document actors |
| Metadata DB | **Supabase** | Postgres + auth + realtime + storage in one platform. Fast to start, handles users/workspaces/permissions/billing |
| Backend | **TypeScript / Node.js** | Team strength. Consistent language across entire stack |
| File storage | **Supabase Storage** (or Cloudflare R2) | Integrated with Supabase, or R2 for Cloudflare alignment |

### AI Agent Architecture

**Core insight:** Don't build LLM-specific integrations. Expose document operations as **tools** that any LLM can call.c

```
Any LLM (Claude, GPT, Gemini, open-source)
       | (tool calls via function calling / MCP)
       v
Agent Runtime (server-side, tool executor)
  Tools: read_block, write_text, insert_block,
         delete_block, move_block, update_property...
       |
       v
CRDT Writer (maps tool calls -> Y.Doc operations)
  - Connects to Yjs room as a peer (via PartyKit)
  - Manages cursor position + awareness
  - Handles rate limiting + permissions
       |
       v
Document (Yjs Y.Doc)
```

**Key properties:**
- **LLM-agnostic** — any provider works via standard tool/function calling
- **MCP-aligned** — document tools follow MCP patterns, extensible to external tools
- **Testable** — tools can be called without an LLM for testing
- **Generic runtime** — build the bridge once, any agent walks across it
- **Server-side** — agents run independently of user's browser, can handle long tasks
- **Visible** — agent cursor appears in the document, users watch it work in real-time

**Phase 1 built-in agents:**
- Writer Agent (drafts, expands, rewrites)
- Editor Agent (grammar, clarity, suggestions)

More agents (Research, Data, Task) ship in later phases.

---

## Architecture Overview (Phase 1)

```
Client (React + Vite)
  |-- TipTap Editor (ProseMirror)
  |     |-- y-prosemirror binding --> Yjs Y.Doc
  |     |-- Custom block extensions (all 16+ types)
  |     |-- AIAgentExtension (cursor rendering, @mention)
  |     |-- CommentsExtension
  |     |-- SuggestionModeExtension
  |
  |-- Yjs Providers
  |     |-- y-partykit (sync with server)
  |     |-- y-indexeddb (local persistence)
  |
  |-- Supabase Client (auth, metadata, storage)

PartyKit (Cloudflare Durable Objects)
  |-- Per-document Yjs rooms
  |-- Awareness protocol (cursors, presence)
  |-- Document persistence (snapshots)
  |-- Agent Runtime connections (agents as peers)

Agent Runtime (server-side service)
  |-- Connects to PartyKit rooms as Yjs peer
  |-- Exposes document tools to LLMs
  |-- Manages agent cursor + awareness state
  |-- Streams LLM tool calls -> CRDT operations

Supabase
  |-- Auth (email + OAuth)
  |-- PostgreSQL (users, workspaces, permissions, agent configs)
  |-- Storage (file attachments, images)
```

---

## Open Questions

1. **PartyKit vs raw Durable Objects** — PartyKit simplifies Yjs hosting but adds an abstraction. Need to evaluate if it supports the agent runtime connection pattern (server-side peers connecting to rooms). If not, may need custom Durable Objects.

2. **Agent Runtime hosting** — Where does the Agent Runtime service itself run? Options: Cloudflare Workers, separate Node.js service on Railway/Fly, or co-located in the Durable Object. Needs evaluation.

3. **Token streaming UX** — How fast should agent text appear? Character-by-character feels natural but may cause excessive CRDT operations. Block-by-block is more efficient but less impressive. Need to prototype both.

4. **Offline + AI** — When offline, can agents run on-device with small models? Or is AI simply unavailable offline? PRD says "partial" — need to define what that means for Phase 1.

5. **Product name** — "Project Nexus" is a codename. What's the shipping name?

6. **Monetization timeline** — When does billing/pricing need to be built? Can Phase 1 be free alpha?

---

## What's NOT in Phase 1

- Desktop app (Tauri) — deferred
- Mobile app — deferred
- Databases (table, board, calendar views) — Phase 2
- Enterprise features (SSO, audit logs, E2EE) — Phase 4
- LiveKit voice/video — potential future feature
- Custom agent marketplace — later
- Notion importer — Phase 2

---

## Next Steps

Run `/workflows:plan` to create a detailed implementation plan for Phase 1, breaking down the work into sprints and assigning workstreams across the team.
