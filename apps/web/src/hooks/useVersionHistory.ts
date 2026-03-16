import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { PARTYKIT_HOST } from "@/lib/partykit";
import type { PageVersion } from "@motion/shared";

function getPartykitUrl(pageId: string) {
  const protocol = PARTYKIT_HOST.includes("localhost") ? "http" : "https";
  return `${protocol}://${PARTYKIT_HOST}/parties/main/${pageId}`;
}

export function useVersionHistory(
  pageId: string | null,
  workspaceId: string | null,
  opts?: { userId?: string; userName?: string },
) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVersions = useCallback(async () => {
    if (!pageId) return;

    const { data, error } = await supabase
      .from("page_versions")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load versions:", error);
      setLoading(false);
      return;
    }

    setVersions((data as PageVersion[]) || []);
    setLoading(false);
  }, [pageId]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!pageId) return;

    loadVersions();

    const channel = supabase
      .channel(`versions-${pageId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "page_versions",
          filter: `page_id=eq.${pageId}`,
        },
        () => {
          loadVersions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, loadVersions]);

  /** Trigger a manual "Save version" via the PartyKit HTTP endpoint */
  const saveVersion = useCallback(
    async (opts?: {
      label?: string;
      userId?: string;
      userName?: string;
    }) => {
      if (!pageId) return;

      const protocol = PARTYKIT_HOST.includes("localhost") ? "http" : "https";
      const url = `${protocol}://${PARTYKIT_HOST}/parties/main/${pageId}`;

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: opts?.label,
          created_by: opts?.userId,
          created_by_name: opts?.userName,
          workspace_id: workspaceId,
        }),
      });
    },
    [pageId, workspaceId],
  );

  /** Fetch the Yjs snapshot bytes for a specific version */
  const getSnapshot = useCallback(
    async (versionId: string): Promise<Uint8Array | null> => {
      const { data, error } = await supabase
        .from("page_versions")
        .select("snapshot")
        .eq("id", versionId)
        .single();

      if (error || !data?.snapshot) return null;

      // Decode base64 → Uint8Array
      const binary = atob(data.snapshot);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },
    [],
  );

  /** Update the label on a version */
  const labelVersion = useCallback(
    async (versionId: string, label: string | null) => {
      const { error } = await supabase
        .from("page_versions")
        .update({ label })
        .eq("id", versionId);

      if (error) {
        console.error("Failed to update version label:", error);
        return;
      }
      await loadVersions();
    },
    [loadVersions],
  );

  return {
    versions,
    loading,
    saveVersion,
    getSnapshot,
    labelVersion,
  };
}
