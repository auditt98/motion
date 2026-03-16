import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { WorkspaceInviteLink } from "@motion/shared";

export function useInviteLinks(workspaceId: string | null) {
  const [links, setLinks] = useState<WorkspaceInviteLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("workspace_invite_links")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error("Failed to load invite links:", error);
        setLinks(data || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const createLink = useCallback(
    async (role: WorkspaceInviteLink["role"], maxUses?: number) => {
      if (!workspaceId) return null;

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("workspace_invite_links")
        .insert({
          workspace_id: workspaceId,
          role,
          max_uses: maxUses ?? null,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create invite link:", error);
        return null;
      }

      setLinks((prev) => [data, ...prev]);
      return data;
    },
    [workspaceId],
  );

  const toggleLink = useCallback(
    async (linkId: string, isActive: boolean) => {
      const { error } = await supabase
        .from("workspace_invite_links")
        .update({ is_active: isActive })
        .eq("id", linkId);

      if (error) {
        console.error("Failed to toggle invite link:", error);
        return;
      }

      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, is_active: isActive } : l)),
      );
    },
    [],
  );

  const deleteLink = useCallback(
    async (linkId: string) => {
      const { error } = await supabase
        .from("workspace_invite_links")
        .delete()
        .eq("id", linkId);

      if (error) {
        console.error("Failed to delete invite link:", error);
        return;
      }

      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    },
    [],
  );

  return { links, loading, createLink, toggleLink, deleteLink };
}
