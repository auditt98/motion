import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FolderItem } from "@/hooks/useWorkspace";
import { PageIcon } from "@/components/shared/PageIcon";

interface Page {
  id: string;
  title: string;
  icon: string | null;
  is_favorite?: boolean;
  folder_id?: string | null;
}

interface PageTreeProps {
  pages: Page[];
  activePageId?: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onMoveToFolder?: (pageId: string, folderId: string | null) => void;
  folders?: FolderItem[];
  sortable?: boolean;
}

function SortablePageItem({
  page,
  isActive,
  isEditing,
  editValue,
  onEditChange,
  onEditBlur,
  onEditKeyDown,
  inputRef,
  onSelect,
  menuId,
  onMenuToggle,
  onStartRename,
  onDelete,
  onToggleFavorite,
  onMoveToFolder,
  folders,
  sortable,
}: {
  page: Page;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onEditBlur: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  menuId: string | null;
  onMenuToggle: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onToggleFavorite?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  folders?: FolderItem[];
  sortable?: boolean;
}) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative"
      onContextMenu={(e) => {
        e.preventDefault();
        onMenuToggle();
      }}
    >
      <button
        onClick={() => !isEditing && onSelect()}
        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded text-left transition-colors ${
          isActive
            ? "bg-theme-surface text-theme-primary font-medium"
            : "text-theme-primary hover:bg-(--color-surface)"
        }`}
      >
        {/* Drag handle */}
        {sortable && (
          <span
            {...listeners}
            className="shrink-0 cursor-grab text-theme-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:text-theme-primary active:cursor-grabbing"
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
        )}
        <PageIcon icon={page.icon} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditBlur}
            onKeyDown={onEditKeyDown}
            className="flex-1 bg-theme border border-blue-400 rounded px-1 py-0 text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{page.title}</span>
        )}
      </button>

      {/* Three-dot menu button */}
      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-(--color-border) text-theme-secondary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      )}

      {/* Context menu */}
      {menuId === page.id && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => { onMenuToggle(); setShowFolderMenu(false); }}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 bg-theme rounded-lg shadow-lg border border-theme py-1">
            <button
              onClick={onStartRename}
              className="w-full text-left px-3 py-1.5 text-sm text-theme-primary hover:bg-(--color-surface)"
            >
              Rename
            </button>
            {onToggleFavorite && (
              <button
                onClick={() => {
                  onToggleFavorite();
                  onMenuToggle();
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-theme-primary hover:bg-(--color-surface)"
              >
                {page.is_favorite ? "Remove from favorites" : "Add to favorites"}
              </button>
            )}
            {onMoveToFolder && folders && folders.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowFolderMenu(!showFolderMenu)}
                  className="w-full text-left px-3 py-1.5 text-sm text-theme-primary hover:bg-(--color-surface) flex items-center justify-between"
                >
                  Move to folder
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                {showFolderMenu && (
                  <div className="absolute left-full top-0 ml-1 w-40 bg-theme rounded-lg shadow-lg border border-theme py-1">
                    {page.folder_id && (
                      <button
                        onClick={() => {
                          onMoveToFolder(null);
                          onMenuToggle();
                          setShowFolderMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-theme-secondary hover:bg-(--color-surface) italic"
                      >
                        No folder
                      </button>
                    )}
                    {folders
                      .filter((f) => f.id !== page.folder_id)
                      .map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            onMoveToFolder(f.id);
                            onMenuToggle();
                            setShowFolderMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-theme-primary hover:bg-(--color-surface) flex items-center gap-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={f.color || "#6b7280"} strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => {
                const url = `${window.location.origin}/page/${page.id}`;
                navigator.clipboard.writeText(url);
                onMenuToggle();
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-theme-primary hover:bg-(--color-surface)"
            >
              Copy link
            </button>
            <div className="border-t border-theme my-1" />
            <button
              onClick={() => {
                onMenuToggle();
                onDelete();
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PageTree({
  pages,
  activePageId,
  onSelect,
  onRename,
  onDelete,
  onToggleFavorite,
  onMoveToFolder,
  folders,
  sortable = false,
}: PageTreeProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRename(page: Page) {
    setEditingId(page.id);
    setEditValue(page.title);
    setMenuId(null);
  }

  function commitRename(pageId: string) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== pages.find((p) => p.id === pageId)?.title) {
      onRename(pageId, trimmed);
    }
    setEditingId(null);
  }

  return (
    <nav className="space-y-0.5">
      {pages.map((page) => (
        <SortablePageItem
          key={page.id}
          page={page}
          isActive={page.id === activePageId}
          isEditing={page.id === editingId}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditBlur={() => commitRename(page.id)}
          onEditKeyDown={(e) => {
            if (e.key === "Enter") commitRename(page.id);
            if (e.key === "Escape") setEditingId(null);
          }}
          inputRef={inputRef}
          onSelect={() => onSelect(page.id)}
          menuId={menuId}
          onMenuToggle={() => setMenuId(menuId === page.id ? null : page.id)}
          onStartRename={() => startRename(page)}
          onDelete={() => onDelete(page.id)}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(page.id) : undefined}
          onMoveToFolder={onMoveToFolder ? (fid) => onMoveToFolder(page.id, fid) : undefined}
          folders={folders}
          sortable={sortable}
        />
      ))}
    </nav>
  );
}
