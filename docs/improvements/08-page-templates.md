# Page Templates

## Problem

Every new page starts blank. Users have to recreate common structures (meeting notes, project briefs, weekly standups, RFCs) from scratch each time. Templates reduce friction, drive adoption, and are a natural surface for AI pre-population.

## Priority

**Sprint 8.** ~1–2 days of effort. High adoption impact.

## What to Build

### 1. Built-in template library

Ship 6–8 starter templates as ProseMirror JSON:

| Template | Content |
|----------|---------|
| **Meeting Notes** | Date, attendees, agenda, discussion, action items (task list) |
| **Project Brief** | Overview, goals, scope, timeline, team, risks |
| **Weekly Standup** | What I did, what I'm doing, blockers (per person) |
| **RFC / Technical Spec** | Problem, proposed solution, alternatives, open questions |
| **Brainstorm** | Topic, ideas (bullet list), votes, next steps |
| **Bug Report** | Summary, steps to reproduce, expected vs actual, screenshots |
| **Empty** | Blank page (current default) |

Store as JSON files in `apps/web/src/templates/` or as constants in a `templates.ts` file.

### 2. Template picker UI

When creating a new page, show a template selection modal:

- Grid of template cards with title, icon, and brief description
- Click a template → creates a new page pre-populated with that template's content
- "Blank page" is always the first option (preserves current behavior)
- Optional: "Use last template" shortcut

Trigger points:
- "New page" button in sidebar → opens template picker
- "New page" on dashboard → opens template picker
- Keyboard shortcut (Cmd+N) → opens template picker

### 3. Create page with template content

Update `useWorkspace.ts` `createPage()`:

- Accept an optional `templateId` parameter
- After creating the page in Supabase, initialize the Yjs document with the template content
- Connect to the PartyKit room briefly to apply the template blocks
- Use the existing `insertPMBlockIntoFragment()` from the ProseMirror-Yjs bridge

### 4. Custom templates (stretch)

- "Save as template" option in the page context menu
- Saves current document content as a workspace-level template
- Custom templates appear alongside built-in ones in the picker
- Store in a `workspace_templates` table or as special pages with a `is_template` flag

## Files to Modify

- `apps/web/src/templates/` (new directory) — template JSON definitions
- `apps/web/src/components/workspace/TemplatePicker.tsx` (new)
- `apps/web/src/hooks/useWorkspace.ts` — update `createPage()` to accept template
- `apps/web/src/components/workspace/Sidebar.tsx` — wire "New page" to template picker
- `apps/web/src/components/workspace/Dashboard.tsx` — wire "Create page" to template picker

## Verification

1. Click "New page" → template picker appears
2. Select "Meeting Notes" → new page created with pre-filled structure
3. Select "Blank page" → creates empty page (existing behavior preserved)
4. Template content is editable immediately after creation
5. Template content syncs correctly to other peers via Yjs

## Dependencies

None. Can ship independently.
