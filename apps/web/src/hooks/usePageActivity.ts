import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface RecentPage {
  page_id: string;
  title: string;
  icon: string | null;
  last_visited: string;
}

export interface AgentActivityItem {
  id: string;
  page_id: string;
  page_title: string;
  actor_name: string | null;
  created_at: string;
}

const VISIT_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export function usePageActivity(workspaceId: string | null, userId: string | null) {
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const lastVisitRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!workspaceId || !userId) return;
    let cancelled = false;

    async function load() {
      const [recentResult, agentResult] = await Promise.all([
        // Recent pages: latest views by this user, deduped by page_id
        supabase
          .from("page_activity")
          .select("page_id, created_at, page:pages(title, icon, deleted_at)")
          .eq("workspace_id", workspaceId!)
          .eq("user_id", userId!)
          .eq("activity_type", "view")
          .order("created_at", { ascending: false })
          .limit(50),

        // Agent activity: recent agent edits
        supabase
          .from("page_activity")
          .select("id, page_id, actor_name, created_at, page:pages(title)")
          .eq("workspace_id", workspaceId!)
          .eq("actor_type", "agent")
          .eq("activity_type", "edit")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      // Dedupe recent pages by page_id (keep most recent)
      const seen = new Set<string>();
      const dedupedRecent: RecentPage[] = [];
      for (const row of recentResult.data || []) {
        if (seen.has(row.page_id)) continue;
        seen.add(row.page_id);
        const page = row.page as any;
        if (!page || page.deleted_at) continue;
        dedupedRecent.push({
          page_id: row.page_id,
          title: page.title || "Untitled",
          icon: page.icon || null,
          last_visited: row.created_at,
        });
        if (dedupedRecent.length >= 8) break;
      }
      setRecentPages(dedupedRecent);

      // Agent activity
      const agentItems: AgentActivityItem[] = [];
      for (const row of agentResult.data || []) {
        const page = row.page as any;
        agentItems.push({
          id: row.id,
          page_id: row.page_id,
          page_title: page?.title || "Untitled",
          actor_name: row.actor_name,
          created_at: row.created_at,
        });
      }
      setAgentActivity(agentItems);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId, userId]);

  const recordVisit = useCallback(
    async (pageId: string) => {
      if (!workspaceId || !userId) return;

      // Client-side throttle: skip if visited same page within 5 minutes
      const now = Date.now();
      const lastVisit = lastVisitRef.current[pageId] || 0;
      if (now - lastVisit < VISIT_THROTTLE_MS) return;
      lastVisitRef.current[pageId] = now;

      const { error } = await supabase
        .from("page_activity")
        .insert({
          page_id: pageId,
          workspace_id: workspaceId,
          user_id: userId,
          activity_type: "view",
          actor_type: "human",
        });

      if (error) {
        console.error("Failed to record page visit:", error);
      }
    },
    [workspaceId, userId],
  );

  const refresh = useCallback(async () => {
    if (!workspaceId || !userId) return;

    const { data } = await supabase
      .from("page_activity")
      .select("page_id, created_at, page:pages(title, icon, deleted_at)")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("activity_type", "view")
      .order("created_at", { ascending: false })
      .limit(50);

    const seen = new Set<string>();
    const dedupedRecent: RecentPage[] = [];
    for (const row of data || []) {
      if (seen.has(row.page_id)) continue;
      seen.add(row.page_id);
      const page = row.page as any;
      if (!page || page.deleted_at) continue;
      dedupedRecent.push({
        page_id: row.page_id,
        title: page.title || "Untitled",
        icon: page.icon || null,
        last_visited: row.created_at,
      });
      if (dedupedRecent.length >= 8) break;
    }
    setRecentPages(dedupedRecent);
  }, [workspaceId, userId]);

  return { recentPages, agentActivity, loading, recordVisit, refresh };
}
