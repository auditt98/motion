# Keyboard Shortcuts & Discoverability

## Problem

The editor supports keyboard shortcuts (via TipTap defaults like Cmd+B, Cmd+I) but they're completely undiscoverable. No shortcuts panel, no tooltips showing shortcuts, no onboarding. Power users expect Cmd+/ or a shortcuts overlay, and new users don't know what's available.

## Priority

**Sprint 12.** ~0.5–1 day of effort. Small but high polish impact.

## What to Build

### 1. Keyboard shortcuts overlay

A modal/panel triggered by `Cmd+/` (or `Ctrl+/`) showing all available shortcuts:

**Text Formatting:**
| Shortcut | Action |
|----------|--------|
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+U | Underline |
| Cmd+Shift+X | Strikethrough |
| Cmd+E | Inline code |
| Cmd+K | Add link |

**Blocks:**
| Shortcut | Action |
|----------|--------|
| / | Slash command menu |
| Cmd+Shift+1 | Heading 1 |
| Cmd+Shift+2 | Heading 2 |
| Cmd+Shift+3 | Heading 3 |
| Cmd+Shift+8 | Bullet list |
| Cmd+Shift+9 | Ordered list |
| Cmd+Shift+7 | Task list |
| Cmd+Shift+B | Blockquote |
| Cmd+Alt+C | Code block |

**Navigation:**
| Shortcut | Action |
|----------|--------|
| Cmd+K | Quick search (Command Palette) |
| Cmd+/ | This shortcuts panel |

### 2. Tooltip hints on toolbar buttons

Add tooltips to every toolbar button showing the keyboard shortcut:
- Hover "Bold" button → tooltip: "Bold (Cmd+B)"
- Hover "Heading 1" → tooltip: "Heading 1 (Cmd+Shift+1)"

### 3. Onboarding hint

On first visit, show a subtle bottom-right toast: "Tip: Press / for commands, Cmd+/ for all shortcuts" — dismissable, shown once (stored in localStorage).

## Files to Modify

- `apps/web/src/components/editor/KeyboardShortcuts.tsx` (new) — overlay modal
- `apps/web/src/components/editor/EditorToolbar.tsx` — add tooltips to buttons
- `apps/web/src/components/editor/EditorPage.tsx` — register Cmd+/ shortcut, onboarding toast

## Verification

1. Press Cmd+/ → shortcuts overlay appears
2. Press Escape or click outside → overlay closes
3. Hover any toolbar button → tooltip shows shortcut
4. First visit → onboarding toast appears once

## Dependencies

None. Purely UI work.
