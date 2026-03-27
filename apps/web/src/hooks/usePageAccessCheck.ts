import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PageAccessLevel } from "@motion/shared";

type EffectiveAccess = PageAccessLevel | "full";

interface AccessCheckResult {
  loading: boolean;
  allowed: boolean;
  accessLevel: EffectiveAccess;
}

/**
 * Lightweight hook that checks whether the current user can access a page
 * and at what level. Only relevant for human users in the web app —
 * agents with workspace-level tokens bypass page restrictions entirely.
 */
export function usePageAccessCheck(
  pageId: string | undefined,
  userId: string | undefined,
  workspaceId: string | null,
  currentUserRole: "owner" | "admin" | "member" | "guest" | null,
): AccessCheckResult {
  const [result, setResult] = useState<AccessCheckResult>({
    loading: true,
    allowed: true,
    accessLevel: "full",
  });

  useEffect(() => {
    if (!pageId || !userId || !workspaceId) {
      setResult({ loading: false, allowed: true, accessLevel: "full" });
      return;
    }

    let cancelled = false;

    async function check() {
      // 1. Check if page_permissions row exists
      const { data: perms } = await supabase
        .from("page_permissions")
        .select("is_restricted")
        .eq("page_id", pageId)
        .maybeSingle();

      if (cancelled) return;

      // No permissions row → default workspace access
      if (!perms) {
        setResult({ loading: false, allowed: true, accessLevel: "full" });
        return;
      }

      // Not restricted → full access for all workspace members
      if (!perms.is_restricted) {
        setResult({ loading: false, allowed: true, accessLevel: "full" });
        return;
      }

      // Restricted page: owners/admins always have full access
      if (currentUserRole === "owner" || currentUserRole === "admin") {
        setResult({ loading: false, allowed: true, accessLevel: "full" });
        return;
      }

      // Check if user is in the access list
      const { data: entry } = await supabase
        .from("page_access_list")
        .select("access_level")
        .eq("page_id", pageId)
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (entry) {
        setResult({
          loading: false,
          allowed: true,
          accessLevel: entry.access_level as PageAccessLevel,
        });
      } else {
        setResult({ loading: false, allowed: false, accessLevel: "view" });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [pageId, userId, workspaceId, currentUserRole]);

  return result;
}
