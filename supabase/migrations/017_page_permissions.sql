-- Per-page access control (layered on top of workspace membership)
-- Public sharing: any page can be published to a public URL
-- Restricted access: limit page visibility to specific workspace members

-- One row per page, created lazily when permissions are first configured
create table public.page_permissions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete cascade not null unique,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,

  -- Public sharing
  is_public boolean default false,
  public_access_level text default 'view' check (public_access_level in ('view', 'comment')),
  public_slug text unique,  -- optional vanity slug; falls back to page UUID

  -- Restricted access (when true, only listed users + admins can access)
  is_restricted boolean default false,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Per-user page access (only meaningful when is_restricted = true)
create table public.page_access_list (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  access_level text default 'edit' check (access_level in ('view', 'comment', 'edit')),
  granted_by uuid references public.users(id),
  created_at timestamptz default now() not null,
  unique(page_id, user_id)
);

-- Indexes
create index idx_page_permissions_page on public.page_permissions(page_id);
create index idx_page_permissions_public_slug on public.page_permissions(public_slug) where public_slug is not null;
create index idx_page_permissions_is_public on public.page_permissions(is_public) where is_public = true;
create index idx_page_access_list_page on public.page_access_list(page_id);
create index idx_page_access_list_user on public.page_access_list(user_id);

-- Auto-update updated_at (reuses existing function from 002_pages.sql)
create trigger page_permissions_updated_at
  before update on public.page_permissions
  for each row execute function public.update_updated_at();

-- ============================================================
-- RLS: page_permissions
-- ============================================================
alter table public.page_permissions enable row level security;

-- Workspace members can read page permissions for their workspace
create policy "Members can view page permissions"
  on public.page_permissions for select
  using (public.is_workspace_member(workspace_id));

-- Workspace members can create/update page permissions (any member can share their pages)
create policy "Members can insert page permissions"
  on public.page_permissions for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Members can update page permissions"
  on public.page_permissions for update
  using (public.is_workspace_member(workspace_id));

-- Only admins can delete page permission rows
create policy "Admins can delete page permissions"
  on public.page_permissions for delete
  using (public.is_workspace_admin(workspace_id));

-- Anonymous users can read public page permissions (needed for /p/:slug route)
create policy "Public pages readable by anyone"
  on public.page_permissions for select
  using (is_public = true);

-- ============================================================
-- RLS: page_access_list
-- ============================================================
alter table public.page_access_list enable row level security;

-- Workspace members can view the access list for pages in their workspace
create policy "Members can view page access list"
  on public.page_access_list for select
  using (
    exists (
      select 1 from public.page_permissions pp
      where pp.page_id = page_access_list.page_id
        and public.is_workspace_member(pp.workspace_id)
    )
  );

-- Workspace members can manage access list entries
create policy "Members can insert page access"
  on public.page_access_list for insert
  with check (
    exists (
      select 1 from public.page_permissions pp
      where pp.page_id = page_access_list.page_id
        and public.is_workspace_member(pp.workspace_id)
    )
  );

create policy "Members can update page access"
  on public.page_access_list for update
  using (
    exists (
      select 1 from public.page_permissions pp
      where pp.page_id = page_access_list.page_id
        and public.is_workspace_member(pp.workspace_id)
    )
  );

create policy "Members can delete page access"
  on public.page_access_list for delete
  using (
    exists (
      select 1 from public.page_permissions pp
      where pp.page_id = page_access_list.page_id
        and public.is_workspace_member(pp.workspace_id)
    )
  );

-- ============================================================
-- RPC: public page lookup (callable without auth)
-- ============================================================
create or replace function public.get_public_page_by_slug(slug_or_id text)
returns table(
  page_id uuid,
  workspace_id uuid,
  title text,
  icon text,
  cover_url text
) as $$
  select p.id, p.workspace_id, p.title, p.icon, p.cover_url
  from public.pages p
  join public.page_permissions pp on pp.page_id = p.id
  where pp.is_public = true
    and p.deleted_at is null
    and (pp.public_slug = slug_or_id or p.id::text = slug_or_id)
  limit 1;
$$ language sql security definer stable;
