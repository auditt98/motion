import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  displayName: string | null;
  avatarUrl: string | null;
  defaultWorkspaceId: string | null;
  loading: boolean;
}

export function useUserProfile(userId: string | undefined, email?: string | undefined) {
  const [profile, setProfile] = useState<UserProfile>({
    displayName: null,
    avatarUrl: null,
    defaultWorkspaceId: null,
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("users")
        .select("display_name, avatar_url, default_workspace_id")
        .eq("id", userId)
        .single();

      if (!cancelled) {
        if (error) console.error("Failed to load user profile:", error);
        setProfile({
          displayName: data?.display_name ?? null,
          avatarUrl: data?.avatar_url ?? null,
          defaultWorkspaceId: data?.default_workspace_id ?? null,
          loading: false,
        });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!userId) return { error: "No user" };

      const trimmed = name.trim();
      const { error } = await supabase
        .from("users")
        .update({ display_name: trimmed || null })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update display name:", error);
        return { error: error.message };
      }

      setProfile((prev) => ({ ...prev, displayName: trimmed || null }));
      return { error: null };
    },
    [userId],
  );

  const updateDefaultWorkspace = useCallback(
    async (workspaceId: string | null) => {
      if (!userId) return { error: "No user" };

      const { error } = await supabase
        .from("users")
        .update({ default_workspace_id: workspaceId })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update default workspace:", error);
        return { error: error.message };
      }

      setProfile((prev) => ({ ...prev, defaultWorkspaceId: workspaceId }));
      return { error: null };
    },
    [userId],
  );

  const resolvedDisplayName =
    profile.displayName ||
    email?.split("@")[0] ||
    "User";

  return {
    ...profile,
    resolvedDisplayName,
    updateDisplayName,
    updateDefaultWorkspace,
  };
}
