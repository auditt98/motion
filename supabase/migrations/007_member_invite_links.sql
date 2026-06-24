-- Allow all workspace members (not just admins) to view and create invite links.
-- This supports the "Copy invite link" and "Copy agent instructions" buttons
-- being available to every member in the Share panel.

-- Drop admin-only policies on workspace_invite_links (idempotent — tolerate re-runs)
drop policy if exists "Admins can view workspace invite links" on public.workspace_invite_links;
drop policy if exists "Admins can create workspace invite links" on public.workspace_invite_links;

-- Replace with member-level policies (drop-then-create so re-runs are safe)
drop policy if exists "Members can view workspace invite links" on public.workspace_invite_links;
drop policy if exists "Members can create workspace invite links" on public.workspace_invite_links;

create policy "Members can view workspace invite links"
  on public.workspace_invite_links for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can create workspace invite links"
  on public.workspace_invite_links for insert
  with check (public.is_workspace_member(workspace_id));
