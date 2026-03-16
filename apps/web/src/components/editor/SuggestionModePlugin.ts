/**
 * SuggestionMode — a TipTap extension that intercepts edits and converts them
 * into suggestion marks (suggestion-add / suggestion-delete) instead of direct
 * document mutations.
 *
 * When enabled:
 * - Typing new text → wraps in `suggestionAdd` mark
 * - Deleting text → wraps in `suggestionDelete` mark (text stays visible)
 * - Replacing selected text → `suggestionDelete` on old + `suggestionAdd` on new
 *
 * Strategy: intercept at the input level (handleTextInput, handleKeyDown)
 * BEFORE ProseMirror creates transactions, so we have full control.
 */
import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

export interface SuggestionModeOptions {
  authorId: string;
  authorName: string;
}

interface SuggestionModeState {
  enabled: boolean;
  currentSuggestionId: string | null;
}

export const suggestionModePluginKey = new PluginKey<SuggestionModeState>(
  "suggestionMode",
);

function generateId(): string {
  return crypto.randomUUID();
}

export const SuggestionModeExtension = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      authorId: "",
      authorName: "",
    };
  },

  addCommands() {
    return {
      setSuggestionMode:
        (enabled: boolean) =>
        ({ tr, dispatch }: { tr: any; dispatch: any }) => {
          if (dispatch) {
            tr.setMeta(suggestionModePluginKey, {
              setEnabled: enabled,
            });
            dispatch(tr);
          }
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;

    function makeMarkAttrs(suggestionId: string) {
      return {
        suggestionId,
        authorId: extensionOptions.authorId,
        authorName: extensionOptions.authorName,
        createdAt: new Date().toISOString(),
      };
    }

    return [
      new Plugin<SuggestionModeState>({
        key: suggestionModePluginKey,

        state: {
          init(): SuggestionModeState {
            return { enabled: false, currentSuggestionId: null };
          },
          apply(tr, value): SuggestionModeState {
            const meta = tr.getMeta(suggestionModePluginKey);
            if (meta?.setEnabled !== undefined) {
              return {
                enabled: meta.setEnabled,
                currentSuggestionId: null,
              };
            }
            if (meta?.updateSuggestionId) {
              return { ...value, currentSuggestionId: meta.updateSuggestionId };
            }
            // Reset suggestion group when cursor moves without editing
            if (tr.selectionSet && !tr.docChanged) {
              return { ...value, currentSuggestionId: null };
            }
            return value;
          },
        },

        props: {
          /**
           * Intercept text input BEFORE ProseMirror processes it.
           * We handle the insertion ourselves with suggestion marks.
           */
          handleTextInput(view, from, to, text) {
            const pluginState = suggestionModePluginKey.getState(view.state);
            if (!pluginState?.enabled) return false;

            const { state } = view;
            const suggestionId = pluginState.currentSuggestionId ?? generateId();
            const attrs = makeMarkAttrs(suggestionId);
            const addMarkType = state.schema.marks.suggestionAdd;
            const deleteMarkType = state.schema.marks.suggestionDelete;
            if (!addMarkType) return false;

            let tr = state.tr;

            // If there's a selection (from !== to), mark it as deleted first
            if (from !== to && deleteMarkType) {
              const deleteMark = deleteMarkType.create(attrs);
              tr = tr.addMark(from, to, deleteMark);
              // Insert new text AFTER the "deleted" range
              tr = tr.insertText(text, to);
              // Mark the inserted text with suggestion-add
              const addMark = addMarkType.create(attrs);
              tr = tr.addMark(to, to + text.length, addMark);
              // Move cursor to after inserted text
              tr = tr.setSelection(
                TextSelection.create(tr.doc, to + text.length),
              );
            } else {
              // Simple insertion — insert text with suggestion-add mark
              const addMark = addMarkType.create(attrs);
              tr = tr.insertText(text, from);
              tr = tr.addMark(from, from + text.length, addMark);
            }

            tr.setMeta(suggestionModePluginKey, {
              updateSuggestionId: suggestionId,
            });
            view.dispatch(tr);
            return true; // We handled it
          },

          /**
           * Intercept Backspace/Delete to mark text as deleted
           * instead of actually removing it.
           */
          handleKeyDown(view, event) {
            const pluginState = suggestionModePluginKey.getState(view.state);
            if (!pluginState?.enabled) return false;

            const isBackspace = event.key === "Backspace";
            const isDelete = event.key === "Delete";
            if (!isBackspace && !isDelete) return false;

            const { state } = view;
            const { from, to, empty } = state.selection;
            const deleteMarkType = state.schema.marks.suggestionDelete;
            if (!deleteMarkType) return false;

            const suggestionId = generateId();
            const attrs = makeMarkAttrs(suggestionId);
            const deleteMark = deleteMarkType.create(attrs);
            let tr = state.tr;

            const addMarkType = state.schema.marks.suggestionAdd;

            if (!empty) {
              // Selection exists — check if it's all suggestion-add text
              let allSuggestionAdd = true;
              state.doc.nodesBetween(from, to, (node) => {
                if (node.isText) {
                  const hasSuggestionAdd = node.marks.some(
                    (m) => m.type === addMarkType,
                  );
                  if (!hasSuggestionAdd) allSuggestionAdd = false;
                }
              });
              if (allSuggestionAdd) {
                // All selected text is pending suggestions — just delete it
                tr = tr.delete(from, to);
              } else {
                // Mark real text as deleted, delete suggestion-add text
                tr = tr.addMark(from, to, deleteMark);
                tr = tr.setSelection(TextSelection.create(tr.doc, to));
              }
            } else if (isBackspace && from > 1) {
              const charBefore = from - 1;
              const nodeAtChar = state.doc.nodeAt(charBefore);
              const marks = nodeAtChar?.marks ?? [];
              const isSuggestionAdd = marks.some(
                (m) => m.type === addMarkType,
              );
              const alreadyDeleted = marks.some(
                (m) => m.type === deleteMarkType,
              );

              if (isSuggestionAdd) {
                // Backspacing over our own pending suggestion — just delete it
                tr = tr.delete(charBefore, from);
              } else if (alreadyDeleted) {
                // Already marked as deleted — just move cursor back
                tr = tr.setSelection(
                  TextSelection.create(tr.doc, charBefore),
                );
              } else {
                // Real text — mark as suggestion-delete
                tr = tr.addMark(charBefore, from, deleteMark);
                tr = tr.setSelection(
                  TextSelection.create(tr.doc, charBefore),
                );
              }
            } else if (isDelete && to < state.doc.content.size - 1) {
              const charAfter = to + 1;
              const nodeAtChar = state.doc.nodeAt(to);
              const marks = nodeAtChar?.marks ?? [];
              const isSuggestionAdd = marks.some(
                (m) => m.type === addMarkType,
              );
              const alreadyDeleted = marks.some(
                (m) => m.type === deleteMarkType,
              );

              if (isSuggestionAdd) {
                // Delete key over our own pending suggestion — just delete it
                tr = tr.delete(to, charAfter);
              } else if (!alreadyDeleted) {
                tr = tr.addMark(to, charAfter, deleteMark);
              }
            } else {
              return false;
            }

            tr.setMeta(suggestionModePluginKey, {
              updateSuggestionId: suggestionId,
            });
            view.dispatch(tr);
            return true; // We handled it, don't let ProseMirror delete
          },
        },
      }),
    ];
  },
});

// --- Suggestion accept/reject helpers ---

export interface SuggestionInfo {
  suggestionId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  type: "add" | "delete";
  from: number;
  to: number;
}

/**
 * Find all suggestions in the document.
 */
export function findAllSuggestions(view: EditorView): SuggestionInfo[] {
  const suggestions: SuggestionInfo[] = [];
  const { doc, schema } = view.state;

  doc.descendants((node: Node, pos: number) => {
    if (!node.isInline || !node.marks.length) return;

    for (const mark of node.marks) {
      if (
        mark.type === schema.marks.suggestionAdd ||
        mark.type === schema.marks.suggestionDelete
      ) {
        const type =
          mark.type === schema.marks.suggestionAdd ? "add" : "delete";
        suggestions.push({
          suggestionId: mark.attrs.suggestionId,
          authorId: mark.attrs.authorId,
          authorName: mark.attrs.authorName,
          createdAt: mark.attrs.createdAt,
          type,
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    }
  });

  // Merge adjacent ranges with the same suggestionId + type
  const merged: SuggestionInfo[] = [];
  for (const s of suggestions) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.suggestionId === s.suggestionId &&
      last.type === s.type &&
      last.to === s.from
    ) {
      last.to = s.to;
    } else {
      merged.push({ ...s });
    }
  }

  return merged;
}

/**
 * Accept a suggestion: for adds, remove the mark (keep text). For deletes, remove the text.
 */
export function acceptSuggestion(
  view: EditorView,
  suggestionId: string,
): void {
  const { state } = view;
  let tr = state.tr;
  const suggestions = findAllSuggestions(view);
  const matching = suggestions
    .filter((s) => s.suggestionId === suggestionId)
    .sort((a, b) => b.from - a.from);

  for (const s of matching) {
    if (s.type === "add") {
      tr = tr.removeMark(s.from, s.to, state.schema.marks.suggestionAdd);
    } else {
      tr = tr.delete(s.from, s.to);
    }
  }

  tr.setMeta("suggestion-accept", true);
  view.dispatch(tr);
}

/**
 * Reject a suggestion: for adds, remove the text. For deletes, remove the mark (keep text).
 */
export function rejectSuggestion(
  view: EditorView,
  suggestionId: string,
): void {
  const { state } = view;
  let tr = state.tr;
  const suggestions = findAllSuggestions(view);
  const matching = suggestions
    .filter((s) => s.suggestionId === suggestionId)
    .sort((a, b) => b.from - a.from);

  for (const s of matching) {
    if (s.type === "add") {
      tr = tr.delete(s.from, s.to);
    } else {
      tr = tr.removeMark(s.from, s.to, state.schema.marks.suggestionDelete);
    }
  }

  tr.setMeta("suggestion-reject", true);
  view.dispatch(tr);
}

/**
 * Accept all suggestions in the document.
 */
export function acceptAllSuggestions(view: EditorView): void {
  const suggestions = findAllSuggestions(view);
  const ids = [...new Set(suggestions.map((s) => s.suggestionId))];
  for (const id of ids) {
    acceptSuggestion(view, id);
  }
}

/**
 * Reject all suggestions in the document.
 */
export function rejectAllSuggestions(view: EditorView): void {
  const suggestions = findAllSuggestions(view);
  const ids = [...new Set(suggestions.map((s) => s.suggestionId))];
  for (const id of ids) {
    rejectSuggestion(view, id);
  }
}
