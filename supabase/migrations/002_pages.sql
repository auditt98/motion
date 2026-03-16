-- Pages table (metadata only — content is in Yjs/PartyKit)
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  parent_id uuid references public.pages(id) on delete set null,
  title text not null default 'Untitled',
  icon text,
  cover_url text,
  position integer not null default 0,
  is_favorite boolean default false,
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.pages enable row level security;

-- Pages are accessible to workspace members
create policy "Workspace members can view pages"
  on public.pages for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create pages"
  on public.pages for insert
  with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy "Workspace members can update pages"
  on public.pages for update
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can delete pages"
  on public.pages for delete
  using (public.is_workspace_member(workspace_id));

-- Indexes for fast page tree queries
create index idx_pages_workspace on public.pages(workspace_id);
create index idx_pages_parent on public.pages(parent_id);
create index idx_pages_position on public.pages(workspace_id, parent_id, position);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pages_updated_at
  before update on public.pages
  for each row execute function public.update_updated_at();
