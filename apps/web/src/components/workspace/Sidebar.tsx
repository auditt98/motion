import { useState, useRef, useEffect, useMemo } from "react";
import { APP_NAME } from "@motion/shared";
import { useNavigate, useLocation } from "react-router";
import type { User } from "@supabase/supabase-js";
import type { PageItem, WorkspaceItem, FolderItem } from "@/hooks/useWorkspace";
import { PageTree } from "./PageTree";
import { PageIcon } from "@/components/shared/PageIcon";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface SidebarProps {
  user: User;
  pages: PageItem[];
  folders: FolderItem[];
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  onSwitchWorkspace: (workspaceId: string) => void;
  onCreatePage: () => void;
  onRenamePage: (id: string, title: string) => void;
  onDeletePage: (id: string) => void;
  onMovePage: (pageId: string, parentId: string | null, index: number) => void;
  onToggleFavorite: (id: string) => void;
  onMovePageToFolder: (pageId: string, folderId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onSignOut: () => void;
  onClose: () => void;
}

// --- Persistence helpers for collapsed state ---

function getStorageKey(workspaceId: string | null, section: string) {
  return `motion-sidebar-${workspaceId || "default"}-${section}`;
}

function getSectionCollapsed(workspaceId: string | null, section: string): boolean {
  try {
    return localStorage.getItem(getStorageKey(workspaceId, section)) === "true";
  } catch {
    return false;
  }
}

function setSectionCollapsed(workspaceId: string | null, section: string, collapsed: boolean) {
  try {
    localStorage.setItem(getStorageKey(workspaceId, section), String(collapsed));
  } catch {
    // ignore
  }
}

// --- Collapsible section ---

function CollapsibleSection({
  title,
  workspaceId,
  sectionKey,
  children,
  count,
  icon,
}: {
  title: string;
  workspaceId: string | null;
  sectionKey: string;
  children: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() =>
    getSectionCollapsed(workspaceId, sectionKey),
  );

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setSectionCollapsed(workspaceId, sectionKey, next);
  }

  return (
    <div className="mb-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1 px-2 py-1 w-full text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {icon}
        <span>{title}</span>
        {count !== undefined && (
          <span className="text-gray-300 ml-auto text-[10px] normal-case">{count}</span>
        )}
      </button>
      {!collapsed && children}
    </div>
  );
}

// --- Folder section with rename/delete context menu ---

function FolderSection({
  folder,
  workspaceId,
  children,
  count,
  onRename,
  onDelete,
}: {
  folder: FolderItem;
  workspaceId: string | null;
  children: React.ReactNode;
  count: number;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const sectionKey = `folder-${folder.id}`;
  const [collapsed, setCollapsed] = useState(() =>
    getSectionCollapsed(workspaceId, sectionKey),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setSectionCollapsed(workspaceId, sectionKey, next);
  }

  function startRename() {
    setEditValue(folder.name);
    setEditing(true);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <div className="mb-2">
      <div className="group relative">
        <button
          onClick={toggle}
          onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
          className="flex items-center gap-1 px-2 py-1 w-full text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={folder.color || "#9ca3af"} strokeWidth="2" className="shrink-0">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-white border border-blue-400 rounded px-1 py-0 text-xs outline-none normal-case font-normal tracking-normal"
            />
          ) : (
            <span className="truncate">{folder.name}</span>
          )}
          {!editing && count !== undefined && (
            <span className="text-gray-300 ml-auto text-[10px] normal-case">{count}</span>
          )}
        </button>

        {/* Three-dot menu */}
        {!editing && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-300 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}

        {/* Context menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <button
                onClick={startRename}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Rename
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete folder
              </button>
            </div>
          </>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

// --- Droppable folder zone (drop target for dragging pages into folders) ---

function DroppableFolderZone({
  folderId,
  children,
}: {
  folderId: string | null; // null = "unfiled" zone
  children: React.ReactNode;
}) {
  const droppableId = folderId ? `drop:folder:${folderId}` : "drop:unfiled";
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors rounded ${isOver ? "bg-blue-50 ring-1 ring-blue-200" : ""}`}
    >
      {children}
    </div>
  );
}

// --- Main Sidebar ---

export function Sidebar({
  user,
  pages,
  folders,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onMovePage,
  onToggleFavorite,
  onMovePageToFolder,
  onRenameFolder,
  onDeleteFolder,
  onSignOut,
  onClose,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageId = location.pathname.match(/\/page\/(.+)/)?.[1];
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const favorites = pages.filter((p) => p.is_favorite);

  // Group pages by folder
  const unfiledPages = useMemo(
    () =>
      pages
        .filter((p) => !p.parent_id && !p.folder_id)
        .sort((a, b) => a.position - b.position),
    [pages],
  );

  const folderPages = useMemo(() => {
    const map: Record<string, PageItem[]> = {};
    for (const f of folders) {
      map[f.id] = [];
    }
    for (const p of pages) {
      if (p.folder_id && map[p.folder_id]) {
        map[p.folder_id].push(p);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [pages, folders]);

  // Search filtering
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, searchQuery, isSearching]);

  const displayName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "User";

  const activeWorkspace = workspaces.find((w) => w.workspace_id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name || APP_NAME;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // Helper: find which container (folder ID or null for unfiled) a page belongs to
  function getPageContainer(pId: string): string | null {
    const page = pages.find((p) => p.id === pId);
    return page?.folder_id ?? null;
  }

  // Helper: get sorted pages for a container
  function getContainerPages(containerId: string | null): PageItem[] {
    if (containerId === null) return unfiledPages;
    return folderPages[containerId] || [];
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a folder drop zone
    if (overId.startsWith("drop:folder:")) {
      const targetFolderId = overId.replace("drop:folder:", "");
      const currentFolderId = getPageContainer(activeId);
      if (currentFolderId !== targetFolderId) {
        onMovePageToFolder(activeId, targetFolderId);
      }
      return;
    }

    // Check if dropped on the "unfiled" drop zone
    if (overId === "drop:unfiled") {
      const currentFolderId = getPageContainer(activeId);
      if (currentFolderId !== null) {
        onMovePageToFolder(activeId, null);
      }
      return;
    }

    // Dropped on another page — reorder within the target page's container
    if (activeId === overId) return;

    const overContainer = getPageContainer(overId);
    const activeContainer = getPageContainer(activeId);

    if (activeContainer !== overContainer) {
      // Moving to a different container — change folder + set position
      onMovePageToFolder(activeId, overContainer);
      const containerPages = getContainerPages(overContainer);
      const newIndex = containerPages.findIndex((p) => p.id === overId);
      if (newIndex !== -1) {
        onMovePage(activeId, null, newIndex);
      }
    } else {
      // Reorder within the same container
      const containerPages = getContainerPages(activeContainer);
      const newIndex = containerPages.findIndex((p) => p.id === overId);
      if (newIndex !== -1) {
        onMovePage(activeId, null, newIndex);
      }
    }
  }

  const activeDragPage = activeDragId
    ? pages.find((p) => p.id === activeDragId)
    : null;

  // All sortable IDs across all containers (for collision detection)
  const allSortableIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of unfiledPages) ids.push(p.id);
    for (const folder of folders) {
      for (const p of folderPages[folder.id] || []) ids.push(p.id);
    }
    return ids;
  }, [unfiledPages, folders, folderPages]);

  // Close workspace menu on click outside
  useEffect(() => {
    if (!wsMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [wsMenuOpen]);

  return (
    <aside className="w-60 border-r border-gray-200 flex flex-col bg-gray-50 shrink-0">
      {/* Workspace switcher */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="relative flex-1 min-w-0" ref={wsMenuRef}>
          <button
            onClick={() => workspaces.length > 1 && setWsMenuOpen(!wsMenuOpen)}
            className={`flex items-center gap-1.5 font-semibold text-sm text-gray-700 truncate ${workspaces.length > 1 ? "hover:bg-gray-200 rounded px-1.5 py-0.5 -ml-1.5" : ""}`}
          >
            <span className="truncate">{workspaceName}</span>
            {workspaces.length > 1 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </button>

          {wsMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.workspace_id}
                  onClick={() => {
                    onSwitchWorkspace(ws.workspace_id);
                    setWsMenuOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${ws.workspace_id === activeWorkspaceId ? "text-gray-900 font-medium" : "text-gray-600"}`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.workspace_id === activeWorkspaceId && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-gray-900">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 shrink-0"
          aria-label="Close sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Inline search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 text-xs text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {isSearching ? (
          /* Search results — flat list */
          <div>
            <div className="px-2 py-1 text-xs text-gray-400">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </div>
            <PageTree
              pages={searchResults}
              activePageId={pageId}
              onSelect={(id) => navigate(`/page/${id}`)}
              onRename={onRenamePage}
              onDelete={onDeletePage}
              onToggleFavorite={onToggleFavorite}
              onMoveToFolder={onMovePageToFolder}
              folders={folders}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Favorites */}
            {favorites.length > 0 && (
              <CollapsibleSection
                title="Favorites"
                workspaceId={activeWorkspaceId}
                sectionKey="favorites"
                count={favorites.length}
              >
                <PageTree
                  pages={favorites}
                  activePageId={pageId}
                  onSelect={(id) => navigate(`/page/${id}`)}
                  onRename={onRenamePage}
                  onDelete={onDeletePage}
                  onToggleFavorite={onToggleFavorite}
                  onMoveToFolder={onMovePageToFolder}
                  folders={folders}
                />
              </CollapsibleSection>
            )}

            {/* Folders */}
            {folders.map((folder) => {
              const pagesInFolder = folderPages[folder.id] || [];
              return (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  workspaceId={activeWorkspaceId}
                  count={pagesInFolder.length}
                  onRename={(name) => onRenameFolder(folder.id, name)}
                  onDelete={() => onDeleteFolder(folder.id)}
                >
                  <DroppableFolderZone folderId={folder.id}>
                    <SortableContext
                      items={pagesInFolder.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <PageTree
                        pages={pagesInFolder}
                        activePageId={pageId}
                        onSelect={(id) => navigate(`/page/${id}`)}
                        onRename={onRenamePage}
                        onDelete={onDeletePage}
                        onToggleFavorite={onToggleFavorite}
                        onMoveToFolder={onMovePageToFolder}
                        folders={folders}
                        sortable
                      />
                    </SortableContext>
                    {pagesInFolder.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-300 italic">
                        Drop pages here
                      </div>
                    )}
                  </DroppableFolderZone>
                </FolderSection>
              );
            })}

            {/* Unfiled pages */}
            <CollapsibleSection
              title="Pages"
              workspaceId={activeWorkspaceId}
              sectionKey="pages"
              count={unfiledPages.length}
            >
              <DroppableFolderZone folderId={null}>
                <SortableContext
                  items={unfiledPages.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <PageTree
                    pages={unfiledPages}
                    activePageId={pageId}
                    onSelect={(id) => navigate(`/page/${id}`)}
                    onRename={onRenamePage}
                    onDelete={onDeletePage}
                    onToggleFavorite={onToggleFavorite}
                    onMoveToFolder={onMovePageToFolder}
                    folders={folders}
                    sortable
                  />
                </SortableContext>
                {unfiledPages.length === 0 && (
                  <div className="px-2 py-2 text-xs text-gray-300 italic">
                    Drop pages here
                  </div>
                )}
              </DroppableFolderZone>
            </CollapsibleSection>

            <DragOverlay>
              {activeDragPage && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm bg-white rounded shadow-lg border border-gray-200">
                  <PageIcon icon={activeDragPage.icon} />
                  <span className="truncate">{activeDragPage.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t border-gray-200 space-y-1">
        <button
          onClick={onCreatePage}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New page
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </button>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </button>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-gray-500 truncate">{displayName}</span>
          <button
            onClick={onSignOut}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
