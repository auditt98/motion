/**
 * Lightweight Supabase REST client for the MCP server.
 * Uses fetch() against PostgREST — no SDK dependency needed.
 */

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

export class SupabaseClient {
  private headers: Record<string, string>;

  constructor(private config: SupabaseConfig) {
    this.headers = {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
    };
  }

  get isConfigured(): boolean {
    return !!(this.config.url && this.config.serviceKey);
  }

  // --- Workspace helpers ---

  async getWorkspaceOwnerId(workspaceId: string): Promise<string | null> {
    const res = await fetch(
      `${this.config.url}/rest/v1/workspaces?id=eq.${enc(workspaceId)}&select=owner_id&limit=1`,
      { headers: this.headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ owner_id: string }>;
    return rows[0]?.owner_id ?? null;
  }

  // --- Workspace verification ---

  async verifyPageInWorkspace(pageId: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?id=eq.${enc(pageId)}&workspace_id=eq.${enc(workspaceId)}&select=id&limit=1`,
      { headers: this.headers },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.length > 0;
  }

  async verifyFolderInWorkspace(folderId: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/folders?id=eq.${enc(folderId)}&workspace_id=eq.${enc(workspaceId)}&select=id&limit=1`,
      { headers: this.headers },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.length > 0;
  }

  // --- Pages ---

  async listPages(
    workspaceId: string,
    includeDeleted = false,
  ): Promise<PageRow[]> {
    const filter = includeDeleted
      ? ""
      : "&deleted_at=is.null";
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?workspace_id=eq.${enc(workspaceId)}&select=id,title,icon,parent_id,folder_id,position,is_favorite,deleted_at&order=position.asc${filter}`,
      { headers: this.headers },
    );
    return (await res.json()) as PageRow[];
  }

  async createPage(
    workspaceId: string,
    title: string,
    opts?: { parentId?: string | null; folderId?: string | null; createdBy?: string },
  ): Promise<PageRow | null> {
    // Resolve created_by to a valid user UUID
    let createdBy: string | undefined = opts?.createdBy;
    if (!createdBy || createdBy.startsWith("agent:")) {
      const ownerId = await this.getWorkspaceOwnerId(workspaceId);
      if (!ownerId) return null;
      createdBy = ownerId;
    }

    // Find max position
    const pages = await this.listPages(workspaceId);
    const maxPos = pages.reduce((max, p) => Math.max(max, p.position), -1);

    const res = await fetch(
      `${this.config.url}/rest/v1/pages`,
      {
        method: "POST",
        headers: { ...this.headers, Prefer: "return=representation" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title,
          parent_id: opts?.parentId ?? null,
          folder_id: opts?.folderId ?? null,
          position: maxPos + 1,
          created_by: createdBy,
        }),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as PageRow[];
    return rows[0] ?? null;
  }

  async renamePage(pageId: string, title: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?id=eq.${enc(pageId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({ title }),
      },
    );
    return res.ok;
  }

  async softDeletePage(pageId: string, deletedBy: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?id=eq.${enc(pageId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
        }),
      },
    );
    return res.ok;
  }

  async restorePage(pageId: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?id=eq.${enc(pageId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({ deleted_at: null, deleted_by: null }),
      },
    );
    return res.ok;
  }

  async updatePagePosition(
    pageId: string,
    parentId: string | null,
    position: number,
    workspaceId: string,
    folderId?: string | null,
  ): Promise<boolean> {
    const body: Record<string, unknown> = { parent_id: parentId, position };
    if (folderId !== undefined) body.folder_id = folderId;
    const res = await fetch(
      `${this.config.url}/rest/v1/pages?id=eq.${enc(pageId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  }

  // --- Folders ---

  async listFolders(workspaceId: string): Promise<FolderRow[]> {
    const res = await fetch(
      `${this.config.url}/rest/v1/folders?workspace_id=eq.${enc(workspaceId)}&select=id,name,icon,color,position&order=position.asc`,
      { headers: this.headers },
    );
    return (await res.json()) as FolderRow[];
  }

  async createFolder(
    workspaceId: string,
    name: string,
    createdBy: string,
  ): Promise<FolderRow | null> {
    // Resolve created_by to a valid user UUID
    let resolvedCreatedBy = createdBy;
    if (resolvedCreatedBy.startsWith("agent:")) {
      const ownerId = await this.getWorkspaceOwnerId(workspaceId);
      if (!ownerId) return null;
      resolvedCreatedBy = ownerId;
    }

    const folders = await this.listFolders(workspaceId);
    const maxPos = folders.reduce((max, f) => Math.max(max, f.position), -1);

    const res = await fetch(
      `${this.config.url}/rest/v1/folders`,
      {
        method: "POST",
        headers: { ...this.headers, Prefer: "return=representation" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name,
          position: maxPos + 1,
          created_by: resolvedCreatedBy,
        }),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as FolderRow[];
    return rows[0] ?? null;
  }

  async renameFolder(folderId: string, name: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/folders?id=eq.${enc(folderId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({ name }),
      },
    );
    return res.ok;
  }

  async deleteFolder(folderId: string, workspaceId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/folders?id=eq.${enc(folderId)}&workspace_id=eq.${enc(workspaceId)}`,
      {
        method: "DELETE",
        headers: { ...this.headers, Prefer: "return=minimal" },
      },
    );
    return res.ok;
  }

  // --- Comments ---

  async listCommentThreads(pageId: string): Promise<CommentThreadRow[]> {
    const { url } = this.config;

    const tRes = await fetch(
      `${url}/rest/v1/comment_threads?page_id=eq.${enc(pageId)}&select=*&order=created_at.asc`,
      { headers: this.headers },
    );
    const threads = (await tRes.json()) as CommentThreadRow[];

    if (threads.length === 0) return [];

    const threadIds = threads.map((t) => t.id);
    const cRes = await fetch(
      `${url}/rest/v1/comments?thread_id=in.(${threadIds.map(enc).join(",")})&select=*&order=created_at.asc`,
      { headers: this.headers },
    );
    const comments = (await cRes.json()) as CommentRow[];

    const commentsByThread = new Map<string, CommentRow[]>();
    for (const c of comments) {
      const list = commentsByThread.get(c.thread_id) || [];
      list.push(c);
      commentsByThread.set(c.thread_id, list);
    }

    return threads.map((t) => ({
      ...t,
      comments: commentsByThread.get(t.id) || [],
    }));
  }

  async createCommentThread(
    pageId: string,
    workspaceId: string,
    createdBy: string,
    body: string,
    mentions: string[] = [],
  ): Promise<string | null> {
    const { url } = this.config;

    const tRes = await fetch(`${url}/rest/v1/comment_threads`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=representation" },
      body: JSON.stringify({
        page_id: pageId,
        workspace_id: workspaceId,
        created_by: createdBy,
      }),
    });
    if (!tRes.ok) return null;
    const threads = (await tRes.json()) as Array<{ id: string }>;
    const threadId = threads[0]?.id;
    if (!threadId) return null;

    await fetch(`${url}/rest/v1/comments`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        thread_id: threadId,
        author_id: createdBy,
        body,
        mentions,
      }),
    });

    return threadId;
  }

  async addCommentReply(
    threadId: string,
    authorId: string,
    body: string,
    mentions: string[] = [],
  ): Promise<boolean> {
    const res = await fetch(`${this.config.url}/rest/v1/comments`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        thread_id: threadId,
        author_id: authorId,
        body,
        mentions,
      }),
    });
    return res.ok;
  }

  async resolveThread(threadId: string, resolvedBy: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/comment_threads?id=eq.${enc(threadId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          is_resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        }),
      },
    );
    return res.ok;
  }

  async reopenThread(threadId: string): Promise<boolean> {
    const res = await fetch(
      `${this.config.url}/rest/v1/comment_threads?id=eq.${enc(threadId)}`,
      {
        method: "PATCH",
        headers: { ...this.headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
        }),
      },
    );
    return res.ok;
  }

  // --- Search ---

  async searchPages(
    workspaceId: string,
    queryText: string,
    limit = 20,
  ): Promise<SearchResultRow[]> {
    // Call the search_pages RPC function via PostgREST
    const res = await fetch(
      `${this.config.url}/rest/v1/rpc/search_pages`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          ws_id: workspaceId,
          query_text: queryText,
          query_embedding: null,
          result_limit: limit,
        }),
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as SearchResultRow[];
  }

  // --- Page permissions ---
  // Note: Workspace-level tokens (agent_token, invite_token) bypass page
  // restrictions per the additive model. These methods are for agents to
  // read/manage permissions, not to gate their own access.

  async getPagePermissions(pageId: string): Promise<PagePermissionsRow | null> {
    const res = await fetch(
      `${this.config.url}/rest/v1/page_permissions?page_id=eq.${enc(pageId)}&select=*&limit=1`,
      { headers: this.headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as PagePermissionsRow[];
    return rows[0] ?? null;
  }

  async getPageAccessList(pageId: string): Promise<PageAccessListRow[]> {
    const res = await fetch(
      `${this.config.url}/rest/v1/page_access_list?page_id=eq.${enc(pageId)}&select=*&order=created_at.asc`,
      { headers: this.headers },
    );
    if (!res.ok) return [];
    return (await res.json()) as PageAccessListRow[];
  }

  async upsertPagePermissions(
    pageId: string,
    workspaceId: string,
    updates: Partial<Omit<PagePermissionsRow, "id" | "page_id" | "workspace_id" | "created_at" | "updated_at">>,
  ): Promise<PagePermissionsRow | null> {
    const res = await fetch(
      `${this.config.url}/rest/v1/page_permissions`,
      {
        method: "POST",
        headers: {
          ...this.headers,
          Prefer: "return=representation,resolution=merge-duplicates",
        },
        body: JSON.stringify({
          page_id: pageId,
          workspace_id: workspaceId,
          ...updates,
        }),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as PagePermissionsRow[];
    return rows[0] ?? null;
  }

  // --- Versions ---

  async listVersions(pageId: string): Promise<VersionRow[]> {
    const res = await fetch(
      `${this.config.url}/rest/v1/page_versions?page_id=eq.${enc(pageId)}&select=id,page_id,label,created_by_name,actor_type,trigger_type,created_at&order=created_at.desc`,
      { headers: this.headers },
    );
    return (await res.json()) as VersionRow[];
  }

  async getVersionSnapshot(versionId: string): Promise<string | null> {
    const res = await fetch(
      `${this.config.url}/rest/v1/page_versions?id=eq.${enc(versionId)}&select=snapshot`,
      { headers: this.headers },
    );
    const rows = (await res.json()) as Array<{ snapshot: string }>;
    return rows[0]?.snapshot ?? null;
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

// --- Row types (PostgREST response shapes) ---

export interface PageRow {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  folder_id: string | null;
  position: number;
  is_favorite: boolean;
  deleted_at: string | null;
}

export interface FolderRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
}

export interface CommentRow {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
}

export interface CommentThreadRow {
  id: string;
  page_id: string;
  workspace_id: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  comments?: CommentRow[];
}

export interface SearchResultRow {
  page_id: string;
  title: string;
  snippet: string;
  fts_rank: number;
  semantic_score: number;
  combined_score: number;
}

export interface PagePermissionsRow {
  id: string;
  page_id: string;
  workspace_id: string;
  is_public: boolean;
  public_access_level: string;
  public_slug: string | null;
  is_restricted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageAccessListRow {
  id: string;
  page_id: string;
  user_id: string;
  access_level: string;
  granted_by: string | null;
  created_at: string;
}

export interface VersionRow {
  id: string;
  page_id: string;
  label: string | null;
  created_by_name: string | null;
  actor_type: string;
  trigger_type: string;
  created_at: string;
}
