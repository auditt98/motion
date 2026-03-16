# Motion — AI-native collaborative document editor

## Project overview

Motion is a real-time collaborative document editor with AI agent integration. Human users and AI agents co-edit documents through the same CRDT protocol. The editor uses TipTap (ProseMirror) with Yjs for conflict-free real-time sync.

## Monorepo structure

```
apps/
  web/             → React 19 + Vite frontend (Cloudflare Pages)
  mcp-server/      → MCP server for AI agent integration (Fly.io)
packages/
  shared/          → Types, constants, agent guide template (pure TS, no deps)
  editor-extensions/ → TipTap extensions + ProseMirror ↔ Yjs bridge
party/             → PartyKit server for real-time Yjs sync
supabase/
  migrations/      → PostgreSQL schema migrations (001–007)
docs/              → Documentation and brainstorms
```

## Key technology

- **Editor**: TipTap 2 (ProseMirror) with collaboration extensions
- **CRDT sync**: Yjs documents synced via PartyKit WebSocket rooms
- **Local persistence**: IndexedDB via y-indexeddb
- **Database**: Supabase PostgreSQL (metadata, auth, permissions — NOT document content)
- **Package manager**: pnpm 10 with Turbo for build orchestration

## Design system

The web app **must** use the [Weave Design System](https://github.com/weave-design-system) (`@weave-design-system/react`) for all UI components. Never use raw HTML elements (e.g. `<button>`, `<input>`, `<table>`) or introduce third-party UI libraries when a Weave component exists.

**Storybook**: https://weave.hank-82d.workers.dev/ — reference for component variants, props, and usage examples.

### Available components

Import from `@weave-design-system/react`:

| Component | Usage |
|-----------|-------|
| `Button` | All buttons — variants: `primary`, `ghost`; sizes: `sm`, default |
| `Sidebar`, `SidebarNavItem` | Navigation shell and nav links |
| `CommandPalette` | Quick-search / command launcher |
| `Card`, `Card.Header`, `Card.Content` | Content cards |
| `Avatar` | User/agent avatars with fallback |
| `Badge` | Status and count badges |
| `Tooltip` | Hover tooltips wrapping any element |
| `Accordion` | Collapsible sections |
| `Tabs` | Tabbed interfaces |
| `InputGroup` | Form text inputs |
| `SelectGroup` | Form select dropdowns |
| `Table` | Data tables |
| `Modal` | Dialog overlays |
| `AlertBanner` | Alerts and notifications |
| `EmptyState` | Empty-state placeholders |
| `ActivityFeed` | Activity timelines |
| `SkeletonLoader` | Loading skeletons |
| `ToastProvider`, `useToast` | Toast notifications |

### Styling rules

- **Layout & spacing**: Use Tailwind CSS utility classes (`flex`, `gap-*`, `p-*`, `rounded-*`, etc.)
- **Colors**: Always use CSS variables — never hardcode hex values. Apply via inline `style` when Tailwind doesn't expose the token:
  ```tsx
  style={{ background: "var(--color-bg)", color: "var(--color-textPrimary)" }}
  ```
- **Key color tokens**: `--color-bg`, `--color-border`, `--color-surface`, `--color-textPrimary`, `--color-textSecondary`, `--color-rust` (brand accent), `--color-rustLight`, `--color-forest`, `--color-gray-400`, `--color-white`
- **Fonts**: Satoshi (UI, weights 400–700) and JetBrains Mono (code, weights 400–500) — loaded in `apps/web/index.html`
- **Theme CSS**: Imported via `@import "@weave-design-system/react/theme.css"` in `apps/web/src/index.css`

### Shared components

Project-specific reusable components live in `apps/web/src/components/shared/` (e.g., `PageIcon`). Check there before creating new shared UI.

### Editor styles

TipTap/editor-specific CSS (headings, lists, callouts, collaboration cursors, comments, version history) lives in `apps/web/src/index.css`. Follow the existing patterns when adding new editor styles.

## Development

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps (web + party + mcp-server)
pnpm dev:web              # Start web app only
pnpm dev:party            # Start PartyKit server only
pnpm dev:mcp              # Start MCP server only
pnpm build                # Build all packages
pnpm typecheck            # Type-check all packages
```

Build order matters: `packages/shared` → `packages/editor-extensions` → apps. Turbo handles this via `dependsOn: ["^build"]`.

## Deployment

| Service | Platform | Config | URL |
|---------|----------|--------|-----|
| Web | Cloudflare Pages | — | motion-web.pages.dev |
| MCP Server | Fly.io | `fly.toml` + `apps/mcp-server/Dockerfile` | motion-mcp-server.fly.dev |
| PartyKit | PartyKit hosting | `party/partykit.json` | motion-sync.auditt98.partykit.dev |
| Database | Supabase | `supabase/migrations/` | ehggdmxcdoasiwkzjwsx.supabase.co |

### Deploy MCP server
```bash
fly deploy                # Deploys from root using fly.toml → apps/mcp-server/Dockerfile
```

### Deploy PartyKit
```bash
cd party && npx partykit deploy
```

## Environment variables

Key env vars (see `.env.example`):
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase client config
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase access (MCP server)
- `VITE_PARTYKIT_HOST` — PartyKit WebSocket host

## Agent guide

The agent instruction text (copied to clipboard via "Copy agent instructions" button in the Share menu) is defined in a single source of truth:

**`packages/shared/src/agent-guide.ts`** → `buildAgentInstructions(inviteUrl, mcpHost)`

Both the web app's ShareButton and `docs/agent-document-guide.md` derive from this. When updating the agent guide, update only `agent-guide.ts` — the docs file is auto-generated from it.

## Architecture notes

- Documents are Yjs `Y.Doc` instances hosted in PartyKit rooms (one room per document)
- Every top-level block has a stable `blockId` (UUID) for agent editing
- AI agents connect as Yjs peers via the MCP server, appearing in the presence bar
- The ProseMirror schema in `packages/editor-extensions` is the single source of truth for both web and MCP server
- Supabase stores workspace metadata, page hierarchy, and invite links — document content lives entirely in Yjs/PartyKit
