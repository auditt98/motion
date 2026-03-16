-- Folders table (flat grouping for pages within a workspace)
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null default 'Untitled folder',
  icon text,
  color text,
  position integer not null default 0,
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.folders enable row level security;

create policy "Workspace members can view folders"
  on public.folders for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create folders"
  on public.folders for insert
  with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy "Workspace members can update folders"
  on public.folders for update
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can delete folders"
  on public.folders for delete
  using (public.is_workspace_member(workspace_id));

create index idx_folders_workspace on public.folders(workspace_id, position);

create trigger folders_updated_at
  before update on public.folders
  for each row execute function public.update_updated_at();

-- Add folder_id to pages (NULL = unfiled / root level)
alter table public.pages add column folder_id uuid references public.folders(id) on delete set null;
create index idx_pages_folder on public.pages(folder_id);

-- Add last_edited_by to pages
alter table public.pages add column last_edited_by uuid references public.users(id);

-- Page activity log (visits + edits, human + agent)
create table public.page_activity (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  activity_type text not null check (activity_type in ('view', 'edit')),
  actor_type text not null default 'human' check (actor_type in ('human', 'agent')),
  actor_name text,
  created_at timestamptz default now() not null
);

alter table public.page_activity enable row level security;

create policy "Workspace members can view page activity"
  on public.page_activity for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can insert page activity"
  on public.page_activity for insert
  with check (public.is_workspace_member(workspace_id));

create index idx_page_activity_user on public.page_activity(user_id, workspace_id, created_at desc);
create index idx_page_activity_page on public.page_activity(page_id, created_at desc);
create index idx_page_activity_agent on public.page_activity(workspace_id, actor_type, created_at desc);
