import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/** A scoped, expiring OAuth grant for an AI agent (replaces static workspace tokens). */
export interface AgentGrant {
  id: string;
  agent_name: string;
  scope_type: "workspace" | "folder" | "page";
  scope_target_id: string | null;
  role: "viewer" | "commenter" | "editor";
  mode: "suggest" | "direct";
  status: "pending" | "active" | "revoked";
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  client_id: string | null;
  created_at: string;
}

export function useAgentGrants(workspaceId: string | null) {
  const [grants, setGrants] = useState<AgentGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("agent_grants")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Failed to load agent grants:", error);
        setGrants((data as AgentGrant[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const revokeGrant = useCallback(async (grantId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("agent_grants")
      .update({ status: "revoked", revoked_at: now })
      .eq("id", grantId);
    if (error) {
      console.error("Failed to revoke grant:", error);
      return;
    }
    setGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, status: "revoked", revoked_at: now } : g)),
    );
  }, []);

  return { grants, loading, revokeGrant };
}
