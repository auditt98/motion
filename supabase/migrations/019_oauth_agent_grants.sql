-- OAuth 2.1 authorization for AI agents.
-- Motion's MCP server is both the authorization server and the resource server;
-- Supabase stores registered clients, short-lived authorization codes, and the
-- scoped/expiring grants (with opaque, hashed access/refresh tokens) that replace
-- the static workspace_agent_tokens. Tokens are opaque + DB-backed so revocation
-- is instant.

-- ── Dynamically registered OAuth clients (RFC 7591) ────────────────────────────
create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null default '{}',
  token_endpoint_auth_method text not null default 'none', -- public clients use PKCE
  created_at timestamptz not null default now()
);

-- ── Scoped, expiring agent grants (the unit of access) ─────────────────────────
create table if not exists public.agent_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null, -- human who approved
  client_id text references public.oauth_clients(client_id) on delete set null,
  agent_name text not null default 'AI Agent',

  -- what the agent may touch
  scope_type text not null default 'workspace' check (scope_type in ('workspace', 'folder', 'page')),
  scope_target_id uuid,                                          -- folder/page id when narrowed
  role text not null default 'editor' check (role in ('viewer', 'commenter', 'editor')),
  mode text not null default 'suggest' check (mode in ('suggest', 'direct')),
  oauth_scopes text[] not null default '{}',

  -- opaque tokens (sha-256 hashes only — raw tokens are never stored)
  access_token_hash text,
  refresh_token_hash text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,                                -- null = no expiry

  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_grants_access_hash on public.agent_grants(access_token_hash);
create index if not exists idx_agent_grants_refresh_hash on public.agent_grants(refresh_token_hash);
create index if not exists idx_agent_grants_workspace on public.agent_grants(workspace_id, status);

-- ── Short-lived authorization codes (post-consent, single use) ─────────────────
create table if not exists public.oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  grant_id uuid not null references public.agent_grants(id) on delete cascade,
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────────
-- The MCP server uses the service role (bypasses RLS) for all OAuth machinery.
-- Members may view their workspace's grants and admins may revoke them, so the
-- Settings → Members & agents UI works with the anon key.
alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.agent_grants enable row level security;

drop policy if exists "Members can view workspace agent grants" on public.agent_grants;
create policy "Members can view workspace agent grants"
  on public.agent_grants for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can revoke workspace agent grants" on public.agent_grants;
create policy "Admins can revoke workspace agent grants"
  on public.agent_grants for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
