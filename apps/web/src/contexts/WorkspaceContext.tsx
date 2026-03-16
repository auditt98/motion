import { createContext, useContext } from "react";
import type { WorkspaceMember } from "@motion/shared";

interface WorkspaceContextValue {
  workspaceId: string | null;
  currentUserRole: WorkspaceMember["role"] | null;
  workspaceName: string | null;
  renameWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: null,
  currentUserRole: null,
  workspaceName: null,
  renameWorkspace: async () => {},
  deleteWorkspace: async () => {},
});

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}
