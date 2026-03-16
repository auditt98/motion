import type { Editor } from "@tiptap/react";
import { downloadFile } from "./download";

// --- Types matching ProseMirror JSON ---

interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
}

interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// --- Inline serialization ---

function wrapMark(text: string, open: string, close: string): string {
  // Preserve leading/trailing whitespace outside the mark delimiters
  // so "Hello world " with bold becomes "**Hello world** " not "**Hello world **"
  const leadingMatch = text.match(/^(\s*)/);
  const trailingMatch = text.match(/(\s*)$/);
  const leading = leadingMatch ? leadingMatch[1] : "";
  const trailing = trailingMatch ? trailingMatch[1] : "";
  const inner = text.slice(leading.length, text.length - trailing.length);
  if (!inner) return text; // all whitespace, don't wrap
  return `${leading}${open}${inner}${close}${trailing}`;
}

function serializeMarks(text: string, marks: PMMark[]): string {
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
      case "strong":
        result = wrapMark(result, "**", "**");
        break;
      case "italic":
      case "em":
        result = wrapMark(result, "*", "*");
        break;
      case "code":
        result = wrapMark(result, "`", "`");
        break;
      case "strike":
        result = wrapMark(result, "~~", "~~");
        break;
      case "link":
        result = `[${result}](${mark.attrs?.href ?? ""})`;
        break;
      case "underline":
        result = wrapMark(result, "<u>", "</u>");
        break;
      // highlight, comment, textStyle, color → pass through as plain text
    }
  }
  return result;
}

function serializeInlineContent(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") {
        const text = node.text ?? "";
        return node.marks ? serializeMarks(text, node.marks) : text;
      }
      if (node.type === "hardBreak") return "\n";
      if (node.type === "image") {
        const alt = (node.attrs?.alt as string) ?? "";
        const src = (node.attrs?.src as string) ?? "";
        return `![${alt}](${src})`;
      }
      return "";
    })
    .join("");
}

// --- Block serialization ---

function serializeNode(node: PMNode, indent: string = ""): string {
  switch (node.type) {
    case "doc":
      return serializeChildren(node.content).trim() + "\n";

    case "paragraph": {
      const text = serializeInlineContent(node.content);
      // Empty paragraph = blank line in the editor → just a newline
      if (!text) return "\n";
      return indent + text + "\n";
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(Math.min(level, 6));
      return `${prefix} ${serializeInlineContent(node.content)}\n`;
    }

    case "bulletList":
      return serializeListItems(node.content, indent, "bullet");

    case "orderedList":
      return serializeListItems(node.content, indent, "ordered");

    case "taskList":
      return serializeListItems(node.content, indent, "task");

    case "listItem":
      return serializeListItem(node, indent, "- ");

    case "taskItem": {
      const checked = node.attrs?.checked ? "[x]" : "[ ]";
      return serializeListItem(node, indent, `- ${checked} `);
    }

    case "blockquote":
      return serializeBlockquote(node);

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = serializeInlineContent(node.content);
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
      return serializeTable(node);

    case "callout": {
      const emoji = (node.attrs?.emoji as string) ?? "";
      const text = serializeInlineContent(node.content);
      return `> ${emoji} ${text}\n`;
    }

    case "toggle": {
      const summary = (node.attrs?.summary as string) ?? "Toggle";
      const content = serializeChildren(node.content);
      return `<details>\n<summary>${summary}</summary>\n\n${content}\n</details>\n`;
    }

    case "hardBreak":
      return "\n";

    default:
      // Fallback: try to render content
      if (node.content) return serializeChildren(node.content);
      if (node.text) return node.text;
      return "";
  }
}

function serializeChildren(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  const parts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const serialized = serializeNode(nodes[i]);
    parts.push(serialized);
    // Add a blank line between blocks (paragraph separation) but not after the last one.
    // Empty paragraphs (blank lines in the editor) already produce just "\n",
    // so a blank line in the editor naturally becomes a blank line in markdown.
    if (i < nodes.length - 1 && needsBlankLine(nodes[i], nodes[i + 1])) {
      parts.push("\n");
    }
  }
  return parts.join("");
}

/** Decide whether two adjacent blocks need a blank line separator between them. */
function needsBlankLine(current: PMNode, next: PMNode): boolean {
  // Empty paragraphs already output as a bare "\n" — they ARE the blank line,
  // so don't add another one around them.
  const currentEmpty = isEmptyParagraph(current);
  const nextEmpty = isEmptyParagraph(next);
  if (currentEmpty || nextEmpty) return false;
  // List items within a list don't need blank lines between them
  if (current.type === "listItem" || current.type === "taskItem") return false;
  // All other adjacent blocks get a blank line for standard markdown separation
  return true;
}

function isEmptyParagraph(node: PMNode): boolean {
  return node.type === "paragraph" && (!node.content || node.content.length === 0);
}

function serializeListItems(
  items: PMNode[] | undefined,
  indent: string,
  listType: "bullet" | "ordered" | "task",
): string {
  if (!items) return "";
  return items
    .map((item, i) => {
      if (listType === "ordered") {
        return serializeListItem(item, indent, `${i + 1}. `);
      }
      if (listType === "task") {
        const checked = item.attrs?.checked ? "[x]" : "[ ]";
        return serializeListItem(item, indent, `- ${checked} `);
      }
      return serializeListItem(item, indent, "- ");
    })
    .join("");
}

function serializeListItem(
  node: PMNode,
  indent: string,
  prefix: string,
): string {
  if (!node.content) return indent + prefix + "\n";

  const lines: string[] = [];
  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i];
    if (i === 0 && child.type === "paragraph") {
      // First paragraph is inline with the bullet
      lines.push(indent + prefix + serializeInlineContent(child.content));
    } else if (
      child.type === "bulletList" ||
      child.type === "orderedList" ||
      child.type === "taskList"
    ) {
      // Nested lists get extra indent
      lines.push(serializeNode(child, indent + "  "));
    } else {
      lines.push(indent + "  " + serializeNode(child).trimStart());
    }
  }
  return lines.join("\n") + "\n";
}

function serializeBlockquote(node: PMNode): string {
  const inner = serializeChildren(node.content);
  return inner
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n") + "\n";
}

// --- Table ---

function serializeTable(node: PMNode): string {
  if (!node.content) return "";

  const rows: string[][] = [];
  let isFirstRowHeader = false;

  for (let r = 0; r < node.content.length; r++) {
    const row = node.content[r];
    if (!row.content) continue;

    const cells: string[] = [];
    for (const cell of row.content) {
      const text = cell.content
        ? cell.content.map((p) => serializeInlineContent(p.content)).join(" ")
        : "";
      cells.push(text);

      if (r === 0 && cell.type === "tableHeader") {
        isFirstRowHeader = true;
      }
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  // Determine column widths
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...rows.map((r) => (r[i] ?? "").length)),
  );

  const formatRow = (cells: string[]) =>
    "| " +
    cells
      .map((c, i) => c.padEnd(colWidths[i]))
      .join(" | ") +
    " |";

  const lines: string[] = [];
  lines.push(formatRow(rows[0]));

  if (isFirstRowHeader) {
    lines.push(
      "| " +
        colWidths.map((w) => "-".repeat(w)).join(" | ") +
        " |",
    );
    for (let r = 1; r < rows.length; r++) {
      lines.push(formatRow(rows[r]));
    }
  } else {
    // No header row — add a blank separator after first row
    lines.push(
      "| " +
        colWidths.map((w) => "-".repeat(w)).join(" | ") +
        " |",
    );
    for (let r = 1; r < rows.length; r++) {
      lines.push(formatRow(rows[r]));
    }
  }

  return lines.join("\n") + "\n";
}

// --- Main export ---

export function exportAsMarkdown(editor: Editor, title: string): void {
  const json = editor.getJSON() as PMNode;
  const markdown = serializeNode(json);
  downloadFile(`${title}.md`, markdown, "text/markdown");
}
