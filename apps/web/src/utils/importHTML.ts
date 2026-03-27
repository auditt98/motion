import { generateJSON } from "@tiptap/html";
import { getSchemaExtensions } from "@motion/editor-extensions";
import type { JSONContent } from "@tiptap/react";

export interface ImportResult {
  title: string;
  doc: JSONContent;
}

/**
 * Convert an HTML string to a ProseMirror JSON document.
 * Handles both full HTML documents and fragments.
 */
export function htmlToDoc(html: string): ImportResult {
  // Extract body content if this is a full HTML document
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;

  const extensions = getSchemaExtensions();
  const doc = generateJSON(content.trim(), extensions) as JSONContent;

  // Extract title from first <h1> or <title>
  let title = "Untitled";

  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Override with first H1 in the document content
  const firstNode = doc.content?.[0];
  if (firstNode?.type === "heading" && firstNode.attrs?.level === 1) {
    const textContent = extractText(firstNode);
    if (textContent) {
      title = textContent;
    }
  }

  return { title, doc };
}

function extractText(node: JSONContent): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(extractText).join("");
}
