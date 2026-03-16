# Agent Quick Actions

## Problem

Users must manually copy agent instructions, open their AI tool, paste the instructions, and configure access. There's no in-app way to trigger common AI tasks like proofreading, summarizing, or translating. The barrier to first AI use is too high — most users won't complete this flow.

## Priority

**Sprint 10.** ~2–3 days of effort. High differentiation impact — lowers the barrier to the core AI collaboration feature.

## What to Build

### 1. Agent action palette

Add an "AI" button to the editor toolbar or header bar. Clicking opens a palette of pre-built agent actions:

| Action | What it does |
|--------|-------------|
| Proofread | Check grammar, spelling, and clarity |
| Summarize | Generate a summary at the top of the document |
| Translate | Translate the document to a selected language |
| Expand | Elaborate on selected text or outline |
| Shorten | Condense selected text while preserving meaning |
| Fix formatting | Clean up inconsistent headings, lists, spacing |
| Generate from outline | Convert bullet points to full prose |

### 2. Action execution flow

When a user selects an action:

1. **Generate agent instructions** — combine the action prompt + document context + invite token
2. **Call MCP server directly** — the web app calls the MCP server's HTTP API to create a session and execute the action
3. **Show progress** — agent presence appears in the presence bar with status ("Proofreading...")
4. **Results appear in real-time** — edits flow through Yjs like any agent edit
5. **Use suggestion mode** — if Sprint 4 (suggestion mode) is done, agent actions default to suggesting mode

This means the web app acts as the agent client — no external tool needed. The "AI brain" could be:
- A built-in Claude/GPT API call from a Supabase edge function
- Or simply generating the right MCP instructions for the user to paste into their own AI tool (simpler, no LLM cost)

### 3. Start simple: Copy-to-clipboard approach (v1)

Before building a full in-app agent runtime, start with:

- User selects an action (e.g., "Proofread")
- App generates a pre-formatted prompt that includes: the action instruction, the document invite URL, the MCP server connection details
- Copies to clipboard with a toast: "Instructions copied — paste into Claude or your AI tool"
- This is nearly zero backend work and immediately useful

### 4. In-app agent runtime (v2, stretch)

For users who want one-click AI actions:

- Supabase edge function that calls the Claude API (or configurable LLM)
- Edge function connects to the document via MCP server
- Executes the action and disconnects
- User sees the agent editing in real-time
- Requires: API key management in workspace settings, LLM cost tracking

## Files to Modify

- `apps/web/src/components/editor/AgentActionPalette.tsx` (new)
- `apps/web/src/components/editor/EditorPage.tsx` — add AI button
- `packages/shared/src/agent-guide.ts` — extend with per-action prompts
- (v2) `supabase/functions/agent-action/` (new edge function)

## Verification

1. Click AI button → action palette appears
2. Select "Proofread" → instructions copied to clipboard
3. Paste into Claude → agent connects and proofreads the document
4. Agent appears in presence bar during editing
5. (v2) One-click action → agent runs in-app without external tool

## Dependencies

- Benefits greatly from Sprint 4 (suggestion mode) — agent actions in suggest mode are much safer
- Benefits from Sprint 3 (version history) — users can revert if an agent action goes wrong
