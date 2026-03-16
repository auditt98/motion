-- Comment threads (one per highlighted text selection in a document)
create table public.comment_threads (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  is_resolved boolean default false not null,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.comment_threads enable row level security;

create policy "Workspace members can view comment threads"
  on public.comment_threads for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create comment threads"
  on public.comment_threads for insert
  with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy "Workspace members can update comment threads"
  on public.comment_threads for update
  using (public.is_workspace_member(workspace_id));

create index idx_comment_threads_page on public.comment_threads(page_id, is_resolved, created_at);
create index idx_comment_threads_workspace on public.comment_threads(workspace_id);

create trigger comment_threads_updated_at
  before update on public.comment_threads
  for each row execute function public.update_updated_at();

-- Comments (individual messages within a thread: root comment + replies)
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.comment_threads(id) on delete cascade not null,
  author_id uuid references public.users(id) not null,
  body text not null,
  mentions uuid[] default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.comments enable row level security;

create policy "Members can view comments"
  on public.comments for select
  using (exists (
    select 1 from public.comment_threads ct
    where ct.id = comments.thread_id
    and public.is_workspace_member(ct.workspace_id)
  ));

create policy "Members can create comments"
  on public.comments for insert
  with check (exists (
    select 1 from public.comment_threads ct
    where ct.id = comments.thread_id
    and public.is_workspace_member(ct.workspace_id)
  ) and auth.uid() = author_id);

create policy "Authors can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

create index idx_comments_thread on public.comments(thread_id, created_at);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.update_updated_at();
