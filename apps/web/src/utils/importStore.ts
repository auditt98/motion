import { create } from "zustand";
import type { JSONContent } from "@tiptap/react";

interface ImportStore {
  /** Map of pageId → ProseMirror JSON content awaiting editor mount */
  pendingContent: Record<string, JSONContent>;
  setPendingContent: (pageId: string, content: JSONContent) => void;
  /** Returns and removes pending content for a page (one-time consumption). */
  consumePendingContent: (pageId: string) => JSONContent | null;
}

export const useImportStore = create<ImportStore>((set, get) => ({
  pendingContent: {},

  setPendingContent: (pageId, content) =>
    set((s) => ({
      pendingContent: { ...s.pendingContent, [pageId]: content },
    })),

  consumePendingContent: (pageId) => {
    const content = get().pendingContent[pageId] ?? null;
    if (content) {
      set((s) => {
        const { [pageId]: _, ...rest } = s.pendingContent;
        return { pendingContent: rest };
      });
    }
    return content;
  },
}));
