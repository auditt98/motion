#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { YjsPeer } from "./yjs-peer.js";
import { registerAllTools } from "./tools.js";
import type { ToolContext } from "./tools.js";
import { SupabaseClient } from "./supabase-client.js";
import { startHttpServer } from "./http.js";
import { APP_NAME, APP_SLUG } from "@motion/shared";

const mode = process.argv.includes("--http") ? "http" : "stdio";

if (mode === "http") {
  // ─── HTTP mode ───
  // Deployed as a web service. Any LLM connects via REST API.
  // Sessions are created per-document — supports multiple documents and LLMs.
  const port = parseInt(process.env.PORT || "3001", 10);
  startHttpServer(port);
} else {
  // ─── Stdio mode ───
  // Local MCP server for Claude Desktop / Claude Code.
  // Connects to a single document specified by CLI arg or env var.
  const PARTYKIT_HOST =
    process.env.PARTYKIT_HOST || process.env.VITE_PARTYKIT_HOST || "localhost:1999";
  const DOCUMENT_ID = process.env.DOCUMENT_ID || process.argv[2];
  const AGENT_NAME = process.env.AGENT_NAME || "AI Agent";
  const WORKSPACE_ID = process.env.WORKSPACE_ID || "";

  const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!DOCUMENT_ID) {
    console.error(
      "Usage:\n" +
        `  ${APP_SLUG}-mcp <document-id>         # stdio mode (for Claude Desktop)\n` +
        `  ${APP_SLUG}-mcp --http                 # HTTP mode (for any LLM)\n\n` +
        "Environment variables:\n" +
        "  DOCUMENT_ID     - The document to connect to (stdio mode)\n" +
        "  PARTYKIT_HOST   - PartyKit server host (default: localhost:1999)\n" +
        "  AGENT_NAME      - Display name in the editor (default: AI Agent)\n" +
        "  WORKSPACE_ID    - Workspace ID for page/comment/version tools\n" +
        "  SUPABASE_URL    - Supabase project URL\n" +
        "  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key\n" +
        "  PORT            - HTTP server port (default: 3001, http mode only)",
    );
    process.exit(1);
  }

  const peer = new YjsPeer(DOCUMENT_ID, PARTYKIT_HOST, AGENT_NAME);
  const supabase = new SupabaseClient({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY });

  const ctx: ToolContext = {
    peer,
    supabase,
    workspaceId: WORKSPACE_ID,
    documentId: DOCUMENT_ID,
    partykitHost: PARTYKIT_HOST,
    agentName: AGENT_NAME,
    peerRef: { current: peer },
  };

  const server = new McpServer({
    name: `${APP_SLUG}-document`,
    version: "0.0.1",
  });

  registerAllTools(server, ctx);

  async function main() {
    await peer.connect();
    console.error(`Connected to document ${DOCUMENT_ID} on ${PARTYKIT_HOST}`);
    console.error(`Agent name: ${AGENT_NAME}`);
    if (supabase.isConfigured) {
      console.error(`Supabase configured — workspace/comment/version tools available`);
    } else {
      console.error(`Supabase not configured — only document editing tools available`);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`${APP_NAME} MCP Document Server running on stdio`);
  }

  process.on("SIGINT", () => {
    ctx.peerRef.current.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    ctx.peerRef.current.disconnect();
    process.exit(0);
  });

  main().catch((error) => {
    console.error("Fatal error:", error);
    ctx.peerRef.current.disconnect();
    process.exit(1);
  });
}
