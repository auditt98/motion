# Motion plugin for Codex

Connect OpenAI **Codex** (CLI and IDE) to your Motion workspace.

Codex does **not** surface an MCP server's instructions/prompts/resources to the model —
only **skills** and `AGENTS.md` reach it. So this plugin bundles the **`motion` skill**
(the same one the Claude plugin uses) alongside the MCP server config. The skill teaches
the document/block model, suggestion-mode etiquette, and the read → edit → verify workflow.

## Install

```bash
# 1. Add the remote MCP server
codex mcp add motion --url https://motion-mcp-server.fly.dev/mcp

# 2. Authorize over OAuth (opens a browser consent screen — no token to paste)
codex mcp login motion
```

Equivalent `~/.codex/config.toml`:

```toml
[mcp_servers.motion]
url = "https://motion-mcp-server.fly.dev/mcp"
```

Signing in opens Motion's `/agent-consent` screen: pick the workspace · role · mode · expiry
and approve. Codex stores the scoped, expiring token and refreshes it automatically.

## The skill

Install the bundled skill so Codex knows *how* to use Motion (not just that the tools
exist): copy `skills/motion/` into your Codex skills directory (e.g. `~/.codex/skills/`),
or install via the Codex plugin once published. List it with `/skills`; reference it with
`$motion`.

## Verify

Ask Codex to *"open my Motion roadmap and suggest a tighter intro."* `/skills` should list
`motion`, the `motion` MCP tools should be available, and a suggestion edit should land in
the document.
