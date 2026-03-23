import type * as Party from "partykit/server";
import { onConnect, type YPartyKitOptions } from "y-partykit";
import * as Y from "yjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SNAPSHOT_TIMER_MS = 30 * 60 * 1000; // 30 minutes

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default class DocumentServer implements Party.Server {
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private hasChanges = false;
  private callbackCount = 0; // Track callback invocations to skip initial sync
  private ydoc: Y.Doc | null = null;
  private supabase: SupabaseClient | null = null;

  constructor(readonly room: Party.Room) {
    const url = room.env.SUPABASE_URL as string | undefined;
    const key = room.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (url && key) {
      this.supabase = createClient(url, key);
    }
  }

  // @ts-expect-error — YPartyKitOptions is used by onConnect at runtime
  readonly options: YPartyKitOptions = {
    persist: {
      mode: "snapshot",
    },
    callback: {
      handler: async (ydoc) => {
        this.ydoc = ydoc;
        this.callbackCount++;
        // Skip the first callback — it fires during initial Yjs sync
        // (loading persisted state), not from an actual user edit.
        if (this.callbackCount > 1) {
          this.hasChanges = true;
          this.resetSnapshotTimer();
        }
      },
      debounceWait: 500,
      debounceMaxWait: 1000,
    },
  };

  onConnect(conn: Party.Connection) {
    // If this is the only connection (fresh session after reload/close),
    // reset change tracking so the initial sync callback doesn't count.
    const peers = [...this.room.getConnections()];
    if (peers.length <= 1) {
      this.hasChanges = false;
      this.callbackCount = 0;
    }
    return onConnect(conn, this.room, this.options);
  }

  async onClose(_conn: Party.Connection) {
    const connections = [...this.room.getConnections()];
    if (connections.length === 0 && this.hasChanges) {
      await this.saveSnapshot("session_end");
      this.clearSnapshotTimer();
    }
  }

  async onRequest(req: Party.Request): Promise<Response> {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as {
          label?: string;
          created_by?: string;
          created_by_name?: string;
          workspace_id?: string;
        };
        await this.saveSnapshot("manual", {
          label: body.label,
          created_by: body.created_by,
          created_by_name: body.created_by_name,
          workspace_id: body.workspace_id,
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: String(err) }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  private resetSnapshotTimer() {
    this.clearSnapshotTimer();
    this.snapshotTimer = setTimeout(async () => {
      if (this.hasChanges) {
        await this.saveSnapshot("auto");
      }
    }, SNAPSHOT_TIMER_MS);
  }

  private clearSnapshotTimer() {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  private async saveSnapshot(
    triggerType: "auto" | "manual" | "session_end" | "pre_restore",
    meta?: {
      label?: string;
      created_by?: string;
      created_by_name?: string;
      workspace_id?: string;
    },
  ) {
    if (!this.ydoc || !this.supabase) return;

    const snapshot = Y.encodeStateAsUpdate(this.ydoc);
    const pageId = this.room.id;

    let workspaceId = meta?.workspace_id;
    let pageTitle = "";
    if (!workspaceId) {
      const { data } = await this.supabase
        .from("pages")
        .select("workspace_id, title")
        .eq("id", pageId)
        .single();
      workspaceId = data?.workspace_id;
      pageTitle = data?.title || "";
    } else {
      const { data } = await this.supabase
        .from("pages")
        .select("title")
        .eq("id", pageId)
        .single();
      pageTitle = data?.title || "";
    }

    if (!workspaceId) return;

    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(snapshot)),
    );

    const { error } = await this.supabase.from("page_versions").insert({
      page_id: pageId,
      workspace_id: workspaceId,
      snapshot: base64,
      created_by: meta?.created_by || null,
      created_by_name: meta?.created_by_name || null,
      actor_type: "human",
      trigger_type: triggerType,
      label: meta?.label || null,
    });

    if (error) {
      console.error("[version-history] Failed to save snapshot:", error);
    } else {
      this.hasChanges = false;
      // Update the search index (best-effort, don't block on failure)
      this.saveSearchIndex(pageId, workspaceId, pageTitle).catch((err) =>
        console.error("[search-index] Error:", err),
      );
    }
  }

  /**
   * Extract plain text from the Yjs document and UPSERT into the search index.
   */
  private async saveSearchIndex(
    pageId: string,
    workspaceId: string,
    title: string,
  ) {
    if (!this.ydoc || !this.supabase) return;

    const fragment = this.ydoc.getXmlFragment("default");
    const parts: string[] = [];
    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);
      if (child instanceof Y.XmlText) {
        parts.push(child.toString());
      } else if (child instanceof Y.XmlElement) {
        parts.push(xmlElementToText(child));
      }
    }
    const bodyText = parts.join("\n");

    const { error } = await this.supabase
      .from("page_search_index")
      .upsert(
        {
          page_id: pageId,
          workspace_id: workspaceId,
          title,
          body_text: bodyText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "page_id" },
      );

    if (error) {
      console.error("[search-index] Failed to update search index:", error);
      return;
    }

    // Trigger async embedding generation via Supabase Edge Function
    const supabaseUrl = this.room.env.SUPABASE_URL as string | undefined;
    const supabaseKey = this.room.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/functions/v1/embed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_id: pageId }),
      }).catch((err) =>
        console.error("[search-index] Failed to trigger embedding:", err),
      );
    }
  }
}

/** Recursively extract plain text from a Yjs XmlElement. */
function xmlElementToText(element: Y.XmlElement): string {
  const parts: string[] = [];
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(xmlElementToText(child));
    }
  }
  return parts.join("");
}

DocumentServer satisfies Party.Worker;
