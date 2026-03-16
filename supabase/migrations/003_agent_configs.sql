-- Agent configurations
create table public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  system_prompt text not null,
  tools text[] not null default '{}',
  model text not null default 'claude-sonnet-4-6',
  icon text,
  color text,
  is_builtin boolean default false,
  created_by uuid references public.users(id),
  created_at timestamptz default now() not null
);

alter table public.agent_configs enable row level security;

create policy "Workspace members can view agent configs"
  on public.agent_configs for select
  using (public.is_workspace_member(workspace_id));

create policy "Admins can manage agent configs"
  on public.agent_configs for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_configs.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create index idx_agent_configs_workspace on public.agent_configs(workspace_id);
