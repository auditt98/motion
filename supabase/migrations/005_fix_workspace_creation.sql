-- Fix: workspace owners couldn't add themselves as members (RLS chicken-and-egg).
-- Solution: SECURITY DEFINER function for atomic workspace creation,
-- plus a SELECT policy so owners always see their own workspace.

-- 1. Owners can always see their own workspace (even before member row exists)
create policy "Owners can view own workspaces"
  on public.workspaces for select
  using (owner_id = auth.uid());

-- 2. Atomic workspace creation function (bypasses RLS)
create or replace function public.create_workspace(
  ws_name text,
  ws_slug text
)
returns uuid as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (name, slug, owner_id)
  values (ws_name, ws_slug, auth.uid())
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, auth.uid(), 'owner');

  return ws_id;
end;
$$ language plpgsql security definer;
