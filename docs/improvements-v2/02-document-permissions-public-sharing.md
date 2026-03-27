# Document-Level Permissions & Public Sharing

## Problem

Authorization is currently workspace-wide: you're either a workspace member or you're not. There's no way to share a single page publicly, restrict a sensitive document to specific members, or create a read-only public link. This blocks several important use cases:

- **Public documentation**: Teams can't publish help docs, wikis, or portfolios via URL
- **Sensitive documents**: HR docs, financials, and board notes are visible to all workspace members
- **External sharing**: Can't share a single page with a client without inviting them to the entire workspace

## Priority

~3-4 days of effort. Critical for competing with Notion/Google Docs.

## Design Principles

- **Additive model**: Per-page permissions are layered ON TOP of workspace access. Users with workspace tokens or invite links still access everything they could before -- page-level permissions only ADD restrictions or public access.
- **Workspace members retain access by default**: A page-level restriction means "only these people can see this page." Workspace owners/admins always retain access.
- **Public sharing is opt-in per page**: Pages are private by default. Public access requires explicit action.

## What to Build

### 1. DB migration: `page_permissions` table

New migration `supabase/migrations/016_page_permissions.sql`:

```sql
-- Per-page access control (layered on top of workspace membership)
CREATE TABLE page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Public sharing
  is_public boolean DEFAULT false,          -- publicly accessible via URL
  public_access_level text DEFAULT 'view',  -- 'view' or 'comment' (no public edit)
  public_slug text UNIQUE,                  -- optional vanity URL slug

  -- Restricted access (when set, only listed users + admins can access)
  is_restricted boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Per-user page access (only used when is_restricted = true)
CREATE TABLE page_access_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  access_level text DEFAULT 'edit',  -- 'view', 'comment', 'edit'
  granted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(page_id, user_id)
);

CREATE INDEX idx_page_permissions_page ON page_permissions(page_id);
CREATE INDEX idx_page_permissions_public ON page_permissions(is_public) WHERE is_public = true;
CREATE INDEX idx_page_access_list_page ON page_access_list(page_id);
CREATE INDEX idx_page_access_list_user ON page_access_list(user_id);

-- RLS: workspace members can read page permissions for their workspace
ALTER TABLE page_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_read_page_permissions"
  ON page_permissions FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_admins_manage_page_permissions"
  ON page_permissions FOR ALL
  USING (is_workspace_member(workspace_id));

-- Public pages are readable by anyone (no auth required)
CREATE POLICY "public_pages_readable"
  ON page_permissions FOR SELECT
  USING (is_public = true);
```

### 2. Public page viewer

Create a new route `/public/:slug` (or `/p/:slug`) that renders a read-only version of the document:

- No authentication required
- Read-only TipTap editor (editable: false)
- Minimal chrome: page title, content, no sidebar
- Optional: "Made with Motion" footer with signup CTA
- SEO-friendly: server-rendered meta tags (title, description) via Cloudflare Pages functions

### 3. Update ShareButton / SharePopover

Extend the existing `ShareButton` component at `apps/web/src/components/workspace/ShareButton.tsx`:

**New "Public access" section:**
- Toggle: "Publish to web" (on/off)
- When on: show the public URL with copy button
- Optional: custom slug input (e.g., `motion.app/p/my-doc-title`)
- Access level: "Anyone with the link can view" / "Anyone with the link can comment"

**New "Page access" section (for restricted pages):**
- Toggle: "Restrict to specific people"
- When on: show user list with access levels (view/comment/edit)
- Add people by email (autocomplete from workspace members)
- Note: "Workspace admins always have access"

### 4. Access control logic

Create a helper function `canAccessPage(userId, pageId)` used by:
- The web app (route guard on `/page/:pageId`)
- The MCP server (session validation)
- The PartyKit server (WebSocket connection auth)

Logic:
```
1. If page has no page_permissions row -> default workspace access (current behavior)
2. If page_permissions.is_restricted = true:
   a. Workspace owner/admin -> always allowed
   b. User in page_access_list -> allowed at their access_level
   c. Others -> denied
3. If page_permissions.is_public = true:
   a. Anyone can view (even unauthenticated)
   b. Authenticated workspace members get their normal access level
```

### 5. PartyKit connection auth update

Update `party/document.ts` to check page-level permissions on WebSocket connection:
- If the page is restricted, verify the connecting user is in the access list
- If the page is public and the connection is read-only, allow without auth
- Workspace tokens and invite links bypass page restrictions (per the additive model)

### 6. Hook: `usePagePermissions`

New hook for managing page permissions:

```typescript
const {
  permissions,         // { isPublic, publicSlug, isRestricted, accessList }
  togglePublic,        // (isPublic: boolean) => void
  setPublicSlug,       // (slug: string) => void
  toggleRestricted,    // (isRestricted: boolean) => void
  addAccess,           // (userId: string, level: 'view'|'comment'|'edit') => void
  removeAccess,        // (userId: string) => void
  updateAccessLevel,   // (userId: string, level: string) => void
} = usePagePermissions(pageId, workspaceId);
```

## Files to Modify

- `supabase/migrations/016_page_permissions.sql` (new)
- `apps/web/src/hooks/usePagePermissions.ts` (new)
- `apps/web/src/components/workspace/ShareButton.tsx` -- add public sharing + restricted access UI
- `apps/web/src/components/editor/PublicPageViewer.tsx` (new) -- read-only public page
- `apps/web/src/App.tsx` -- add `/public/:slug` route
- `party/document.ts` -- add page permission check on connection
- `apps/mcp-server/src/http.ts` -- add permission check on session creation
- `apps/mcp-server/src/supabase-client.ts` -- add permission query methods

## Verification

1. Create a page -> no permissions row exists -> accessible to all workspace members (existing behavior unchanged)
2. Toggle "Publish to web" -> public URL is generated -> open in incognito -> page is readable
3. Set custom slug -> URL reflects the slug
4. Toggle "Restrict to specific people" -> add User B with "view" access -> User B can read but not edit -> User C (not in list) sees "Access denied"
5. Workspace admin -> can always access restricted pages
6. User with workspace token -> can still access all pages (additive model)
7. User with invite link -> can still access all pages they could before
8. Public page with no auth -> renders read-only, no sidebar, clean layout
9. Delete the page -> public URL returns 404

## Dependencies

None on planned features. Requires updates to PartyKit auth and MCP server validation.
