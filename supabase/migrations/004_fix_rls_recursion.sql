-- Fix infinite recursion in workspace_members and agent_configs RLS policies.
-- The issue: policies on workspace_members query workspace_members itself.
-- The fix: use a SECURITY DEFINER helper function for the admin check too.

-- Drop the problematic policies
drop policy if exists "Members can view workspace members" on public.workspace_members;
drop policy if exists "Admins can manage workspace members" on public.workspace_members;
drop policy if exists "Workspace members can view agent configs" on public.agent_configs;
drop policy if exists "Admins can manage agent configs" on public.agent_configs;

-- Create a SECURITY DEFINER function for admin check (bypasses RLS internally)
create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

-- Recreate workspace_members policies using SECURITY DEFINER functions
create policy "Members can view workspace members"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "Admins can insert workspace members"
  on public.workspace_members for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can update workspace members"
  on public.workspace_members for update
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can delete workspace members"
  on public.workspace_members for delete
  using (public.is_workspace_admin(workspace_id));

-- Recreate agent_configs policies
create policy "Members can view agent configs"
  on public.agent_configs for select
  using (public.is_workspace_member(workspace_id));

create policy "Admins can insert agent configs"
  on public.agent_configs for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can update agent configs"
  on public.agent_configs for update
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can delete agent configs"
  on public.agent_configs for delete
  using (public.is_workspace_admin(workspace_id));
