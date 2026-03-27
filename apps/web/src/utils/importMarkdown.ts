import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { generateJSON } from "@tiptap/html";
import { getSchemaExtensions } from "@motion/editor-extensions";
import type { JSONContent } from "@tiptap/react";

const md = new MarkdownIt({ html: true, linkify: true }).use(taskLists, {
  enabled: true,
  label: false,
});

/**
 * Post-process markdown-it's task list HTML to match TipTap's expected format.
 *
 * markdown-it-task-lists outputs:
 *   <ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> text</li>
 *
 * TipTap TaskList expects:
 *   <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>text</p></li>
 */
function fixTaskListHTML(html: string): string {
  // Replace task list <ul> wrappers
  let result = html.replace(
    /<ul class="contains-task-list">/g,
    '<ul data-type="taskList">',
  );

  // Replace checked task items
  result = result.replace(
    /<li class="task-list-item">\s*<input[^>]*checked[^>]*disabled[^>]*>\s*/g,
    '<li data-type="taskItem" data-checked="true"><p>',
  );

  // Replace unchecked task items
  result = result.replace(
    /<li class="task-list-item">\s*<input[^>]*disabled[^>]*>\s*/g,
    '<li data-type="taskItem" data-checked="false"><p>',
  );

  // Close the <p> tags we opened inside task items
  // Each task list item's closing </li> needs a </p> before it
  result = result.replace(
    /(<li data-type="taskItem"[^>]*><p>)([\s\S]*?)(<\/li>)/g,
    (_match, open, content, close) => {
      // Remove any trailing newline before </li>
      const trimmed = content.replace(/\n$/, "");
      return `${open}${trimmed}</p>${close}`;
    },
  );

  return result;
}

export interface ImportResult {
  title: string;
  doc: JSONContent;
}

/**
 * Convert a Markdown string to a ProseMirror JSON document.
 * Extracts the first H1 as the page title (if present).
 */
export function markdownToDoc(markdown: string): ImportResult {
  let html = md.render(markdown);
  html = fixTaskListHTML(html);

  const extensions = getSchemaExtensions();
  const doc = generateJSON(html, extensions) as JSONContent;

  // Extract title from first heading
  let title = "Untitled";
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
