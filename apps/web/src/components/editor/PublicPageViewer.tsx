import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useEditor, EditorContent } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import Link from "@tiptap/extension-link";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { getSchemaExtensions } from "@motion/editor-extensions";
import { HtmlEmbedNodeView } from "@/extensions/blocks/html-embed";
import { CodeBlockNodeView } from "@/extensions/blocks/code-block";
import { PARTYKIT_HOST } from "@/lib/partykit";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@weave-design-system/react";

const schemaExtensions = getSchemaExtensions();

interface PublicPageData {
  page_id: string;
  workspace_id: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
}

export function PublicPageViewer() {
  useTheme();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch public page metadata via RPC
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPage() {
      const { data, error } = await supabase.rpc("get_public_page_by_slug", {
        slug_or_id: slug,
      });

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setPageData(data[0]);
      }
      setLoading(false);
    }

    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="space-y-3 w-full max-w-2xl px-8">
          <div
            className="h-8 w-48 rounded animate-pulse"
            style={{ background: "var(--color-surface)" }}
          />
          <div
            className="h-4 w-full rounded animate-pulse"
            style={{ background: "var(--color-surface)" }}
          />
          <div
            className="h-4 w-3/4 rounded animate-pulse"
            style={{ background: "var(--color-surface)" }}
          />
        </div>
      </div>
    );
  }

  if (notFound || !pageData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-center space-y-4">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <h1
            className="text-lg font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Page not found
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            This page doesn't exist or is no longer public.
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Go to Motion
          </Button>
        </div>
      </div>
    );
  }

  return <PublicPageContent pageData={pageData} />;
}

function PublicPageContent({ pageData }: { pageData: PublicPageData }) {
  const navigate = useNavigate();

  // Set up Yjs with PartyKit (read-only, no awareness/cursors)
  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new YPartyKitProvider(
      PARTYKIT_HOST,
      pageData.page_id,
      ydoc,
      { connect: true },
    );
    return { ydoc, provider };
  }, [pageData.page_id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        ...schemaExtensions,
        Collaboration.configure({ document: ydoc }),
        Link.configure({
          openOnClick: true,
          HTMLAttributes: {
            class: "text-blue-600 underline cursor-pointer hover:text-blue-800",
          },
        }),
        HtmlEmbedNodeView,
        CodeBlockNodeView,
      ],
      editable: false,
      editorProps: {
        attributes: {
          class: "tiptap prose prose-gray max-w-none focus:outline-none",
        },
      },
    },
    [ydoc],
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <header
        className="border-b px-6 py-3 flex items-center"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {pageData.icon && (
            <span className="text-lg">{pageData.icon}</span>
          )}
          <h1
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {pageData.title}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          Made with Motion
        </Button>
      </header>

      {/* Cover image */}
      {pageData.cover_url && (
        <div className="w-full h-48 overflow-hidden">
          <img
            src={pageData.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Editor content */}
      <div className="max-w-3xl mx-auto px-8 py-12">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div
            className="animate-pulse h-32 rounded"
            style={{ background: "var(--color-surface)" }}
          />
        )}
      </div>
    </div>
  );
}
