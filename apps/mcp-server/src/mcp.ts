import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getSchema } from "@tiptap/core";
import {
  getSchemaExtensions,
  getMarkTypes,
  getBlockTypes,
} from "@motion/editor-extensions";
import { MCP_SERVER_INSTRUCTIONS } from "@motion/shared";
import { validateAccessToken, resourceMetadataUrl } from "./oauth.js";
import { YjsPeer } from "./yjs-peer.js";
import { SupabaseClient } from "./supabase-client.js";
import { registerAllTools, type ToolContext } from "./tools.js";

/**
 * Real remote MCP server (Streamable HTTP) for Motion.
 *
 * Serves the same 47 tools defined in tools.ts over the MCP protocol so any
 * MCP client (Claude Code/Desktop/claude.ai, Codex, …) can connect by URL.
 * The REST API in http.ts remains for backward compatibility.
 *
 * Phase 1 authenticates with the existing workspace agent token presented as
 * `Authorization: Bearer <token>`. Phase 2 replaces this with OAuth 2.1
 * (Supabase as the authorization server) — see `authenticate()` below, the one
 * place that needs to change.
 */

const PARTYKIT_HOST =
  process.env.PARTYKIT_HOST || process.env.VITE_PARTYKIT_HOST || "localhost:1999";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const sbClient = new SupabaseClient({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY });

// Schema type lists are document-independent — resolve them once so tool
// descriptions can be built before any document (peer) is connected.
const SCHEMA = getSchema(getSchemaExtensions());
const AVAILABLE_MARKS = getMarkTypes(SCHEMA);
const AVAILABLE_BLOCK_TYPES = getBlockTypes(SCHEMA);

interface AuthPrincipal {
  workspaceId: string;
  agentName: string;
}

/**
 * Authenticate an MCP initialize request.
 * Phase 1: validate the workspace agent token in the Bearer header.
 * Phase 2: validate an OAuth access token (JWKS signature, audience, scope, expiry).
 */
async function authenticate(req: IncomingMessage): Promise<AuthPrincipal | null> {
  const header = req.headers["authorization"];
  if (!header || Array.isArray(header)) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();

  // Primary: OAuth 2.1 access token (scoped, expiring agent_grants).
  const principal = await validateAccessToken(token);
  if (principal) {
    return { workspaceId: principal.workspaceId, agentName: principal.agentName };
  }

  // Fallback: legacy static workspace agent token (deprecated; removed once OAuth is the norm).
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { workspaceId: "dev", agentName: "AI Agent" };
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_agent_tokens?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=workspace_id,name&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ workspace_id: string; name: string }>;
  if (!rows.length) return null;
  return { workspaceId: rows[0].workspace_id, agentName: rows[0].name };
}

/**
 * A lazy proxy that resolves `peerRef.current` on every access. Document tools
 * close over this once at registration but always act on the live peer, and get
 * a clear error when no document is connected yet.
 */
function makePeerProxy(peerRef: { current: YjsPeer | null }): YjsPeer {
  return new Proxy({} as YjsPeer, {
    get(_target, prop) {
      const peer = peerRef.current;
      if (!peer) {
        throw new Error(
          "No document is connected. Use create_and_edit_page (to start a new page) or switch_document / list_pages (to open an existing one) before reading or editing document content.",
        );
      }
      const value = (peer as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(peer)
        : value;
    },
  });
}

function buildServer(principal: AuthPrincipal): { server: McpServer; peerRef: { current: YjsPeer | null } } {
  const peerRef: { current: YjsPeer | null } = { current: null };
  const ctx: ToolContext = {
    peer: makePeerProxy(peerRef),
    supabase: sbClient,
    workspaceId: principal.workspaceId,
    documentId: "",
    partykitHost: PARTYKIT_HOST,
    agentName: principal.agentName,
    peerRef,
    availableMarks: AVAILABLE_MARKS,
    availableBlockTypes: AVAILABLE_BLOCK_TYPES,
  };

  const server = new McpServer(
    { name: "motion", version: "0.1.0" },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );
  registerAllTools(server, ctx);
  return { server, peerRef };
}

// Active transports keyed by the MCP session id (mcp-session-id header).
const transports = new Map<string, StreamableHTTPServerTransport>();

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Handle a request to the `/mcp` endpoint (Streamable HTTP transport).
 * Mounted from http.ts. Supports POST (messages), GET (SSE stream), DELETE (end session).
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);
  const method = req.method ?? "GET";
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (method === "POST") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
      return;
    }

    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (!isInitializeRequest(body)) {
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: { code: -32000, message: "No valid MCP session. Send an initialize request first." },
          id: null,
        });
        return;
      }

      const principal = await authenticate(req);
      if (!principal) {
        setCors(res);
        res.writeHead(401, {
          "Content-Type": "application/json",
          // Point MCP clients at the protected-resource metadata so they can run the OAuth flow.
          "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl(req)}"`,
        });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }));
        return;
      }

      const { server, peerRef } = buildServer(principal);
      const created = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, created);
        },
      });
      created.onclose = () => {
        const sid = created.sessionId;
        if (sid) transports.delete(sid);
        peerRef.current?.disconnect();
        peerRef.current = null;
      };
      await server.connect(created);
      transport = created;
    }

    await transport.handleRequest(req, res, body);
    return;
  }

  if (method === "GET" || method === "DELETE") {
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      sendJson(res, 400, { error: "Unknown or missing MCP session id." });
      return;
    }
    await transport.handleRequest(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
