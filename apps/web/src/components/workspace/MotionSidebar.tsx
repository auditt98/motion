import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { PageItem, FolderItem } from "@/hooks/useWorkspace";
import { PageIcon } from "@/components/shared/PageIcon";
import {
  SidebarNavItem,
  Button,
  ActionMenu,
  Badge,
  type ActionMenuItem,
} from "@weave-design-system/react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TrashPanel } from "./TrashPanel";

interface MotionSidebarContentProps {
  pages: PageItem[];
  folders: FolderItem[];
  trashPages: PageItem[];
  activePageId?: string;
  activePath?: string;
  sidebarCollapsed: boolean;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onRenamePage: (id: string, title: string) => void;
  onDeletePage: (id: string) => void;
  onMovePage: (pageId: string, parentId: string | null, index: number) => void;
  onToggleFavorite: (id: string) => void;
  onMovePageToFolder: (pageId: string, folderId: string | null) => void;
  onRestorePage: (id: string) => void;
  onPermanentlyDeletePage: (id: string) => void;
  onCreateFolder: (name?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onNavigate: (path: string) => void;
  onImport?: () => void;
}

// --- Positioned context menu (measures itself to avoid viewport overflow) ---

function PositionedMenu({
  menuBtnRef,
  onClose,
  items,
}: {
  menuBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  items: ActionMenuItem[];
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden", position: "fixed", zIndex: 101 });

  useLayoutEffect(() => {
    const btnRect = menuBtnRef.current?.getBoundingClientRect();
    const menuEl = menuRef.current;
    if (!btnRect || !menuEl) return;

    const menuHeight = menuEl.offsetHeight;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const fitsBelow = spaceBelow >= menuHeight + 4;

    setStyle({
      position: "fixed",
      zIndex: 101,
      left: btnRect.right - 180,
      ...(fitsBelow
        ? { top: btnRect.bottom + 4 }
        : { top: Math.max(4, btnRect.top - menuHeight - 4) }),
      visibility: "visible",
    });
  }, [menuBtnRef]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-100" onClick={onClose} />
      <div ref={menuRef} style={style}>
        <ActionMenu items={items} />
      </div>
    </>,
    document.body,
  );
}

// --- Sortable page item ---

function SortablePageRow({
  page,
  isActive,
  folders,
  onSelect,
  onToggleFavorite,
  onMoveToFolder,
  onRename,
  onDelete,
}: {
  page: PageItem;
  isActive: boolean;
  folders: FolderItem[];
  onSelect: () => void;
  onToggleFavorite?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(page.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    isSorting,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const showDropIndicator = isOver && !isDragging && isSorting;

  function startRename() {
    setEditValue(page.title);
    setEditing(true);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== page.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  const menuItems: ActionMenuItem[] = [
    { label: "Rename", onClick: startRename },
    ...(onToggleFavorite
      ? [{ label: page.is_favorite ? "Remove from favorites" : "Add to favorites", onClick: onToggleFavorite }]
      : []),
    ...(onMoveToFolder && folders.length > 0
      ? [
          { label: "", divider: true } as ActionMenuItem,
          ...folders
            .filter((f) => f.id !== page.folder_id)
            .map((f) => ({
              label: `Move to ${f.name}`,
              onClick: () => onMoveToFolder(f.id),
            })),
          ...(page.folder_id
            ? [{ label: "Remove from folder", onClick: () => onMoveToFolder(null) }]
            : []),
        ]
      : []),
    { label: "", divider: true } as ActionMenuItem,
    {
      label: "Copy link",
      onClick: () => navigator.clipboard.writeText(`${window.location.origin}/page/${page.id}`),
    },
    { label: "Delete", onClick: onDelete, destructive: true },
  ];

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} className="px-1 py-0.5">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full px-2 py-1 text-sm rounded border outline-none"
          style={{
            borderColor: "var(--color-rust)",
            background: "var(--color-surface)",
            color: "var(--color-textPrimary)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative"
    >
      {showDropIndicator && (
        <div className="absolute top-0 left-3 right-3 h-0.5 -translate-y-1/2 rounded-full" style={{ background: "var(--color-rust)" }} />
      )}
      <div
        onClick={onSelect}
        className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
          isActive
            ? "font-medium"
            : ""
        }`}
        style={{
          background: isActive ? "var(--color-rustLight)" : undefined,
          color: isActive ? "var(--color-rust)" : "var(--color-textPrimary)",
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
        }}
      >
        <span
          {...listeners}
          className="shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
          style={{ color: "var(--color-textSecondary)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5.5" cy="3.5" r="1.5" />
            <circle cx="10.5" cy="3.5" r="1.5" />
            <circle cx="5.5" cy="8" r="1.5" />
            <circle cx="10.5" cy="8" r="1.5" />
            <circle cx="5.5" cy="12.5" r="1.5" />
            <circle cx="10.5" cy="12.5" r="1.5" />
          </svg>
        </span>
        <PageIcon icon={page.icon} pageType={page.page_type} />
        <span className="flex-1 min-w-0 wrap-break-word">{page.title}</span>
        {page.is_favorite && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-saffron)" stroke="var(--color-saffron)" strokeWidth="2" className="shrink-0 group-hover:invisible">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
      </div>

      {/* Context menu trigger */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          ref={menuBtnRef}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-0.5 rounded hover:bg-theme-surface"
          style={{ color: "var(--color-textSecondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {menuOpen && <PositionedMenu
          menuBtnRef={menuBtnRef}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
        />}
      </div>
    </div>
  );
}

// --- Droppable folder zone ---

function DroppableFolderZone({
  folderId,
  children,
}: {
  folderId: string | null;
  children: React.ReactNode;
}) {
  const droppableId = folderId ? `drop:folder:${folderId}` : "drop:unfiled";
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors rounded-sm ${isOver ? "ring-1 ring-(--color-rust)" : ""}`}
      style={{
        background: isOver ? "var(--color-rustLight)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

// --- Compact collapsible section for sidebar ---

function SidebarSection({
  title,
  count,
  icon,
  defaultOpen = false,
  children,
  onRename,
  onDelete,
}: {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderMenuBtnRef = useRef<HTMLButtonElement>(null);

  function startRename() {
    setEditValue(title);
    setEditing(true);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title && onRename) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="mb-0.5">
      <div className="group relative flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-colors"
          style={{ color: "var(--color-textSecondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          {icon}
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
              className="flex-1 px-1 py-0 text-[11px] rounded border outline-none normal-case font-normal tracking-normal"
              style={{ borderColor: "var(--color-rust)", background: "var(--color-surface)", color: "var(--color-textPrimary)" }}
            />
          ) : (
            <span className="truncate">{title}</span>
          )}
          {!editing && count !== undefined && (
            <span className="ml-auto text-[10px] normal-case font-normal rounded-full px-1.5 py-0.5 group-hover:invisible"
              style={{ background: "var(--color-surface)", color: "var(--color-textSecondary)" }}>
              {count}
            </span>
          )}
        </button>

        {/* Folder actions (rename/delete) */}
        {onRename && !editing && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              ref={folderMenuBtnRef}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-0.5 rounded hover:bg-theme-surface"
              style={{ color: "var(--color-textSecondary)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && createPortal(
              <>
                <div className="fixed inset-0 z-100" onClick={() => setMenuOpen(false)} />
                <div className="fixed z-101" style={{
                  top: (folderMenuBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: (folderMenuBtnRef.current?.getBoundingClientRect().right ?? 0) - 180,
                }}>
                  <ActionMenu items={[
                    { label: "Rename", onClick: startRename },
                    ...(onDelete ? [{ label: "Delete", onClick: () => { setMenuOpen(false); onDelete(); }, destructive: true } as ActionMenuItem] : []),
                  ]} />
                </div>
              </>,
              document.body,
            )}
          </div>
        )}
      </div>
      {open && <div className="mt-0.5 ml-1">{children}</div>}
    </div>
  );
}

// --- Main sidebar content ---

export function MotionSidebarContent({
  pages,
  folders,
  trashPages,
  activePageId,
  activePath,
  sidebarCollapsed,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onMovePage,
  onToggleFavorite,
  onMovePageToFolder,
  onRestorePage,
  onPermanentlyDeletePage,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onNavigate,
  onImport,
}: MotionSidebarContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  const favorites = pages.filter((p) => p.is_favorite);

  const unfiledPages = useMemo(
    () => pages.filter((p) => !p.parent_id && !p.folder_id).sort((a, b) => a.position - b.position),
    [pages],
  );

  const folderPages = useMemo(() => {
    const map: Record<string, PageItem[]> = {};
    for (const f of folders) map[f.id] = [];
    for (const p of pages) {
      if (p.folder_id && map[p.folder_id]) map[p.folder_id].push(p);
    }
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.position - b.position);
    return map;
  }, [pages, folders]);

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, searchQuery, isSearching]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function getPageContainer(pId: string): string | null {
    const page = pages.find((p) => p.id === pId);
    return page?.folder_id ?? null;
  }

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

    if (overId.startsWith("drop:folder:")) {
      const targetFolderId = overId.replace("drop:folder:", "");
      if (getPageContainer(activeId) !== targetFolderId) {
        onMovePageToFolder(activeId, targetFolderId);
      }
      return;
    }
    if (overId === "drop:unfiled") {
      if (getPageContainer(activeId) !== null) {
        onMovePageToFolder(activeId, null);
      }
      return;
    }
    if (activeId === overId) return;
    const overContainer = getPageContainer(overId);
    const activeContainer = getPageContainer(activeId);
    if (activeContainer !== overContainer) {
      onMovePageToFolder(activeId, overContainer);
    }
    const containerPages = getContainerPages(overContainer);
    const newIndex = containerPages.findIndex((p) => p.id === overId);
    if (newIndex !== -1) {
      onMovePage(activeId, null, newIndex);
    }
  }

  const activeDragPage = activeDragId ? pages.find((p) => p.id === activeDragId) : null;

  if (sidebarCollapsed) {
    return (
      <div className="space-y-1">
        <SidebarNavItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
          label="Home"
          active={!activePageId}
          onClick={() => onNavigate("/")}
        />
        <SidebarNavItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>}
          label="Search"
          onClick={() => {
            const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(event);
          }}
        />
        <SidebarNavItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
          label="New page"
          onClick={onCreatePage}
        />
        <SidebarNavItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>}
          label="Trash"
          onClick={() => setTrashOpen(true)}
        />
        {trashOpen && (
          <TrashPanel
            pages={trashPages}
            onRestore={onRestorePage}
            onPermanentlyDelete={onPermanentlyDeletePage}
            onClose={() => setTrashOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3">
      {/* Search */}
      <div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-textSecondary)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 text-xs outline-none bg-transparent"
            style={{ color: "var(--color-textPrimary)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ color: "var(--color-textSecondary)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav links */}
      <SidebarNavItem
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
        label="Home"
        active={!activePageId}
        onClick={() => onNavigate("/")}
      />
      <SidebarNavItem
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>}
        label="Settings"
        active={activePath === "/settings"}
        onClick={() => onNavigate("/settings")}
      />
      <SidebarNavItem
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>}
        label={trashPages.length > 0 ? `Trash (${trashPages.length})` : "Trash"}
        active={trashOpen}
        onClick={() => setTrashOpen(true)}
      />
      {trashOpen && (
        <TrashPanel
          pages={trashPages}
          onRestore={onRestorePage}
          onPermanentlyDelete={onPermanentlyDeletePage}
          onClose={() => setTrashOpen(false)}
        />
      )}

      <hr style={{ borderColor: "var(--color-border)" }} className="my-1" />

      {isSearching ? (
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--color-textSecondary)" }}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </div>
          {searchResults.map((page) => (
            <SortablePageRow
              key={page.id}
              page={page}
              isActive={page.id === activePageId}
              folders={folders}
              onSelect={() => onSelectPage(page.id)}
              onToggleFavorite={() => onToggleFavorite(page.id)}
              onMoveToFolder={(fid) => onMovePageToFolder(page.id, fid)}
              onRename={(title) => onRenamePage(page.id, title)}
              onDelete={() => onDeletePage(page.id)}
            />
          ))}
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
            <SidebarSection title="Favorites" count={favorites.length} defaultOpen>
              {favorites.map((page) => (
                <SortablePageRow
                  key={page.id}
                  page={page}
                  isActive={page.id === activePageId}
                  folders={folders}
                  onSelect={() => onSelectPage(page.id)}
                  onToggleFavorite={() => onToggleFavorite(page.id)}
                  onMoveToFolder={(fid) => onMovePageToFolder(page.id, fid)}
                  onRename={(title) => onRenamePage(page.id, title)}
                  onDelete={() => onDeletePage(page.id)}
                />
              ))}
            </SidebarSection>
          )}

          {/* Folders */}
          {folders.map((folder) => {
            const pagesInFolder = folderPages[folder.id] || [];
            return (
              <SidebarSection
                key={folder.id}
                title={folder.name}
                count={pagesInFolder.length}
                defaultOpen
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={folder.color || "var(--color-forest)"} strokeWidth="2" className="shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                }
                onRename={(name) => onRenameFolder(folder.id, name)}
                onDelete={() => onDeleteFolder(folder.id)}
              >
                <DroppableFolderZone folderId={folder.id}>
                  <SortableContext items={pagesInFolder.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {pagesInFolder.map((page) => (
                      <SortablePageRow
                        key={page.id}
                        page={page}
                        isActive={page.id === activePageId}
                        folders={folders}
                        onSelect={() => onSelectPage(page.id)}
                        onToggleFavorite={() => onToggleFavorite(page.id)}
                        onMoveToFolder={(fid) => onMovePageToFolder(page.id, fid)}
                        onRename={(title) => onRenamePage(page.id, title)}
                        onDelete={() => onDeletePage(page.id)}
                      />
                    ))}
                  </SortableContext>
                  {pagesInFolder.length === 0 && (
                    <div className="px-2 py-1 text-[11px] italic" style={{ color: "var(--color-textSecondary)" }}>
                      Drop pages here
                    </div>
                  )}
                </DroppableFolderZone>
              </SidebarSection>
            );
          })}

          {/* Unfiled pages */}
          <SidebarSection title="Pages" count={unfiledPages.length} defaultOpen>
            <DroppableFolderZone folderId={null}>
              <SortableContext items={unfiledPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {unfiledPages.map((page) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    isActive={page.id === activePageId}
                    folders={folders}
                    onSelect={() => onSelectPage(page.id)}
                    onToggleFavorite={() => onToggleFavorite(page.id)}
                    onMoveToFolder={(fid) => onMovePageToFolder(page.id, fid)}
                    onRename={(title) => onRenamePage(page.id, title)}
                    onDelete={() => onDeletePage(page.id)}
                  />
                ))}
              </SortableContext>
              {unfiledPages.length === 0 && (
                <div className="px-2 py-1 text-[11px] italic" style={{ color: "var(--color-textSecondary)" }}>
                  Drop pages here
                </div>
              )}
            </DroppableFolderZone>
          </SidebarSection>

          <DragOverlay>
            {activeDragPage && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm" style={{ background: "var(--color-white)", boxShadow: "var(--shadow-2)", border: "1px solid var(--color-border)" }}>
                <PageIcon icon={activeDragPage.icon} pageType={activeDragPage.page_type} />
                <span className="truncate">{activeDragPage.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* New page / folder buttons */}
      <div className="mt-1 space-y-0.5">
        <Button variant="ghost" size="sm" onClick={onCreatePage} className="w-full justify-start"
          leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
        >
          New page
        </Button>
        <Button variant="ghost" size="sm" onClick={() => {
          const name = window.prompt("Folder name:");
          if (name?.trim()) onCreateFolder(name.trim());
        }} className="w-full justify-start"
          leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
        >
          New folder
        </Button>
        {onImport && (
          <Button variant="ghost" size="sm" onClick={onImport} className="w-full justify-start"
            leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
          >
            Import
          </Button>
        )}
      </div>
    </div>
  );
}


