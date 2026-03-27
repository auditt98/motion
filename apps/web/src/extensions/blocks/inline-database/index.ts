import { ReactNodeViewRenderer } from "@tiptap/react";
import { InlineDatabaseExtension } from "@motion/editor-extensions";
import { InlineDatabaseView } from "./InlineDatabaseView";

/**
 * Client-side extension that adds the React NodeView to the shared InlineDatabase schema.
 */
export const InlineDatabaseNodeView = InlineDatabaseExtension.extend({
  addNodeView() {
    return ReactNodeViewRenderer(InlineDatabaseView);
  },
});
