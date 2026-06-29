import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router";
import * as Y from "yjs";
import { useToast } from "@weave-design-system/react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useYjsProvider } from "@/hooks/useYjsProvider";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { ShareButton } from "@/components/workspace/ShareButton";
import { PageIcon } from "@/components/shared/PageIcon";

const STARTER_HTML = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 640px; margin: 56px auto; padding: 0 20px; color: #221E18; line-height: 1.6; }
      h1 { font-size: 2.2em; margin-bottom: 0.2em; }
      p { color: #5b5347; }
    </style>
  </head>
  <body>
    <h1>Hello, artifact 👋</h1>
    <p>Edit the HTML on the left — the preview updates live.</p>
  </body>
</html>`;

type Mode = "code" | "split" | "preview";

// --- No-dependency HTML syntax highlighter (returns escaped HTML with colored spans) ---

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightTag(tag: string): string {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)(\/?)>$/.exec(tag);
  if (!m) return `<span class="hl-tag">${esc(tag)}</span>`;
  const [, slash, name, attrs, selfClose] = m;
  const attrsHtml = attrs.replace(
    /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(=)?("[^"]*"|'[^']*')?/g,
    (full, an: string, eq?: string, av?: string) => {
      if (!an && !av) return esc(full);
      let out = an ? `<span class="hl-attr">${esc(an)}</span>` : "";
      if (eq) out += `<span class="hl-punct">=</span>`;
      if (av) out += `<span class="hl-str">${esc(av)}</span>`;
      return out;
    },
  );
  return `<span class="hl-punct">&lt;${slash}</span><span class="hl-tag">${esc(name)}</span>${attrsHtml}<span class="hl-punct">${selfClose}&gt;</span>`;
}

export function highlightHtml(code: string): string {
  let out = "";
  const re = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const tok = m[0];
    if (tok.startsWith("<!--")) out += `<span class="hl-comment">${esc(tok)}</span>`;
    else if (tok[0] === "<") out += highlightTag(tok);
    else out += esc(tok);
  }
  return out;
}

// --- Minimal-diff write into a Y.Text (keeps Yjs ops small + collab-friendly) ---

function applyTextDiff(ydoc: Y.Doc, ytext: Y.Text, next: string) {
  const prev = ytext.toString();
  if (prev === next) return;
  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  ydoc.transact(() => {
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
  });
}

const codeStyle: CSSProperties = {
  margin: 0,
  padding: "16px 20px",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  lineHeight: 1.6,
  tabSize: 2,
  whiteSpace: "pre",
  wordWrap: "normal",
  overflowWrap: "normal",
  border: 0,
  boxSizing: "border-box",
};

// --- Outer: resolve route/identity, then mount a keyed inner per page ---

export function HtmlArtifactPage({ title }: { title?: string }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { user } = useAuth();
  const { resolvedDisplayName: userName } = useUserProfile(user?.id, user?.email);

  if (!pageId) {
    return <div className="p-8" style={{ color: "var(--color-textSecondary)" }}>No page selected</div>;
  }
  return <HtmlArtifactInner key={pageId} documentId={pageId} userName={userName} title={title} />;
}

function HtmlArtifactInner({ documentId, userName, title }: { documentId: string; userName: string; title?: string }) {
  const { workspaceId } = useWorkspaceContext();
  const { ydoc, idbSynced } = useYjsProvider(documentId, userName);
  const { togglePublic } = usePagePermissions(documentId, workspaceId);
  const { toast } = useToast();

  const ytext = ydoc.getText("html");
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState<Mode>("split");
  const [previewKey, setPreviewKey] = useState(0);
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep local state mirrored from the shared Y.Text (also reflects agent/peer edits).
  useEffect(() => {
    const update = () => setHtml(ytext.toString());
    update();
    ytext.observe(update);
    return () => ytext.unobserve(update);
  }, [ytext]);

  // Seed a starter template once the doc has synced and is still empty.
  useEffect(() => {
    if (idbSynced && ytext.length === 0) {
      ydoc.transact(() => ytext.insert(0, STARTER_HTML));
    }
  }, [idbSynced, ytext, ydoc]);

  function onCodeChange(value: string) {
    setHtml(value);
    applyTextDiff(ydoc, ytext, value);
  }

  function syncScroll() {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  }

  async function publish() {
    await togglePublic(true);
    const url = `${window.location.origin}/p/${documentId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* noop */
    }
    toast({ title: "Published to web", message: "Anyone with the link can view — link copied.", variant: "success" });
  }

  const showCode = mode !== "preview";
  const showPreview = mode !== "code";

  const modeBtn = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        padding: "5px 11px",
        borderRadius: 5,
        fontSize: 13,
        fontWeight: 600,
        background: mode === m ? "var(--color-surface)" : "transparent",
        color: mode === m ? "var(--color-textPrimary)" : "var(--color-textSecondary)",
        boxShadow: mode === m ? "var(--shadow-1)" : undefined,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" style={{ height: 56, padding: "0 20px", borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <div className="flex items-center" style={{ gap: 7 }}>
            <PageIcon icon={null} pageType="html" />
            <span className="text-sm font-medium truncate" style={{ color: "var(--color-textPrimary)", maxWidth: 280 }}>
              {title || "Untitled artifact"}
            </span>
          </div>
          <span
            className="inline-flex items-center"
            style={{ gap: 5, padding: "3px 8px", borderRadius: 6, background: "var(--color-gold-light)" }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: "var(--color-gold)" }}>HTML</span>
          </span>
        </div>

        <div className="flex items-center" style={{ gap: 10 }}>
          <div className="flex items-center" style={{ gap: 2, padding: 2, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
            {modeBtn("code", "Code")}
            {modeBtn("split", "Split")}
            {modeBtn("preview", "Preview")}
          </div>
          <div style={{ width: 1, height: 22, background: "var(--color-border)" }} />
          <ShareButton pageId={documentId} />
          <button
            onClick={publish}
            className="flex items-center hover:opacity-90"
            style={{ gap: 7, padding: "9px 15px", borderRadius: 6, background: "var(--color-rust)", color: "var(--color-white)", fontSize: 14, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            Publish
          </button>
        </div>
      </div>

      {/* Body: code | preview */}
      <div className="flex-1 flex overflow-hidden">
        {showCode && (
          <div className="flex flex-col overflow-hidden" style={{ flex: 1, background: "#262019", borderRight: showPreview ? "1px solid var(--color-border)" : undefined }}>
            {/* file tabs */}
            <div className="flex items-center shrink-0" style={{ height: 38, padding: "0 8px", background: "#1F1B16", gap: 4 }}>
              <span className="inline-flex items-center" style={{ gap: 7, padding: "6px 12px", borderRadius: 6, background: "#262019" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E0826B" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#E8E0D2" }}>index.html</span>
              </span>
            </div>
            {/* layered editor: highlighted <pre> behind a transparent-caret <textarea> */}
            <div className="flex-1" style={{ position: "relative", overflow: "hidden" }}>
              <pre
                ref={preRef}
                aria-hidden
                className="artifact-code"
                style={{ ...codeStyle, position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
                dangerouslySetInnerHTML={{ __html: highlightHtml(html) + "\n" }}
              />
              <textarea
                ref={taRef}
                value={html}
                spellCheck={false}
                onChange={(e) => onCodeChange(e.target.value)}
                onScroll={syncScroll}
                style={{ ...codeStyle, position: "absolute", inset: 0, overflow: "auto", background: "transparent", color: "transparent", caretColor: "#E8E0D2", resize: "none", outline: "none" }}
              />
            </div>
          </div>
        )}

        {showPreview && (
          <div className="flex flex-col overflow-hidden" style={{ flex: 1, background: "var(--color-white)" }}>
            {/* browser chrome */}
            <div className="flex items-center shrink-0" style={{ height: 38, padding: "0 13px", gap: 11, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
              <div className="flex items-center" style={{ gap: 6 }}>
                {["#E0826B", "#DAB05A", "#8FBF8A"].map((c) => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c, opacity: 0.7 }} />
                ))}
              </div>
              <div className="flex-1 truncate" style={{ padding: "3px 10px", borderRadius: 6, background: "var(--color-bg)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-textSecondary)" }}>
                preview · {title || "artifact"}
              </div>
              <button onClick={() => setPreviewKey((k) => k + 1)} title="Reload preview" style={{ color: "var(--color-textSecondary)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
            </div>
            <iframe
              key={previewKey}
              title="HTML preview"
              srcDoc={html}
              sandbox="allow-scripts allow-popups allow-forms allow-modals"
              style={{ flex: 1, width: "100%", border: 0, background: "#fff" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
