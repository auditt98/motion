/**
 * Backfill script: populate page_search_index from existing page_versions.
 *
 * For each page, loads the latest Yjs snapshot, extracts plain text,
 * and upserts into page_search_index. Then triggers embedding generation
 * for each page via the embed Edge Function.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-search-index.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as Y from "yjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

async function main() {
  // Get all non-deleted pages
  const { data: pages, error: pagesErr } = await supabase
    .from("pages")
    .select("id, title, workspace_id")
    .is("deleted_at", null);

  if (pagesErr || !pages) {
    console.error("Failed to fetch pages:", pagesErr);
    process.exit(1);
  }

  console.log(`Found ${pages.length} pages to index`);

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of pages) {
    // Get the latest snapshot for this page
    const { data: versions } = await supabase
      .from("page_versions")
      .select("snapshot")
      .eq("page_id", page.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!versions || versions.length === 0) {
      skipped++;
      continue;
    }

    const base64Snapshot = versions[0].snapshot;

    try {
      // Decode base64 to Uint8Array
      const binary = Uint8Array.from(atob(base64Snapshot), (c) =>
        c.charCodeAt(0),
      );

      // Create a Yjs doc and apply the snapshot
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, binary);

      // Extract text from the document
      const fragment = ydoc.getXmlFragment("default");
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

      // Upsert into search index
      const { error: upsertErr } = await supabase
        .from("page_search_index")
        .upsert(
          {
            page_id: page.id,
            workspace_id: page.workspace_id,
            title: page.title || "",
            body_text: bodyText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "page_id" },
        );

      if (upsertErr) {
        console.error(`  Failed to index page ${page.id}:`, upsertErr.message);
        failed++;
        continue;
      }

      // Trigger embedding generation
      await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_id: page.id }),
      }).catch(() => {
        // Non-fatal: embedding will be generated on next snapshot
      });

      indexed++;
      ydoc.destroy();
    } catch (err) {
      console.error(`  Error processing page ${page.id}:`, err);
      failed++;
    }
  }

  console.log(`\nDone! Indexed: ${indexed}, Skipped (no snapshot): ${skipped}, Failed: ${failed}`);
}

main();
