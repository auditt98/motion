import { ReactNodeViewRenderer } from "@tiptap/react";
import { HtmlEmbedExtension } from "@motion/editor-extensions";
import { HtmlEmbedView } from "./HtmlEmbedView";

/**
 * Client-side extension that adds the React NodeView to the shared HtmlEmbed schema.
 */
export const HtmlEmbedNodeView = HtmlEmbedExtension.extend({
  addNodeView() {
    return ReactNodeViewRenderer(HtmlEmbedView);
  },
});
