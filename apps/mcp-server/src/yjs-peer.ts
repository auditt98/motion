import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import WebSocket from "ws";
import type { AgentAwareness } from "@motion/shared";
import { AGENT_COLOR } from "@motion/shared";
import { getSchema } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import {
  getSchemaExtensions,
  getMarkTypes,
  getBlockTypes,
  insertPMBlockIntoFragment,
  readBlockAsPMJSON,
  readDocumentAsPMJSON,
} from "@motion/editor-extensions";

export interface BlockInfo {
  id: string;
  type: string;
  content: string;
  attrs: Record<string, unknown>;
}

/**
 * Connects to a PartyKit document room as a Yjs peer.
 * This is the bridge between any external LLM and the collaborative document.
 */
export class YjsPeer {
  readonly ydoc: Y.Doc;
  readonly provider: YPartyKitProvider;
  readonly schema: Schema;
  private connected = false;

  constructor(
    readonly documentId: string,
    readonly partykitHost: string,
    readonly agentName: string,
  ) {
    this.schema = getSchema(getSchemaExtensions());
    this.ydoc = new Y.Doc();
    this.provider = new YPartyKitProvider(
      partykitHost,
      documentId,
      this.ydoc,
      { connect: false, WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket },
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    this.provider.connect();
    this.connected = true;

    this.updateAwareness("thinking", "Connecting...");

    await new Promise<void>((resolve) => {
      if (this.provider.synced) {
        resolve();
        return;
      }
      this.provider.once("synced", () => resolve());
    });
  }

  updateAwareness(
    status: AgentAwareness["status"],
    taskDescription: string,
  ): void {
    this.provider.awareness.setLocalStateField("user", {
      name: this.agentName,
      color: AGENT_COLOR,
      icon: "sparkles",
      isAgent: true,
      agentId: `mcp-${this.documentId}`,
      status,
      taskDescription,
    } satisfies AgentAwareness);
  }

  /**
   * Move the agent's cursor to a block so human editors can see where the agent is working.
   * Sets the awareness `cursor` field with Yjs relative positions that y-prosemirror reads.
   */
  private setCursorToBlock(element: Y.XmlElement): void {
    // Find the first XmlText node inside the element to anchor the cursor
    const textNode = findFirstTextNode(element);
    if (!textNode) return;

    const anchor = Y.createRelativePositionFromTypeIndex(textNode, 0);
    const head = Y.createRelativePositionFromTypeIndex(textNode, textNode.length);

    this.provider.awareness.setLocalStateField("cursor", {
      anchor: Y.relativePositionToJSON(anchor),
      head: Y.relativePositionToJSON(head),
    });
  }

  /**
   * Clear the agent's cursor from the editor.
   */
  private clearCursor(): void {
    this.provider.awareness.setLocalStateField("cursor", null);
  }

  /**
   * Get the root XmlFragment that TipTap uses.
   */
  private getFragment(): Y.XmlFragment {
    return this.ydoc.getXmlFragment("default");
  }

  /**
   * Ensure a block has a stable ID attribute. Assigns one if missing.
   */
  private ensureBlockId(element: Y.XmlElement): string {
    let id = element.getAttribute("blockId") as string | undefined;
    if (!id) {
      id = randomUUID();
      element.setAttribute("blockId", id);
    }
    return id;
  }

  /**
   * Find a block by its stable ID. Returns the element and its current index.
   */
  private findBlockById(blockId: string): { element: Y.XmlElement; index: number } | null {
    const fragment = this.getFragment();
    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlElement) {
        const id = child.getAttribute("blockId") as string | undefined;
        if (id === blockId) {
          return { element: child, index: i };
        }
      }
    }
    return null;
  }

  /**
   * Get the index of a block by its stable ID. Returns -1 if not found.
   */
  getBlockIndexById(blockId: string): number {
    const found = this.findBlockById(blockId);
    return found ? found.index : -1;
  }

  /**
   * Get the number of top-level blocks in the document.
   */
  getBlockCount(): number {
    return this.getFragment().length;
  }

  /**
   * Read the document heading structure as an outline.
   */
  readOutline(): Array<{ level: number; text: string; blockId: string; index: number }> {
    const fragment = this.getFragment();
    const headings: Array<{ level: number; text: string; blockId: string; index: number }> = [];
    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlElement && child.nodeName === "heading") {
        const level = Number(child.getAttribute("level")) || 1;
        const text = xmlElementToText(child);
        const blockId = this.ensureBlockId(child);
        headings.push({ level, text, blockId, index: i });
      }
    }
    return headings;
  }

  /**
   * Read the full document as structured text with block IDs.
   */
  readDocument(): string {
    const fragment = this.getFragment();
    const blocks: string[] = [];
    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlElement) {
        const id = this.ensureBlockId(child);
        const tag = child.nodeName;
        const text = xmlElementToText(child);
        blocks.push(`[${i}] (${id}) <${tag}> ${text}`);
      } else if (child instanceof Y.XmlText) {
        blocks.push(`[${i}] <text> ${child.toString()}`);
      }
    }
    return blocks.join("\n");
  }

  /**
   * Read a specific block by its stable ID.
   */
  readBlockById(blockId: string): BlockInfo | null {
    const found = this.findBlockById(blockId);
    if (!found) return null;
    return {
      id: blockId,
      type: found.element.nodeName,
      content: xmlElementToText(found.element),
      attrs: found.element.getAttributes(),
    };
  }

  /**
   * Read a specific block by index.
   */
  readBlock(index: number): BlockInfo | null {
    const fragment = this.getFragment();
    if (index < 0 || index >= fragment.length) return null;

    const child = fragment.get(index);
    if (child instanceof Y.XmlElement) {
      const id = this.ensureBlockId(child);
      return {
        id,
        type: child.nodeName,
        content: xmlElementToText(child),
        attrs: child.getAttributes(),
      };
    }
    if (child instanceof Y.XmlText) {
      return { id: "", type: "text", content: child.toString(), attrs: {} };
    }
    return null;
  }

  /**
   * Insert a block at a specific position.
   * Returns the new block's stable ID.
   */
  insertBlock(
    index: number,
    type: string,
    content: string,
    attrs?: Record<string, unknown>,
  ): string {
    const fragment = this.getFragment();
    const clampedIndex = Math.min(Math.max(0, index), fragment.length);
    const blockId = randomUUID();
    const element = createBlockElement(type, content, attrs);
    element.setAttribute("blockId", blockId);
    fragment.insert(clampedIndex, [element]);
    this.setCursorToBlock(element);
    return blockId;
  }

  /**
   * Update a block's text content by stable ID.
   */
  updateBlockById(blockId: string, content: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;
    this.setCursorToBlock(found.element);
    const result = this.updateBlockElement(found.element, content);
    this.setCursorToBlock(found.element);
    return result;
  }

  /**
   * Update a block's text content by index.
   */
  updateBlock(index: number, content: string): boolean {
    const fragment = this.getFragment();
    if (index < 0 || index >= fragment.length) return false;

    const child = fragment.get(index);
    if (child instanceof Y.XmlElement) {
      return this.updateBlockElement(child, content);
    }
    return false;
  }

  private updateBlockElement(element: Y.XmlElement, content: string): boolean {
    while (element.length > 0) {
      element.delete(0, 1);
    }
    const textNode = new Y.XmlText();
    textNode.insert(0, content);
    element.insert(0, [textNode]);
    return true;
  }

  /**
   * Delete a block by stable ID.
   */
  deleteBlockById(blockId: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;
    const fragment = this.getFragment();
    fragment.delete(found.index, 1);
    this.clearCursor();
    return true;
  }

  /**
   * Delete a block at a specific index.
   */
  deleteBlock(index: number): boolean {
    const fragment = this.getFragment();
    if (index < 0 || index >= fragment.length) return false;
    fragment.delete(index, 1);
    return true;
  }

  /**
   * Move a block by stable ID to a target index.
   */
  moveBlockById(blockId: string, toIndex: number): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;
    return this.moveBlock(found.index, toIndex);
  }

  /**
   * Move a block from one position to another.
   */
  moveBlock(fromIndex: number, toIndex: number): boolean {
    const fragment = this.getFragment();
    if (fromIndex < 0 || fromIndex >= fragment.length) return false;
    if (toIndex < 0 || toIndex > fragment.length) return false;
    if (fromIndex === toIndex) return true;

    const child = fragment.get(fromIndex);
    if (!(child instanceof Y.XmlElement)) return false;

    const type = child.nodeName;
    const content = xmlElementToText(child);
    const attrs = child.getAttributes();
    const blockId = this.ensureBlockId(child);

    fragment.delete(fromIndex, 1);

    const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const element = createBlockElement(type, content, attrs);
    element.setAttribute("blockId", blockId);
    fragment.insert(adjustedIndex, [element]);
    return true;
  }

  /**
   * Find and replace text within a block by stable ID.
   */
  replaceTextById(blockId: string, search: string, replacement: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;
    this.setCursorToBlock(found.element);
    const result = replaceInElement(found.element, search, replacement);
    this.setCursorToBlock(found.element);
    return result;
  }

  /**
   * Find and replace text within a specific block by index.
   */
  replaceText(index: number, search: string, replacement: string): boolean {
    const fragment = this.getFragment();
    if (index < 0 || index >= fragment.length) return false;

    const child = fragment.get(index);
    if (child instanceof Y.XmlElement) {
      return replaceInElement(child, search, replacement);
    }
    return false;
  }

  // --- Rich text (ProseMirror JSON) methods ---

  /**
   * Insert a block from ProseMirror JSON at the given index.
   * Validates against the shared schema and converts via y-prosemirror.
   * Returns the new block's stable ID.
   */
  insertBlockJSON(index: number, json: Record<string, unknown>): string {
    const fragment = this.getFragment();
    const clampedIndex = Math.min(Math.max(0, index), fragment.length);

    insertPMBlockIntoFragment(this.schema, fragment, clampedIndex, json);

    // Assign a stable block ID to the newly inserted element
    const inserted = fragment.get(clampedIndex) as Y.XmlElement;
    const blockId = randomUUID();
    inserted.setAttribute("blockId", blockId);
    this.setCursorToBlock(inserted);
    return blockId;
  }

  /**
   * Read a single block as ProseMirror JSON by its stable ID.
   */
  readBlockJSONById(blockId: string): { id: string; json: Record<string, unknown> } | null {
    const found = this.findBlockById(blockId);
    if (!found) return null;
    const json = readBlockAsPMJSON(this.getFragment(), found.index);
    if (!json) return null;
    return { id: blockId, json };
  }

  /**
   * Read the full document as an array of ProseMirror JSON blocks with IDs.
   */
  readDocumentJSON(): Array<{ id: string; index: number; json: Record<string, unknown> }> {
    const fragment = this.getFragment();
    const blocks = readDocumentAsPMJSON(fragment);
    return blocks.map((json: Record<string, unknown>, i: number) => {
      const child = fragment.get(i);
      const id = child instanceof Y.XmlElement ? this.ensureBlockId(child) : "";
      return { id, index: i, json };
    });
  }

  /**
   * Replace a block's entire content with new ProseMirror JSON.
   * This is destructive — prefer formatText / replaceText for targeted edits.
   */
  replaceBlockJSON(blockId: string, json: Record<string, unknown>): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;

    const fragment = this.getFragment();
    fragment.delete(found.index, 1);
    insertPMBlockIntoFragment(this.schema, fragment, found.index, json);

    // Preserve the block ID
    const inserted = fragment.get(found.index) as Y.XmlElement;
    inserted.setAttribute("blockId", blockId);
    this.setCursorToBlock(inserted);
    return true;
  }

  /**
   * Apply a mark to a text range within a block (by stable ID).
   * Returns false if block not found or mark name is invalid.
   */
  formatTextById(
    blockId: string,
    start: number,
    length: number,
    markName: string,
    attrs?: Record<string, unknown>,
  ): boolean {
    if (!this.schema.marks[markName]) return false;

    const found = this.findBlockById(blockId);
    if (!found) return false;

    const xmlText = findFirstTextNode(found.element);
    if (!xmlText) return false;

    this.setCursorToBlock(found.element);
    xmlText.format(start, length, { [markName]: attrs ?? {} });
    return true;
  }

  /**
   * Remove a mark from a text range within a block (by stable ID).
   */
  removeFormatById(
    blockId: string,
    start: number,
    length: number,
    markName: string,
  ): boolean {
    if (!this.schema.marks[markName]) return false;

    const found = this.findBlockById(blockId);
    if (!found) return false;

    const xmlText = findFirstTextNode(found.element);
    if (!xmlText) return false;

    this.setCursorToBlock(found.element);
    xmlText.format(start, length, { [markName]: null });
    return true;
  }

  /**
   * Apply or remove a mark on text matched by content string (by stable ID).
   * More reliable than offset-based formatting since the agent doesn't need to count characters.
   */
  formatTextByMatch(
    blockId: string,
    matchText: string,
    markName: string,
    attrs?: Record<string, unknown>,
    occurrence: number = 1,
    remove: boolean = false,
  ): { success: boolean; totalOccurrences: number } {
    if (!this.schema.marks[markName]) return { success: false, totalOccurrences: 0 };

    const found = this.findBlockById(blockId);
    if (!found) return { success: false, totalOccurrences: 0 };

    const totalOccurrences = countTextInElement(found.element, matchText);
    if (totalOccurrences === 0) return { success: false, totalOccurrences: 0 };
    if (occurrence > totalOccurrences) return { success: false, totalOccurrences };

    const match = findTextInElement(found.element, matchText, occurrence);
    if (!match) return { success: false, totalOccurrences };

    this.setCursorToBlock(found.element);
    if (remove) {
      match.xmlText.format(match.offset, matchText.length, { [markName]: null });
    } else {
      match.xmlText.format(match.offset, matchText.length, { [markName]: attrs ?? {} });
    }
    return { success: true, totalOccurrences };
  }

  /**
   * Get available mark type names from the schema.
   */
  getAvailableMarks(): string[] {
    return getMarkTypes(this.schema);
  }

  /**
   * Get available block type names from the schema.
   */
  getAvailableBlockTypes(): string[] {
    return getBlockTypes(this.schema);
  }

  // --- Suggestion mode methods ---

  /**
   * Insert a block with all text wrapped in suggestion-add marks.
   * Returns the new block's stable ID.
   */
  insertBlockAsSuggestion(
    index: number,
    type: string,
    content: string,
    attrs?: Record<string, unknown>,
  ): string {
    const blockId = this.insertBlock(index, type, content, attrs);
    // Apply suggestion-add mark to all text in the new block
    const found = this.findBlockById(blockId);
    if (found) {
      const xmlText = findFirstTextNode(found.element);
      if (xmlText && xmlText.length > 0) {
        xmlText.format(0, xmlText.length, {
          suggestionAdd: {
            suggestionId: randomUUID(),
            authorId: `agent:${this.agentName}`,
            authorName: this.agentName,
            createdAt: new Date().toISOString(),
          },
        });
      }
    }
    return blockId;
  }

  /**
   * Insert a block from ProseMirror JSON with suggestion-add marks.
   */
  insertBlockJSONAsSuggestion(index: number, json: Record<string, unknown>): string {
    const blockId = this.insertBlockJSON(index, json);
    const found = this.findBlockById(blockId);
    if (found) {
      this.applySuggestionAddToAllText(found.element);
    }
    return blockId;
  }

  /**
   * Update a block as a suggestion: mark old text as suggestion-delete,
   * insert new text with suggestion-add.
   */
  updateBlockAsSuggestion(blockId: string, content: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;

    const xmlText = findFirstTextNode(found.element);
    if (!xmlText) return false;

    this.setCursorToBlock(found.element);
    const suggestionId = randomUUID();
    const now = new Date().toISOString();
    const markAttrs = {
      suggestionId,
      authorId: `agent:${this.agentName}`,
      authorName: this.agentName,
      createdAt: now,
    };

    // Mark existing text as suggestion-delete
    if (xmlText.length > 0) {
      xmlText.format(0, xmlText.length, {
        suggestionDelete: markAttrs,
      });
    }

    // Insert new text at the end with suggestion-add
    const insertPos = xmlText.length;
    xmlText.insert(insertPos, content);
    xmlText.format(insertPos, content.length, {
      suggestionAdd: markAttrs,
    });

    this.setCursorToBlock(found.element);
    return true;
  }

  /**
   * Find and replace text as a suggestion: mark old text as suggestion-delete,
   * insert replacement with suggestion-add.
   */
  replaceTextAsSuggestion(blockId: string, search: string, replacement: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;

    const match = findTextInElement(found.element, search, 1);
    if (!match) return false;

    this.setCursorToBlock(found.element);
    const suggestionId = randomUUID();
    const now = new Date().toISOString();
    const markAttrs = {
      suggestionId,
      authorId: `agent:${this.agentName}`,
      authorName: this.agentName,
      createdAt: now,
    };

    // Mark the search text as suggestion-delete
    match.xmlText.format(match.offset, search.length, {
      suggestionDelete: markAttrs,
    });

    // Insert replacement text right after the deleted text with suggestion-add
    const insertPos = match.offset + search.length;
    match.xmlText.insert(insertPos, replacement);
    match.xmlText.format(insertPos, replacement.length, {
      suggestionAdd: markAttrs,
    });

    this.setCursorToBlock(found.element);
    return true;
  }

  /**
   * Delete a block as a suggestion: mark all text as suggestion-delete
   * instead of physically removing the block.
   */
  deleteBlockAsSuggestion(blockId: string): boolean {
    const found = this.findBlockById(blockId);
    if (!found) return false;

    this.setCursorToBlock(found.element);
    const markAttrs = {
      suggestionId: randomUUID(),
      authorId: `agent:${this.agentName}`,
      authorName: this.agentName,
      createdAt: new Date().toISOString(),
    };
    this.applySuggestionDeleteRecursive(found.element, markAttrs);
    return true;
  }

  /**
   * Apply suggestion-add marks to all text nodes in an element (recursive).
   */
  private applySuggestionAddToAllText(element: Y.XmlElement): void {
    const markAttrs = {
      suggestionId: randomUUID(),
      authorId: `agent:${this.agentName}`,
      authorName: this.agentName,
      createdAt: new Date().toISOString(),
    };
    this.applySuggestionAddRecursive(element, markAttrs);
  }

  private applySuggestionAddRecursive(
    element: Y.XmlElement,
    markAttrs: Record<string, string>,
  ): void {
    for (let i = 0; i < element.length; i++) {
      const child = element.get(i);
      if (child instanceof Y.XmlText && child.length > 0) {
        child.format(0, child.length, { suggestionAdd: markAttrs });
      } else if (child instanceof Y.XmlElement) {
        this.applySuggestionAddRecursive(child, markAttrs);
      }
    }
  }

  private applySuggestionDeleteRecursive(
    element: Y.XmlElement,
    markAttrs: Record<string, string>,
  ): void {
    for (let i = 0; i < element.length; i++) {
      const child = element.get(i);
      if (child instanceof Y.XmlText && child.length > 0) {
        child.format(0, child.length, { suggestionDelete: markAttrs });
      } else if (child instanceof Y.XmlElement) {
        this.applySuggestionDeleteRecursive(child, markAttrs);
      }
    }
  }

  // --- Suggestion scanning & review (Yjs-level) ---

  /**
   * Find all suggestion marks in the document.
   * Walks Yjs XmlText deltas to find suggestionAdd / suggestionDelete formatting.
   */
  findAllSuggestions(): YjsSuggestionInfo[] {
    const fragment = this.getFragment();
    const suggestions: YjsSuggestionInfo[] = [];

    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlElement) {
        const blockId = this.ensureBlockId(child);
        collectSuggestionsFromElement(child, blockId, suggestions);
      }
    }

    // Merge adjacent ranges with the same suggestionId + type
    const merged: YjsSuggestionInfo[] = [];
    for (const s of suggestions) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.suggestionId === s.suggestionId &&
        last.type === s.type &&
        last.blockId === s.blockId
      ) {
        last.text += s.text;
        last.length += s.length;
      } else {
        merged.push({ ...s });
      }
    }
    return merged;
  }

  /**
   * Accept a suggestion by its ID.
   * - suggestionAdd: remove the mark (keep text)
   * - suggestionDelete: delete the text
   */
  acceptSuggestion(suggestionId: string): boolean {
    const suggestions = this.findAllSuggestions();
    const matching = suggestions.filter((s) => s.suggestionId === suggestionId);
    if (matching.length === 0) return false;

    // Process in reverse order to avoid offset shifts
    const sorted = [...matching].sort((a, b) => b.offset - a.offset);
    for (const s of sorted) {
      if (s.type === "add") {
        // Remove the mark, keep the text
        s.xmlText.format(s.offset, s.length, { suggestionAdd: null });
      } else {
        // Delete the text
        s.xmlText.delete(s.offset, s.length);
      }
    }
    return true;
  }

  /**
   * Reject a suggestion by its ID.
   * - suggestionAdd: delete the text
   * - suggestionDelete: remove the mark (keep text)
   */
  rejectSuggestion(suggestionId: string): boolean {
    const suggestions = this.findAllSuggestions();
    const matching = suggestions.filter((s) => s.suggestionId === suggestionId);
    if (matching.length === 0) return false;

    // Process in reverse order to avoid offset shifts
    const sorted = [...matching].sort((a, b) => b.offset - a.offset);
    for (const s of sorted) {
      if (s.type === "add") {
        // Delete the text
        s.xmlText.delete(s.offset, s.length);
      } else {
        // Remove the mark, keep the text
        s.xmlText.format(s.offset, s.length, { suggestionDelete: null });
      }
    }
    return true;
  }

  /**
   * Accept all suggestions in the document.
   */
  acceptAllSuggestions(): number {
    const suggestions = this.findAllSuggestions();
    const ids = [...new Set(suggestions.map((s) => s.suggestionId))];
    for (const id of ids) this.acceptSuggestion(id);
    return ids.length;
  }

  /**
   * Reject all suggestions in the document.
   */
  rejectAllSuggestions(): number {
    const suggestions = this.findAllSuggestions();
    const ids = [...new Set(suggestions.map((s) => s.suggestionId))];
    for (const id of ids) this.rejectSuggestion(id);
    return ids.length;
  }

  /**
   * Export the document content as Markdown.
   * Reads PM JSON and serializes it.
   */
  exportAsMarkdown(): string {
    const blocks = this.readDocumentJSON();
    const doc: PMNode = {
      type: "doc",
      content: blocks.map((b) => b.json as unknown as PMNode),
    };
    return serializePMNodeToMarkdown(doc);
  }

  /**
   * Export the document content as HTML.
   */
  exportAsHTML(): string {
    const blocks = this.readDocumentJSON();
    const doc: PMNode = {
      type: "doc",
      content: blocks.map((b) => b.json as unknown as PMNode),
    };
    return serializePMNodeToHTML(doc);
  }

  // --- Database methods ---

  private getDbMeta(databaseId?: string): Y.Map<unknown> {
    const key = databaseId ? `db_meta_${databaseId}` : "database_meta";
    return this.ydoc.getMap(key);
  }

  private getDbRows(databaseId?: string): Y.Array<unknown> {
    const key = databaseId ? `db_rows_${databaseId}` : "database_rows";
    return this.ydoc.getArray(key);
  }

  private readDbColumns(databaseId?: string): Array<{ id: string; name: string; type: string; width: number; options?: string[] }> {
    const raw = this.getDbMeta(databaseId).get("columns");
    if (Array.isArray(raw)) return raw;
    return [];
  }

  readDatabaseSchema(databaseId?: string): { columns: Array<{ id: string; name: string; type: string; width: number; options?: string[] }> } {
    return { columns: this.readDbColumns(databaseId) };
  }

  readDatabaseRows(options?: { limit?: number; offset?: number; databaseId?: string }): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    const dbRows = this.getDbRows(options?.databaseId);

    dbRows.forEach((item) => {
      if (item instanceof Y.Map) {
        const obj: Record<string, unknown> = {};
        item.forEach((v, k) => { obj[k] = v; });
        rows.push(obj);
      }
    });

    const start = options?.offset ?? 0;
    const end = options?.limit ? start + options.limit : rows.length;
    return rows.slice(start, end);
  }

  insertDatabaseRow(values: Record<string, unknown>, databaseId?: string): string {
    const dbRows = this.getDbRows(databaseId);
    const rowMap = new Y.Map<unknown>();
    const rowId = randomUUID();

    this.ydoc.transact(() => {
      rowMap.set("id", rowId);
      for (const [key, val] of Object.entries(values)) {
        rowMap.set(key, val);
      }
      dbRows.push([rowMap]);
    });

    return rowId;
  }

  updateDatabaseCell(rowId: string, columnId: string, value: unknown, databaseId?: string): boolean {
    const dbRows = this.getDbRows(databaseId);
    for (let i = 0; i < dbRows.length; i++) {
      const item = dbRows.get(i);
      if (item instanceof Y.Map && item.get("id") === rowId) {
        item.set(columnId, value);
        return true;
      }
    }
    return false;
  }

  deleteDatabaseRow(rowId: string, databaseId?: string): boolean {
    const dbRows = this.getDbRows(databaseId);
    for (let i = 0; i < dbRows.length; i++) {
      const item = dbRows.get(i);
      if (item instanceof Y.Map && item.get("id") === rowId) {
        dbRows.delete(i, 1);
        return true;
      }
    }
    return false;
  }

  addDatabaseColumn(name: string, type: string, options?: string[], databaseId?: string): string {
    const dbMeta = this.getDbMeta(databaseId);
    const cols = this.readDbColumns(databaseId);
    const colId = randomUUID();
    const newCol = { id: colId, name, type, width: 200, ...(options ? { options } : {}) };
    dbMeta.set("columns", [...cols, newCol]);
    return colId;
  }

  updateDatabaseColumn(columnId: string, updates: { name?: string; type?: string; options?: string[] }, databaseId?: string): boolean {
    const dbMeta = this.getDbMeta(databaseId);
    const cols = this.readDbColumns(databaseId);
    const idx = cols.findIndex((c) => c.id === columnId);
    if (idx === -1) return false;
    cols[idx] = { ...cols[idx], ...updates };
    dbMeta.set("columns", cols);
    return true;
  }

  /** List all inline database blocks in the current document. */
  listInlineDatabases(): Array<{ blockId: string; databaseId: string; title: string }> {
    const fragment = this.getFragment();
    const results: Array<{ blockId: string; databaseId: string; title: string }> = [];
    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlElement && child.nodeName === "inlineDatabase") {
        const blockId = this.ensureBlockId(child);
        const databaseId = child.getAttribute("databaseId") as string | undefined;
        const title = (child.getAttribute("title") as string) || "Untitled Database";
        if (databaseId) {
          results.push({ blockId, databaseId, title });
        }
      }
    }
    return results;
  }

  disconnect(): void {
    if (!this.connected) return;
    this.clearCursor();
    this.provider.awareness.setLocalState(null);
    this.provider.disconnect();
    this.ydoc.destroy();
    this.connected = false;
  }
}

// --- Helpers ---

function createBlockElement(
  type: string,
  content: string,
  attrs?: Record<string, unknown>,
): Y.XmlElement {
  const element = new Y.XmlElement(type);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value as string);
    }
  }

  // Atom nodes have no editable text content
  if (type === "horizontalRule" || type === "htmlEmbed") {
    return element;
  }

  if (type === "bulletList" || type === "orderedList" || type === "taskList") {
    const listItem = new Y.XmlElement("listItem");
    const para = new Y.XmlElement("paragraph");
    const textNode = new Y.XmlText();
    textNode.insert(0, content);
    para.insert(0, [textNode]);
    listItem.insert(0, [para]);
    element.insert(0, [listItem]);
    return element;
  }

  const textNode = new Y.XmlText();
  textNode.insert(0, content);
  element.insert(0, [textNode]);
  return element;
}

function xmlElementToText(element: Y.XmlElement): string {
  const parts: string[] = [];
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(xmlElementToText(child));
    }
  }
  return parts.join("");
}

function findFirstTextNode(element: Y.XmlElement): Y.XmlText | null {
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) return child;
    if (child instanceof Y.XmlElement) {
      const found = findFirstTextNode(child);
      if (found) return found;
    }
  }
  return null;
}

function findTextInElement(
  element: Y.XmlElement,
  searchText: string,
  targetOccurrence: number,
  counter: { count: number } = { count: 0 },
): { xmlText: Y.XmlText; offset: number } | null {
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      const text = child.toString();
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(searchText, searchFrom);
        if (idx === -1) break;
        counter.count++;
        if (counter.count === targetOccurrence) {
          return { xmlText: child, offset: idx };
        }
        searchFrom = idx + 1;
      }
    } else if (child instanceof Y.XmlElement) {
      const found = findTextInElement(child, searchText, targetOccurrence, counter);
      if (found) return found;
    }
  }
  return null;
}

function countTextInElement(element: Y.XmlElement, searchText: string): number {
  let count = 0;
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      const text = child.toString();
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(searchText, searchFrom);
        if (idx === -1) break;
        count++;
        searchFrom = idx + 1;
      }
    } else if (child instanceof Y.XmlElement) {
      count += countTextInElement(child, searchText);
    }
  }
  return count;
}

function replaceInElement(
  element: Y.XmlElement,
  search: string,
  replacement: string,
): boolean {
  let replaced = false;
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      const text = child.toString();
      const idx = text.indexOf(search);
      if (idx !== -1) {
        child.delete(idx, search.length);
        child.insert(idx, replacement);
        replaced = true;
      }
    } else if (child instanceof Y.XmlElement) {
      if (replaceInElement(child, search, replacement)) {
        replaced = true;
      }
    }
  }
  return replaced;
}

// --- Suggestion scanning helpers ---

export interface YjsSuggestionInfo {
  suggestionId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  type: "add" | "delete";
  text: string;
  blockId: string;
  xmlText: Y.XmlText;
  offset: number;
  length: number;
}

function collectSuggestionsFromElement(
  element: Y.XmlElement,
  blockId: string,
  out: YjsSuggestionInfo[],
): void {
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      collectSuggestionsFromXmlText(child, blockId, out);
    } else if (child instanceof Y.XmlElement) {
      collectSuggestionsFromElement(child, blockId, out);
    }
  }
}

function collectSuggestionsFromXmlText(
  xmlText: Y.XmlText,
  blockId: string,
  out: YjsSuggestionInfo[],
): void {
  const deltas = xmlText.toDelta() as Array<{
    insert: string;
    attributes?: Record<string, Record<string, string>>;
  }>;

  let offset = 0;
  for (const delta of deltas) {
    const text = typeof delta.insert === "string" ? delta.insert : "";
    const len = text.length;
    const attrs = delta.attributes;

    if (attrs) {
      for (const markName of ["suggestionAdd", "suggestionDelete"] as const) {
        const markAttrs = attrs[markName];
        if (markAttrs) {
          out.push({
            suggestionId: markAttrs.suggestionId,
            authorId: markAttrs.authorId,
            authorName: markAttrs.authorName,
            createdAt: markAttrs.createdAt,
            type: markName === "suggestionAdd" ? "add" : "delete",
            text,
            blockId,
            xmlText,
            offset,
            length: len,
          });
        }
      }
    }
    offset += len;
  }
}

// --- Markdown / HTML export helpers ---

interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function serializePMNodeToMarkdown(node: PMNode): string {
  return serializeMDNode(node).trim() + "\n";
}

function serializeMDNode(node: PMNode, indent = ""): string {
  switch (node.type) {
    case "doc":
      return serializeMDChildren(node.content);

    case "paragraph": {
      const text = serializeMDInline(node.content);
      if (!text) return "\n";
      return indent + text + "\n";
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(Math.min(level, 6));
      return `${prefix} ${serializeMDInline(node.content)}\n`;
    }

    case "bulletList":
      return serializeMDListItems(node.content, indent, "bullet");
    case "orderedList":
      return serializeMDListItems(node.content, indent, "ordered");
    case "taskList":
      return serializeMDListItems(node.content, indent, "task");

    case "listItem":
      return serializeMDListItem(node, indent, "- ");
    case "taskItem": {
      const checked = node.attrs?.checked ? "[x]" : "[ ]";
      return serializeMDListItem(node, indent, `- ${checked} `);
    }

    case "blockquote": {
      const inner = serializeMDChildren(node.content);
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n") + "\n";
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = serializeMDInline(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }

    case "horizontalRule":
      return "---\n";

    case "image": {
      const alt = (node.attrs?.alt as string) ?? "";
      const src = (node.attrs?.src as string) ?? "";
      return `![${alt}](${src})\n`;
    }

    case "table":
      return serializeMDTable(node);

    case "hardBreak":
      return "\n";

    default:
      if (node.content) return serializeMDChildren(node.content);
      if (node.text) return node.text;
      return "";
  }
}

function serializeMDChildren(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  const parts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    parts.push(serializeMDNode(nodes[i]));
    if (i < nodes.length - 1 && needsMDBlankLine(nodes[i], nodes[i + 1])) {
      parts.push("\n");
    }
  }
  return parts.join("");
}

function needsMDBlankLine(current: PMNode, next: PMNode): boolean {
  const currentEmpty = current.type === "paragraph" && (!current.content || current.content.length === 0);
  const nextEmpty = next.type === "paragraph" && (!next.content || next.content.length === 0);
  if (currentEmpty || nextEmpty) return false;
  if (current.type === "listItem" || current.type === "taskItem") return false;
  return true;
}

function serializeMDInline(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") {
        let text = node.text ?? "";
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case "bold":
              case "strong":
                text = wrapMDMark(text, "**", "**");
                break;
              case "italic":
              case "em":
                text = wrapMDMark(text, "*", "*");
                break;
              case "code":
                text = wrapMDMark(text, "`", "`");
                break;
              case "strike":
                text = wrapMDMark(text, "~~", "~~");
                break;
              case "link":
                text = `[${text}](${mark.attrs?.href ?? ""})`;
                break;
              case "underline":
                text = wrapMDMark(text, "<u>", "</u>");
                break;
            }
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      if (node.type === "image") {
        return `![${(node.attrs?.alt as string) ?? ""}](${(node.attrs?.src as string) ?? ""})`;
      }
      return "";
    })
    .join("");
}

function wrapMDMark(text: string, open: string, close: string): string {
  const leading = text.match(/^(\s*)/)?.[1] ?? "";
  const trailing = text.match(/(\s*)$/)?.[1] ?? "";
  const inner = text.slice(leading.length, text.length - trailing.length);
  if (!inner) return text;
  return `${leading}${open}${inner}${close}${trailing}`;
}

function serializeMDListItems(
  items: PMNode[] | undefined,
  indent: string,
  listType: "bullet" | "ordered" | "task",
): string {
  if (!items) return "";
  return items
    .map((item, i) => {
      if (listType === "ordered") return serializeMDListItem(item, indent, `${i + 1}. `);
      if (listType === "task") {
        const checked = item.attrs?.checked ? "[x]" : "[ ]";
        return serializeMDListItem(item, indent, `- ${checked} `);
      }
      return serializeMDListItem(item, indent, "- ");
    })
    .join("");
}

function serializeMDListItem(node: PMNode, indent: string, prefix: string): string {
  if (!node.content) return indent + prefix + "\n";
  const lines: string[] = [];
  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i];
    if (i === 0 && child.type === "paragraph") {
      lines.push(indent + prefix + serializeMDInline(child.content));
    } else if (["bulletList", "orderedList", "taskList"].includes(child.type)) {
      lines.push(serializeMDNode(child, indent + "  "));
    } else {
      lines.push(indent + "  " + serializeMDNode(child).trimStart());
    }
  }
  return lines.join("\n") + "\n";
}

function serializeMDTable(node: PMNode): string {
  if (!node.content) return "";
  const rows: string[][] = [];
  let isFirstRowHeader = false;
  for (let r = 0; r < node.content.length; r++) {
    const row = node.content[r];
    if (!row.content) continue;
    const cells: string[] = [];
    for (const cell of row.content) {
      const text = cell.content
        ? cell.content.map((p) => serializeMDInline(p.content)).join(" ")
        : "";
      cells.push(text);
      if (r === 0 && cell.type === "tableHeader") isFirstRowHeader = true;
    }
    rows.push(cells);
  }
  if (rows.length === 0) return "";
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const formatRow = (cells: string[]) =>
    "| " + cells.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |";
  const lines: string[] = [];
  lines.push(formatRow(rows[0]));
  lines.push("| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |");
  for (let r = 1; r < rows.length; r++) lines.push(formatRow(rows[r]));
  return lines.join("\n") + "\n";
}

// --- HTML export ---

function serializePMNodeToHTML(node: PMNode): string {
  return serializeHTMLNode(node);
}

function serializeHTMLNode(node: PMNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(serializeHTMLNode).join("");

    case "paragraph":
      return `<p>${serializeHTMLInline(node.content)}</p>`;

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      return `<h${level}>${serializeHTMLInline(node.content)}</h${level}>`;
    }

    case "bulletList":
      return `<ul>${(node.content ?? []).map(serializeHTMLNode).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map(serializeHTMLNode).join("")}</ol>`;
    case "taskList":
      return `<ul data-type="taskList">${(node.content ?? []).map(serializeHTMLNode).join("")}</ul>`;
    case "listItem":
      return `<li>${(node.content ?? []).map(serializeHTMLNode).join("")}</li>`;
    case "taskItem": {
      const checked = node.attrs?.checked ? " checked" : "";
      return `<li><input type="checkbox" disabled${checked}> ${serializeHTMLInline(node.content)}</li>`;
    }

    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(serializeHTMLNode).join("")}</blockquote>`;

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const cls = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${cls}>${escapeHTML(serializeHTMLInline(node.content))}</code></pre>`;
    }

    case "horizontalRule":
      return "<hr>";

    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      return `<img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}">`;
    }

    case "table":
      return `<table>${(node.content ?? []).map(serializeHTMLNode).join("")}</table>`;
    case "tableRow":
      return `<tr>${(node.content ?? []).map(serializeHTMLNode).join("")}</tr>`;
    case "tableHeader":
      return `<th>${(node.content ?? []).map(serializeHTMLNode).join("")}</th>`;
    case "tableCell":
      return `<td>${(node.content ?? []).map(serializeHTMLNode).join("")}</td>`;

    case "hardBreak":
      return "<br>";

    default:
      if (node.content) return (node.content).map(serializeHTMLNode).join("");
      if (node.text) return escapeHTML(node.text);
      return "";
  }
}

function serializeHTMLInline(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") {
        let html = escapeHTML(node.text ?? "");
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case "bold":
              case "strong":
                html = `<strong>${html}</strong>`;
                break;
              case "italic":
              case "em":
                html = `<em>${html}</em>`;
                break;
              case "code":
                html = `<code>${html}</code>`;
                break;
              case "strike":
                html = `<s>${html}</s>`;
                break;
              case "underline":
                html = `<u>${html}</u>`;
                break;
              case "link":
                html = `<a href="${escapeHTML(String(mark.attrs?.href ?? ""))}">${html}</a>`;
                break;
            }
          }
        }
        return html;
      }
      if (node.type === "hardBreak") return "<br>";
      if (node.type === "image") {
        return `<img src="${escapeHTML(String(node.attrs?.src ?? ""))}" alt="${escapeHTML(String(node.attrs?.alt ?? ""))}">`;
      }
      return "";
    })
    .join("");
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
