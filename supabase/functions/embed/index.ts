import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

/**
 * Generate an embedding using OpenAI text-embedding-3-small.
 *
 * Two modes:
 * 1. Query mode: POST { text } → returns { embedding: number[] }
 * 2. Index mode: POST { page_id } → fetches body_text from page_search_index,
 *    generates embedding, and writes it back.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();

    // Mode 1: Generate embedding for arbitrary text (query-time)
    if (body.text) {
      const embedding = await generateEmbedding(body.text);
      return new Response(JSON.stringify({ embedding }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Mode 2: Index a page (generate + store embedding)
    if (body.page_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data, error } = await supabase
        .from("page_search_index")
        .select("title, body_text")
        .eq("page_id", body.page_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Page not found in search index" }),
          { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }

      const textToEmbed = `${data.title}\n\n${data.body_text}`.slice(0, 8000);
      const embedding = await generateEmbedding(textToEmbed);

      const { error: updateError } = await supabase
        .from("page_search_index")
        .update({ embedding })
        .eq("page_id", body.page_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(
      JSON.stringify({ error: "Provide either 'text' or 'page_id'" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}
