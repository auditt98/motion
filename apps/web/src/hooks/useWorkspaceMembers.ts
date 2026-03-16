import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface MemberWithUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "guest";
  created_at: string;
  user: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*, user:users(id, email, display_name, avatar_url)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        if (error) console.error("Failed to load members:", error);
        setMembers((data as MemberWithUser[]) || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const updateRole = useCallback(
    async (memberId: string, role: MemberWithUser["role"]) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role })
        .eq("id", memberId);

      if (error) {
        console.error("Failed to update role:", error);
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
      );
    },
    [],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) {
        console.error("Failed to remove member:", error);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    },
    [],
  );

  return { members, loading, updateRole, removeMember };
}
