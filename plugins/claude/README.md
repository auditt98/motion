# Motion plugin for Claude

Connect Claude (Claude Code, Claude Desktop) to your **Motion** workspace. The plugin
bundles two things:

- **MCP server** — the remote Motion MCP server (`https://motion-mcp-server.fly.dev/mcp`),
  exposing the full toolset: read/edit documents by stable block ID, manage pages &
  folders, comments, version history, suggestions, search, and databases.
- **Skill** (`motion`) — teaches the agent the document/block model (ProseMirror JSON),
  suggestion-mode etiquette, and the read → edit → verify workflow, so it uses the tools
  well. Loads automatically when you work with Motion; or invoke it with `/motion:motion`.

## Install

```
/plugin marketplace add auditt98/motion        # path: plugins/ in the repo
/plugin install motion@studio65
```

> The marketplace lives at `plugins/.claude-plugin/marketplace.json` in the
> [motion repo](https://github.com/auditt98/motion). For a private rollout, point
> `/plugin marketplace add` at a private clone; the same files publish unchanged later.

## Authentication — OAuth, no tokens

The first time the agent connects, Claude opens a browser **consent** screen
(`/agent-consent`): sign in to Motion, pick the **workspace · role · mode (Suggest/Direct) ·
expiry**, and approve. Claude receives a scoped, expiring token automatically and refreshes
it silently — nothing to copy or paste. The grant appears in **Settings → Members & agents**
and is revocable there anytime.

Under the hood the Motion MCP server implements OAuth 2.1 (authorization-code + PKCE +
dynamic client registration); Claude discovers it from the server's
`/.well-known/oauth-protected-resource` after a `401`.

## Verify

Ask Claude to *"list my Motion pages"* or *"open my Roadmap doc and suggest a tighter intro."*
The skill should load, the `motion` MCP tools should appear, and a suggestion edit should
land in the document (visible in real time to other editors).
