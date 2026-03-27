export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "guest";
  created_at: string;
}

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user: Pick<User, "id" | "email" | "display_name" | "avatar_url">;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member" | "guest";
  invited_by: string | null;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
}

export interface WorkspaceInviteLink {
  id: string;
  workspace_id: string;
  token: string;
  role: "member" | "guest";
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
}

export type PageType = "document" | "database";

export interface Page {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: number;
  is_favorite: boolean;
  page_type: PageType;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface AgentConfig {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  tools: string[];
  model: string;
  icon: string | null;
  color: string | null;
  is_builtin: boolean;
  created_by: string | null;
  created_at: string;
}

export type BlockType =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "toggle"
  | "quote"
  | "callout"
  | "divider"
  | "codeBlock"
  | "image"
  | "video"
  | "fileAttachment"
  | "embed"
  | "table"
  | "syncedBlock"
  | "columnLayout"
  | "inlineDatabase";

export interface AgentTask {
  id: string;
  agent_id: string;
  document_id: string;
  instruction: string;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  created_by: string;
  created_at: string;
}

export interface AgentAwareness {
  name: string;
  color: string;
  icon: string;
  isAgent: true;
  agentId: string;
  status: "thinking" | "writing" | "idle";
  taskDescription: string;
}

export interface UserAwareness {
  name: string;
  color: string;
  avatar_url: string | null;
  isAgent: false;
  userId: string;
}

export type AwarenessState = AgentAwareness | UserAwareness;

export interface PageVersion {
  id: string;
  page_id: string;
  workspace_id: string;
  snapshot: string; // base64-encoded Yjs state
  created_by: string | null;
  created_by_name: string | null;
  actor_type: "human" | "agent";
  trigger_type: "auto" | "manual" | "session_end" | "pre_restore";
  label: string | null;
  created_at: string;
}

// --- Suggestion mode ---

export type SuggestionType = "add" | "delete";

export interface SuggestionMarkAttrs {
  suggestionId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  page_id: string;
  workspace_id: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<User, "id" | "email" | "display_name" | "avatar_url">;
}

export interface CommentThreadWithComments extends CommentThread {
  comments: CommentWithAuthor[];
}

export interface AgentToken {
  id: string;
  workspace_id: string;
  name: string;
  token: string;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

// --- Page Permissions ---

export type PageAccessLevel = "view" | "comment" | "edit";
export type PublicAccessLevel = "view" | "comment";

export interface PagePermissions {
  id: string;
  page_id: string;
  workspace_id: string;
  is_public: boolean;
  public_access_level: PublicAccessLevel;
  public_slug: string | null;
  is_restricted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageAccessEntry {
  id: string;
  page_id: string;
  user_id: string;
  access_level: PageAccessLevel;
  granted_by: string | null;
  created_at: string;
  user?: Pick<User, "id" | "email" | "display_name" | "avatar_url">;
}

// --- Database / Structured Data Views ---

export type ColumnType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "person"
  | "url";

export interface DatabaseColumn {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
  options?: string[]; // for select / multi_select
}

export interface DatabaseMeta {
  columns: DatabaseColumn[];
}

export interface DatabaseViewConfig {
  sorts: Array<{ columnId: string; direction: "asc" | "desc" }>;
  filters: Array<{ columnId: string; operator: string; value: string }>;
  hiddenColumns: string[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
}
