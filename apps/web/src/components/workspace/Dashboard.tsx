import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import type { User } from "@supabase/supabase-js";
import type { PageItem, FolderItem } from "@/hooks/useWorkspace";
import type { RecentPage, AgentActivityItem } from "@/hooks/usePageActivity";
import { PageIcon } from "@/components/shared/PageIcon";
import type { MemberWithUser } from "@/hooks/useWorkspaceMembers";
import {
  Card,
  Button,
  Avatar,
  Badge,
  Tabs,
  EmptyState,
  ActivityFeed,
  SkeletonLoader,
  type ActivityItem,
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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DashboardProps {
  user: User;
  pages: PageItem[];
  folders: FolderItem[];
  recentPages: RecentPage[];
  agentActivity: AgentActivityItem[];
  members: MemberWithUser[];
  membersLoading: boolean;
  onCreatePage: (title?: string, parentId?: string | null, folderId?: string | null) => Promise<PageItem | null>;
  onCreateFolder: (name?: string) => Promise<FolderItem | null>;
  onMovePageToFolder: (pageId: string, folderId: string | null) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// --- Draggable page card ---

function DraggablePageCard({ page, onClick }: { page: PageItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <Card className="cursor-grab active:cursor-grabbing h-full">
        <Card.Content className="flex flex-col gap-2">
          <PageIcon icon={page.icon} size="lg" />
          <span className="text-sm font-medium truncate" style={{ color: "var(--color-textPrimary)" }}>{page.title}</span>
          <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>{timeAgo(page.updated_at)}</span>
        </Card.Content>
      </Card>
    </div>
  );
}

// --- Droppable folder card ---

function DroppableFolderCard({ folder, count, onClick }: { folder: FolderItem; count: number; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `drop:folder:${folder.id}` });

  return (
    <div ref={setNodeRef} onClick={onClick}>
      <Card className={`cursor-pointer h-full ${isOver ? "ring-2 ring-(--color-rust)" : ""}`}
        style={{ background: isOver ? "var(--color-rustLight)" : "var(--color-surface)" }}
      >
        <Card.Content className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={folder.color || "var(--color-forest)"} strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm font-medium truncate" style={{ color: "var(--color-textPrimary)" }}>{folder.name}</span>
          </div>
          <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
            {count} page{count !== 1 ? "s" : ""}
            {isOver && " — drop to add"}
          </span>
        </Card.Content>
      </Card>
    </div>
  );
}

// --- Main Dashboard ---

export function Dashboard({
  user,
  pages,
  folders,
  recentPages,
  agentActivity,
  members,
  membersLoading,
  onCreatePage,
  onCreateFolder,
  onMovePageToFolder,
}: DashboardProps) {
  const navigate = useNavigate();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const displayName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "User";

  const visiblePages = activeFolderId
    ? pages.filter((p) => p.folder_id === activeFolderId)
    : pages.filter((p) => !p.folder_id);

  const sortedPages = useMemo(
    () => [...visiblePages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [visiblePages],
  );

  const activeDragPage = activeDragId ? pages.find((p) => p.id === activeDragId) : null;

  function handleDragStart(event: DragStartEvent) { setActiveDragId(event.active.id as string); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith("drop:folder:")) {
      const targetFolderId = overId.replace("drop:folder:", "");
      const page = pages.find((p) => p.id === activeId);
      if (page && page.folder_id !== targetFolderId) onMovePageToFolder(activeId, targetFolderId);
      return;
    }
    if (overId === "drop:unfiled") {
      const page = pages.find((p) => p.id === activeId);
      if (page && page.folder_id !== null) onMovePageToFolder(activeId, null);
    }
  }

  async function handleCreatePage() {
    const page = await onCreatePage(undefined, null, activeFolderId);
    if (page) navigate(`/page/${page.id}`);
  }

  // Agent activity items for ActivityFeed
  const agentActivityItems: ActivityItem[] = agentActivity.map((item) => ({
    id: item.id,
    name: item.actor_name || "Agent",
    action: `edited "${item.page_title}"`,
    timestamp: timeAgo(item.created_at),
  }));

  function UnfiledDropZone() {
    const { isOver, setNodeRef } = useDroppable({ id: "drop:unfiled" });
    return (
      <div
        ref={setNodeRef}
        className={`mt-3 px-4 py-3 rounded-md border border-dashed text-xs text-center transition-colors ${isOver ? "border-(--color-rust)" : ""}`}
        style={{
          borderColor: isOver ? "var(--color-rust)" : "var(--color-border)",
          background: isOver ? "var(--color-rustLight)" : undefined,
          color: isOver ? "var(--color-rust)" : "var(--color-textSecondary)",
        }}
      >
        {isOver ? "Drop to remove from folder" : "Drag here to remove from folder"}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-textPrimary)" }}>
              {getGreeting()}, {displayName}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-textSecondary)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleCreatePage}
              leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
            >
              New page
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCreateFolder()}
              leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
            >
              New folder
            </Button>
          </div>
        </div>

        {/* Recently visited */}
        {recentPages.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-textSecondary)" }}>
              Recently visited
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentPages.map((rp) => (
                <Card key={rp.page_id} className="shrink-0 cursor-pointer"
                  onClick={() => navigate(`/page/${rp.page_id}`)}
                >
                  <Card.Content className="flex items-center gap-2 py-2 px-3">
                    <PageIcon icon={rp.icon} />
                    <span className="text-sm truncate max-w-35" style={{ color: "var(--color-textPrimary)" }}>{rp.title}</span>
                    <span className="text-xs shrink-0" style={{ color: "var(--color-textSecondary)" }}>{timeAgo(rp.last_visited)}</span>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-textSecondary)" }}>
                {activeFolderId
                  ? folders.find((f) => f.id === activeFolderId)?.name || "Folder"
                  : "Documents"}
              </h2>
              {activeFolderId && (
                <Button variant="ghost" size="sm" onClick={() => setActiveFolderId(null)}
                  leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>}
                >
                  Back
                </Button>
              )}
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {!activeFolderId && folders.map((folder) => {
                const count = pages.filter((p) => p.folder_id === folder.id).length;
                return <DroppableFolderCard key={folder.id} folder={folder} count={count} onClick={() => setActiveFolderId(folder.id)} />;
              })}

              {sortedPages.map((page) => (
                <DraggablePageCard key={page.id} page={page} onClick={() => navigate(`/page/${page.id}`)} />
              ))}

              {sortedPages.length === 0 && (!activeFolderId ? folders.length === 0 : true) && (
                <div className="col-span-full">
                  <EmptyState
                    icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-textSecondary)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M12 18v-6M9 15h6" /></svg>}
                    title="No documents yet"
                    description={activeFolderId ? "This folder is empty" : "Create your first page to get started"}
                    actionLabel="Create page"
                    onAction={handleCreatePage}
                  />
                </div>
              )}
            </div>

            {activeFolderId && activeDragId && <UnfiledDropZone />}

            <DragOverlay>
              {activeDragPage && (
                <Card className="shadow-(--shadow-3)">
                  <Card.Content className="flex items-center gap-2 py-2 px-3">
                    <PageIcon icon={activeDragPage.icon} />
                    <span className="text-sm truncate">{activeDragPage.title}</span>
                  </Card.Content>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        </section>

        {/* Team */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-textSecondary)" }}>
              Team
              {!membersLoading && <Badge variant="secondary" className="ml-2">{members.length}</Badge>}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>Manage</Button>
          </div>
          {membersLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (<SkeletonLoader key={i} shape="avatar" />))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {members.map((member) => {
                const name = member.user.display_name || member.user.email.split("@")[0];
                return (
                  <Card key={member.id} className="p-0!">
                    <Card.Content className="flex items-center gap-2 px-3 py-2">
                      <Avatar name={name} src={member.user.avatar_url || undefined} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm truncate" style={{ color: "var(--color-textPrimary)" }}>{name}</div>
                        <Badge variant={member.role === "owner" ? "primary" : member.role === "admin" ? "info" : "secondary"}>
                          {member.role}
                        </Badge>
                      </div>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Agent activity */}
        {agentActivityItems.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-textSecondary)" }}>
              Agent activity
            </h2>
            <Card>
              <Card.Content>
                <ActivityFeed items={agentActivityItems} />
              </Card.Content>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
