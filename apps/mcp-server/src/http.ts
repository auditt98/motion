import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { YjsPeer } from "./yjs-peer.js";
import { SupabaseClient } from "./supabase-client.js";
import { computeInsertPosition, renumberPositions, APP_NAME } from "@motion/shared";

type EditMode = "direct" | "suggest";
function getEditMode(body: Record<string, unknown>): EditMode {
  return body.mode === "direct" ? "direct" : "suggest";
}

const PARTYKIT_HOST =
  process.env.PARTYKIT_HOST || process.env.VITE_PARTYKIT_HOST || "localhost:1999";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Validate a workspace invite link token and check the document belongs to that workspace.
 * Returns the workspace_id on success, null if invalid/unauthorized.
 */
async function validateInviteToken(
  inviteToken: string,
  documentId?: string,
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // No Supabase configured — open access (dev mode)
    return "dev";
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  // 1. Look up the invite link
  const linkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_invite_links?token=eq.${encodeURIComponent(inviteToken)}&select=workspace_id,is_active,expires_at&limit=1`,
    { headers },
  );
  const links = (await linkRes.json()) as Array<{
    workspace_id: string;
    is_active: boolean;
    expires_at: string | null;
  }>;

  if (!links.length || !links[0].is_active) return null;
  if (links[0].expires_at && new Date(links[0].expires_at) < new Date()) return null;

  const workspaceId = links[0].workspace_id;

  // 2. If a document ID was provided, verify it belongs to this workspace
  if (documentId) {
    const pageRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pages?id=eq.${encodeURIComponent(documentId)}&select=workspace_id&limit=1`,
      { headers },
    );
    const pages = (await pageRes.json()) as Array<{ workspace_id: string }>;

    if (!pages.length || pages[0].workspace_id !== workspaceId) return null;
  }

  return workspaceId;
}

/**
 * Validate a dedicated agent token.
 * Returns workspace_id + token name on success, null if invalid/revoked.
 */
async function validateAgentToken(
  token: string,
): Promise<{ workspaceId: string; name: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { workspaceId: "dev", name: "AI Agent" };
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_agent_tokens?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=workspace_id,name&limit=1`,
    { headers },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ workspace_id: string; name: string }>;
  if (!rows.length) return null;

  return { workspaceId: rows[0].workspace_id, name: rows[0].name };
}

interface Session {
  id: string;
  peer: YjsPeer | null;
  documentId: string | null;
  workspaceId: string;
  agentName: string;
  createdAt: number;
}

interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  position: number;
  is_favorite: boolean;
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const sbClient = new SupabaseClient({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY });

async function listWorkspacePages(workspaceId: string): Promise<PageRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pages?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,title,icon,parent_id,position,is_favorite&order=position.asc`,
    { headers: supabaseHeaders },
  );
  return (await res.json()) as PageRow[];
}

async function updatePagePosition(
  pageId: string,
  parentId: string | null,
  position: number,
  workspaceId?: string,
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  let url = `${SUPABASE_URL}/rest/v1/pages?id=eq.${encodeURIComponent(pageId)}`;
  if (workspaceId) url += `&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...supabaseHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ parent_id: parentId, position }),
  });
  return res.ok;
}

const sessions = new Map<string, Session>();

/**
 * Simple REST API so any LLM can edit documents via function/tool calling.
 *
 * Endpoints:
 *   POST   /sessions                      — Connect to a document
 *   DELETE  /sessions/:id                  — Disconnect
 *   GET    /sessions/:id/document          — Read full document
 *   GET    /sessions/:id/blocks/:index     — Read a single block
 *   POST   /sessions/:id/blocks            — Insert a block
 *   PUT    /sessions/:id/blocks/:index     — Update a block
 *   DELETE /sessions/:id/blocks/:index     — Delete a block
 *   POST   /sessions/:id/blocks/move       — Move a block
 *   POST   /sessions/:id/blocks/:index/replace — Find and replace text
 */

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) {
        resolve({});
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

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  const path = url.pathname;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (path === "/health" && method === "GET") {
    json(res, 200, { status: "ok", sessions: sessions.size });
    return;
  }

  // POST /sessions — create a new session
  // document_id is optional — without it you get workspace-level access only (pages, comments, versions)
  if (path === "/sessions" && method === "POST") {
    const body = await parseBody(req);
    const documentId = (body.document_id as string | undefined) || null;
    const agentToken = body.agent_token as string | undefined;
    const inviteToken = body.invite_token as string | undefined;

    // Resolve workspace via agent_token (preferred) or invite_token (legacy)
    let workspaceId: string | null = null;
    let agentName = (body.agent_name as string) || "";

    if (agentToken) {
      const result = await validateAgentToken(agentToken);
      if (!result) {
        json(res, 403, { error: "Invalid or revoked agent token." });
        return;
      }
      workspaceId = result.workspaceId;
      if (!agentName) agentName = result.name;

      // If document_id provided, verify it belongs to this workspace
      if (documentId && workspaceId !== "dev") {
        const belongs = await sbClient.verifyPageInWorkspace(documentId, workspaceId);
        if (!belongs) {
          json(res, 403, { error: "Document does not belong to this workspace." });
          return;
        }
      }
    } else if (inviteToken) {
      workspaceId = await validateInviteToken(inviteToken, documentId ?? undefined);
      if (!workspaceId) {
        json(res, 403, { error: "Invalid or expired invite token, or document does not belong to that workspace." });
        return;
      }
    } else {
      json(res, 401, { error: "agent_token or invite_token is required." });
      return;
    }

    if (!agentName) agentName = "AI Agent";

    const id = randomUUID();
    let peer: YjsPeer | null = null;
    if (documentId) {
      peer = new YjsPeer(documentId, PARTYKIT_HOST, agentName);
      await peer.connect();
    }

    const session: Session = { id, peer, documentId, workspaceId, agentName, createdAt: Date.now() };
    sessions.set(id, session);

    json(res, 201, {
      session_id: id,
      document_id: documentId,
      agent_name: agentName,
      tools: [
        // Document editing
        "GET    /sessions/:id/document          — Read full document as PM JSON",
        "GET    /sessions/:id/blocks/:block_id  — Read block as PM JSON",
        "POST   /sessions/:id/blocks            — Insert block (PM JSON or plain text)",
        "PUT    /sessions/:id/blocks/:block_id  — Replace block (PM JSON or plain text)",
        "DELETE /sessions/:id/blocks/:block_id  — Delete block",
        "POST   /sessions/:id/blocks/:block_id/move    — Move block",
        "POST   /sessions/:id/blocks/:block_id/replace — Find and replace text",
        "POST   /sessions/:id/blocks/:block_id/format-by-match — Apply/remove marks by text match",
        "POST   /sessions/:id/blocks/:block_id/format  — Apply/remove marks by offset",
        // Page management
        "GET    /sessions/:id/pages             — List workspace pages",
        "POST   /sessions/:id/pages             — Create page",
        "PATCH  /sessions/:id/pages/:page_id    — Rename page",
        "DELETE /sessions/:id/pages/:page_id    — Soft-delete page",
        "POST   /sessions/:id/pages/:page_id/restore — Restore from trash",
        "POST   /sessions/:id/pages/move        — Move page",
        // Comments
        "GET    /sessions/:id/comments          — List comment threads",
        "POST   /sessions/:id/comments          — Create comment thread",
        "POST   /sessions/:id/comments/:id/reply   — Reply to thread",
        "POST   /sessions/:id/comments/:id/resolve — Resolve thread",
        "POST   /sessions/:id/comments/:id/reopen  — Reopen thread",
        // Versions
        "GET    /sessions/:id/versions          — List versions",
        "POST   /sessions/:id/versions          — Save version snapshot",
        // Export
        "GET    /sessions/:id/export?format=markdown|html — Export document",
        // Suggestions
        "GET    /sessions/:id/suggestions       — List pending suggestions",
        "POST   /sessions/:id/suggestions/:id/accept — Accept suggestion",
        "POST   /sessions/:id/suggestions/:id/reject — Reject suggestion",
        "POST   /sessions/:id/suggestions/accept-all — Accept all",
        "POST   /sessions/:id/suggestions/reject-all — Reject all",
        // Session
        "DELETE /sessions/:id                   — Disconnect",
      ],
    });
    return;
  }

  // All other routes require /sessions/:id/...
  const sessionMatch = path.match(/^\/sessions\/([^/]+)(\/.*)?$/);
  if (!sessionMatch) {
    json(res, 404, { error: "Not found" });
    return;
  }

  const sessionId = sessionMatch[1];
  const subpath = sessionMatch[2] ?? "";
  const session = getSession(sessionId);

  if (!session) {
    json(res, 404, { error: "Session not found. Create one with POST /sessions." });
    return;
  }

  // session is guaranteed non-null past this point
  const s = session;

  /** Returns the Yjs peer or sends a 400 and returns null. */
  function requirePeer(): YjsPeer | null {
    if (s.peer) return s.peer;
    json(res, 400, { error: "This session has no document connected. Create a session with document_id, or use POST /sessions/:id/connect to connect to a document." });
    return null;
  }

  // DELETE /sessions/:id — disconnect
  if (subpath === "" && method === "DELETE") {
    session.peer?.disconnect();
    sessions.delete(sessionId);
    json(res, 200, { disconnected: true });
    return;
  }

  // POST /sessions/:id/connect — connect to a document (for workspace-only sessions)
  if (subpath === "/connect" && method === "POST") {
    const body = await parseBody(req);
    const docId = body.document_id as string | undefined;
    if (!docId) {
      json(res, 400, { error: "document_id is required" });
      return;
    }
    // Verify document belongs to this workspace
    if (session.workspaceId !== "dev") {
      const belongs = await sbClient.verifyPageInWorkspace(docId, session.workspaceId);
      if (!belongs) {
        json(res, 403, { error: "Resource does not belong to this workspace" });
        return;
      }
    }
    // Disconnect existing peer if any
    session.peer?.disconnect();
    const peer = new YjsPeer(docId, PARTYKIT_HOST, session.agentName);
    await peer.connect();
    session.peer = peer;
    session.documentId = docId;
    json(res, 200, { connected: true, document_id: docId });
    return;
  }

  // ─── Document editing (requires peer) ────────────────────────────────

  // GET /sessions/:id/document — read full document as PM JSON
  if (subpath === "/document" && method === "GET") {
    const p = requirePeer(); if (!p) return;
    p.updateAwareness("thinking", "Reading document...");
    const blocks = p.readDocumentJSON();
    p.updateAwareness("idle", "");
    json(res, 200, { blocks });
    return;
  }

  // POST /sessions/:id/blocks — insert a block
  if (subpath === "/blocks" && method === "POST") {
    const p = requirePeer(); if (!p) return;
    const body = await parseBody(req);
    const index = (body.index as number) ?? -1;
    const insertAt = index === -1 ? p.getBlockCount() : index;

    const mode = getEditMode(body);

    if (body.block && typeof body.block === "object") {
      const block = body.block as Record<string, unknown>;
      p.updateAwareness("writing", `Inserting ${(block.type as string) || "block"}...`);
      try {
        const blockId = mode === "suggest"
          ? p.insertBlockJSONAsSuggestion(insertAt, block)
          : p.insertBlockJSON(insertAt, block);
        p.updateAwareness("idle", "");
        json(res, 201, { inserted: true, block_id: blockId, index: insertAt, mode });
      } catch (e) {
        p.updateAwareness("idle", "");
        json(res, 400, { error: `Validation error: ${(e as Error).message}` });
      }
      return;
    }

    const type = body.type as string;
    const content = body.content as string;
    const attrs = body.attrs as Record<string, unknown> | undefined;

    if (!type || content === undefined) {
      json(res, 400, { error: "Either 'block' (PM JSON) or 'type' + 'content' are required" });
      return;
    }

    p.updateAwareness("writing", `Inserting ${type}...`);
    const blockId = mode === "suggest"
      ? p.insertBlockAsSuggestion(insertAt, type, content, attrs)
      : p.insertBlock(insertAt, type, content, attrs);
    p.updateAwareness("idle", "");
    json(res, 201, { inserted: true, block_id: blockId, index: insertAt, type, mode });
    return;
  }

  // Routes with block ID: /blocks/:block_id
  const blockMatch = subpath.match(/^\/blocks\/([^/]+)(\/.*)?$/);
  if (blockMatch) {
    const p = requirePeer(); if (!p) return;
    const blockId = blockMatch[1];
    const blockSubpath = blockMatch[2] ?? "";

    if (blockSubpath === "/move" && method === "POST") {
      const body = await parseBody(req);
      const toIndex = body.to_index as number;
      if (toIndex === undefined) { json(res, 400, { error: "to_index is required" }); return; }
      p.updateAwareness("writing", `Moving block...`);
      const success = p.moveBlockById(blockId, toIndex);
      p.updateAwareness("idle", "");
      if (!success) { json(res, 400, { error: `Could not move block ${blockId} to index ${toIndex}` }); return; }
      json(res, 200, { moved: true, block_id: blockId, to_index: toIndex });
      return;
    }

    if (blockSubpath === "" && method === "GET") {
      p.updateAwareness("thinking", `Reading block ${blockId}...`);
      const result = p.readBlockJSONById(blockId);
      p.updateAwareness("idle", "");
      if (!result) { json(res, 404, { error: `No block with ID ${blockId}.` }); return; }
      json(res, 200, result);
      return;
    }

    if (blockSubpath === "" && method === "PUT") {
      const body = await parseBody(req);
      const mode = getEditMode(body);

      if (body.block && typeof body.block === "object") {
        const block = body.block as Record<string, unknown>;
        p.updateAwareness("writing", `Replacing block ${blockId}...`);
        try {
          if (mode === "suggest") {
            // Mark old text as suggestion-delete, insert new block as suggestion
            const oldBlock = p.readBlockById(blockId);
            if (!oldBlock) { p.updateAwareness("idle", ""); json(res, 404, { error: `No block with ID ${blockId}` }); return; }
            if (oldBlock.content) {
              p.formatTextByMatch(blockId, oldBlock.content, "suggestionDelete", {
                suggestionId: randomUUID(),
                authorId: `agent:${s.agentName}`,
                authorName: s.agentName,
                createdAt: new Date().toISOString(),
              });
            }
            const insertIndex = p.getBlockIndexById(blockId);
            const insertAt = insertIndex >= 0 ? insertIndex + 1 : p.getBlockCount();
            p.insertBlockJSONAsSuggestion(insertAt, block);
            p.updateAwareness("idle", "");
            json(res, 200, { replaced: true, block_id: blockId, mode });
          } else {
            const success = p.replaceBlockJSON(blockId, block);
            p.updateAwareness("idle", "");
            if (!success) { json(res, 404, { error: `No block with ID ${blockId}` }); return; }
            json(res, 200, { replaced: true, block_id: blockId, mode });
          }
        } catch (e) {
          p.updateAwareness("idle", "");
          json(res, 400, { error: `Validation error: ${(e as Error).message}` });
        }
        return;
      }
      const content = body.content as string;
      if (content === undefined) { json(res, 400, { error: "Either 'block' (PM JSON) or 'content' is required" }); return; }
      p.updateAwareness("writing", `Updating block ${blockId}...`);
      const success = mode === "suggest"
        ? p.updateBlockAsSuggestion(blockId, content)
        : p.updateBlockById(blockId, content);
      p.updateAwareness("idle", "");
      if (!success) { json(res, 400, { error: `No block with ID ${blockId}` }); return; }
      json(res, 200, { updated: true, block_id: blockId, mode });
      return;
    }

    if (blockSubpath === "" && method === "DELETE") {
      const body = await parseBody(req);
      const mode = getEditMode(body);
      p.updateAwareness("writing", `Deleting block ${blockId}...`);
      const success = mode === "suggest"
        ? p.deleteBlockAsSuggestion(blockId)
        : p.deleteBlockById(blockId);
      p.updateAwareness("idle", "");
      if (!success) { json(res, 400, { error: `No block with ID ${blockId}` }); return; }
      json(res, 200, { deleted: true, block_id: blockId, mode });
      return;
    }

    if (blockSubpath === "/format-by-match" && method === "POST") {
      const body = await parseBody(req);
      const text = body.text as string;
      const mark = body.mark as string;
      const attrs = body.attrs as Record<string, unknown> | undefined;
      const occurrence = (body.occurrence as number | undefined) ?? 1;
      const remove = body.remove as boolean | undefined;
      if (!text || !mark) { json(res, 400, { error: "text and mark are required" }); return; }
      p.updateAwareness("writing", `Formatting text in block ${blockId}...`);
      const result = p.formatTextByMatch(blockId, text, mark, attrs, occurrence, remove ?? false);
      p.updateAwareness("idle", "");
      if (!result.success) {
        const reason = result.totalOccurrences === 0
          ? `Could not find "${text}" in block ${blockId}`
          : `Only found ${result.totalOccurrences} occurrence(s) of "${text}", but occurrence ${occurrence} was requested`;
        json(res, 400, { error: reason });
        return;
      }
      json(res, 200, { formatted: true, block_id: blockId, mark, text, occurrence, total_occurrences: result.totalOccurrences });
      return;
    }

    if (blockSubpath === "/format" && method === "POST") {
      const body = await parseBody(req);
      const start = body.start as number;
      const length = body.length as number;
      const mark = body.mark as string;
      const attrs = body.attrs as Record<string, unknown> | undefined;
      const remove = body.remove as boolean | undefined;
      if (start === undefined || length === undefined || !mark) { json(res, 400, { error: "start, length, and mark are required" }); return; }
      p.updateAwareness("writing", `Formatting text in block ${blockId}...`);
      const success = remove ? p.removeFormatById(blockId, start, length, mark) : p.formatTextById(blockId, start, length, mark, attrs);
      p.updateAwareness("idle", "");
      if (!success) { json(res, 400, { error: `Could not apply mark "${mark}" to block ${blockId}` }); return; }
      json(res, 200, { formatted: true, block_id: blockId, mark, start, length });
      return;
    }

    if (blockSubpath === "/replace" && method === "POST") {
      const body = await parseBody(req);
      const search = body.search as string;
      const replacement = body.replacement as string;
      const mode = getEditMode(body);
      if (!search || replacement === undefined) { json(res, 400, { error: "search and replacement are required" }); return; }
      p.updateAwareness("writing", `Replacing text...`);
      const success = mode === "suggest"
        ? p.replaceTextAsSuggestion(blockId, search, replacement)
        : p.replaceTextById(blockId, search, replacement);
      p.updateAwareness("idle", "");
      if (!success) { json(res, 400, { error: `Could not find "${search}" in block ${blockId}` }); return; }
      json(res, 200, { replaced: true, block_id: blockId, mode });
      return;
    }
  }

  // GET /sessions/:id/pages — list all pages in the workspace
  if (subpath === "/pages" && method === "GET") {
    const pages = await listWorkspacePages(session.workspaceId);
    json(res, 200, { pages });
    return;
  }

  // POST /sessions/:id/pages/move — move a page to a new position
  if (subpath === "/pages/move" && method === "POST") {
    const body = await parseBody(req);
    const pageId = body.page_id as string | undefined;
    const afterPageId = body.after_page_id as string | null | undefined;
    const parentId = (body.parent_id as string | null | undefined) ?? null;

    if (!pageId) {
      json(res, 400, { error: "page_id is required" });
      return;
    }

    const allPages = await listWorkspacePages(session.workspaceId);

    // Get siblings (same parent), sorted by position, excluding the moved page
    const siblings = allPages
      .filter((p) => p.parent_id === parentId && p.id !== pageId)
      .sort((a, b) => a.position - b.position);

    // Compute target index
    let targetIndex: number;
    if (afterPageId === null || afterPageId === undefined) {
      targetIndex = 0; // Move to first position
    } else {
      const afterIdx = siblings.findIndex((p) => p.id === afterPageId);
      targetIndex = afterIdx === -1 ? siblings.length : afterIdx + 1;
    }

    const siblingPositions = siblings.map((p) => p.position);
    let { position: newPosition, needsRenumber } = computeInsertPosition(
      siblingPositions,
      targetIndex,
    );

    if (needsRenumber) {
      const fresh = renumberPositions(siblings.length + 1);
      let posIdx = 0;
      for (let i = 0; i <= siblings.length; i++) {
        if (i === targetIndex) {
          newPosition = fresh[posIdx++];
        } else {
          const sib = siblings[i > targetIndex ? i - 1 : i];
          if (sib) {
            await updatePagePosition(sib.id, sib.parent_id, fresh[posIdx++], session.workspaceId);
          }
        }
      }
    }

    const success = await updatePagePosition(pageId, parentId, newPosition, session.workspaceId);
    if (!success) {
      json(res, 500, { error: "Failed to update page position" });
      return;
    }

    json(res, 200, { moved: true, page_id: pageId, position: newPosition, parent_id: parentId });
    return;
  }

  // POST /sessions/:id/pages — create a new page
  if (subpath === "/pages" && method === "POST") {
    const body = await parseBody(req);
    const title = (body.title as string) || "Untitled";
    const parentId = (body.parent_id as string | null) ?? null;
    const folderId = (body.folder_id as string | null) ?? null;
    const autoConnect = body.auto_connect === true;

    const page = await sbClient.createPage(session.workspaceId, title, {
      parentId,
      folderId,
      createdBy: `agent:${session.agentName}`,
    });
    if (!page) {
      json(res, 500, { error: "Failed to create page" });
      return;
    }

    if (autoConnect) {
      session.peer?.disconnect();
      const peer = new YjsPeer(page.id, PARTYKIT_HOST, session.agentName);
      await peer.connect();
      session.peer = peer;
      session.documentId = page.id;
      json(res, 201, { ...page, connected: true, document_id: page.id });
    } else {
      json(res, 201, page);
    }
    return;
  }

  // PATCH /sessions/:id/pages/:page_id — rename a page
  const pageActionMatch = subpath.match(/^\/pages\/([^/]+)(\/.*)?$/);
  if (pageActionMatch) {
    const pageId = pageActionMatch[1];
    const pageSubpath = pageActionMatch[2] ?? "";

    if (pageSubpath === "" && method === "PATCH") {
      const body = await parseBody(req);
      const title = body.title as string | undefined;
      if (!title) {
        json(res, 400, { error: "title is required" });
        return;
      }
      const ok = await sbClient.renamePage(pageId, title, session.workspaceId);
      json(res, ok ? 200 : 500, ok ? { renamed: true, page_id: pageId } : { error: "Failed to rename page" });
      return;
    }

    // DELETE /sessions/:id/pages/:page_id — soft-delete
    if (pageSubpath === "" && method === "DELETE") {
      const ok = await sbClient.softDeletePage(pageId, `agent:${session.agentName}`, session.workspaceId);
      json(res, ok ? 200 : 500, ok ? { deleted: true, page_id: pageId } : { error: "Failed to delete page" });
      return;
    }

    // POST /sessions/:id/pages/:page_id/restore — restore from trash
    if (pageSubpath === "/restore" && method === "POST") {
      const ok = await sbClient.restorePage(pageId, session.workspaceId);
      json(res, ok ? 200 : 500, ok ? { restored: true, page_id: pageId } : { error: "Failed to restore page" });
      return;
    }
  }

  // ─── Folders (workspace-level) ───

  // GET /sessions/:id/folders — list folders
  if (subpath === "/folders" && method === "GET") {
    const folders = await sbClient.listFolders(session.workspaceId);
    json(res, 200, { folders });
    return;
  }

  // POST /sessions/:id/folders — create folder
  if (subpath === "/folders" && method === "POST") {
    const body = await parseBody(req);
    const name = (body.name as string) || "Untitled folder";
    const folder = await sbClient.createFolder(session.workspaceId, name, `agent:${session.agentName}`);
    if (!folder) { json(res, 500, { error: "Failed to create folder" }); return; }
    json(res, 201, folder);
    return;
  }

  // Routes with folder ID: /folders/:folder_id
  const folderMatch = subpath.match(/^\/folders\/([^/]+)$/);
  if (folderMatch) {
    const folderId = folderMatch[1];

    // PATCH /sessions/:id/folders/:folder_id — rename
    if (method === "PATCH") {
      const body = await parseBody(req);
      const name = body.name as string | undefined;
      if (!name) { json(res, 400, { error: "name is required" }); return; }
      const ok = await sbClient.renameFolder(folderId, name, session.workspaceId);
      json(res, ok ? 200 : 500, ok ? { renamed: true, folder_id: folderId } : { error: "Failed to rename folder" });
      return;
    }

    // DELETE /sessions/:id/folders/:folder_id — delete
    if (method === "DELETE") {
      const ok = await sbClient.deleteFolder(folderId, session.workspaceId);
      json(res, ok ? 200 : 500, ok ? { deleted: true, folder_id: folderId } : { error: "Failed to delete folder" });
      return;
    }
  }

  // ─── Comments ───

  // GET /sessions/:id/comments — list comment threads
  if (subpath === "/comments" && method === "GET") {
    if (!session.documentId) { json(res, 400, { error: "No document connected. Use POST /sessions/:id/connect first." }); return; }
    const threads = await sbClient.listCommentThreads(session.documentId);
    json(res, 200, { threads });
    return;
  }

  // POST /sessions/:id/comments — create a comment thread
  if (subpath === "/comments" && method === "POST") {
    if (!session.documentId) { json(res, 400, { error: "No document connected. Use POST /sessions/:id/connect first." }); return; }
    const body = await parseBody(req);
    const commentBody = body.body as string;
    const mentions = (body.mentions as string[]) ?? [];
    if (!commentBody) {
      json(res, 400, { error: "body is required" });
      return;
    }
    const threadId = await sbClient.createCommentThread(
      session.documentId,
      session.workspaceId,
      `agent:${session.agentName}`,
      commentBody,
      mentions,
    );
    if (!threadId) {
      json(res, 500, { error: "Failed to create comment thread" });
      return;
    }
    json(res, 201, { thread_id: threadId });
    return;
  }

  // Routes with comment thread ID: /comments/:thread_id
  const commentMatch = subpath.match(/^\/comments\/([^/]+)(\/.*)?$/);
  if (commentMatch) {
    const threadId = commentMatch[1];
    const commentSubpath = commentMatch[2] ?? "";

    // POST /sessions/:id/comments/:thread_id/reply
    if (commentSubpath === "/reply" && method === "POST") {
      const body = await parseBody(req);
      const replyBody = body.body as string;
      const mentions = (body.mentions as string[]) ?? [];
      if (!replyBody) {
        json(res, 400, { error: "body is required" });
        return;
      }
      const ok = await sbClient.addCommentReply(threadId, `agent:${session.agentName}`, replyBody, mentions);
      json(res, ok ? 201 : 500, ok ? { replied: true, thread_id: threadId } : { error: "Failed to reply" });
      return;
    }

    // POST /sessions/:id/comments/:thread_id/resolve
    if (commentSubpath === "/resolve" && method === "POST") {
      const ok = await sbClient.resolveThread(threadId, `agent:${session.agentName}`);
      json(res, ok ? 200 : 500, ok ? { resolved: true, thread_id: threadId } : { error: "Failed to resolve" });
      return;
    }

    // POST /sessions/:id/comments/:thread_id/reopen
    if (commentSubpath === "/reopen" && method === "POST") {
      const ok = await sbClient.reopenThread(threadId);
      json(res, ok ? 200 : 500, ok ? { reopened: true, thread_id: threadId } : { error: "Failed to reopen" });
      return;
    }
  }

  // ─── Versions ───

  // GET /sessions/:id/versions — list versions
  if (subpath === "/versions" && method === "GET") {
    if (!session.documentId) { json(res, 400, { error: "No document connected. Use POST /sessions/:id/connect first." }); return; }
    const versions = await sbClient.listVersions(session.documentId);
    json(res, 200, { versions });
    return;
  }

  // POST /sessions/:id/versions — save a version
  if (subpath === "/versions" && method === "POST") {
    if (!session.documentId) { json(res, 400, { error: "No document connected. Use POST /sessions/:id/connect first." }); return; }
    const body = await parseBody(req);
    const label = body.label as string | undefined;
    const protocol = PARTYKIT_HOST.includes("localhost") ? "http" : "https";
    const versionUrl = `${protocol}://${PARTYKIT_HOST}/parties/main/${session.documentId}`;
    const vRes = await fetch(versionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        created_by: `agent:${session.agentName}`,
        created_by_name: session.agentName,
        workspace_id: session.workspaceId,
      }),
    });
    json(res, vRes.ok ? 201 : 500, vRes.ok ? { saved: true } : { error: "Failed to save version" });
    return;
  }

  // ─── Export ───

  // GET /sessions/:id/export?format=markdown|html
  if (subpath === "/export" && method === "GET") {
    const p = requirePeer(); if (!p) return;
    const format = url.searchParams.get("format") || "markdown";
    const content = format === "html" ? p.exportAsHTML() : p.exportAsMarkdown();
    json(res, 200, { format, content });
    return;
  }

  // ─── Suggestions (requires peer) ───

  // GET /sessions/:id/suggestions — list suggestions
  if (subpath === "/suggestions" && method === "GET") {
    const p = requirePeer(); if (!p) return;
    const suggestions = p.findAllSuggestions().map((s) => {
      const { xmlText: _, ...rest } = s;
      return rest;
    });
    json(res, 200, { suggestions });
    return;
  }

  // POST /sessions/:id/suggestions/accept-all
  if (subpath === "/suggestions/accept-all" && method === "POST") {
    const p = requirePeer(); if (!p) return;
    const count = p.acceptAllSuggestions();
    json(res, 200, { accepted: count });
    return;
  }

  // POST /sessions/:id/suggestions/reject-all
  if (subpath === "/suggestions/reject-all" && method === "POST") {
    const p = requirePeer(); if (!p) return;
    const count = p.rejectAllSuggestions();
    json(res, 200, { rejected: count });
    return;
  }

  // Routes with suggestion ID: /suggestions/:suggestion_id
  const suggestionMatch = subpath.match(/^\/suggestions\/([^/]+)(\/.*)?$/);
  if (suggestionMatch) {
    const p = requirePeer(); if (!p) return;
    const suggestionId = suggestionMatch[1];
    const suggestionSubpath = suggestionMatch[2] ?? "";

    if (suggestionSubpath === "/accept" && method === "POST") {
      const ok = p.acceptSuggestion(suggestionId);
      json(res, ok ? 200 : 404, ok ? { accepted: true } : { error: "Suggestion not found" });
      return;
    }

    if (suggestionSubpath === "/reject" && method === "POST") {
      const ok = p.rejectSuggestion(suggestionId);
      json(res, ok ? 200 : 404, ok ? { rejected: true } : { error: "Suggestion not found" });
      return;
    }
  }

  json(res, 404, { error: "Not found" });
}

export function startHttpServer(port: number): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error("Request error:", err);
      json(res, 500, { error: "Internal server error" });
    });
  });

  server.listen(port, () => {
    console.error(`${APP_NAME} Document API running at http://localhost:${port}`);
    console.error(`PartyKit host: ${PARTYKIT_HOST}`);
    console.error("");
    console.error("Create a session:  POST /sessions { document_id: '...' }");
    console.error("Then use the returned session_id to read/edit the document.");
  });

  // Cleanup all sessions on shutdown
  const cleanup = () => {
    for (const session of sessions.values()) {
      session.peer?.disconnect();
    }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
