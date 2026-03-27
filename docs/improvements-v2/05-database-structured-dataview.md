# Database / Structured Data Views

## Problem

Documents handle unstructured content well, but teams also need structured data: project trackers, task boards, contact lists, meeting logs, inventory sheets. Currently, the only option is a basic HTML table in the editor, which has no sorting, filtering, column types, or formulas. Without structured data, Motion can't replace Notion or Airtable for teams that mix documents and databases.

## Priority

~5-7 days of effort. Large scope but high expansion impact -- opens entirely new use cases beyond document editing.

## What to Build

### 1. Database page type

Introduce a new page type: "Database." When a user creates a database, the page renders as a structured table instead of a freeform document.

A database page stores its schema and rows in the Yjs document (CRDT-synced, collaborative), not in Supabase tables. This means databases get real-time collaboration, version history, and agent editing for free.

### 2. Yjs data model for databases

Store database data in a Yjs shared type within the document:

```typescript
// Inside the Y.Doc for a database page
const dbMeta = ydoc.getMap("database_meta");    // schema, view settings
const dbRows = ydoc.getArray("database_rows");  // array of Y.Maps (one per row)

// Schema definition
dbMeta.set("columns", [
  { id: "col-1", name: "Task", type: "text", width: 200 },
  { id: "col-2", name: "Status", type: "select", options: ["Todo", "In Progress", "Done"] },
  { id: "col-3", name: "Assignee", type: "person" },
  { id: "col-4", name: "Due Date", type: "date" },
  { id: "col-5", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
  { id: "col-6", name: "Done", type: "checkbox" },
]);

// Each row is a Y.Map
// { id: "row-uuid", "col-1": "Fix login bug", "col-2": "In Progress", ... }
```

### 3. Column types

Support these column types in v1:

| Type | Render | Edit | Sort | Filter |
|------|--------|------|------|--------|
| `text` | Plain text | Inline input | Alphabetical | Contains, equals |
| `number` | Formatted number | Number input | Numeric | >, <, =, range |
| `select` | Colored badge | Dropdown | By option order | Equals, in list |
| `multi_select` | Multiple badges | Multi-select dropdown | -- | Contains any/all |
| `date` | Formatted date | Date picker | Chronological | Before, after, range |
| `checkbox` | Checkbox | Toggle | Checked first/last | Is checked |
| `person` | Avatar + name | Member picker | Alphabetical | Equals |
| `url` | Clickable link | Text input | -- | Contains |

### 4. Table view component

The primary view: a spreadsheet-like table with:

- **Column headers**: name, type icon, resize handle, sort indicator
- **Column actions menu**: rename, change type, sort asc/desc, filter, hide, delete
- **Row rendering**: one row per data entry, cells rendered by column type
- **Inline editing**: click a cell to edit in-place (text input, dropdown, date picker depending on type)
- **Add row**: "+" button at the bottom, or Enter from last row
- **Add column**: "+" button at the right
- **Row selection**: checkbox column on the left for bulk actions (delete, move)
- **Sorting**: click column header to sort, multi-column sort via dropdown
- **Filtering**: filter bar above the table, one filter per column, combinable with AND

### 5. View options

Store view configuration in `dbMeta`:

- **Sort**: `[{ columnId, direction: 'asc' | 'desc' }]`
- **Filters**: `[{ columnId, operator, value }]`
- **Hidden columns**: `string[]` of column IDs
- **Column order**: `string[]` of column IDs (drag to reorder)
- **Column widths**: `Record<string, number>`

Views are per-user (stored in localStorage) in v1. Named views (shared) in v2.

### 6. Board view (stretch - v2)

A Kanban board grouped by a select column:

- Columns represent select options (e.g., "Todo", "In Progress", "Done")
- Cards show row data (configurable: which fields to display)
- Drag cards between columns to update the select value
- Same data source as table view -- just a different rendering

### 7. Creating a database

**From Dashboard:**
- "New database" button next to "New page" and "New folder"
- Opens a template picker: "Blank database", "Project tracker", "Meeting log", "Bug tracker"

**From Editor (inline database):**
- Slash command: `/database` inserts an inline database block within a document page
- Renders as a mini-table within the document flow
- Full database features but embedded in a larger document

**Page metadata:**
- Add `page_type` field to the `pages` table: `'document'` (default) or `'database'`
- Sidebar shows database pages with a grid icon instead of the document icon

### 8. MCP server tools for databases

Add tools so AI agents can read and manipulate databases:

- `read_database_schema` -- returns column definitions
- `read_database_rows` -- returns rows (with pagination, filter support)
- `insert_row` -- add a new row with column values
- `update_row` -- modify specific cells
- `delete_row` -- remove a row
- `add_column` -- add a new column with type
- `update_column` -- rename or change column type

## Files to Modify

- `supabase/migrations/016_page_type.sql` (new) -- add `page_type` to pages table
- `packages/shared/src/types.ts` -- add database types (Column, Row, DatabaseMeta, ColumnType)
- `packages/editor-extensions/src/extensions.ts` -- add inline database node (stretch)
- `apps/web/src/components/database/DatabasePage.tsx` (new) -- main database view
- `apps/web/src/components/database/TableView.tsx` (new) -- table rendering
- `apps/web/src/components/database/ColumnHeader.tsx` (new) -- column header with actions
- `apps/web/src/components/database/CellRenderer.tsx` (new) -- cell rendering by type
- `apps/web/src/components/database/CellEditor.tsx` (new) -- cell editing by type
- `apps/web/src/components/database/FilterBar.tsx` (new) -- filter UI
- `apps/web/src/components/database/DatabaseTemplates.tsx` (new) -- starter templates
- `apps/web/src/hooks/useDatabase.ts` (new) -- Yjs-backed database state management
- `apps/web/src/App.tsx` -- route database pages to DatabasePage
- `apps/web/src/components/workspace/MotionSidebar.tsx` -- database icon for database pages
- `apps/web/src/components/workspace/Dashboard.tsx` -- "New database" button
- `apps/mcp-server/src/tools.ts` -- database MCP tools
- `apps/mcp-server/src/yjs-peer.ts` -- database read/write methods

## Verification

1. Create a new database -> table view renders with default columns
2. Add a row -> row appears, editable inline
3. Add columns of different types (text, select, date, checkbox) -> renders correctly
4. Sort by column -> rows reorder
5. Filter by column -> matching rows shown
6. Resize columns -> widths persist
7. Real-time collaboration: User A adds a row -> User B sees it appear
8. Version history works on database pages -> can restore previous state
9. AI agent uses MCP tools to read/write database rows
10. (Stretch) Board view: drag card between columns -> select value updates

## Dependencies

- Relies on existing Yjs infrastructure (PartyKit sync, IndexedDB persistence)
- Benefits from page templates (spec 08) for database starter templates
- Migration numbering may need adjustment based on what ships first
