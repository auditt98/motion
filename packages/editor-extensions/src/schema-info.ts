/**
 * Derive mark/block/inline node types from a ProseMirror schema.
 * No manual enums — always reflects the actual extensions.
 */

import type { Schema } from "@tiptap/pm/model";

/** All mark type names registered in the schema (e.g. bold, italic, link). */
export function getMarkTypes(schema: Schema): string[] {
  return Object.keys(schema.marks);
}

/** All block-level node type names (nodes whose group includes "block"). */
export function getBlockTypes(schema: Schema): string[] {
  return Object.keys(schema.nodes).filter((name) => {
    const spec = schema.nodes[name].spec;
    return spec.group?.includes("block");
  });
}

/** All inline node types except "text" (e.g. hardBreak, image when inline). */
export function getInlineNodeTypes(schema: Schema): string[] {
  return Object.keys(schema.nodes).filter((name) => {
    const spec = schema.nodes[name].spec;
    return spec.group?.includes("inline") && name !== "text";
  });
}
