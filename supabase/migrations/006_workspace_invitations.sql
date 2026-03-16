-- Allow owners to delete their workspaces
create policy "Owners can delete their workspaces"
  on public.workspaces for delete
  using (owner_id = auth.uid());

-- Workspace invitations (email-based, one-time use)
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role text check (role in ('admin', 'member', 'guest')) not null default 'member',
  invited_by uuid references public.users(id) on delete set null,
  token uuid default gen_random_uuid() not null unique,
  status text check (status in ('pending', 'accepted', 'expired', 'revoked')) not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now() not null,
  unique(workspace_id, email)
);

alter table public.workspace_invitations enable row level security;

create policy "Admins can view workspace invitations"
  on public.workspace_invitations for select
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can create workspace invitations"
  on public.workspace_invitations for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can update workspace invitations"
  on public.workspace_invitations for update
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can delete workspace invitations"
  on public.workspace_invitations for delete
  using (public.is_workspace_admin(workspace_id));

-- Shareable invite links (reusable)
create table public.workspace_invite_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  token uuid default gen_random_uuid() not null unique,
  role text check (role in ('member', 'guest')) not null default 'member',
  max_uses integer,
  use_count integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.workspace_invite_links enable row level security;

create policy "Admins can view workspace invite links"
  on public.workspace_invite_links for select
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can create workspace invite links"
  on public.workspace_invite_links for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can update workspace invite links"
  on public.workspace_invite_links for update
  using (public.is_workspace_admin(workspace_id));

create policy "Admins can delete workspace invite links"
  on public.workspace_invite_links for delete
  using (public.is_workspace_admin(workspace_id));

-- Allow workspace co-members to see each other's profiles (needed for member list)
create policy "Workspace co-members can view user profiles"
  on public.users for select
  using (
    exists (
      select 1 from public.workspace_members wm1
      join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid()
        and wm2.user_id = users.id
    )
  );

-- RPC: Accept an email invitation (SECURITY DEFINER because the user isn't a member yet)
create or replace function public.accept_email_invitation(invite_token uuid)
returns jsonb as $$
declare
  inv record;
  existing_member uuid;
begin
  select * into inv
  from public.workspace_invitations
  where token = invite_token
    and status = 'pending'
    and expires_at > now();

  if inv is null then
    return jsonb_build_object('error', 'Invitation not found, expired, or already used');
  end if;

  if inv.email != (select email from auth.users where id = auth.uid()) then
    return jsonb_build_object('error', 'This invitation was sent to a different email address');
  end if;

  select id into existing_member
  from public.workspace_members
  where workspace_id = inv.workspace_id and user_id = auth.uid();

  if existing_member is not null then
    update public.workspace_invitations set status = 'accepted' where id = inv.id;
    return jsonb_build_object('workspace_id', inv.workspace_id, 'already_member', true);
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role);

  update public.workspace_invitations set status = 'accepted' where id = inv.id;

  return jsonb_build_object('workspace_id', inv.workspace_id, 'already_member', false);
end;
$$ language plpgsql security definer;

-- RPC: Accept a shareable invite link
create or replace function public.accept_invite_link(link_token uuid)
returns jsonb as $$
declare
  lnk record;
  existing_member uuid;
begin
  select * into lnk
  from public.workspace_invite_links
  where token = link_token
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses);

  if lnk is null then
    return jsonb_build_object('error', 'Invite link is invalid, expired, or has reached its usage limit');
  end if;

  select id into existing_member
  from public.workspace_members
  where workspace_id = lnk.workspace_id and user_id = auth.uid();

  if existing_member is not null then
    return jsonb_build_object('workspace_id', lnk.workspace_id, 'already_member', true);
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (lnk.workspace_id, auth.uid(), lnk.role);

  update public.workspace_invite_links set use_count = use_count + 1 where id = lnk.id;

  return jsonb_build_object('workspace_id', lnk.workspace_id, 'already_member', false);
end;
$$ language plpgsql security definer;
