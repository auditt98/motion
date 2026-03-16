# Full-Text Search

## Problem

The command palette (Cmd+K) only searches page titles. Users cannot search document content. As workspaces grow, "I know we wrote about X somewhere" becomes a daily frustration with no answer.

## Priority

**Sprint 6.** ~2–3 days of effort. Critical for daily-driver status.

## Approach Options

### Option A: Supabase pg_trgm (Simplest)

Use PostgreSQL's built-in trigram search. Store a searchable text snapshot of each document in the `pages` table.

- Add `search_content text` column to `pages`
- Create GIN index: `CREATE INDEX idx_pages_search ON pages USING GIN (search_content gin_trgm_ops)`
- Periodically extract plain text from Yjs docs and update `search_content`
- Search via: `SELECT * FROM pages WHERE search_content ILIKE '%query%'` or `similarity()`

**Pros:** No new infrastructure. Works with existing Supabase setup.
**Cons:** No typo tolerance, no ranking sophistication, requires content sync pipeline.

### Option B: Meilisearch / Typesense (Best UX)

Deploy a dedicated search engine for typo-tolerant, ranked full-text search.

**Pros:** Fast, typo-tolerant, ranked results, faceted filtering.
**Cons:** Additional infrastructure to deploy and maintain.

### Recommended: Start with Option A, migrate to Option B when needed.

## What to Build (Option A — pg_trgm)

### 1. DB migration: Add search content column

New migration `supabase/migrations/012_search_content.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE pages ADD COLUMN search_content text DEFAULT '';

CREATE INDEX idx_pages_search_trgm
  ON pages USING GIN (search_content gin_trgm_ops);
```

### 2. Content sync: Extract text from Yjs docs

On document save / snapshot events, extract plain text from the Yjs document and store it in `search_content`.

Two approaches:
- **Client-side**: After each edit batch (debounced 30s), extract text via `editor.getText()` and update Supabase
- **Server-side**: PartyKit server extracts text from Y.Doc on snapshot and updates Supabase via service role key

Client-side is simpler to start. Add to `useYjsProvider.ts` or a new `useSearchSync.ts` hook.

### 3. Update Command Palette to search content

Update `apps/web/src/components/workspace/CommandPalette.tsx`:

- Current: `pages.filter(p => p.title.includes(query))`
- New: Query Supabase with `search_content ILIKE '%query%'` (or `similarity()` for ranking)
- Show matching text snippet in results (context around the match)
- Debounce search input (300ms)

### 4. Search results display

Each result shows:
- Page title + icon
- Folder name (if in a folder)
- Text snippet with query highlighted in bold
- Relevance ranking (by similarity score)

## Files to Modify

- `supabase/migrations/012_search_content.sql` (new)
- `apps/web/src/hooks/useSearchSync.ts` (new) — extract and sync text content
- `apps/web/src/components/workspace/CommandPalette.tsx` — full-text search queries
- `apps/web/src/hooks/useYjsProvider.ts` — trigger content sync on document changes

## Verification

1. Edit a document with distinctive text → wait for sync → Cmd+K → search for that text → document appears in results
2. Search for a word in a page title → still works (title search not broken)
3. Search for a word only in document body → found with text snippet
4. Misspelling (if using similarity): "documnt" → finds "document" (stretch)
5. Delete text from document → re-search → no longer found
6. Results show context snippet with highlighted match

## Dependencies

None strictly, but content sync mechanism benefits from a stable document save flow.
