import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router";
import { APP_NAME } from "@motion/shared";
import { createPortal } from "react-dom";
import { Routes, Route, useNavigate, useLocation } from "react-router";
import type { User } from "@supabase/supabase-js";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePageActivity } from "@/hooks/usePageActivity";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useUserProfile } from "@/hooks/useUserProfile";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import {
  Sidebar as WeaveSidebar,
  SidebarNavItem,
  Accordion,
  Button,
  Avatar,
  Badge,
  ToastProvider,
  Tooltip,
} from "@weave-design-system/react";
import { MotionSidebarContent } from "../workspace/MotionSidebar";
import { DrawerOverlay } from "../shared/DrawerOverlay";
import { CommandPalette } from "../workspace/CommandPalette";
import { Dashboard } from "../workspace/Dashboard";
import { EditorPage } from "../editor/EditorPage";
import { DatabasePage } from "../database/DatabasePage";
import { SettingsPage } from "../workspace/SettingsPage";
import { ImportModal, type ImportPage } from "../workspace/ImportModal";
import { useImportStore } from "@/utils/importStore";
import type { Theme } from "@/hooks/useTheme";

/** Routes to DatabasePage or EditorPage based on page_type */
function PageRouter({ pages }: { pages: { id: string; page_type: string }[] }) {
  const { pageId } = useParams<{ pageId: string }>();
  const page = pages.find((p) => p.id === pageId);
  if (page?.page_type === "database") {
    return <DatabasePage />;
  }
  return <EditorPage />;
}

interface AppLayoutProps {
  user: User;
  onSignOut: () => void;
  themeState: { theme: Theme; setTheme: (t: Theme) => void; resolvedTheme: string };
}

export function AppLayout({ user, onSignOut, themeState }: AppLayoutProps) {
  const { isMobileOrTablet } = useBreakpoint();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const wsBtnRef = useRef<HTMLButtonElement>(null);
  const [wsMenuPos, setWsMenuPos] = useState({ top: 0, left: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const {
    pages,
    folders,
    trashPages,
    loading,
    createPage,
    renamePage,
    deletePage,
    restorePage,
    permanentlyDeletePage,
    movePage,
    toggleFavorite,
    movePageToFolder,
    createDatabase,
    createFolder,
    renameFolder,
    deleteFolder,
    workspaceId,
    currentUserRole,
    workspaceName,
    workspaces,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspace(user);

  const { recentPages, agentActivity } = usePageActivity(workspaceId, user.id);
  const { members, loading: membersLoading } = useWorkspaceMembers(workspaceId);

  const workspaceContextValue = useMemo(
    () => ({ workspaceId, currentUserRole, workspaceName, workspaces, renameWorkspace, deleteWorkspace }),
    [workspaceId, currentUserRole, workspaceName, workspaces, renameWorkspace, deleteWorkspace],
  );

  // Close workspace menu on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    }
    if (wsMenuOpen) {
      document.addEventListener("mousedown", handleMouseDown);
      return () => document.removeEventListener("mousedown", handleMouseDown);
    }
  }, [wsMenuOpen]);

  // Auto-close sidebar on navigation for mobile/tablet
  useEffect(() => {
    if (isMobileOrTablet) {
      setSidebarCollapsed(true);
    }
  }, [location.pathname, isMobileOrTablet]);

  // Collapse sidebar when entering mobile/tablet mode
  useEffect(() => {
    if (isMobileOrTablet) {
      setSidebarCollapsed(true);
    }
  }, [isMobileOrTablet]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreatePage = useCallback(async () => {
    const page = await createPage();
    if (page) {
      navigate(`/page/${page.id}`);
    }
  }, [createPage, navigate]);

  const handleDeletePage = useCallback(async (pageId: string) => {
    await deletePage(pageId);
    if (location.pathname.includes(pageId)) {
      navigate("/");
    }
  }, [deletePage, navigate, location.pathname]);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleImportPages = useCallback(
    async (importPages: ImportPage[], folderId: string | null) => {
      if (importPages.length === 1) {
        // Single page: create, store content, navigate
        const { title, doc } = importPages[0];
        const page = await createPage(title, null, folderId);
        if (page) {
          useImportStore.getState().setPendingContent(page.id, doc);
          navigate(`/page/${page.id}`);
        }
      } else {
        // Batch: create all pages (content injection handled via Yjs in ImportModal progress)
        for (const { title, doc } of importPages) {
          const page = await createPage(title, null, folderId);
          if (page) {
            useImportStore.getState().setPendingContent(page.id, doc);
          }
        }
        // Navigate to the first imported page
        // (pages state will update via useWorkspace, user can find them in sidebar)
      }
      setImportModalOpen(false);
    },
    [createPage, navigate],
  );

  const { resolvedDisplayName: displayName } = useUserProfile(user.id, user.email);

  // No longer building commandItems — the custom CommandPalette handles search internally

  const pageId = location.pathname.match(/\/page\/(.+)/)?.[1];

  return (
    <ToastProvider>
      <WorkspaceProvider value={workspaceContextValue}>
        <div className="flex h-screen" style={{ background: "var(--color-bg)" }}>
          {isMobileOrTablet ? (
            <DrawerOverlay open={!sidebarCollapsed} onClose={() => setSidebarCollapsed(true)}>
              <WeaveSidebar
                collapsed={false}
                onCollapsedChange={() => setSidebarCollapsed(true)}
                header={
                  <div>
                    <button
                      ref={wsBtnRef}
                      onClick={() => {
                        if (!wsMenuOpen && wsBtnRef.current) {
                          const rect = wsBtnRef.current.getBoundingClientRect();
                          setWsMenuPos({ top: rect.bottom + 4, left: rect.left });
                        }
                        setWsMenuOpen(!wsMenuOpen);
                      }}
                      className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: "var(--color-rust)", color: "var(--color-white)" }}>
                        {(workspaceName || "M").charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--color-textPrimary)" }}>
                        {workspaceName || APP_NAME}
                      </span>
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-textSecondary)" }} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.427 6.427a.75.75 0 011.06-.073L8 8.574l2.513-2.22a.75.75 0 11.994 1.126l-3 2.647a.75.75 0 01-.994 0l-3-2.647a.75.75 0 01-.086-1.073z" />
                      </svg>
                    </button>
                  </div>
                }
                footer={
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1 px-2 py-1" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {(["light", "dark", "system"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => themeState.setTheme(t)}
                          className="flex items-center justify-center rounded-md px-2 py-1 text-xs transition-colors"
                          style={{
                            background: themeState.theme === t ? "var(--color-surface)" : "transparent",
                            color: themeState.theme === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                          }}
                          title={t.charAt(0).toUpperCase() + t.slice(1)}
                        >
                          {t === "light" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                          )}
                          {t === "dark" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                          )}
                          {t === "system" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
                            </svg>
                          )}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Avatar name={displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate" style={{ color: "var(--color-textSecondary)" }}>{displayName}</div>
                      </div>
                      <button
                        onClick={onSignOut}
                        className="text-xs hover:underline"
                        style={{ color: "var(--color-textSecondary)" }}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                }
              >
                <MotionSidebarContent
                  pages={pages}
                  folders={folders}
                  trashPages={trashPages}
                  activePageId={pageId}
                  activePath={location.pathname}
                  sidebarCollapsed={false}
                  onSelectPage={(id) => navigate(`/page/${id}`)}
                  onCreatePage={handleCreatePage}
                  onRenamePage={renamePage}
                  onDeletePage={handleDeletePage}
                  onMovePage={movePage}
                  onToggleFavorite={toggleFavorite}
                  onMovePageToFolder={movePageToFolder}
                  onRestorePage={restorePage}
                  onPermanentlyDeletePage={permanentlyDeletePage}
                  onCreateFolder={createFolder}
                  onRenameFolder={renameFolder}
                  onDeleteFolder={deleteFolder}
                  onNavigate={navigate}
                  onImport={() => setImportModalOpen(true)}
                />
              </WeaveSidebar>
            </DrawerOverlay>
          ) : (
          <WeaveSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            header={
              <div>
                <button
                  ref={wsBtnRef}
                  onClick={() => {
                    if (!wsMenuOpen && wsBtnRef.current) {
                      const rect = wsBtnRef.current.getBoundingClientRect();
                      setWsMenuPos({ top: rect.bottom + 4, left: rect.left });
                    }
                    setWsMenuOpen(!wsMenuOpen);
                  }}
                  className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: "var(--color-rust)", color: "var(--color-white)" }}>
                    {(workspaceName || "M").charAt(0).toUpperCase()}
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--color-textPrimary)" }}>
                        {workspaceName || APP_NAME}
                      </span>
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-textSecondary)" }} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.427 6.427a.75.75 0 011.06-.073L8 8.574l2.513-2.22a.75.75 0 11.994 1.126l-3 2.647a.75.75 0 01-.994 0l-3-2.647a.75.75 0 01-.086-1.073z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            }
            footer={
              <div className="space-y-1">
                {!sidebarCollapsed ? (
                  <>
                    <div className="flex items-center justify-center gap-1 px-2 py-1" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {(["light", "dark", "system"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => themeState.setTheme(t)}
                          className="flex items-center justify-center rounded-md px-2 py-1 text-xs transition-colors"
                          style={{
                            background: themeState.theme === t ? "var(--color-surface)" : "transparent",
                            color: themeState.theme === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                          }}
                          title={t.charAt(0).toUpperCase() + t.slice(1)}
                        >
                          {t === "light" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                          )}
                          {t === "dark" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                          )}
                          {t === "system" && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
                            </svg>
                          )}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Avatar name={displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate" style={{ color: "var(--color-textSecondary)" }}>{displayName}</div>
                      </div>
                      <button
                        onClick={onSignOut}
                        className="text-xs hover:underline"
                        style={{ color: "var(--color-textSecondary)" }}
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-center py-1">
                    <button
                      onClick={() => {
                        const modes: Theme[] = ["light", "dark", "system"];
                        const next = modes[(modes.indexOf(themeState.theme) + 1) % modes.length];
                        themeState.setTheme(next);
                      }}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: "var(--color-text-secondary)" }}
                      title={`Theme: ${themeState.theme}`}
                    >
                      {themeState.resolvedTheme === "dark" ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            }
          >
            <MotionSidebarContent
              pages={pages}
              folders={folders}
              trashPages={trashPages}
              activePageId={pageId}
              activePath={location.pathname}
              sidebarCollapsed={sidebarCollapsed}
              onSelectPage={(id) => navigate(`/page/${id}`)}
              onCreatePage={handleCreatePage}
              onRenamePage={renamePage}
              onDeletePage={handleDeletePage}
              onMovePage={movePage}
              onToggleFavorite={toggleFavorite}
              onMovePageToFolder={movePageToFolder}
              onRestorePage={restorePage}
              onPermanentlyDeletePage={permanentlyDeletePage}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onNavigate={navigate}
            />
          </WeaveSidebar>
          )}

          {wsMenuOpen && createPortal(
            <div
              ref={wsMenuRef}
              className="fixed w-52 rounded-lg shadow-lg py-1"
              style={{
                top: wsMenuPos.top,
                left: wsMenuPos.left,
                zIndex: 9999,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {workspaces.map((ws) => (
                <button
                  key={ws.workspace_id}
                  onClick={() => {
                    switchWorkspace(ws.workspace_id);
                    setWsMenuOpen(false);
                    navigate("/");
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:opacity-80"
                  style={{
                    color: "var(--color-textPrimary)",
                    background: ws.workspace_id === workspaceId ? "var(--color-bg)" : "transparent",
                  }}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.workspace_id === workspaceId && (
                    <svg className="w-4 h-4 shrink-0" style={{ color: "var(--color-rust)" }} viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="mx-2 my-1" style={{ borderTop: "1px solid var(--color-border)" }} />
              <button
                onClick={async () => {
                  const name = window.prompt("Workspace name:");
                  if (!name?.trim()) return;
                  const id = await createWorkspace(name.trim());
                  if (id) {
                    setWsMenuOpen(false);
                    navigate("/");
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:opacity-80"
                style={{ color: "var(--color-textSecondary)" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
                New workspace
              </button>
            </div>,
            document.body,
          )}

          <main className="flex-1 flex flex-col overflow-hidden">
            {isMobileOrTablet && (
              <div
                className="flex items-center gap-2 px-3 py-2 shrink-0"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <Button variant="ghost" size="sm" onClick={() => setSidebarCollapsed(false)} aria-label="Open sidebar">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 4.5h12M3 9h12M3 13.5h12" />
                  </svg>
                </Button>
                <span className="font-semibold text-sm truncate" style={{ color: "var(--color-textPrimary)" }}>
                  {workspaceName || APP_NAME}
                </span>
              </div>
            )}
            <Routes>
              <Route path="page/:pageId" element={<PageRouter pages={pages} />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  loading ? (
                    <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-textSecondary)" }}>
                      <p>Loading workspace...</p>
                    </div>
                  ) : (
                    <Dashboard
                      user={user}
                      pages={pages}
                      folders={folders}
                      recentPages={recentPages}
                      agentActivity={agentActivity}
                      members={members}
                      membersLoading={membersLoading}
                      onCreatePage={createPage}
                      onCreateDatabase={createDatabase}
                      onCreateFolder={createFolder}
                      onMovePageToFolder={movePageToFolder}
                      onImport={() => setImportModalOpen(true)}
                    />
                  )
                }
              />
            </Routes>
          </main>

          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            pages={pages}
            folders={folders}
            recentPages={recentPages}
            workspaceId={workspaceId}
          />

          <ImportModal
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            folders={folders}
            onImportPages={handleImportPages}
          />
        </div>
      </WorkspaceProvider>
    </ToastProvider>
  );
}
