# Full-Text + Semantic Search System

## Problem

The command palette (Cmd+K) only searches page titles via client-side substring matching. Users cannot search document content. As workspaces grow, finding information becomes impossible without remembering exact page names.

## Goals

1. **Keyword search**: Find pages containing exact words/phrases (pg_trgm)
2. **Semantic search**: Find pages by meaning/concept (pgvector + OpenAI embeddings)
3. **Hybrid ranking**: Merge both result sets for best relevance (RRF)
4. **Minimal new infrastructure**: Everything in Supabase PostgreSQL — no external services beyond OpenAI embeddings API

## Architecture Overview

```
                              ┌─────────────────────┐
                              │   OpenAI Embeddings  │
                              │  text-embedding-3-   │
                              │       small          │
                              └──────────┬───────────┘
                                         │ vector (1536d)
                                         ▼
┌──────────┐  snapshot   ┌───────────┐  text + vector  ┌──────────────────┐
│ PartyKit ├────────────►│  PartyKit │───────────────►  │    Supabase PG   │
│  Y.Doc   │  callback   │ document  │    upsert        │                  │
│ (rooms)  │             │   .ts     │                  │ pages.search_    │
└──────────┘             └───────────┘                  │   content (text) │
                                                        │ page_embeddings  │
                                                        │   (vector 1536)  │
                                                        └────────┬─────────┘
                                                                 │
                              ┌───────────┐  query + embed       │
                              │  Web App  │◄─────────────────────┘
                              │ Cmd+K     │  hybrid results
                              │ search    │  (RRF ranked)
                              └───────────┘
```

## Indexing Pipeline

### Trigger: On Snapshot Save (PartyKit)

Piggyback on the existing `saveSnapshot()` flow in `party/document.ts`. When PartyKit saves a snapshot (every 30min, on session end, or manual), it also:

1. **Extracts plain text** from the Y.Doc
2. **Upserts `search_content`** on the `pages` table (for keyword search)
3. **Calls OpenAI** to generate an embedding of the text
4. **Upserts `page_embeddings`** with the vector (for semantic search)

### Text Extraction

Use the existing Yjs tree walker pattern (already in `yjs-peer.ts:xmlElementToText`). Replicate a lightweight version directly in `party/document.ts`:

```typescript
function extractText(ydoc: Y.Doc): string {
  const fragment = ydoc.getXmlFragment("default");
  return xmlFragmentToText(fragment);
}

function xmlFragmentToText(fragment: Y.XmlFragment): string {
  const parts: string[] = [];
  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(xmlElementToText(child));
    }
  }
  return parts.join("\n");
}

function xmlElementToText(element: Y.XmlElement): string {
  const parts: string[] = [];
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(xmlElementToText(child));
    }
  }
  return parts.join(" ");
}
```

**Key detail**: Top-level blocks are joined with `\n` (newlines), inline content with spaces. This preserves enough structure for keyword matching while keeping the text flat for embedding.

### Embedding Generation

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // ~2000 tokens, stays well under 8191 limit
    }),
  });
  const data = await response.json();
  return data.data[0].embedding; // 1536-dimensional float array
}
```

**Chunking strategy for v1**: Embed the entire document as a single vector (truncated to ~8000 chars). This is simple and works well for documents up to ~4 pages. For longer documents, a future iteration can chunk by heading sections and store multiple embeddings per page.

### Indexing Flow in `party/document.ts`

Add an `updateSearchIndex()` method called after `saveSnapshot()`:

```typescript
private async updateSearchIndex() {
  if (!this.ydoc || !this.supabase) return;

  const pageId = this.room.id;
  const text = extractText(this.ydoc);

  if (!text.trim()) return; // Skip empty docs

  // 1. Update keyword search content
  await this.supabase
    .from("pages")
    .update({ search_content: text })
    .eq("id", pageId);

  // 2. Generate embedding
  const openaiKey = this.room.env.OPENAI_API_KEY as string | undefined;
  if (!openaiKey) return; // Semantic search disabled without key

  try {
    const embedding = await generateEmbedding(text, openaiKey);
    await this.supabase
      .from("page_embeddings")
      .upsert({
        page_id: pageId,
        embedding: JSON.stringify(embedding), // pgvector accepts JSON array
        content_hash: simpleHash(text),        // Skip re-embedding if unchanged
        updated_at: new Date().toISOString(),
      }, { onConflict: "page_id" });
  } catch (err) {
    console.error("[search] Embedding generation failed:", err);
    // Keyword search still works even if embedding fails
  }
}
```

**Content hashing**: Before calling OpenAI, hash the extracted text and compare with the stored hash. Skip the API call if content hasn't changed. This saves costs when snapshots fire but no text was edited.

---

## Database Schema

### Migration: `supabase/migrations/015_search.sql`

```sql
-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add keyword search column to pages
ALTER TABLE pages ADD COLUMN IF NOT EXISTS search_content text DEFAULT '';

-- 3. Create trigram index for keyword search
CREATE INDEX idx_pages_search_trgm
  ON pages USING GIN (search_content gin_trgm_ops);

-- 4. Create embeddings table for semantic search
CREATE TABLE page_embeddings (
  page_id uuid PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  content_hash text,
  updated_at timestamptz DEFAULT now()
);

-- 5. Create HNSW index for fast vector similarity search
--    (HNSW is faster than IVFFlat for < 1M rows, no training needed)
CREATE INDEX idx_page_embeddings_hnsw
  ON page_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 6. RLS policies
ALTER TABLE page_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view embeddings"
  ON page_embeddings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pages p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = page_embeddings.page_id
        AND wm.user_id = auth.uid()
    )
  );

-- 7. Hybrid search function
--    Returns results ranked by Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION hybrid_search(
  p_workspace_id uuid,
  p_query text,
  p_query_embedding vector(1536),
  p_match_count int DEFAULT 20,
  p_keyword_weight float DEFAULT 0.5,
  p_semantic_weight float DEFAULT 0.5
)
RETURNS TABLE (
  page_id uuid,
  title text,
  icon text,
  folder_id uuid,
  search_content text,
  keyword_rank float,
  semantic_rank float,
  rrf_score float
)
LANGUAGE sql STABLE
AS $$
  WITH keyword_results AS (
    SELECT
      p.id AS page_id,
      p.title,
      p.icon,
      p.folder_id,
      p.search_content,
      similarity(p.search_content, p_query) AS sim_score,
      ROW_NUMBER() OVER (ORDER BY similarity(p.search_content, p_query) DESC) AS rank_ix
    FROM pages p
    WHERE p.workspace_id = p_workspace_id
      AND p.deleted_at IS NULL
      AND p.search_content % p_query  -- trigram similarity threshold (default 0.3)
    ORDER BY sim_score DESC
    LIMIT p_match_count * 2
  ),
  semantic_results AS (
    SELECT
      p.id AS page_id,
      p.title,
      p.icon,
      p.folder_id,
      p.search_content,
      1 - (pe.embedding <=> p_query_embedding) AS cos_score,
      ROW_NUMBER() OVER (ORDER BY pe.embedding <=> p_query_embedding) AS rank_ix
    FROM page_embeddings pe
    JOIN pages p ON p.id = pe.page_id
    WHERE p.workspace_id = p_workspace_id
      AND p.deleted_at IS NULL
    ORDER BY pe.embedding <=> p_query_embedding
    LIMIT p_match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(k.page_id, s.page_id) AS page_id,
      COALESCE(k.title, s.title) AS title,
      COALESCE(k.icon, s.icon) AS icon,
      COALESCE(k.folder_id, s.folder_id) AS folder_id,
      COALESCE(k.search_content, s.search_content) AS search_content,
      COALESCE(1.0 / (60 + k.rank_ix), 0.0) AS keyword_rank,
      COALESCE(1.0 / (60 + s.rank_ix), 0.0) AS semantic_rank,
      -- RRF: weighted combination
      (p_keyword_weight * COALESCE(1.0 / (60 + k.rank_ix), 0.0)) +
      (p_semantic_weight * COALESCE(1.0 / (60 + s.rank_ix), 0.0)) AS rrf_score
    FROM keyword_results k
    FULL OUTER JOIN semantic_results s ON k.page_id = s.page_id
  )
  SELECT
    c.page_id,
    c.title,
    c.icon,
    c.folder_id,
    c.search_content,
    c.keyword_rank,
    c.semantic_rank,
    c.rrf_score
  FROM combined c
  ORDER BY c.rrf_score DESC
  LIMIT p_match_count;
$$;

-- 8. Keyword-only fallback (when no embedding API key configured)
CREATE OR REPLACE FUNCTION keyword_search(
  p_workspace_id uuid,
  p_query text,
  p_match_count int DEFAULT 20
)
RETURNS TABLE (
  page_id uuid,
  title text,
  icon text,
  folder_id uuid,
  search_content text,
  similarity_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id AS page_id,
    p.title,
    p.icon,
    p.folder_id,
    p.search_content,
    similarity(p.search_content, p_query) AS similarity_score
  FROM pages p
  WHERE p.workspace_id = p_workspace_id
    AND p.deleted_at IS NULL
    AND (
      p.search_content ILIKE '%' || p_query || '%'
      OR p.title ILIKE '%' || p_query || '%'
      OR p.search_content % p_query
    )
  ORDER BY
    -- Exact matches first, then trigram similarity
    CASE WHEN p.title ILIKE '%' || p_query || '%' THEN 0 ELSE 1 END,
    CASE WHEN p.search_content ILIKE '%' || p_query || '%' THEN 0 ELSE 1 END,
    similarity(p.search_content, p_query) DESC
  LIMIT p_match_count;
$$;
```

### Why These Choices

- **pg_trgm**: Built into Supabase, handles typos (similarity threshold), fast with GIN index
- **pgvector with HNSW**: Available in Supabase, HNSW index is fast for reads with no training step. 1536 dims matches OpenAI text-embedding-3-small
- **RRF (k=60)**: Standard reciprocal rank fusion constant. Avoids needing to normalize scores across different ranking systems. Well-studied in hybrid search literature
- **Separate table for embeddings**: Keeps the `pages` table lean. Embeddings are large (1536 floats ≈ 6KB per row) and have different update cadence
- **ON DELETE CASCADE**: When a page is hard-deleted, its embedding is cleaned up automatically

---

## Search API

### Option A: Supabase RPC (simplest)

Call the `hybrid_search` function directly from the web app via Supabase client:

```typescript
// In a new hook: useSearch.ts
async function search(query: string, workspaceId: string) {
  // 1. Generate query embedding client-side via edge function or proxy
  const embedding = await getQueryEmbedding(query);

  // 2. Call hybrid search
  const { data } = await supabase.rpc("hybrid_search", {
    p_workspace_id: workspaceId,
    p_query: query,
    p_query_embedding: JSON.stringify(embedding),
    p_match_count: 20,
  });

  return data;
}
```

**Problem**: This exposes the OpenAI API key. Need a proxy.

### Option B: Supabase Edge Function (recommended)

Create a Supabase Edge Function that:
1. Receives the search query
2. Generates the query embedding via OpenAI
3. Calls `hybrid_search` via the service role
4. Returns ranked results with snippets

```
POST /functions/v1/search
{
  "query": "how to set up authentication",
  "workspace_id": "uuid"
}

Response:
{
  "results": [
    {
      "page_id": "uuid",
      "title": "Auth Setup Guide",
      "icon": "🔐",
      "folder_name": "Engineering",
      "snippet": "...set up authentication using Supabase Auth with magic links...",
      "score": 0.82
    }
  ]
}
```

### Option C: MCP Server Endpoint

Add `GET /search?q=query&workspace_id=uuid` to the existing MCP HTTP server. This is the simplest if we don't want to set up Edge Functions.

**Recommended: Option C** — the MCP server already has Supabase service role access and the embedding call is a simple fetch. No new infrastructure.

### MCP Server Search Endpoint

Add to `apps/mcp-server/src/http.ts`:

```typescript
// GET /search?q=<query>&workspace_id=<uuid>
// Auth: workspace agent token OR user session (via Supabase anon key)
if (pathname === "/search" && method === "GET") {
  const query = url.searchParams.get("q");
  const workspaceId = url.searchParams.get("workspace_id");

  if (!query || !workspaceId) {
    return json(res, 400, { error: "Missing q or workspace_id" });
  }

  // Generate query embedding
  const embedding = await generateEmbedding(query);

  // Call hybrid search RPC
  const results = await supabaseClient.rpc("hybrid_search", {
    p_workspace_id: workspaceId,
    p_query: query,
    p_query_embedding: JSON.stringify(embedding),
    p_match_count: 20,
  });

  // Extract snippets around matching text
  const withSnippets = results.map(r => ({
    ...r,
    snippet: extractSnippet(r.search_content, query, 150),
  }));

  return json(res, 200, { results: withSnippets });
}
```

**Snippet extraction**: Find the first occurrence of the query (or closest trigram match) in the content and return ~150 chars of surrounding context with the match highlighted.

---

## Frontend Integration

### Updated Command Palette

Modify `apps/web/src/components/workspace/CommandPalette.tsx`:

```
Current flow:
  User types → filter pages[] by title.includes(query) → show results

New flow:
  User types → debounce 300ms → POST /search → show results with snippets
  (While debouncing, still show instant title matches from local pages[])
```

**Two-phase search**:
1. **Instant** (0ms): Filter local `pages[]` by title (existing behavior). Show these immediately.
2. **Server** (300ms debounce): Call search API for content + semantic matches. Merge with title results, deduplicate by page_id, re-rank.

This gives instant feedback for title matches while semantic results load.

### Search Result Component

Each result shows:
- Page icon + title
- Folder name (gray badge)
- Text snippet with query terms **highlighted** (bold or yellow background)
- Match type indicator: "Title match" / "Content match" / "Related" (for semantic-only)

### New Hook: `useSearch.ts`

```typescript
export function useSearch(workspaceId: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced server search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${MCP_HOST}/search?q=${encodeURIComponent(query)}&workspace_id=${workspaceId}`
        );
        const data = await res.json();
        setResults(data.results);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  return { query, setQuery, results, isSearching };
}
```

### Sidebar Search Enhancement

Also update `MotionSidebar.tsx` to use the same `useSearch` hook for content search, instead of the current client-side title filter.

---

## Backfill Strategy

When the migration is first applied, existing documents have no `search_content` and no embeddings. Two approaches:

### Option 1: Lazy Backfill (Recommended)

- When a user opens a document, the editor's Yjs provider syncs the doc
- On first snapshot after migration, `updateSearchIndex()` populates `search_content` + embedding
- Documents that are never opened remain unindexed (acceptable — if nobody opens them, nobody searches for them)

### Option 2: Batch Backfill Script

A one-time Node.js script that:
1. Lists all pages from Supabase
2. For each page, connects to PartyKit room via YjsPeer
3. Extracts text, generates embedding
4. Updates `search_content` and `page_embeddings`
5. Disconnects and moves to next page

```bash
# Run once after migration
npx tsx scripts/backfill-search-index.ts
```

Rate-limit to ~50 pages/minute to stay within OpenAI rate limits.

**Recommendation**: Ship lazy backfill first (no extra script needed). Add batch backfill script later if users complain about older documents not showing in search.

---

## Environment Variables

### New variables needed:

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | PartyKit server env | Generate embeddings during snapshot save |
| `OPENAI_API_KEY` | MCP server env (Fly.io) | Generate query embeddings for search API |
| `VITE_SEARCH_ENABLED` | Web app (optional) | Feature flag to enable/disable search UI |

### Cost Estimate

- **text-embedding-3-small**: $0.02 per 1M tokens
- Average document: ~500 tokens → $0.00001 per document index
- Average search query: ~10 tokens → $0.0000002 per search
- **1000 documents indexed + 10,000 searches/month ≈ $0.01/month**

Embedding costs are negligible. The content hash check ensures we don't re-embed unchanged documents.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/015_search.sql` | pg_trgm + pgvector schema, hybrid_search function |
| `apps/web/src/hooks/useSearch.ts` | Search hook with debounce + server call |
| `scripts/backfill-search-index.ts` | (Optional) One-time backfill for existing pages |

### Modified Files

| File | Change |
|------|--------|
| `party/document.ts` | Add `updateSearchIndex()` after `saveSnapshot()`, text extraction, embedding generation |
| `apps/mcp-server/src/http.ts` | Add `GET /search` endpoint with hybrid search |
| `apps/web/src/components/workspace/CommandPalette.tsx` | Two-phase search (instant title + debounced content/semantic) |
| `apps/web/src/components/workspace/MotionSidebar.tsx` | Use `useSearch` hook instead of client-side filter |
| `apps/web/src/components/layout/AppLayout.tsx` | Pass search results to CommandPalette |

### Environment Config

| File | Change |
|------|--------|
| `.env.example` | Add `OPENAI_API_KEY` |
| `fly.toml` | Add `OPENAI_API_KEY` to env section |
| `party/partykit.json` | Add `OPENAI_API_KEY` to env vars |

---

## Verification Plan

1. **Keyword search**: Edit a document with unique text → wait for snapshot (or trigger manual save) → Cmd+K → search for that text → document appears with snippet
2. **Semantic search**: Write about "authentication setup" → search for "login configuration" → document appears (semantic match, not keyword)
3. **Title search still works**: Search for a page by title → instant result before server response
4. **Snippet highlighting**: Search result shows surrounding context with query terms bolded
5. **Empty doc handling**: Empty documents don't appear in results, no errors
6. **Deleted pages excluded**: Soft-deleted pages don't appear in search
7. **Cross-workspace isolation**: Users only see results from their own workspace
8. **Degraded mode**: If OpenAI is down, keyword search still works (semantic results just missing)
9. **Content hash**: Edit a document, trigger two snapshots without changing content → OpenAI called only once

---

## Future Enhancements (Out of Scope for v1)

1. **Per-heading chunking**: Split long documents into sections, embed each separately for more precise retrieval
2. **Search within comments**: Index comment thread text alongside document content
3. **Filters**: Search by date range, author, folder, has-comments, etc.
4. **Search analytics**: Track popular queries, zero-result queries
5. **Typeahead suggestions**: Show popular/recent queries as user types
6. **Dedicated search page**: Full-page search UI with facets, beyond CommandPalette
7. **Real-time indexing**: Client-side debounced indexing for near-instant search freshness
8. **Multi-language support**: Language-specific tokenization for non-English content
