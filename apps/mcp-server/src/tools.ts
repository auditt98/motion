import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YjsPeer } from "./yjs-peer.js";
import type { SupabaseClient } from "./supabase-client.js";
import { computeInsertPosition, renumberPositions } from "@motion/shared";

export interface ToolContext {
  peer: YjsPeer;
  supabase: SupabaseClient;
  workspaceId: string;
  documentId: string;
  partykitHost: string;
  agentName: string;
  /** Mutable reference so switch_document can swap the peer */
  peerRef: { current: YjsPeer };
}

/**
 * Register ALL tools on the MCP server.
 */
export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerDocumentTools(server, ctx);
  registerPageTools(server, ctx);
  registerCommentTools(server, ctx);
  registerVersionTools(server, ctx);
  registerExportTools(server, ctx);
  registerSuggestionTools(server, ctx);
  registerSearchTools(server, ctx);
  registerDatabaseTools(server, ctx);
}

/**
 * Register document content tools on the MCP server.
 * These tools allow any LLM to read and edit a collaborative document
 * through the same CRDT protocol as human editors.
 *
 * All block-mutating tools accept a stable block ID instead of a fragile index.
 */
function registerDocumentTools(server: McpServer, ctx: ToolContext): void {
  const peer = ctx.peerRef.current;
  // Dynamic descriptions based on actual schema
  const availableMarks = peer.getAvailableMarks().join(", ");
  const availableBlocks = peer.getAvailableBlockTypes().join(", ");

  server.tool(
    "read_outline",
    "Read the document's heading structure as a nested outline. Returns an array of headings with their level (1-3), text content, stable block ID, and index. Useful for understanding document structure and navigating by section before making edits.",
    {},
    async () => {
      peer.updateAwareness("thinking", "Reading outline...");
      const headings = peer.readOutline();
      peer.updateAwareness("idle", "");
      if (headings.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No headings found in the document." }],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(headings, null, 2) }],
      };
    },
  );

  server.tool(
    "read_document",
    "Read the full document content as ProseMirror JSON. Returns all blocks with their stable ID, index, and full rich-text structure including marks (bold, italic, links, etc.). Use this first to understand the document structure before making edits.",
    {},
    async () => {
      peer.updateAwareness("thinking", "Reading document...");
      const blocks = peer.readDocumentJSON();
      peer.updateAwareness("idle", "");
      if (blocks.length === 0) {
        return {
          content: [{ type: "text" as const, text: "(empty document)" }],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(blocks, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "read_block",
    "Read a specific block by its stable ID. Returns ProseMirror JSON with full rich-text structure including marks.",
    { block_id: z.string().describe("The stable ID of the block to read") },
    async ({ block_id }) => {
      peer.updateAwareness("thinking", `Reading block ${block_id}...`);
      const result = peer.readBlockJSONById(block_id);
      peer.updateAwareness("idle", "");
      if (!result) {
        return {
          content: [{ type: "text" as const, text: `Error: No block with ID ${block_id}.` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "insert_block",
    `Insert a rich-text block at a specific position using ProseMirror JSON. The block appears in real-time for all connected editors. Returns the new block's stable ID.
Available block types: ${availableBlocks}
Available marks: ${availableMarks}
Example: {"type":"paragraph","content":[{"type":"text","text":"Hello "},{"type":"text","text":"world","marks":[{"type":"bold"}]}]}`,
    {
      index: z.number().describe("Position to insert at (0 = beginning, -1 or omit for end)"),
      block: z
        .record(z.unknown())
        .describe("ProseMirror JSON for the block node. Must include 'type' and optionally 'content' and 'attrs'."),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) wraps edits in suggestion marks for human review. 'direct' applies edits immediately."),
    },
    async ({ index, block, mode }) => {
      peer.updateAwareness("writing", `Inserting ${(block.type as string) || "block"}...`);
      const insertAt = index === -1 ? peer.getBlockCount() : index;
      try {
        const blockId = mode === "suggest"
          ? peer.insertBlockJSONAsSuggestion(insertAt, block)
          : peer.insertBlockJSON(insertAt, block);
        peer.updateAwareness("idle", "");
        return {
          content: [
            {
              type: "text" as const,
              text: `Inserted block at index ${insertAt} with ID ${blockId}${mode === "suggest" ? " (as suggestion)" : ""}.`,
            },
          ],
        };
      } catch (e) {
        peer.updateAwareness("idle", "");
        return {
          content: [{ type: "text" as const, text: `Validation error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "insert_block_simple",
    "Insert a plain-text block at a specific position. For rich text with marks, use insert_block instead.",
    {
      index: z.number().describe("Position to insert at (0 = beginning, -1 or omit for end)"),
      type: z
        .enum([
          "paragraph",
          "heading",
          "codeBlock",
          "blockquote",
          "bulletList",
          "orderedList",
          "taskList",
          "horizontalRule",
          "htmlEmbed",
        ])
        .describe("The block type to insert"),
      content: z.string().describe("The text content of the block"),
      attrs: z
        .record(z.unknown())
        .optional()
        .describe("Optional attributes (e.g., {level: 2} for heading)"),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) wraps edits in suggestion marks for human review. 'direct' applies edits immediately."),
    },
    async ({ index, type, content, attrs, mode }) => {
      peer.updateAwareness("writing", `Inserting ${type}...`);
      const insertAt = index === -1 ? peer.getBlockCount() : index;
      const blockId = mode === "suggest"
        ? peer.insertBlockAsSuggestion(insertAt, type, content, attrs)
        : peer.insertBlock(insertAt, type, content, attrs);
      peer.updateAwareness("idle", "");
      return {
        content: [
          {
            type: "text" as const,
            text: `Inserted ${type} block at index ${insertAt} with ID ${blockId}${mode === "suggest" ? " (as suggestion)" : ""}.`,
          },
        ],
      };
    },
  );

  server.tool(
    "update_block",
    "Replace the text content of an existing block, identified by its stable ID. Keeps the block type and position.",
    {
      block_id: z.string().describe("The stable ID of the block to update"),
      content: z.string().describe("The new text content for the block"),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) wraps edits in suggestion marks for human review. 'direct' applies edits immediately."),
    },
    async ({ block_id, content, mode }) => {
      peer.updateAwareness("writing", `Updating block ${block_id}...`);
      const success = mode === "suggest"
        ? peer.updateBlockAsSuggestion(block_id, content)
        : peer.updateBlockById(block_id, content);
      peer.updateAwareness("idle", "");
      if (!success) {
        return {
          content: [{ type: "text" as const, text: `Error: No block with ID ${block_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Updated block ${block_id}${mode === "suggest" ? " (as suggestion)" : ""}.` }],
      };
    },
  );

  server.tool(
    "delete_block",
    "Delete a block from the document by its stable ID. All connected editors see the removal in real-time.",
    {
      block_id: z.string().describe("The stable ID of the block to delete"),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) marks all text as suggestion-delete for human review. 'direct' removes the block immediately."),
    },
    async ({ block_id, mode }) => {
      peer.updateAwareness("writing", `Deleting block ${block_id}...`);
      const success = mode === "suggest"
        ? peer.deleteBlockAsSuggestion(block_id)
        : peer.deleteBlockById(block_id);
      peer.updateAwareness("idle", "");
      if (!success) {
        return {
          content: [{ type: "text" as const, text: `Error: No block with ID ${block_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Deleted block ${block_id}${mode === "suggest" ? " (as suggestion)" : ""}.` }],
      };
    },
  );

  server.tool(
    "move_block",
    "Move a block to a new position in the document, identified by its stable ID.",
    {
      block_id: z.string().describe("The stable ID of the block to move"),
      to_index: z.number().describe("Target index to move the block to"),
    },
    async ({ block_id, to_index }) => {
      peer.updateAwareness("writing", `Moving block ${block_id}...`);
      const success = peer.moveBlockById(block_id, to_index);
      peer.updateAwareness("idle", "");
      if (!success) {
        return {
          content: [{ type: "text" as const, text: `Error: Could not move block ${block_id} to index ${to_index}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Moved block ${block_id} to index ${to_index}.` }],
      };
    },
  );

  server.tool(
    "replace_text",
    "Find and replace text within a specific block, identified by its stable ID. Useful for targeted edits without rewriting the entire block.",
    {
      block_id: z.string().describe("The stable ID of the block to search in"),
      search: z.string().describe("The exact text to find"),
      replacement: z.string().describe("The text to replace it with"),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) wraps edits in suggestion marks for human review. 'direct' applies edits immediately."),
    },
    async ({ block_id, search, replacement, mode }) => {
      peer.updateAwareness("writing", `Replacing text in block ${block_id}...`);
      const success = mode === "suggest"
        ? peer.replaceTextAsSuggestion(block_id, search, replacement)
        : peer.replaceTextById(block_id, search, replacement);
      peer.updateAwareness("idle", "");
      if (!success) {
        return {
          content: [{ type: "text" as const, text: `Error: Could not find "${search}" in block ${block_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Replaced "${search}" with "${replacement}" in block ${block_id}${mode === "suggest" ? " (as suggestion)" : ""}.` }],
      };
    },
  );

  server.tool(
    "replace_block",
    `Replace a block's entire content with new ProseMirror JSON. WARNING: This is destructive — it replaces the full block content. Prefer format_text for applying marks or replace_text for targeted text changes.
Available block types: ${availableBlocks}
Available marks: ${availableMarks}`,
    {
      block_id: z.string().describe("The stable ID of the block to replace"),
      block: z
        .record(z.unknown())
        .describe("ProseMirror JSON for the replacement block node"),
      mode: z.enum(["direct", "suggest"]).default("suggest").describe("'suggest' (default) wraps edits in suggestion marks for human review. 'direct' applies edits immediately. Note: suggest mode for full block replacement marks old block as deleted and inserts new block as suggested."),
    },
    async ({ block_id, block, mode }) => {
      peer.updateAwareness("writing", `Replacing block ${block_id}...`);
      try {
        if (mode === "suggest") {
          // For suggest mode: mark old block text as delete, insert new block as suggestion
          const found = peer.readBlockById(block_id);
          if (!found) {
            peer.updateAwareness("idle", "");
            return {
              content: [{ type: "text" as const, text: `Error: No block with ID ${block_id}.` }],
              isError: true,
            };
          }
          // Mark old text as suggestion-delete
          const oldText = found.content;
          if (oldText) {
            peer.formatTextByMatch(block_id, oldText, "suggestionDelete", {
              suggestionId: crypto.randomUUID(),
              authorId: `agent:${peer.agentName}`,
              authorName: peer.agentName,
              createdAt: new Date().toISOString(),
            });
          }
          // Insert new block as suggestion after the old one
          const blockIndex = peer.getBlockIndexById(block_id);
          const insertIndex = blockIndex >= 0 ? blockIndex + 1 : peer.getBlockCount();
          peer.insertBlockJSONAsSuggestion(insertIndex, block);
          peer.updateAwareness("idle", "");
          return {
            content: [{ type: "text" as const, text: `Replaced block ${block_id} (as suggestion).` }],
          };
        }

        const success = peer.replaceBlockJSON(block_id, block);
        peer.updateAwareness("idle", "");
        if (!success) {
          return {
            content: [{ type: "text" as const, text: `Error: No block with ID ${block_id}.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Replaced block ${block_id}.` }],
        };
      } catch (e) {
        peer.updateAwareness("idle", "");
        return {
          content: [{ type: "text" as const, text: `Validation error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "format_text_by_match",
    `Apply or remove a mark on specific text within a block. This is the PREFERRED way to format text — specify the text string instead of counting character offsets.
Works with nested blocks (lists, blockquotes, toggles) automatically.
Available marks: ${availableMarks}
Example: format_text_by_match(block_id, "welcome", "bold") to bold the word "welcome".
Example: format_text_by_match(block_id, "click here", "link", {href: "https://example.com"}) to add a link.`,
    {
      block_id: z.string().describe("The stable ID of the block containing the text"),
      text: z.string().min(1).describe("The exact text to format (case-sensitive)"),
      mark: z.string().describe(`Mark type name. Available: ${availableMarks}`),
      attrs: z
        .record(z.unknown())
        .optional()
        .describe("Mark attributes (e.g., {href: 'https://...'} for link, {color: '#ff0000'} for textStyle)"),
      occurrence: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Which occurrence to format if the text appears multiple times (1-based, default: 1)"),
      remove: z
        .boolean()
        .optional()
        .describe("If true, removes the mark instead of applying it"),
    },
    async ({ block_id, text, mark, attrs, occurrence, remove }) => {
      const action = remove ? "Removing" : "Applying";
      peer.updateAwareness("writing", `${action} ${mark} in block ${block_id}...`);

      const result = peer.formatTextByMatch(
        block_id,
        text,
        mark,
        attrs,
        occurrence ?? 1,
        remove ?? false,
      );

      peer.updateAwareness("idle", "");

      if (!result.success) {
        const markExists = peer.getAvailableMarks().includes(mark);
        let reason: string;
        if (!markExists) {
          reason = `Unknown mark type "${mark}". Available: ${availableMarks}`;
        } else if (result.totalOccurrences === 0) {
          reason = `Could not find "${text}" in block ${block_id}.`;
        } else {
          reason = `Only found ${result.totalOccurrences} occurrence(s) of "${text}" in block ${block_id}, but occurrence ${occurrence} was requested.`;
        }
        return {
          content: [{ type: "text" as const, text: `Error: ${reason}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `${remove ? "Removed" : "Applied"} ${mark} to "${text}" (${occurrence ?? 1} of ${result.totalOccurrences}) in block ${block_id}.`,
          },
        ],
      };
    },
  );

  server.tool(
    "format_text",
    `Apply or remove a mark on a text range using character offsets. Note: prefer format_text_by_match instead — it's more reliable because you specify text content rather than counting offsets.
Available marks: ${availableMarks}
Example: format_text(block_id, 0, 5, "bold") to bold the first 5 characters.
Example: format_text(block_id, 0, 10, "link", {href: "https://example.com"}) to add a link.`,
    {
      block_id: z.string().describe("The stable ID of the block containing the text"),
      start: z.number().describe("Character offset (0-based) where the mark starts"),
      length: z.number().describe("Number of characters to apply the mark to"),
      mark: z.string().describe(`Mark type name. Available: ${availableMarks}`),
      attrs: z
        .record(z.unknown())
        .optional()
        .describe("Mark attributes (e.g., {href: 'https://...'} for link, {color: '#ff0000'} for textStyle)"),
      remove: z
        .boolean()
        .optional()
        .describe("If true, removes the mark instead of applying it"),
    },
    async ({ block_id, start, length, mark, attrs, remove }) => {
      const action = remove ? "Removing" : "Applying";
      peer.updateAwareness("writing", `${action} ${mark} in block ${block_id}...`);

      const success = remove
        ? peer.removeFormatById(block_id, start, length, mark)
        : peer.formatTextById(block_id, start, length, mark, attrs);

      peer.updateAwareness("idle", "");

      if (!success) {
        const markExists = peer.getAvailableMarks().includes(mark);
        const reason = !markExists
          ? `Unknown mark type "${mark}". Available: ${availableMarks}`
          : `Could not apply mark to block ${block_id}. Block not found or has no text content.`;
        return {
          content: [{ type: "text" as const, text: `Error: ${reason}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `${remove ? "Removed" : "Applied"} ${mark} to characters ${start}-${start + length} in block ${block_id}.`,
          },
        ],
      };
    },
  );
}

// ─── Group 1: Page Management ─────────────────────────────────────────

function registerPageTools(server: McpServer, ctx: ToolContext): void {
  const { supabase } = ctx;

  server.tool(
    "list_pages",
    "List all pages in the workspace. Returns each page's id, title, icon, parent_id, folder_id, position, and favorite status.",
    {
      include_deleted: z.boolean().optional().describe("If true, include soft-deleted (trashed) pages"),
    },
    async ({ include_deleted }) => {
      const pages = await supabase.listPages(ctx.workspaceId, include_deleted ?? false);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(pages, null, 2) }],
      };
    },
  );

  server.tool(
    "create_page",
    "Create a new page in the workspace. Returns the new page's id which can be used as a document_id to switch to it.",
    {
      title: z.string().default("Untitled").describe("Page title"),
      parent_id: z.string().optional().describe("Parent page ID for nesting"),
      folder_id: z.string().optional().describe("Folder ID to place the page in"),
    },
    async ({ title, parent_id, folder_id }) => {
      const page = await supabase.createPage(ctx.workspaceId, title, {
        parentId: parent_id,
        folderId: folder_id,
        createdBy: `agent:${ctx.agentName}`,
      });
      if (!page) {
        return {
          content: [{ type: "text" as const, text: "Error: Failed to create page." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(page, null, 2) }],
      };
    },
  );

  server.tool(
    "rename_page",
    "Rename a page by its ID.",
    {
      page_id: z.string().describe("The page ID to rename"),
      title: z.string().describe("The new title"),
    },
    async ({ page_id, title }) => {
      const ok = await supabase.renamePage(page_id, title, ctx.workspaceId);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to rename page ${page_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Renamed page ${page_id} to "${title}".` }],
      };
    },
  );

  server.tool(
    "delete_page",
    "Soft-delete a page (move to trash). Can be restored later with restore_page.",
    {
      page_id: z.string().describe("The page ID to delete"),
    },
    async ({ page_id }) => {
      const ok = await supabase.softDeletePage(page_id, `agent:${ctx.agentName}`, ctx.workspaceId);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to delete page ${page_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Moved page ${page_id} to trash.` }],
      };
    },
  );

  server.tool(
    "restore_page",
    "Restore a soft-deleted page from trash.",
    {
      page_id: z.string().describe("The page ID to restore"),
    },
    async ({ page_id }) => {
      const ok = await supabase.restorePage(page_id, ctx.workspaceId);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to restore page ${page_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Restored page ${page_id} from trash.` }],
      };
    },
  );

  server.tool(
    "move_page",
    "Move a page to a new position, parent, or folder.",
    {
      page_id: z.string().describe("The page ID to move"),
      parent_id: z.string().nullable().optional().describe("New parent page ID (null for root)"),
      after_page_id: z.string().nullable().optional().describe("Place after this page ID (null for first position)"),
      folder_id: z.string().nullable().optional().describe("Move to this folder ID"),
    },
    async ({ page_id, parent_id, after_page_id, folder_id }) => {
      const parentIdVal = parent_id ?? null;
      const allPages = await supabase.listPages(ctx.workspaceId);

      const siblings = allPages
        .filter((p) => p.parent_id === parentIdVal && p.id !== page_id)
        .sort((a, b) => a.position - b.position);

      let targetIndex: number;
      if (after_page_id === null || after_page_id === undefined) {
        targetIndex = 0;
      } else {
        const afterIdx = siblings.findIndex((p) => p.id === after_page_id);
        targetIndex = afterIdx === -1 ? siblings.length : afterIdx + 1;
      }

      const siblingPositions = siblings.map((p) => p.position);
      const { position, needsRenumber } = computeInsertPosition(siblingPositions, targetIndex);
      let newPosition = position;

      if (needsRenumber) {
        const fresh = renumberPositions(siblings.length + 1);
        let posIdx = 0;
        for (let i = 0; i <= siblings.length; i++) {
          if (i === targetIndex) {
            newPosition = fresh[posIdx++];
          } else {
            const sib = siblings[i > targetIndex ? i - 1 : i];
            if (sib) await supabase.updatePagePosition(sib.id, sib.parent_id, fresh[posIdx++], ctx.workspaceId);
          }
        }
      }

      const ok = await supabase.updatePagePosition(page_id, parentIdVal, newPosition, ctx.workspaceId, folder_id);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to move page ${page_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Moved page ${page_id} to position ${newPosition}.` }],
      };
    },
  );

  server.tool(
    "switch_document",
    "Disconnect from the current document and connect to a different page. Use list_pages to find available page IDs.",
    {
      page_id: z.string().describe("The page ID (document ID) to switch to"),
    },
    async ({ page_id }) => {
      // Verify the document belongs to this workspace
      const belongs = await supabase.verifyPageInWorkspace(page_id, ctx.workspaceId);
      if (!belongs) {
        return {
          content: [{ type: "text" as const, text: `Error: Page does not belong to your workspace.` }],
          isError: true,
        };
      }
      const { YjsPeer } = await import("./yjs-peer.js");
      ctx.peerRef.current.disconnect();
      const newPeer = new YjsPeer(page_id, ctx.partykitHost, ctx.agentName);
      await newPeer.connect();
      ctx.peerRef.current = newPeer;
      ctx.documentId = page_id;
      return {
        content: [{ type: "text" as const, text: `Switched to document ${page_id}. Use read_document to see its content.` }],
      };
    },
  );

  server.tool(
    "create_and_edit_page",
    "Create a new page in the workspace and immediately connect to it for editing. Combines create_page + switch_document into a single step.",
    {
      title: z.string().default("Untitled").describe("Page title"),
      parent_id: z.string().optional().describe("Parent page ID for nesting"),
      folder_id: z.string().optional().describe("Folder ID to place the page in"),
    },
    async ({ title, parent_id, folder_id }) => {
      const page = await supabase.createPage(ctx.workspaceId, title, {
        parentId: parent_id,
        folderId: folder_id,
        createdBy: `agent:${ctx.agentName}`,
      });
      if (!page) {
        return {
          content: [{ type: "text" as const, text: "Error: Failed to create page." }],
          isError: true,
        };
      }
      const { YjsPeer } = await import("./yjs-peer.js");
      ctx.peerRef.current.disconnect();
      const newPeer = new YjsPeer(page.id, ctx.partykitHost, ctx.agentName);
      await newPeer.connect();
      ctx.peerRef.current = newPeer;
      ctx.documentId = page.id;
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ...page, connected: true }, null, 2) }],
      };
    },
  );

  // ─── Folder tools ───

  server.tool(
    "list_folders",
    "List all folders in the workspace.",
    {},
    async () => {
      const folders = await supabase.listFolders(ctx.workspaceId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(folders, null, 2) }],
      };
    },
  );

  server.tool(
    "create_folder",
    "Create a new folder in the workspace.",
    {
      name: z.string().default("Untitled folder").describe("Folder name"),
    },
    async ({ name }) => {
      const folder = await supabase.createFolder(ctx.workspaceId, name, `agent:${ctx.agentName}`);
      if (!folder) {
        return {
          content: [{ type: "text" as const, text: "Error: Failed to create folder." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(folder, null, 2) }],
      };
    },
  );

  server.tool(
    "rename_folder",
    "Rename a folder by its ID.",
    {
      folder_id: z.string().describe("The folder ID to rename"),
      name: z.string().describe("The new name"),
    },
    async ({ folder_id, name }) => {
      const ok = await supabase.renameFolder(folder_id, name, ctx.workspaceId);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to rename folder ${folder_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Renamed folder ${folder_id} to "${name}".` }],
      };
    },
  );

  server.tool(
    "delete_folder",
    "Delete a folder by its ID. Pages in this folder will be moved to the root level.",
    {
      folder_id: z.string().describe("The folder ID to delete"),
    },
    async ({ folder_id }) => {
      const ok = await supabase.deleteFolder(folder_id, ctx.workspaceId);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to delete folder ${folder_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Deleted folder ${folder_id}. Pages moved to root.` }],
      };
    },
  );
}

// ─── Group 2: Comments ────────────────────────────────────────────────

function registerCommentTools(server: McpServer, ctx: ToolContext): void {
  const { supabase } = ctx;
  const agentId = () => `agent:${ctx.agentName}`;

  server.tool(
    "list_comments",
    "List all comment threads and replies on the current page. Each thread has an id, resolution status, and array of comments with author and body.",
    {},
    async () => {
      const threads = await supabase.listCommentThreads(ctx.documentId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(threads, null, 2) }],
      };
    },
  );

  server.tool(
    "create_comment",
    "Create a new comment thread on the current page with an initial message.",
    {
      body: z.string().describe("The comment text"),
      mentions: z.array(z.string()).optional().describe("Array of user IDs to mention"),
    },
    async ({ body, mentions }) => {
      const threadId = await supabase.createCommentThread(
        ctx.documentId,
        ctx.workspaceId,
        agentId(),
        body,
        mentions,
      );
      if (!threadId) {
        return {
          content: [{ type: "text" as const, text: "Error: Failed to create comment thread." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Created comment thread ${threadId}.` }],
      };
    },
  );

  server.tool(
    "reply_to_comment",
    "Reply to an existing comment thread.",
    {
      thread_id: z.string().describe("The thread ID to reply to"),
      body: z.string().describe("The reply text"),
      mentions: z.array(z.string()).optional().describe("Array of user IDs to mention"),
    },
    async ({ thread_id, body, mentions }) => {
      const ok = await supabase.addCommentReply(thread_id, agentId(), body, mentions);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to reply to thread ${thread_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Replied to thread ${thread_id}.` }],
      };
    },
  );

  server.tool(
    "resolve_comment",
    "Resolve a comment thread, marking the discussion as complete.",
    {
      thread_id: z.string().describe("The thread ID to resolve"),
    },
    async ({ thread_id }) => {
      const ok = await supabase.resolveThread(thread_id, agentId());
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to resolve thread ${thread_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Resolved thread ${thread_id}.` }],
      };
    },
  );

  server.tool(
    "reopen_comment",
    "Reopen a previously resolved comment thread.",
    {
      thread_id: z.string().describe("The thread ID to reopen"),
    },
    async ({ thread_id }) => {
      const ok = await supabase.reopenThread(thread_id);
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Failed to reopen thread ${thread_id}.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Reopened thread ${thread_id}.` }],
      };
    },
  );
}

// ─── Group 3: Version History ─────────────────────────────────────────

function registerVersionTools(server: McpServer, ctx: ToolContext): void {
  const { supabase } = ctx;

  server.tool(
    "list_versions",
    "List all saved versions of the current document, newest first. Each version has an id, label, author, and timestamp.",
    {},
    async () => {
      const versions = await supabase.listVersions(ctx.documentId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(versions, null, 2) }],
      };
    },
  );

  server.tool(
    "save_version",
    "Save a named version (snapshot) of the current document. Use this to checkpoint your work before making large changes.",
    {
      label: z.string().optional().describe("Human-readable label for this version (e.g., 'Before restructure')"),
    },
    async ({ label }) => {
      const protocol = ctx.partykitHost.includes("localhost") ? "http" : "https";
      const url = `${protocol}://${ctx.partykitHost}/parties/main/${ctx.documentId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          created_by: `agent:${ctx.agentName}`,
          created_by_name: ctx.agentName,
          workspace_id: ctx.workspaceId,
        }),
      });
      if (!res.ok) {
        return {
          content: [{ type: "text" as const, text: "Error: Failed to save version." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Saved version${label ? ` "${label}"` : ""}.` }],
      };
    },
  );

  server.tool(
    "get_version",
    "Read the content of a specific version snapshot. Returns the version metadata (not full document content — snapshots are binary Yjs state).",
    {
      version_id: z.string().describe("The version ID to read"),
    },
    async ({ version_id }) => {
      const snapshot = await supabase.getVersionSnapshot(version_id);
      if (!snapshot) {
        return {
          content: [{ type: "text" as const, text: `Error: Version ${version_id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Version ${version_id} snapshot retrieved (${snapshot.length} bytes base64).` }],
      };
    },
  );
}

// ─── Group 4: Export ──────────────────────────────────────────────────

function registerExportTools(server: McpServer, ctx: ToolContext): void {
  server.tool(
    "export_document",
    "Export the current document content as Markdown or HTML. Returns the content as text — useful for sharing, transforming, or saving externally.",
    {
      format: z.enum(["markdown", "html"]).describe("Export format"),
    },
    async ({ format }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("thinking", `Exporting as ${format}...`);
      const content = format === "markdown"
        ? peer.exportAsMarkdown()
        : peer.exportAsHTML();
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: content }],
      };
    },
  );
}

// ─── Group 5: Suggestion Review ───────────────────────────────────────

function registerSuggestionTools(server: McpServer, ctx: ToolContext): void {
  server.tool(
    "list_suggestions",
    "List all pending suggestions in the document. Each suggestion has an id, author, type (add/delete), the text content, and which block it belongs to.",
    {},
    async () => {
      const peer = ctx.peerRef.current;
      const suggestions = peer.findAllSuggestions();
      if (suggestions.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No pending suggestions." }],
        };
      }
      // Strip internal xmlText reference before serializing
      const serializable = suggestions.map(({ xmlText: _x, ...rest }) => rest);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(serializable, null, 2) }],
      };
    },
  );

  server.tool(
    "accept_suggestion",
    "Accept a suggestion by its ID. For additions, the text is kept. For deletions, the text is removed.",
    {
      suggestion_id: z.string().describe("The suggestion ID to accept"),
    },
    async ({ suggestion_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Accepting suggestion...");
      const ok = peer.acceptSuggestion(suggestion_id);
      peer.updateAwareness("idle", "");
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Suggestion ${suggestion_id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Accepted suggestion ${suggestion_id}.` }],
      };
    },
  );

  server.tool(
    "reject_suggestion",
    "Reject a suggestion by its ID. For additions, the text is removed. For deletions, the text is kept.",
    {
      suggestion_id: z.string().describe("The suggestion ID to reject"),
    },
    async ({ suggestion_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Rejecting suggestion...");
      const ok = peer.rejectSuggestion(suggestion_id);
      peer.updateAwareness("idle", "");
      if (!ok) {
        return {
          content: [{ type: "text" as const, text: `Error: Suggestion ${suggestion_id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: `Rejected suggestion ${suggestion_id}.` }],
      };
    },
  );

  server.tool(
    "accept_all_suggestions",
    "Accept all pending suggestions in the document.",
    {},
    async () => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Accepting all suggestions...");
      const count = peer.acceptAllSuggestions();
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: `Accepted ${count} suggestion(s).` }],
      };
    },
  );

  server.tool(
    "reject_all_suggestions",
    "Reject all pending suggestions in the document.",
    {},
    async () => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Rejecting all suggestions...");
      const count = peer.rejectAllSuggestions();
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: `Rejected ${count} suggestion(s).` }],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Search tools
// ---------------------------------------------------------------------------

function registerSearchTools(server: McpServer, ctx: ToolContext): void {
  server.tool(
    "search_workspace",
    "Search across all pages in the workspace by content and title. Uses full-text search for exact matches and semantic search for natural language queries. Returns matching pages with relevant text snippets.",
    {
      query: z.string().describe("The search query — can be keywords or a natural language question"),
      limit: z.number().optional().default(10).describe("Maximum number of results to return (default: 10, max: 50)"),
    },
    async ({ query, limit }) => {
      const resultLimit = Math.min(Math.max(limit ?? 10, 1), 50);
      const results = await ctx.supabase.searchPages(
        ctx.workspaceId,
        query,
        resultLimit,
      );

      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No pages found matching "${query}".` }],
        };
      }

      const lines = results.map((r, i) => {
        const snippet = r.snippet.replace(/\*\*/g, "");
        return `${i + 1}. **${r.title}** (page_id: ${r.page_id})\n   ${snippet}`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${results.length} page(s) matching "${query}":\n\n${lines.join("\n\n")}`,
        }],
      };
    },
  );
}

/**
 * Register database tools for reading and writing structured data.
 * These tools operate on database pages (page_type = 'database') that store
 * schema and rows in Yjs shared types instead of ProseMirror content.
 */
function registerDatabaseTools(server: McpServer, ctx: ToolContext): void {
  const DB_ID_DESC = "For inline databases, pass the database_id from list_inline_databases. Omit for standalone database pages.";

  server.tool(
    "read_database_schema",
    "Read the database column schema. Returns column definitions including id, name, type, width, and options (for select/multi_select).",
    {
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ database_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("thinking", "Reading database schema...");
      const schema = peer.readDatabaseSchema(database_id);
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }],
      };
    },
  );

  server.tool(
    "read_database_rows",
    "Read rows from a database. Returns an array of row objects with column values. Supports optional limit and offset for pagination.",
    {
      limit: z.number().optional().describe("Maximum number of rows to return"),
      offset: z.number().optional().describe("Number of rows to skip"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ limit, offset, database_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("thinking", "Reading database rows...");
      const rows = peer.readDatabaseRows({ limit, offset, databaseId: database_id });
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      };
    },
  );

  server.tool(
    "insert_database_row",
    "Insert a new row into the database. Pass column values as a key-value object where keys are column IDs. Returns the new row's ID.",
    {
      values: z.record(z.unknown()).describe("Column values as { column_id: value }"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ values, database_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Inserting database row...");
      const rowId = peer.insertDatabaseRow(values, database_id);
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: `Row inserted with id: ${rowId}` }],
      };
    },
  );

  server.tool(
    "update_database_cell",
    "Update a specific cell in a database row. Identifies the cell by row ID and column ID.",
    {
      row_id: z.string().describe("The row's ID"),
      column_id: z.string().describe("The column's ID"),
      value: z.unknown().describe("The new cell value"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ row_id, column_id, value, database_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Updating database cell...");
      const ok = peer.updateDatabaseCell(row_id, column_id, value, database_id);
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: ok ? "Cell updated." : "Row not found." }],
      };
    },
  );

  server.tool(
    "delete_database_row",
    "Delete a row from the database by its row ID.",
    {
      row_id: z.string().describe("The row's ID to delete"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ row_id, database_id }) => {
      const peer = ctx.peerRef.current;
      peer.updateAwareness("writing", "Deleting database row...");
      const ok = peer.deleteDatabaseRow(row_id, database_id);
      peer.updateAwareness("idle", "");
      return {
        content: [{ type: "text" as const, text: ok ? "Row deleted." : "Row not found." }],
      };
    },
  );

  server.tool(
    "add_database_column",
    "Add a new column to the database schema. Returns the new column's ID.",
    {
      name: z.string().describe("Column display name"),
      type: z.enum(["text", "number", "select", "multi_select", "date", "checkbox", "person", "url"]).describe("Column data type"),
      options: z.array(z.string()).optional().describe("Options for select/multi_select columns"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ name, type, options, database_id }) => {
      const peer = ctx.peerRef.current;
      const colId = peer.addDatabaseColumn(name, type, options, database_id);
      return {
        content: [{ type: "text" as const, text: `Column added with id: ${colId}` }],
      };
    },
  );

  server.tool(
    "update_database_column",
    "Update a database column's name, type, or options.",
    {
      column_id: z.string().describe("The column's ID"),
      name: z.string().optional().describe("New column name"),
      type: z.enum(["text", "number", "select", "multi_select", "date", "checkbox", "person", "url"]).optional().describe("New column type"),
      options: z.array(z.string()).optional().describe("New options for select/multi_select"),
      database_id: z.string().optional().describe(DB_ID_DESC),
    },
    async ({ column_id, name, type, options, database_id }) => {
      const peer = ctx.peerRef.current;
      const updates: { name?: string; type?: string; options?: string[] } = {};
      if (name) updates.name = name;
      if (type) updates.type = type;
      if (options) updates.options = options;
      const ok = peer.updateDatabaseColumn(column_id, updates, database_id);
      return {
        content: [{ type: "text" as const, text: ok ? "Column updated." : "Column not found." }],
      };
    },
  );

  server.tool(
    "list_inline_databases",
    "List all inline database blocks embedded in the current document. Returns block IDs, database IDs, and titles. Use the database_id with other database tools to operate on a specific inline database.",
    {},
    async () => {
      const peer = ctx.peerRef.current;
      const databases = peer.listInlineDatabases();
      if (databases.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No inline databases found in this document." }],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(databases, null, 2) }],
      };
    },
  );
}
