# WS-D — Agent plugins + real MCP server

**Status:** In progress — transport, skill, and plugins shipped; OAuth + onboarding UI remain.

Ship Motion as a **skill + MCP server** packaged as **plugins for Claude and Codex**, so an
agent can both *operate* Motion and *know how to use it* — with no token copy-paste. See the
approved plan and `plugins/README.md`.

## Done

- **Real MCP transport** — `apps/mcp-server/src/mcp.ts` serves all 47 tools over a
  Streamable-HTTP transport at **`/mcp`** (mounted in `http.ts`). `tools.ts` was refactored
  so the document tools resolve the peer lazily (a proxy over `peerRef`) and register before
  any document is open. Bearer auth today; the one `authenticate()` function is the Phase-2
  OAuth swap point. The REST API is untouched (back-compat).
- **DRY skill + docs** — single source `packages/shared/src/skill.ts` →
  `pnpm --filter @motion/shared generate:agent-docs` regenerates `skills/motion/`,
  `plugins/{claude,codex}/skills/motion/`, and `docs/agent-document-guide.md`. The MCP
  server's `instructions` import the same `MCP_SERVER_INSTRUCTIONS`. The old REST-framed
  `skills/motion-agent/` was retired.
- **Plugins** — `plugins/claude/` (`.claude-plugin/plugin.json` + `.mcp.json`, listed in
  `plugins/.claude-plugin/marketplace.json`) and `plugins/codex/`
  (`.codex-plugin/plugin.json` + `.mcp.json`), each bundling the generated skill.

- **True OAuth 2.1** — the MCP server is now the authorization **and** resource server:
  discovery (`/.well-known/oauth-protected-resource` + `…-authorization-server`), dynamic
  client registration, `/oauth/authorize` → web consent (`/agent-consent`), `/oauth/token`
  (authorization-code + PKCE + refresh), and opaque, DB-backed access tokens validated per
  request (`apps/mcp-server/src/oauth.ts`, migration `019_oauth_agent_grants.sql`). Identity
  comes from Supabase; the consent screen lets the human pick workspace · role · mode ·
  expiry. The `401` advertises the discovery URL via `WWW-Authenticate`. **The plugins are
  now token-free.**

All of the above type-checks and builds (`@motion/shared`, `@motion/editor-extensions`,
`@motion/mcp-server`, `@motion/web`).

## Remaining

- **Apply + deploy:** run migration `019_oauth_agent_grants.sql` on Supabase and
  `fly deploy` the MCP server so `/mcp` + `/oauth/*` are live (set `MCP_PUBLIC_URL`,
  `WEB_APP_URL` — added to `fly.toml`).
- **Settings → Members & agents:** list/revoke `agent_grants` (table + member RLS exist;
  the React UI still manages the legacy `workspace_agent_tokens`).
- **Onboarding (Phase 5):** ShareButton "Add to Claude / Add to Codex"; flip the marketplace public.
- **Enhancements:** narrow consent scope to a folder/page (currently workspace-level);
  enforce role/mode per tool in the MCP context (expiry + revocation already enforced).

## Try it (OAuth — no token)

```bash
# Claude Code:
/plugin marketplace add auditt98/motion
/plugin install motion@studio65
# Codex:
codex mcp add motion --url https://motion-mcp-server.fly.dev/mcp
codex mcp login motion
```
First use opens the **`/agent-consent`** screen — sign in, pick workspace · role · mode ·
expiry, approve. Then ask the agent to "list my Motion pages" / "open my Roadmap doc and
suggest a tighter intro." Revoke anytime in Settings → Members & agents.
