import { Node, mergeAttributes } from "@tiptap/react";

export type CalloutVariant = "info" | "warning" | "error" | "success";

export const CalloutExtension = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element) =>
          element.getAttribute("data-variant") || "info",
        renderHTML: (attributes) => ({
          "data-variant": attributes.variant,
        }),
      },
      emoji: {
        default: "\u2139\ufe0f",
        parseHTML: (element) => element.getAttribute("data-emoji") || "\u2139\ufe0f",
        renderHTML: (attributes) => ({
          "data-emoji": attributes.emoji,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = HTMLAttributes["data-variant"] || "info";
    const emoji = HTMLAttributes["data-emoji"] || "\u2139\ufe0f";

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
