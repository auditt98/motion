<h1 align="center">Motion</h1>

<p align="center">
  <strong>AI-native collaborative document editor</strong><br>
  Humans and AI agents co-edit documents in real time through the same CRDT protocol.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/built%20with-Yjs-orange.svg" alt="Built with Yjs">
</p>

<!-- Add a screenshot or GIF here: -->
<!-- <p align="center"><img src="docs/assets/hero.png" width="800" alt="Motion editor"></p> -->

---

## Why Motion?

**AI agents are first-class editors.** They connect via MCP or REST API, appear in the presence bar with live cursors, and their keystrokes show up in real time — just like another human collaborator.

**Suggestion mode keeps humans in control.** Agent edits are proposed, not committed. Review additions (green underline) and deletions (strikethrough), then accept or reject — individually or in bulk.

**CRDT-first.** Every document is a Yjs CRDT, synced via PartyKit WebSocket rooms. True conflict-free editing for any number of humans and agents, with zero coordination overhead. Local persistence via IndexedDB means documents load instantly.

**One schema, everywhere.** The ProseMirror schema in `packages/editor-extensions` is the single source of truth — used identically by the browser editor, the MCP server, and the sync server.

---

## Features

### Rich Editor
Headings, paragraphs, bullet / ordered / task lists, blockquotes, code blocks (syntax-highlighted), tables (resizable), callouts (info / warning / error / success), toggles, images, horizontal rules. Bold, italic, underline, strikethrough, inline code, links, highlights, text color.

### AI Agent Integration
31 REST API endpoints for document editing, page management, comments, version history, suggestions, and export. Any LLM can integrate — not locked to MCP. Agents authenticate with workspace tokens or invite links.

### Real-Time Collaboration
Live cursors and selection awareness for every participant. Yjs CRDT sync with zero perceptible latency. Agents appear with distinct purple cursors and thinking / writing / idle status.

### Comments & Discussions
Highlight text to start a thread. Threaded replies with @mentions. Resolve and reopen discussions. Full comment API for agents.

### Version History
Auto-snapshots every 30 minutes and on session end. Manual save with custom labels. Restore any version with one click.

### Workspace Management
Page tree with nested hierarchy. Folders. Drag-and-drop reordering. Favorites. Soft-delete with trash recovery. Invite links and email invitations. Role-based access (owner / admin / member / guest).

### Export
Markdown and HTML export from the editor or via API.

### Slash Commands
Type `/` for a Notion-style command menu — insert any block type with type-ahead search.

---

## Architecture

```
  Browser (TipTap + Yjs)             AI Agent (MCP / REST)
        │                                   │
        └───── WebSocket ─────┬───── HTTP ──┘
                              │
                       PartyKit Server
                        (Yjs rooms)
                              │
                       Supabase Postgres
                    (metadata, auth, comments,
                     versions, permissions)
```

Documents live entirely in Yjs — Supabase stores workspace metadata, not document content.

### Monorepo Structure

```
apps/
  web/                 React 19 + Vite frontend (Cloudflare Pages)
  mcp-server/          MCP + HTTP API server for AI agents (Fly.io)
packages/
  shared/              Types, constants, branding config, agent guide
  editor-extensions/   TipTap extensions + ProseMirror ↔ Yjs bridge
party/                 PartyKit server for real-time Yjs sync
supabase/
  migrations/          PostgreSQL schema (14 migrations)
skills/
  motion-agent/        Claude Code skill for agent integration
```

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm 10+
- [Supabase](https://supabase.com) project (auth, metadata, comments, versions)
- [PartyKit](https://partykit.io) account (real-time sync)

### 1. Clone and install

```bash
git clone https://github.com/AudiTT/motion.git
cd motion
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PartyKit
VITE_PARTYKIT_HOST=localhost:1999
```

Create `party/.dev.vars` for the PartyKit server:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set up the database

```bash
supabase db push
```

Or apply migrations 001–014 manually via the Supabase SQL editor.

### 4. Start development

```bash
pnpm dev          # Web app + PartyKit + MCP server
```

Or run individually:

```bash
pnpm dev:web      # http://localhost:5173
pnpm dev:party    # ws://localhost:1999
pnpm dev:mcp      # MCP server (stdio mode)
```

### 5. Build

```bash
pnpm build        # shared → editor-extensions → apps
pnpm typecheck    # Type-check all packages
```

---

## AI Agent Integration

### HTTP API (any LLM)

Create a session with a workspace agent token:

```bash
curl -X POST https://your-mcp-server.fly.dev/sessions \
  -H "Content-Type: application/json" \
  -d '{"agent_token": "your-token", "agent_name": "Claude"}'
```

The response includes a `session_id`. Use it in all subsequent calls:

```bash
# Read the document
curl https://your-mcp-server.fly.dev/sessions/$SESSION_ID/document

# Insert a block
curl -X POST https://your-mcp-server.fly.dev/sessions/$SESSION_ID/blocks \
  -H "Content-Type: application/json" \
  -d '{"index": -1, "block": {"type": "paragraph", "content": [{"type": "text", "text": "Hello from an agent!"}]}}'

# Disconnect
curl -X DELETE https://your-mcp-server.fly.dev/sessions/$SESSION_ID
```

See [skills/motion-agent/references/api-reference.md](skills/motion-agent/references/api-reference.md) for all 31 endpoints.

### MCP Protocol (Claude Desktop, Cursor)

```bash
DOCUMENT_ID=<page-id> \
WORKSPACE_ID=<workspace-id> \
PARTYKIT_HOST=your-partykit-host \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-key \
AGENT_NAME=Claude \
pnpm dev:mcp
```

### Claude Code Skill

A ready-made skill is included at `skills/motion-agent/`. Copy it to your Claude Code project:

```bash
cp -r skills/motion-agent/ .claude/skills/motion-agent/
```

### Suggestion Workflow

By default, agent edits are wrapped in suggestion marks:

1. Agent inserts or modifies content → appears as green underlines (additions) or strikethroughs (deletions)
2. Human reviews in the editor → accepts or rejects each suggestion
3. Agents can also use `"mode": "direct"` to bypass suggestions for trusted operations

---

## Deployment

| Service | Platform | Command |
|---------|----------|---------|
| Web App | Cloudflare Pages | `cd apps/web && pnpm build && npx wrangler@latest deploy` |
| PartyKit | PartyKit | `cd party && npx partykit deploy --var SUPABASE_URL=... --var SUPABASE_SERVICE_ROLE_KEY=...` |
| MCP Server | Fly.io | `fly deploy` (from project root) |
| Database | Supabase | `supabase db push` |

### MCP Server (Fly.io)

```bash
fly apps create your-mcp-server
fly secrets set \
  PARTYKIT_HOST="your-partykit-host" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-key"
fly deploy
```

Verify: `curl https://your-mcp-server.fly.dev/health`

---

## Rebranding

Motion is designed to be forked and rebranded. The app name is centralized in a single config file:

**`packages/shared/src/config.ts`**

```ts
export const APP_NAME = "Motion";        // Display name in UI
export const APP_DESCRIPTION = "...";    // Tagline
export const APP_SLUG = "motion";        // CLI and MCP server name
export const DEFAULT_MCP_HOST = "...";   // Default API endpoint
```

After changing the config, also update:

| File | What to change |
|------|----------------|
| `apps/web/index.html` | `<title>` tag |
| `package.json` files | `@motion/` package prefix (global find-replace) |
| `fly.toml` | `app` name |
| `party/partykit.json` | `name` field |
| `skills/motion-agent/` | Skill name, descriptions, example URLs |

Then rebuild: `pnpm build`

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Make your changes
4. Run `pnpm build && pnpm typecheck` to verify
5. Open a pull request

---

## License

[MIT](LICENSE) — Viet Anh Trinh
