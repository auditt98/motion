<!-- GENERATED FILE — do not edit by hand.
     Source: packages/shared/src/skill.ts
     Regenerate: pnpm --filter @motion/shared generate:agent-docs -->

# Block format reference (ProseMirror JSON)

Every block is a ProseMirror node. Text lives in `content` as `text` nodes with optional `marks`.

## Headings & paragraphs
```json
{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] }
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Plain and " },
  { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] }
] }
```

## Marks (inline formatting)
```json
{ "type": "text", "text": "link", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] }
{ "type": "text", "text": "warn", "marks": [{ "type": "highlight", "attrs": { "color": "#fef08a" } }] }
{ "type": "text", "text": "red",  "marks": [{ "type": "textStyle", "attrs": { "color": "#dc2626" } }] }
```
Available marks: bold, italic, underline, strike, code, link (attrs: { href }), highlight (attrs: { color }), textStyle + color (attrs: { color }).

## Lists (send the whole list as one block)
```json
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First" }] }] },
  { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second" }] }] }
] }
```
Task lists use `taskList` → `taskItem` (`attrs: { checked: boolean }`).

## Code, quote, callout, toggle
```json
{ "type": "codeBlock", "attrs": { "language": "ts" }, "content": [{ "type": "text", "text": "const x = 1;" }] }
{ "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Quoted" }] }] }
{ "type": "callout", "attrs": { "variant": "info", "emoji": "ℹ️" }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Note" }] }] }
{ "type": "toggle", "attrs": { "summary": "Details", "open": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Hidden" }] }] }
```

## Media & embeds
```json
{ "type": "image", "attrs": { "src": "https://…", "alt": "Diagram" } }
{ "type": "htmlEmbed", "attrs": { "htmlContent": "<iframe …></iframe>", "height": 400 } }
{ "type": "horizontalRule" }
```
