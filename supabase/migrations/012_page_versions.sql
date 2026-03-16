-- Version history: snapshots of Yjs document state
create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  snapshot text not null,
  created_by uuid references public.users(id),
  created_by_name text,
  actor_type text default 'human' not null,
  trigger_type text default 'manual' not null,
  label text,
  created_at timestamptz default now() not null
);

alter table public.page_versions enable row level security;

create policy "Workspace members can view page versions"
  on public.page_versions for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create page versions"
  on public.page_versions for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Workspace members can update page versions"
  on public.page_versions for update
  using (public.is_workspace_member(workspace_id));

create index idx_page_versions_lookup on public.page_versions(page_id, created_at desc);
create index idx_page_versions_workspace on public.page_versions(workspace_id);
