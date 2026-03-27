import { createContext, useContext } from "react";
import type { WorkspaceMember } from "@motion/shared";

export interface WorkspaceContextItem {
  workspace_id: string;
  name: string;
  role: string;
}

interface WorkspaceContextValue {
  workspaceId: string | null;
  currentUserRole: WorkspaceMember["role"] | null;
  workspaceName: string | null;
  workspaces: WorkspaceContextItem[];
  renameWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: null,
  currentUserRole: null,
  workspaceName: null,
  workspaces: [],
  renameWorkspace: async () => {},
  deleteWorkspace: async () => {},
});

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}
