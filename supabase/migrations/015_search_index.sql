-- Full-text search + semantic search index for document content.
-- One row per page, updated on each PartyKit snapshot.

-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Search index table
create table public.page_search_index (
  page_id uuid primary key references public.pages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default '',
  body_text text not null default '',
  fts_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'B')
  ) stored,
  embedding vector(1536),  -- OpenAI text-embedding-3-small
  updated_at timestamptz default now() not null
);

-- Indexes
create index idx_search_fts on public.page_search_index using gin(fts_vector);
create index idx_search_embedding on public.page_search_index using hnsw(embedding vector_cosine_ops);
create index idx_search_workspace on public.page_search_index(workspace_id);

-- RLS
alter table public.page_search_index enable row level security;

create policy "Workspace members can search"
  on public.page_search_index for select
  using (public.is_workspace_member(workspace_id));

-- Service role can upsert (used by PartyKit server)
create policy "Service role can upsert search index"
  on public.page_search_index for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Hybrid search RPC function using Reciprocal Rank Fusion (RRF)
create or replace function public.search_pages(
  ws_id uuid,
  query_text text,
  query_embedding vector(1536) default null,
  result_limit int default 20
)
returns table (
  page_id uuid,
  title text,
  snippet text,
  fts_rank real,
  semantic_score real,
  combined_score real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  fts_query tsquery;
begin
  -- Parse the search query for FTS
  fts_query := websearch_to_tsquery('english', query_text);

  return query
  with fts_results as (
    select
      si.page_id,
      si.title,
      ts_headline('english', si.body_text, fts_query,
        'MaxWords=35, MinWords=15, StartSel=**, StopSel=**') as snippet,
      ts_rank_cd(si.fts_vector, fts_query) as rank
    from public.page_search_index si
    where si.workspace_id = ws_id
      and si.fts_vector @@ fts_query
    order by rank desc
    limit result_limit
  ),
  semantic_results as (
    select
      si.page_id,
      si.title,
      left(si.body_text, 200) as snippet,
      1 - (si.embedding <=> query_embedding) as score
    from public.page_search_index si
    where si.workspace_id = ws_id
      and si.embedding is not null
      and query_embedding is not null
    order by si.embedding <=> query_embedding
    limit result_limit
  ),
  -- Reciprocal Rank Fusion: combine FTS and semantic rankings
  fts_ranked as (
    select page_id, title, snippet,
      rank as fts_rank,
      0::real as semantic_score,
      row_number() over (order by rank desc) as rn
    from fts_results
  ),
  semantic_ranked as (
    select page_id, title, snippet,
      0::real as fts_rank,
      score as semantic_score,
      row_number() over (order by score desc) as rn
    from semantic_results
  ),
  combined as (
    select
      coalesce(f.page_id, s.page_id) as page_id,
      coalesce(f.title, s.title) as title,
      coalesce(f.snippet, s.snippet) as snippet,
      coalesce(f.fts_rank, 0)::real as fts_rank,
      coalesce(s.semantic_score, 0)::real as semantic_score,
      (
        coalesce(1.0 / (60 + f.rn), 0) +
        coalesce(1.0 / (60 + s.rn), 0)
      )::real as combined_score
    from fts_ranked f
    full outer join semantic_ranked s on f.page_id = s.page_id
  )
  select
    combined.page_id,
    combined.title,
    combined.snippet,
    combined.fts_rank,
    combined.semantic_score,
    combined.combined_score
  from combined
  order by combined.combined_score desc
  limit result_limit;
end;
$$;
