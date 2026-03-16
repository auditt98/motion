-- Agent tokens for workspace-level API access.
-- Each token grants full access to all documents within a workspace.

create table public.workspace_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_by uuid not null references public.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.workspace_agent_tokens enable row level security;

create policy "Members can view agent tokens"
  on public.workspace_agent_tokens for select
  using (public.is_workspace_member(workspace_id));

create policy "Admins can create agent tokens"
  on public.workspace_agent_tokens for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can update agent tokens"
  on public.workspace_agent_tokens for update
  using (public.is_workspace_admin(workspace_id));

create index idx_agent_tokens_workspace on public.workspace_agent_tokens(workspace_id);
create index idx_agent_tokens_token on public.workspace_agent_tokens(token);
