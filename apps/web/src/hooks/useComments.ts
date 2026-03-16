import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CommentThread,
  CommentWithAuthor,
  CommentThreadWithComments,
} from "@motion/shared";

export function useComments(pageId: string | null, workspaceId: string | null) {
  const [threads, setThreads] = useState<CommentThreadWithComments[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    if (!pageId) return;

    const { data: threadRows, error: tErr } = await supabase
      .from("comment_threads")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: true });

    if (tErr) {
      console.error("Failed to load comment threads:", tErr);
      setLoading(false);
      return;
    }

    if (!threadRows || threadRows.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const threadIds = threadRows.map((t: CommentThread) => t.id);

    const { data: commentRows, error: cErr } = await supabase
      .from("comments")
      .select("*, author:users(id, email, display_name, avatar_url)")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    if (cErr) {
      console.error("Failed to load comments:", cErr);
      setLoading(false);
      return;
    }

    const commentsByThread = new Map<string, CommentWithAuthor[]>();
    for (const c of commentRows || []) {
      const list = commentsByThread.get(c.thread_id) || [];
      list.push(c as CommentWithAuthor);
      commentsByThread.set(c.thread_id, list);
    }

    const result: CommentThreadWithComments[] = threadRows.map(
      (t: CommentThread) => ({
        ...t,
        comments: commentsByThread.get(t.id) || [],
      }),
    );

    setThreads(result);
    setLoading(false);
  }, [pageId]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!pageId) return;

    loadThreads();

    const channel = supabase
      .channel(`comments-${pageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comment_threads",
          filter: `page_id=eq.${pageId}`,
        },
        () => {
          loadThreads();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        (payload) => {
          // Only reload if the comment belongs to a thread on this page
          const threadId =
            (payload.new as any)?.thread_id ||
            (payload.old as any)?.thread_id;
          if (threadId) {
            loadThreads();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, loadThreads]);

  const createThread = useCallback(
    async (
      userId: string,
      body: string,
      mentions: string[] = [],
    ): Promise<string | null> => {
      if (!pageId || !workspaceId) return null;

      const { data: thread, error: tErr } = await supabase
        .from("comment_threads")
        .insert({
          page_id: pageId,
          workspace_id: workspaceId,
          created_by: userId,
        })
        .select()
        .single();

      if (tErr || !thread) {
        console.error("Failed to create comment thread:", tErr);
        return null;
      }

      const { error: cErr } = await supabase.from("comments").insert({
        thread_id: thread.id,
        author_id: userId,
        body,
        mentions,
      });

      if (cErr) {
        console.error("Failed to create comment:", cErr);
        return null;
      }

      // Eagerly reload so the sidebar updates immediately
      await loadThreads();
      return thread.id;
    },
    [pageId, workspaceId, loadThreads],
  );

  const addReply = useCallback(
    async (
      threadId: string,
      userId: string,
      body: string,
      mentions: string[] = [],
    ) => {
      const { error } = await supabase.from("comments").insert({
        thread_id: threadId,
        author_id: userId,
        body,
        mentions,
      });

      if (error) {
        console.error("Failed to add reply:", error);
      }
      await loadThreads();
    },
    [loadThreads],
  );

  const resolveThread = useCallback(
    async (threadId: string, userId: string) => {
      const { error } = await supabase
        .from("comment_threads")
        .update({
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", threadId);

      if (error) {
        console.error("Failed to resolve thread:", error);
      }
      await loadThreads();
    },
    [loadThreads],
  );

  const reopenThread = useCallback(async (threadId: string) => {
    const { error } = await supabase
      .from("comment_threads")
      .update({
        is_resolved: false,
        resolved_by: null,
        resolved_at: null,
      })
      .eq("id", threadId);

    if (error) {
      console.error("Failed to reopen thread:", error);
    }
    await loadThreads();
  }, [loadThreads]);

  const deleteComment = useCallback(async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Failed to delete comment:", error);
    }
    await loadThreads();
  }, [loadThreads]);

  return {
    threads,
    loading,
    createThread,
    addReply,
    resolveThread,
    reopenThread,
    deleteComment,
  };
}
