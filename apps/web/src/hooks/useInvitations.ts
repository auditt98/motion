import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { WorkspaceInvitation } from "@motion/shared";

export function useInvitations(workspaceId: string | null) {
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error("Failed to load invitations:", error);
        setInvitations(data || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const sendInvitation = useCallback(
    async (email: string, role: WorkspaceInvitation["role"]) => {
      if (!workspaceId) return null;

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: workspaceId,
          email,
          role,
          invited_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to send invitation:", error);
        return { error: error.message };
      }

      setInvitations((prev) => [data, ...prev]);
      return { data };
    },
    [workspaceId],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      const { error } = await supabase
        .from("workspace_invitations")
        .update({ status: "revoked" })
        .eq("id", invitationId);

      if (error) {
        console.error("Failed to revoke invitation:", error);
        return;
      }

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },
    [],
  );

  return { invitations, loading, sendInvitation, revokeInvitation };
}
