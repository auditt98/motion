/**
 * Shared schema-defining extensions for TipTap/ProseMirror.
 *
 * Used by both the web editor (browser) and MCP server (Node.js).
 * Client-only extensions (Collaboration, CollaborationCursor, Placeholder,
 * SlashCommand) are NOT included here — add them in the web app.
 *
 * IMPORTANT: Import from @tiptap/core (not @tiptap/react) so this works in Node.js.
 */

import { Node, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

// --- Custom block extensions ---

export type CalloutVariant = "info" | "warning" | "error" | "success";

export const CalloutExtension = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-variant") || "info",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-variant": attributes.variant,
        }),
      },
      emoji: {
        default: "\u2139\ufe0f",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-emoji") || "\u2139\ufe0f",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-emoji": attributes.emoji,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const variant = (HTMLAttributes["data-variant"] as string) || "info";
    const emoji = (HTMLAttributes["data-emoji"] as string) || "\u2139\ufe0f";

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        class: `callout-block ${variant}`,
      }),
      ["span", { class: "callout-emoji", contenteditable: "false" }, emoji],
      ["span", { class: "callout-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes?: { variant?: CalloutVariant; emoji?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.setNode(this.name, attributes);
        },
    } as any;
  },
});

export const ToggleExtension = Node.create({
  name: "toggle",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute("open"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.open ? { open: "" } : {},
      },
      summary: {
        default: "Toggle",
        parseHTML: (element: HTMLElement) =>
          element.querySelector("summary")?.textContent || "Toggle",
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const { summary, ...rest } = HTMLAttributes;
    return [
      "details",
      mergeAttributes(rest, { class: "toggle-block" }),
      ["summary", {}, (summary as string) || "Toggle"],
      ["div", { class: "toggle-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setToggle:
        (attributes?: { summary?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.setNode(this.name, attributes);
        },
    } as any;
  },
});

// --- HTML Embed block ---

export const HtmlEmbedExtension = Node.create({
  name: "htmlEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      htmlContent: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-html-content") || "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-html-content": attributes.htmlContent,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="html-embed"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "html-embed",
        class: "html-embed-block",
      }),
      ["div", { class: "html-embed-fallback" }, "HTML Embed"],
    ];
  },

  addCommands() {
    return {
      setHtmlEmbed:
        (attributes?: { htmlContent?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    } as any;
  },
});

// --- Suggestion marks ---

/** Mark for proposed text insertions (green highlight). */
export const SuggestionAddMark = Mark.create({
  name: "suggestionAdd",

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.suggestionId) return {};
          return { "data-suggestion-id": attributes.suggestionId };
        },
      },
      authorId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-author-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.authorId) return {};
          return { "data-author-id": attributes.authorId };
        },
      },
      authorName: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-author-name"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.authorName) return {};
          return { "data-author-name": attributes.authorName };
        },
      },
      createdAt: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-created-at"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.createdAt) return {};
          return { "data-created-at": attributes.createdAt };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-suggestion-id].suggestion-add" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "suggestion-add" }),
      0,
    ];
  },

  excludes: "",
});

/** Mark for proposed text deletions (red strikethrough). */
export const SuggestionDeleteMark = Mark.create({
  name: "suggestionDelete",

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.suggestionId) return {};
          return { "data-suggestion-id": attributes.suggestionId };
        },
      },
      authorId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-author-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.authorId) return {};
          return { "data-author-id": attributes.authorId };
        },
      },
      authorName: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-author-name"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.authorName) return {};
          return { "data-author-name": attributes.authorName };
        },
      },
      createdAt: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-created-at"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.createdAt) return {};
          return { "data-created-at": attributes.createdAt };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-suggestion-id].suggestion-delete" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "suggestion-delete" }),
      0,
    ];
  },

  excludes: "",
});

// --- Comment mark ---

export const CommentMark = Mark.create({
  name: "comment",

  addAttributes() {
    return {
      commentThreadId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-comment-thread-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.commentThreadId) return {};
          return { "data-comment-thread-id": attributes.commentThreadId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "comment-highlight" }),
      0,
    ];
  },

  // Allow overlapping with other marks (including other comments)
  excludes: "",
});

// --- Main export ---

/**
 * Returns the schema-defining extensions shared between client and server.
 * Does NOT include client-only extensions (Collaboration, Cursor, Placeholder, SlashCommand).
 */
export function getSchemaExtensions() {
  return [
    StarterKit.configure({
      history: false,
      codeBlock: false,
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableCell,
    TableHeader,
    Highlight.configure({
      multicolor: true,
    }),
    TextStyle,
    Color,
    Underline,
    Link.configure({
      openOnClick: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    Typography,
    CalloutExtension,
    ToggleExtension,
    HtmlEmbedExtension,
    CommentMark,
    SuggestionAddMark,
    SuggestionDeleteMark,
  ];
}
