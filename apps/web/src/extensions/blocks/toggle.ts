import { Node, mergeAttributes } from "@tiptap/react";

export const ToggleExtension = Node.create({
  name: "toggle",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.hasAttribute("open"),
        renderHTML: (attributes) =>
          attributes.open ? { open: "" } : {},
      },
      summary: {
        default: "Toggle",
        parseHTML: (element) =>
          element.querySelector("summary")?.textContent || "Toggle",
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { summary, ...rest } = HTMLAttributes;
    return [
      "details",
      mergeAttributes(rest, { class: "toggle-block" }),
      ["summary", {}, summary || "Toggle"],
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
