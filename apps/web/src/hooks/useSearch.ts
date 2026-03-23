import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface SearchResult {
  page_id: string;
  title: string;
  snippet: string;
  fts_rank: number;
  semantic_score: number;
  combined_score: number;
}

const DEBOUNCE_MS = 300;
const MIN_SERVER_QUERY_LENGTH = 4;
const SEMANTIC_WORD_THRESHOLD = 3;

export function useSearch(workspaceId: string | null) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    (query: string) => {
      // Clear any pending debounce
      if (timerRef.current) clearTimeout(timerRef.current);
      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort();

      if (!workspaceId || query.trim().length < MIN_SERVER_QUERY_LENGTH) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const wordCount = query.trim().split(/\s+/).length;
          let queryEmbedding: number[] | null = null;

          // For longer queries, generate an embedding for semantic search
          if (wordCount > SEMANTIC_WORD_THRESHOLD) {
            try {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              const embedResponse = await fetch(
                `${supabaseUrl}/functions/v1/embed`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${supabaseAnonKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ text: query }),
                  signal: controller.signal,
                },
              );
              if (embedResponse.ok) {
                const embedData = await embedResponse.json();
                queryEmbedding = embedData.embedding;
              }
            } catch {
              // Semantic search is best-effort; fall back to FTS only
            }
          }

          if (controller.signal.aborted) return;

          const { data, error } = await supabase.rpc("search_pages", {
            ws_id: workspaceId,
            query_text: query,
            query_embedding: queryEmbedding,
            result_limit: 20,
          });

          if (controller.signal.aborted) return;

          if (error) {
            console.error("[search] RPC error:", error);
            setResults([]);
          } else {
            setResults(data || []);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("[search] Error:", err);
          setResults([]);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }, DEBOUNCE_MS);
    },
    [workspaceId],
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
}
