-- Restrict account creation to the company Google Workspace.
--
-- Enforced by Supabase Auth's `before-user-created` hook, which must be pointed at
-- public.hook_restrict_signup in the dashboard (Authentication → Hooks). Until that
-- hook is enabled this file changes nothing — signup stays open.
--
-- Sign-IN is unaffected: the hook only runs when a new auth.users row is about to be
-- created, so everyone who already has an account keeps working.

create table if not exists public.signup_allowlist (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('domain', 'email')),
  value text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

-- Reachable only by the auth server and the security-definer hook below —
-- RLS with no policies keeps it off the PostgREST API entirely.
alter table public.signup_allowlist enable row level security;
revoke all on table public.signup_allowlist from anon, authenticated;

insert into public.signup_allowlist (kind, value, note)
values ('domain', 'kelassekejap.com', 'Company Google Workspace')
on conflict (kind, value) do nothing;

-- Grandfather in the accounts that already exist on other domains, so an OAuth
-- sign-in that falls through to user creation instead of identity linking is not
-- rejected. Delete rows from this table to revoke.
insert into public.signup_allowlist (kind, value, note)
select 'email', lower(email), 'Existing account at time of domain restriction'
from auth.users
where split_part(lower(email), '@', 2) <> 'kelassekejap.com'
on conflict (kind, value) do nothing;

create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(event->'user'->>'email');
  v_domain text := split_part(lower(event->'user'->>'email'), '@', 2);
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'An email address is required to sign up.'
    ));
  end if;

  -- Allowlisted domain (the company Workspace), or an individually allowlisted address.
  if exists (
    select 1 from public.signup_allowlist
    where (kind = 'domain' and value = v_domain)
       or (kind = 'email' and value = v_email)
  ) then
    return '{}'::jsonb;
  end if;

  -- An admin explicitly invited this address to a workspace.
  if exists (
    select 1 from public.workspace_invitations
    where lower(email) = v_email
      and status = 'pending'
      and expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Motion is limited to Kelas Sekejap accounts. Sign in with your @kelassekejap.com email, or ask an admin to invite you first.'
  ));
end;
$$;

grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup(jsonb) from anon, authenticated, public;
