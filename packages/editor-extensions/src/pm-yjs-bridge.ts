/**
 * ProseMirror JSON <-> Yjs conversion bridge.
 *
 * Uses y-prosemirror's battle-tested utilities for all conversions.
 * The ProseMirror schema (from getSchemaExtensions()) is the single source
 * of truth — no custom converter, no manual type mapping.
 */

import type { Schema } from "@tiptap/pm/model";
import * as Y from "yjs";
import {
  prosemirrorJSONToYDoc,
  yXmlFragmentToProsemirrorJSON,
} from "y-prosemirror";

/**
 * Insert a ProseMirror block (as JSON) into a Yjs XmlFragment at the given index.
 *
 * 1. Validates via schema.nodeFromJSON() — throws descriptive errors
 * 2. Wraps in a doc, converts via y-prosemirror to get correct Yjs structure
 * 3. Clones the resulting element into the target fragment
 */
export function insertPMBlockIntoFragment(
  schema: Schema,
  fragment: Y.XmlFragment,
  index: number,
  blockJSON: Record<string, unknown>,
): void {
  // Validate: throws if JSON is invalid for this schema
  schema.nodeFromJSON(blockJSON);

  // Wrap in doc for y-prosemirror conversion
  const docJSON = {
    type: "doc",
    content: [blockJSON],
  };

  // Convert to a temporary Y.Doc using y-prosemirror
  const tempDoc = prosemirrorJSONToYDoc(schema, docJSON, "temp");
  const tempFragment = tempDoc.getXmlFragment("temp");

  if (tempFragment.length === 0) {
    tempDoc.destroy();
    throw new Error("Conversion produced empty fragment");
  }

  // Clone the element into the target doc context
  const sourceElement = tempFragment.get(0) as Y.XmlElement;
  const cloned = cloneYElement(sourceElement);
  fragment.insert(Math.min(index, fragment.length), [cloned]);

  tempDoc.destroy();
}

/**
 * Read a single block from a Yjs XmlFragment as ProseMirror JSON.
 *
 * Uses yXmlFragmentToProsemirrorJSON for canonical output — handles mark
 * normalization, adjacent text coalescing, and correct mark ordering.
 */
export function readBlockAsPMJSON(
  fragment: Y.XmlFragment,
  index: number,
): Record<string, unknown> | null {
  if (index < 0 || index >= fragment.length) return null;

  const child = fragment.get(index);
  if (!(child instanceof Y.XmlElement)) return null;

  // Create a temp doc+fragment with just this block, then convert
  const tempDoc = new Y.Doc();
  const tempFragment = tempDoc.getXmlFragment("temp");
  const cloned = cloneYElement(child);
  tempFragment.insert(0, [cloned]);

  const json = yXmlFragmentToProsemirrorJSON(tempFragment);
  tempDoc.destroy();

  // yXmlFragmentToProsemirrorJSON returns {type: "doc", content: [...]}
  const content = (json as Record<string, unknown>).content as
    | Record<string, unknown>[]
    | undefined;
  if (!content || content.length === 0) return null;

  return content[0];
}

/**
 * Read all blocks from a Yjs XmlFragment as ProseMirror JSON array.
 */
export function readDocumentAsPMJSON(
  fragment: Y.XmlFragment,
): Record<string, unknown>[] {
  // Convert the entire fragment at once — more efficient than block-by-block
  const json = yXmlFragmentToProsemirrorJSON(fragment);
  const content = (json as Record<string, unknown>).content as
    | Record<string, unknown>[]
    | undefined;
  return content ?? [];
}

/**
 * Deep-clone a Y.XmlElement (or Y.XmlText) into a new, unattached element.
 * Handles: XmlElement (block/inline nodes), XmlText (with marks/attrs via delta).
 */
function cloneYElement(source: Y.XmlElement): Y.XmlElement {
  const element = new Y.XmlElement(source.nodeName);

  // Copy attributes
  for (const [key, value] of Object.entries(source.getAttributes())) {
    if (value !== undefined) {
      element.setAttribute(key, value);
    }
  }

  // Copy children
  for (let i = 0; i < source.length; i++) {
    const child = source.get(i);
    if (child instanceof Y.XmlText) {
      element.insert(element.length, [cloneYText(child)]);
    } else if (child instanceof Y.XmlElement) {
      element.insert(element.length, [cloneYElement(child)]);
    }
  }

  return element;
}

/**
 * Clone a Y.XmlText node, preserving all text content and mark attributes
 * via delta replay.
 */
function cloneYText(source: Y.XmlText): Y.XmlText {
  const cloned = new Y.XmlText();
  const delta = source.toDelta();
  let offset = 0;
  for (const op of delta) {
    if (typeof op.insert === "string") {
      cloned.insert(offset, op.insert, op.attributes ?? undefined);
      offset += (op.insert as string).length;
    }
    // Non-string inserts (embedded objects) — log and skip for now
  }
  return cloned;
}
