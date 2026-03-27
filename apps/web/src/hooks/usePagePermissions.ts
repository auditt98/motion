import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  PagePermissions,
  PageAccessEntry,
  PageAccessLevel,
  PublicAccessLevel,
} from "@motion/shared";

export function usePagePermissions(
  pageId: string | undefined,
  workspaceId: string | null,
) {
  const [permissions, setPermissions] = useState<PagePermissions | null>(null);
  const [accessList, setAccessList] = useState<PageAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId || !workspaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      // Load page permissions row (may not exist)
      const { data: permsData } = await supabase
        .from("page_permissions")
        .select("*")
        .eq("page_id", pageId)
        .maybeSingle();

      // Load access list with user details
      const { data: accessData } = await supabase
        .from("page_access_list")
        .select("*, user:users(id, email, display_name, avatar_url)")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        setPermissions(permsData || null);
        setAccessList((accessData as PageAccessEntry[]) || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pageId, workspaceId]);

  // Upsert the page_permissions row
  const upsertPermissions = useCallback(
    async (updates: Partial<PagePermissions>) => {
      if (!pageId || !workspaceId) return null;

      const { data, error } = await supabase
        .from("page_permissions")
        .upsert(
          {
            page_id: pageId,
            workspace_id: workspaceId,
            ...updates,
          },
          { onConflict: "page_id" },
        )
        .select()
        .single();

      if (error) {
        console.error("Failed to upsert page permissions:", error);
        return null;
      }

      setPermissions(data);
      return data;
    },
    [pageId, workspaceId],
  );

  const togglePublic = useCallback(
    async (isPublic: boolean) => {
      return upsertPermissions({ is_public: isPublic });
    },
    [upsertPermissions],
  );

  const setPublicSlug = useCallback(
    async (slug: string | null) => {
      return upsertPermissions({ public_slug: slug || null });
    },
    [upsertPermissions],
  );

  const setPublicAccessLevel = useCallback(
    async (level: PublicAccessLevel) => {
      return upsertPermissions({ public_access_level: level });
    },
    [upsertPermissions],
  );

  const toggleRestricted = useCallback(
    async (isRestricted: boolean) => {
      return upsertPermissions({ is_restricted: isRestricted });
    },
    [upsertPermissions],
  );

  const addAccess = useCallback(
    async (userId: string, level: PageAccessLevel) => {
      if (!pageId) return;

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("page_access_list")
        .insert({
          page_id: pageId,
          user_id: userId,
          access_level: level,
          granted_by: userData.user?.id ?? null,
        })
        .select("*, user:users(id, email, display_name, avatar_url)")
        .single();

      if (error) {
        console.error("Failed to add page access:", error);
        return;
      }

      setAccessList((prev) => [...prev, data as PageAccessEntry]);
    },
    [pageId],
  );

  const removeAccess = useCallback(
    async (userId: string) => {
      if (!pageId) return;

      const { error } = await supabase
        .from("page_access_list")
        .delete()
        .eq("page_id", pageId)
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to remove page access:", error);
        return;
      }

      setAccessList((prev) => prev.filter((e) => e.user_id !== userId));
    },
    [pageId],
  );

  const updateAccessLevel = useCallback(
    async (userId: string, level: PageAccessLevel) => {
      if (!pageId) return;

      const { error } = await supabase
        .from("page_access_list")
        .update({ access_level: level })
        .eq("page_id", pageId)
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to update access level:", error);
        return;
      }

      setAccessList((prev) =>
        prev.map((e) =>
          e.user_id === userId ? { ...e, access_level: level } : e,
        ),
      );
    },
    [pageId],
  );

  return {
    permissions,
    accessList,
    loading,
    togglePublic,
    setPublicSlug,
    setPublicAccessLevel,
    toggleRestricted,
    addAccess,
    removeAccess,
    updateAccessLevel,
  };
}
