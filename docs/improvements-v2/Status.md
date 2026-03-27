# Improvements v2 — Status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 01 | Table of Contents | Done | TOC sidebar (left panel), click-to-scroll, active section tracking, localStorage persistence, `read_outline` MCP tool |
| 02 | Document Permissions & Public Sharing | Done | Per-page permissions (additive model), public sharing via /p/:slug, restricted access with per-user access levels, read-only public viewer, MCP permission endpoints |
| 03 | Import (Notion, Google Docs, Markdown) | Done | ImportModal with 4 format tabs (Markdown, HTML, Notion ZIP, DOCX), drag-and-drop file picker, markdown-it + task list support, Notion ZIP extraction via JSZip, DOCX via mammoth, Zustand import store for content injection, Import buttons in Dashboard + Sidebar |
| 05 | Database / Structured Dataview | Done | Database page type, table view with 8 column types, inline editing, sort/filter, MCP tools, real-time sync, inline database blocks via /database slash command |
| 06 | Dark Mode | Done | Dark theme CSS variables, useTheme hook (light/dark/system), sidebar toggle, flash prevention, 61+ hex values replaced in index.css, ~99 Tailwind gray classes replaced across 15 components |
| 07 | ESLint Config | Done | ESLint 9 flat config, TypeScript + React hooks rules, VS Code integration, 0 errors / 52 warnings (intentional) |
| 09 | Responsive / Mobile | Done | 3 breakpoints (mobile <768, tablet 768-1023, desktop ≥1024), useBreakpoint hook, sidebar as overlay drawer on <1024px with swipe-to-close, bottom sheets for TOC/comments/versions, overflow menu on mobile top bar, responsive editor padding, compact presence bar, Modal-based share on mobile, touch gesture hooks, viewport meta update |
