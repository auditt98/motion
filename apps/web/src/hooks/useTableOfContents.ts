import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";

export interface TocEntry {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  pos: number;
}

export function useTableOfContents(
  editor: Editor | null,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
) {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const clickedIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Extract headings from the editor document
  const extractHeadings = useCallback(() => {
    if (!editor) return;
    const result: TocEntry[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "heading" &&
        node.attrs.level >= 1 &&
        node.attrs.level <= 3
      ) {
        result.push({
          id: `heading-${pos}`,
          level: node.attrs.level as 1 | 2 | 3,
          text: node.textContent,
          pos,
        });
      }
    });
    setEntries(result);
  }, [editor]);

  // Listen to editor updates, debounced
  useEffect(() => {
    if (!editor) return;

    // Extract immediately on mount
    extractHeadings();

    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(extractHeadings, 300);
    };

    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, extractHeadings]);

  // IntersectionObserver for active section tracking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || entries.length === 0) {
      setActiveId(null);
      return;
    }

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingEls = container.querySelectorAll<HTMLElement>(
      ".tiptap h1, .tiptap h2, .tiptap h3"
    );

    if (headingEls.length === 0) {
      setActiveId(null);
      return;
    }

    // Track which headings are visible; pick the topmost one
    const visibleSet = new Set<Element>();

    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          if (entry.isIntersecting) {
            visibleSet.add(entry.target);
          } else {
            visibleSet.delete(entry.target);
          }
        }

        // If a click override is active, don't let the observer change it
        if (clickedIdRef.current) return;

        // Find the first visible heading in document order
        const headingArray = Array.from(headingEls);
        for (let i = 0; i < headingArray.length; i++) {
          if (visibleSet.has(headingArray[i]) && entries[i]) {
            setActiveId(entries[i].id);
            return;
          }
        }

        // If none visible, keep the last active
      },
      {
        root: container,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      }
    );

    headingEls.forEach((el) => observerRef.current!.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [entries, scrollContainerRef]);

  // Scroll to a heading entry via DOM
  const scrollToEntry = useCallback(
    (entry: TocEntry) => {
      if (!editor) return;
      // Find the heading DOM element by querying all headings and matching index
      const container = scrollContainerRef.current;
      const allHeadings = container?.querySelectorAll<HTMLElement>(".tiptap h1, .tiptap h2, .tiptap h3");
      const idx = entries.indexOf(entry);
      const heading = allHeadings?.[idx];
      // Force-highlight the clicked entry immediately
      clickedIdRef.current = entry.id;
      setActiveId(entry.id);

      if (heading && container) {
        // Scroll with offset to account for the sticky toolbar
        const headingRect = heading.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const toolbarOffset = 60;
        const scrollTop = container.scrollTop + (headingRect.top - containerRect.top) - toolbarOffset;
        container.scrollTo({ top: scrollTop, behavior: "smooth" });
      }

      // Release the click override after scroll settles, let observer take over
      setTimeout(() => { clickedIdRef.current = null; }, 800);
      // Also set cursor there
      editor.chain().focus().setTextSelection(entry.pos + 1).run();
    },
    [editor, entries, scrollContainerRef]
  );

  return { entries, activeId, scrollToEntry };
}
