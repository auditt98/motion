import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { computeInsertPosition, renumberPositions } from "@motion/shared";

export interface PageItem {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  folder_id: string | null;
  position: number;
  is_favorite: boolean;
  page_type: "document" | "database";
  updated_at: string;
  last_edited_by: string | null;
  cover_url: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface FolderItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
}

export interface WorkspaceItem {
  workspace_id: string;
  role: "owner" | "admin" | "member" | "guest";
  name: string;
}

interface WorkspaceState {
  workspaceId: string | null;
  currentUserRole: "owner" | "admin" | "member" | "guest" | null;
  workspaces: WorkspaceItem[];
  pages: PageItem[];
  folders: FolderItem[];
  trashPages: PageItem[];
  loading: boolean;
}

const PAGE_SELECT = "id, title, icon, parent_id, folder_id, position, is_favorite, page_type, updated_at, last_edited_by, cover_url, deleted_at, deleted_by";

export function useWorkspace(user: User) {
  const [state, setState] = useState<WorkspaceState>({
    workspaceId: null,
    currentUserRole: null,
    workspaces: [],
    pages: [],
    folders: [],
    trashPages: [],
    loading: true,
  });

  // Load all workspaces the user belongs to
  async function loadWorkspaces() {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspace:workspaces(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!data) return [];
    return data.map((m: any) => ({
      workspace_id: m.workspace_id,
      role: m.role,
      name: m.workspace?.name || "Workspace",
    })) as WorkspaceItem[];
  }

  // Load pages for a given workspace
  async function loadPages(workspaceId: string) {
    const { data } = await supabase
      .from("pages")
      .select(PAGE_SELECT)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("position", { ascending: true });
    return (data || []) as PageItem[];
  }

  // Load soft-deleted pages for trash
  async function loadTrashPages(workspaceId: string) {
    const { data } = await supabase
      .from("pages")
      .select(PAGE_SELECT)
      .eq("workspace_id", workspaceId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    return (data || []) as PageItem[];
  }

  // Load folders for a given workspace
  async function loadFolders(workspaceId: string) {
    const { data } = await supabase
      .from("folders")
      .select("id, name, icon, color, position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true });
    return (data || []) as FolderItem[];
  }

  // Guard against StrictMode double-mount creating duplicate workspaces
  const initRef = useRef(false);

  // Initialize: find or create workspace, then load pages
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      const [workspaces, userRow] = await Promise.all([
        loadWorkspaces(),
        supabase.from("users").select("default_workspace_id").eq("id", user.id).single(),
      ]);

      let workspaceId: string;
      let currentUserRole: WorkspaceState["currentUserRole"] = null;

      if (workspaces.length > 0) {
        // Prefer user's explicit default, then invited workspace, then first
        const defaultWs = userRow.data?.default_workspace_id
          ? workspaces.find((w) => w.workspace_id === userRow.data.default_workspace_id)
          : null;
        const invited = workspaces.find((m) => m.role !== "owner");
        const pick = defaultWs || invited || workspaces[0];
        workspaceId = pick.workspace_id;
        currentUserRole = pick.role;
      } else {
        // Create a default workspace for new users via RPC
        const displayName =
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "User";

        const slug =
          displayName.toLowerCase().replace(/[^a-z0-9]/g, "-") +
          "-" +
          Date.now().toString(36);

        const { data: wsId, error: wsError } = await supabase.rpc(
          "create_workspace",
          { ws_name: "Default", ws_slug: slug },
        );

        if (wsError || !wsId) {
          console.error("Failed to create workspace:", wsError);
          setState((s) => ({ ...s, loading: false }));
          return;
        }

        workspaceId = wsId;
        currentUserRole = "owner";
        workspaces.push({
          workspace_id: workspaceId,
          role: "owner",
          name: "Default",
        });
      }

      const [pages, folders, trashPages] = await Promise.all([
        loadPages(workspaceId),
        loadFolders(workspaceId),
        loadTrashPages(workspaceId),
      ]);

      setState({
        workspaceId,
        currentUserRole,
        workspaces,
        pages,
        folders,
        trashPages,
        loading: false,
      });
    }

    init();
  }, [user.id]);

  const createPage = useCallback(
    async (title = "Untitled", parentId: string | null = null, folderId: string | null = null) => {
      if (!state.workspaceId) return null;

      const maxPos = state.pages.reduce(
        (max, p) => Math.max(max, p.position),
        -1,
      );

      const { data, error } = await supabase
        .from("pages")
        .insert({
          workspace_id: state.workspaceId,
          title,
          parent_id: parentId,
          folder_id: folderId,
          position: maxPos + 1,
          created_by: user.id,
        })
        .select(PAGE_SELECT)
        .single();

      if (error || !data) {
        console.error("Failed to create page:", error);
        return null;
      }

      setState((s) => ({ ...s, pages: [...s.pages, data as PageItem] }));
      return data as PageItem;
    },
    [state.workspaceId, state.pages, user.id],
  );

  const createDatabase = useCallback(
    async (title = "Untitled database", folderId: string | null = null) => {
      if (!state.workspaceId) return null;

      const maxPos = state.pages.reduce(
        (max, p) => Math.max(max, p.position),
        -1,
      );

      const { data, error } = await supabase
        .from("pages")
        .insert({
          workspace_id: state.workspaceId,
          title,
          folder_id: folderId,
          position: maxPos + 1,
          page_type: "database",
          created_by: user.id,
        })
        .select(PAGE_SELECT)
        .single();

      if (error || !data) {
        console.error("Failed to create database:", error);
        return null;
      }

      setState((s) => ({ ...s, pages: [...s.pages, data as PageItem] }));
      return data as PageItem;
    },
    [state.workspaceId, state.pages, user.id],
  );

  const renamePage = useCallback(
    async (pageId: string, title: string) => {
      const { error } = await supabase
        .from("pages")
        .update({ title })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to rename page:", error);
        return;
      }

      setState((s) => ({
        ...s,
        pages: s.pages.map((p) => (p.id === pageId ? { ...p, title } : p)),
      }));
    },
    [],
  );

  const deletePage = useCallback(
    async (pageId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("pages")
        .update({ deleted_at: now, deleted_by: user.id })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to soft-delete page:", error);
        return;
      }

      setState((s) => {
        const page = s.pages.find((p) => p.id === pageId);
        const trashItem = page
          ? { ...page, deleted_at: now, deleted_by: user.id }
          : undefined;
        return {
          ...s,
          pages: s.pages.filter((p) => p.id !== pageId),
          trashPages: trashItem ? [trashItem, ...s.trashPages] : s.trashPages,
        };
      });
    },
    [user.id],
  );

  const restorePage = useCallback(
    async (pageId: string) => {
      const { error } = await supabase
        .from("pages")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to restore page:", error);
        return;
      }

      setState((s) => {
        const page = s.trashPages.find((p) => p.id === pageId);
        const restored = page
          ? { ...page, deleted_at: null, deleted_by: null }
          : undefined;
        return {
          ...s,
          trashPages: s.trashPages.filter((p) => p.id !== pageId),
          pages: restored ? [...s.pages, restored] : s.pages,
        };
      });
    },
    [],
  );

  const permanentlyDeletePage = useCallback(
    async (pageId: string) => {
      const { error } = await supabase
        .from("pages")
        .delete()
        .eq("id", pageId);

      if (error) {
        console.error("Failed to permanently delete page:", error);
        return;
      }

      setState((s) => ({
        ...s,
        trashPages: s.trashPages.filter((p) => p.id !== pageId),
      }));
    },
    [],
  );

  const toggleFavorite = useCallback(
    async (pageId: string) => {
      const page = state.pages.find((p) => p.id === pageId);
      if (!page) return;

      const { error } = await supabase
        .from("pages")
        .update({ is_favorite: !page.is_favorite })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to toggle favorite:", error);
        return;
      }

      setState((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === pageId ? { ...p, is_favorite: !p.is_favorite } : p,
        ),
      }));
    },
    [state.pages],
  );

  const movePageToFolder = useCallback(
    async (pageId: string, folderId: string | null) => {
      const { error } = await supabase
        .from("pages")
        .update({ folder_id: folderId })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to move page to folder:", error);
        return;
      }

      setState((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === pageId ? { ...p, folder_id: folderId } : p,
        ),
      }));
    },
    [],
  );

  const movePage = useCallback(
    async (pageId: string, newParentId: string | null, targetIndex: number) => {
      if (!state.workspaceId) return;

      // Get siblings with same parent, sorted by position, excluding the moved page
      const siblings = state.pages
        .filter((p) => p.parent_id === newParentId && p.id !== pageId)
        .sort((a, b) => a.position - b.position);

      const siblingPositions = siblings.map((p) => p.position);
      const { position, needsRenumber } = computeInsertPosition(
        siblingPositions,
        targetIndex,
      );
      let newPosition = position;

      // If gap exhausted, renumber all siblings and pick the right slot
      if (needsRenumber) {
        const freshPositions = renumberPositions(siblings.length + 1);
        // Insert the moved page at targetIndex in the renumbered list
        const updates: Array<{ id: string; position: number }> = [];
        let posIdx = 0;
        for (let i = 0; i <= siblings.length; i++) {
          if (i === targetIndex) {
            newPosition = freshPositions[posIdx++];
          } else {
            const sib = siblings[i > targetIndex ? i - 1 : i];
            if (sib) {
              updates.push({ id: sib.id, position: freshPositions[posIdx++] });
            }
          }
        }
        // Batch update sibling positions
        for (const u of updates) {
          await supabase.from("pages").update({ position: u.position }).eq("id", u.id);
        }
      }

      // Optimistic update
      setState((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === pageId
            ? { ...p, parent_id: newParentId, position: newPosition }
            : p,
        ),
      }));

      // Persist the moved page
      const { error } = await supabase
        .from("pages")
        .update({ parent_id: newParentId, position: newPosition })
        .eq("id", pageId);

      if (error) {
        console.error("Failed to move page:", error);
      }
    },
    [state.pages, state.workspaceId],
  );

  // Folder CRUD
  const createFolder = useCallback(
    async (name = "Untitled folder") => {
      if (!state.workspaceId) return null;

      const maxPos = state.folders.reduce(
        (max, f) => Math.max(max, f.position),
        -1,
      );

      const { data, error } = await supabase
        .from("folders")
        .insert({
          workspace_id: state.workspaceId,
          name,
          position: maxPos + 1,
          created_by: user.id,
        })
        .select("id, name, icon, color, position")
        .single();

      if (error || !data) {
        console.error("Failed to create folder:", error);
        return null;
      }

      setState((s) => ({ ...s, folders: [...s.folders, data as FolderItem] }));
      return data as FolderItem;
    },
    [state.workspaceId, state.folders, user.id],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      const { error } = await supabase
        .from("folders")
        .update({ name })
        .eq("id", folderId);

      if (error) {
        console.error("Failed to rename folder:", error);
        return;
      }

      setState((s) => ({
        ...s,
        folders: s.folders.map((f) =>
          f.id === folderId ? { ...f, name } : f,
        ),
      }));
    },
    [],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) {
        console.error("Failed to delete folder:", error);
        return;
      }

      // Pages in this folder get folder_id = null (ON DELETE SET NULL)
      setState((s) => ({
        ...s,
        folders: s.folders.filter((f) => f.id !== folderId),
        pages: s.pages.map((p) =>
          p.folder_id === folderId ? { ...p, folder_id: null } : p,
        ),
      }));
    },
    [],
  );

  const createWorkspace = useCallback(
    async (name: string) => {
      const slug =
        name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
        "-" +
        Date.now().toString(36);

      const { data: wsId, error } = await supabase.rpc("create_workspace", {
        ws_name: name,
        ws_slug: slug,
      });

      if (error || !wsId) {
        console.error("Failed to create workspace:", error);
        return null;
      }

      const newWs: WorkspaceItem = {
        workspace_id: wsId,
        role: "owner",
        name,
      };

      // Switch to the new workspace immediately
      const [pages, folders, trashPages] = await Promise.all([
        loadPages(wsId),
        loadFolders(wsId),
        loadTrashPages(wsId),
      ]);

      setState((s) => ({
        ...s,
        workspaceId: wsId,
        currentUserRole: "owner",
        workspaces: [...s.workspaces, newWs],
        pages,
        folders,
        trashPages,
      }));

      return wsId;
    },
    [],
  );

  const switchWorkspace = useCallback(
    async (targetWorkspaceId: string) => {
      const ws = state.workspaces.find((w) => w.workspace_id === targetWorkspaceId);
      if (!ws) return;

      setState((s) => ({ ...s, loading: true }));
      const [pages, folders, trashPages] = await Promise.all([
        loadPages(targetWorkspaceId),
        loadFolders(targetWorkspaceId),
        loadTrashPages(targetWorkspaceId),
      ]);
      setState((s) => ({
        ...s,
        workspaceId: targetWorkspaceId,
        currentUserRole: ws.role,
        pages,
        folders,
        trashPages,
        loading: false,
      }));
    },
    [state.workspaces],
  );

  const renameWorkspace = useCallback(
    async (name: string) => {
      if (!state.workspaceId) return;

      const { error } = await supabase
        .from("workspaces")
        .update({ name })
        .eq("id", state.workspaceId);

      if (error) {
        console.error("Failed to rename workspace:", error);
        return;
      }

      setState((s) => ({
        ...s,
        workspaces: s.workspaces.map((w) =>
          w.workspace_id === s.workspaceId ? { ...w, name } : w,
        ),
      }));
    },
    [state.workspaceId],
  );

  const deleteWorkspace = useCallback(
    async () => {
      if (!state.workspaceId) return;

      const { data, error } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", state.workspaceId)
        .select();

      if (error) {
        console.error("Failed to delete workspace:", error);
        return;
      }

      // RLS may silently block the delete — verify it actually worked
      if (!data || data.length === 0) {
        console.error("Workspace delete blocked — you may not be the owner, or the delete policy is missing. Run migration 006.");
        return;
      }

      const remaining = state.workspaces.filter(
        (w) => w.workspace_id !== state.workspaceId,
      );

      if (remaining.length > 0) {
        const next = remaining[0];
        const [pages, folders, trashPages] = await Promise.all([
          loadPages(next.workspace_id),
          loadFolders(next.workspace_id),
          loadTrashPages(next.workspace_id),
        ]);
        setState((s) => ({
          ...s,
          workspaceId: next.workspace_id,
          currentUserRole: next.role,
          workspaces: remaining,
          pages,
          folders,
          trashPages,
        }));
      } else {
        // No workspaces left — reload to create a fresh default
        initRef.current = false;
        setState({
          workspaceId: null,
          currentUserRole: null,
          workspaces: [],
          pages: [],
          folders: [],
          trashPages: [],
          loading: true,
        });
      }
    },
    [state.workspaceId, state.workspaces],
  );

  const activeWorkspace = state.workspaces.find((w) => w.workspace_id === state.workspaceId);

  return {
    workspaceId: state.workspaceId,
    currentUserRole: state.currentUserRole,
    workspaceName: activeWorkspace?.name || null,
    workspaces: state.workspaces,
    pages: state.pages,
    folders: state.folders,
    trashPages: state.trashPages,
    loading: state.loading,
    createPage,
    createDatabase,
    renamePage,
    deletePage,
    restorePage,
    permanentlyDeletePage,
    toggleFavorite,
    movePageToFolder,
    movePage,
    createFolder,
    renameFolder,
    deleteFolder,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
  };
}
