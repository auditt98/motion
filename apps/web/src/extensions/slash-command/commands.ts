import type { Editor, Range } from "@tiptap/react";

export interface SlashCommand {
  title: string;
  description: string;
  icon: string;
  group: string;
  aliases: string[];
  action: (editor: Editor, range: Range) => void;
}

export const slashCommands: SlashCommand[] = [
  // Text
  {
    title: "Text",
    description: "Plain text block",
    icon: "Aa",
    group: "Text",
    aliases: ["paragraph", "p"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large heading",
    icon: "H1",
    group: "Text",
    aliases: ["h1", "title"],
    action: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 1 })
        .run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    group: "Text",
    aliases: ["h2", "subtitle"],
    action: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 2 })
        .run();
    },
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: "H3",
    group: "Text",
    aliases: ["h3"],
    action: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 3 })
        .run();
    },
  },

  // Lists
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: "\u2022",
    group: "Lists",
    aliases: ["ul", "unordered", "bullets"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: "1.",
    group: "Lists",
    aliases: ["ol", "ordered", "numbers"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "List with checkboxes",
    icon: "\u2611",
    group: "Lists",
    aliases: ["todo", "checklist", "checkbox"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },

  // Blocks
  {
    title: "Blockquote",
    description: "Quoted text",
    icon: "\u201C",
    group: "Blocks",
    aliases: ["quote"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Callout",
    description: "Highlighted info block",
    icon: "\u2139\ufe0f",
    group: "Blocks",
    aliases: ["info", "warning", "alert", "note"],
    action: (editor, range) => {
      // setCallout is added by CalloutExtension but not in TipTap's ChainedCommands type
      (editor.chain().focus().deleteRange(range) as any).setCallout({ variant: "info" }).run();
    },
  },
  {
    title: "Toggle",
    description: "Collapsible content",
    icon: "\u25b6",
    group: "Blocks",
    aliases: ["details", "collapse", "accordion"],
    action: (editor, range) => {
      // setToggle is added by ToggleExtension but not in TipTap's ChainedCommands type
      (editor.chain().focus().deleteRange(range) as any).setToggle().run();
    },
  },
  {
    title: "Code Block",
    description: "Code with syntax highlighting",
    icon: "</>",
    group: "Blocks",
    aliases: ["code", "pre", "snippet"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "HTML Embed",
    description: "Embed raw HTML content",
    icon: "<>",
    group: "Blocks",
    aliases: ["html", "embed", "widget"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.chain().focus() as any).setHtmlEmbed({ htmlContent: "" }).run();
    },
  },
  {
    title: "Database",
    description: "Insert an inline database",
    icon: "\u2637",
    group: "Blocks",
    aliases: ["database", "db", "dataview", "inline-database"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.chain().focus() as any).setInlineDatabase({
        databaseId: crypto.randomUUID(),
        title: "Untitled Database",
      }).run();
    },
  },
  {
    title: "Divider",
    description: "Horizontal line",
    icon: "\u2014",
    group: "Blocks",
    aliases: ["hr", "separator", "line"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },

  // Insert
  {
    title: "Image",
    description: "Insert an image from URL",
    icon: "\ud83d\uddbc",
    group: "Insert",
    aliases: ["img", "picture", "photo"],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt("Image URL");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: "\u25a6",
    group: "Insert",
    aliases: ["grid", "spreadsheet"],
    action: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
];

export function filterCommands(query: string): SlashCommand[] {
  if (!query) return slashCommands;

  const lower = query.toLowerCase();
  return slashCommands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(lower) ||
      cmd.aliases.some((a) => a.includes(lower)),
  );
}
