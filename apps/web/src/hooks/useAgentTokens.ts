import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { AgentToken } from "@motion/shared";

export function useAgentTokens(workspaceId: string | null) {
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("workspace_agent_tokens")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error("Failed to load agent tokens:", error);
        setTokens(data || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const createToken = useCallback(
    async (name: string) => {
      if (!workspaceId) return null;

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("workspace_agent_tokens")
        .insert({
          workspace_id: workspaceId,
          name,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create agent token:", error);
        return null;
      }

      setTokens((prev) => [data, ...prev]);
      return data as AgentToken;
    },
    [workspaceId],
  );

  const revokeToken = useCallback(
    async (tokenId: string) => {
      const { error } = await supabase
        .from("workspace_agent_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", tokenId);

      if (error) {
        console.error("Failed to revoke agent token:", error);
        return;
      }

      setTokens((prev) =>
        prev.map((t) =>
          t.id === tokenId ? { ...t, revoked_at: new Date().toISOString() } : t,
        ),
      );
    },
    [],
  );

  const deleteToken = useCallback(
    async (tokenId: string) => {
      const { error } = await supabase
        .from("workspace_agent_tokens")
        .delete()
        .eq("id", tokenId);

      if (error) {
        console.error("Failed to delete agent token:", error);
        return;
      }

      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    },
    [],
  );

  return { tokens, loading, createToken, revokeToken, deleteToken };
}
