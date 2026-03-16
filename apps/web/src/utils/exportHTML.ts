import type { Editor } from "@tiptap/react";
import { downloadFile } from "./download";

function buildHTMLDocument(title: string, bodyHTML: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    color: #1a1a1a;
  }
  h1 { font-size: 2em; margin: 1em 0 0.5em; }
  h2 { font-size: 1.5em; margin: 1em 0 0.5em; }
  h3 { font-size: 1.25em; margin: 1em 0 0.5em; }
  pre {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.9em;
  }
  code {
    background: #f0f0f0;
    padding: 0.15em 0.3em;
    border-radius: 3px;
    font-size: 0.9em;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid #ddd;
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #555;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 0.5em 0.75em;
    text-align: left;
  }
  th { background: #f9f9f9; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 0.5em; }
  .callout-block {
    background: #f0f7ff;
    border-left: 4px solid #3b82f6;
    padding: 0.75em 1em;
    border-radius: 0 6px 6px 0;
    margin: 1em 0;
  }
  .callout-block.warning { background: #fffbeb; border-color: #f59e0b; }
  .callout-block.error { background: #fef2f2; border-color: #ef4444; }
  .callout-block.success { background: #f0fdf4; border-color: #22c55e; }
  details { margin: 1em 0; }
  details summary { cursor: pointer; font-weight: 500; }
</style>
</head>
<body>
${bodyHTML}
</body>
</html>`;
}

export function exportAsHTML(editor: Editor, title: string): void {
  const html = editor.getHTML();
  const doc = buildHTMLDocument(title, html);
  downloadFile(`${title}.html`, doc, "text/html");
}

/** Exposed for PDF export reuse */
export { buildHTMLDocument };
