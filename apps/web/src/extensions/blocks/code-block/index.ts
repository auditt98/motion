import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { CollapsibleCodeBlock } from "@motion/editor-extensions";
import { CodeBlockView } from "./CodeBlockView";

const lowlight = createLowlight(common);

/**
 * Client-side extension that adds the React NodeView to the shared CodeBlock schema.
 * Must re-configure lowlight since this extension overrides the shared one.
 */
export const CodeBlockNodeView = CollapsibleCodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight });
