# Motion plugins

One MCP server + one skill, packaged for both agent platforms. Same teaching content,
same tools — the only difference is the wrapper each client understands.

| Path | What it is | Install |
|------|-----------|---------|
| [`claude/`](claude/) | Claude Code / Desktop plugin — bundles the MCP server (`.mcp.json`) + the `motion` skill | `/plugin marketplace add auditt98/motion` → `/plugin install motion@studio65` |
| [`codex/`](codex/) | Codex plugin — bundles the same skill; MCP server added via `codex mcp add` | `codex mcp add motion --url https://motion-mcp-server.fly.dev/mcp` |
| [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | Claude marketplace manifest listing the `motion` plugin | — |

## Why a skill *and* an MCP server

- The **MCP server** gives the agent the *capability* (47 self-describing tools).
- The **skill** gives the agent the *know-how* — the ProseMirror-JSON block model, stable
  block IDs, when to use which tool, and that edits default to reviewable **suggestions**.

A skill is required (not just MCP-delivered guidance) because **Codex doesn't surface an
MCP server's instructions/prompts/resources to the model** — only skills and `AGENTS.md`
do. Claude Code surfaces MCP instructions too, but the skill keeps both platforms aligned.

## DRY

The skill text and the MCP server's `instructions`/prompt/resource all derive from a single
source — `packages/shared/src/agent-guide.ts` — via the generator in
`packages/shared` (`pnpm --filter @motion/shared generate:agent-docs`). Edit the guide
once; regenerate to update the skill, the docs, and the server instructions together.

## Distribution

Private first (point `/plugin marketplace add` / `codex mcp add` at a private clone), then
flip the same files to a public marketplace listing — no repackaging.
