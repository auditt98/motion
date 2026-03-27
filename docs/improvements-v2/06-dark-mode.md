# Dark Mode

## Problem

Motion has no dark mode. Users who work in low-light environments or prefer dark interfaces are stuck with the light theme. The Weave design system uses CSS custom properties (`--color-bg`, `--color-surface`, etc.) which is the right foundation, but the editor styles in `index.css` have ~40+ hardcoded hex values that bypass the theming system. This means even if we add dark CSS variable values, much of the UI won't respond.

## Priority

~2-3 days of effort. Medium scope -- mostly CSS variable audit and dark value definitions.

## What to Build

### 1. Define dark theme CSS variables

Create a dark theme by defining alternate values for all `--color-*` tokens. Add to `apps/web/src/index.css` (or a dedicated `dark-theme.css`):

```css
[data-theme="dark"] {
  --color-bg: #0f0f0f;
  --color-surface: #1a1a1a;
  --color-border: #2e2e2e;
  --color-textPrimary: #e5e5e5;
  --color-textSecondary: #9ca3af;
  --color-rust: #e8614d;       /* slightly lighter for contrast on dark */
  --color-rustLight: #3d1f1a;
  --color-forest: #4ade80;
  --color-gray-400: #6b7280;
  --color-white: #ffffff;
}
```

The exact values should be tuned visually, but the key principle is: backgrounds go dark, text goes light, accents stay recognizable.

### 2. Audit and replace hardcoded hex values

The following hardcoded colors in `apps/web/src/index.css` must be replaced with CSS variables:

| Current hardcoded | Replace with | Context |
|-------------------|-------------|---------|
| `#fff`, `#f3f4f6` | `var(--color-bg)` or `var(--color-surface)` | Backgrounds |
| `#111827`, `#374151`, `#4b5563` | `var(--color-textPrimary)` | Text colors |
| `#9ca3af`, `#6b7280` | `var(--color-textSecondary)` | Muted text |
| `#e5e7eb`, `#d1d5db` | `var(--color-border)` | Borders |
| `#f9fafb` | `var(--color-surface)` | Surface backgrounds |

**Callout block colors** need dark variants:
```css
[data-theme="dark"] .callout-block.info    { background: #1e293b; border-left-color: #60a5fa; }
[data-theme="dark"] .callout-block.warning  { background: #292524; border-left-color: #facc15; }
[data-theme="dark"] .callout-block.error    { background: #2c1517; border-left-color: #f87171; }
[data-theme="dark"] .callout-block.success  { background: #14261a; border-left-color: #4ade80; }
```

**Code block colors** need dark variants (currently `background: #111827; color: #f3f4f6` which actually works better in dark mode already).

Also audit inline `style` props in components for hardcoded colors (check common offenders: `EditorPage.tsx`, `PresenceBar.tsx`, `CommentSidebar.tsx`, `VersionHistory.tsx`, `Dashboard.tsx`).

### 3. Theme toggle component

Add a theme switcher in the sidebar footer (near the user avatar / sign out area):

- Three options: Light, Dark, System (follows OS preference)
- Use a simple icon button: sun/moon/auto icon
- Dropdown or cycle on click

**Implementation:**
```typescript
// apps/web/src/hooks/useTheme.ts
type Theme = 'light' | 'dark' | 'system';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('motion-theme') as Theme || 'system'
  );

  useEffect(() => {
    const resolved = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;

    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('motion-theme', theme);
  }, [theme]);

  // Listen for OS theme changes when set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme };
}
```

### 4. Weave design system compatibility

The Weave design system (`@weave-design-system/react/theme.css`) defines its own CSS variables. Check if it supports a dark mode class or `data-theme` attribute. If yes, leverage it. If not, override the Weave variables in the `[data-theme="dark"]` block.

Key Weave components to verify in dark mode:
- `Button` (primary and ghost variants)
- `Card` (background and border)
- `Modal` (overlay and content)
- `InputGroup` and `SelectGroup` (input backgrounds, focus rings)
- `Table` (row striping, header background)
- `Sidebar` and `SidebarNavItem` (active/hover states)
- `Badge` (color variants)
- `Tooltip` (background color)

### 5. Editor-specific dark mode

The TipTap editor content area needs special attention:

- **Selection color**: default browser selection may not be visible on dark background
- **Collaboration cursors**: cursor label background should remain the peer's assigned color (already dynamic)
- **Suggestion marks**: green underline and gray strikethrough need sufficient contrast on dark bg
- **Comment highlights**: yellow/orange highlight marks must be visible on dark background
- **Slash command menu**: dropdown background and hover states
- **Placeholder text**: "Type '/' for commands" should be visible but muted

## Files to Modify

- `apps/web/src/index.css` -- add `[data-theme="dark"]` block, replace hardcoded hex values
- `apps/web/src/hooks/useTheme.ts` (new) -- theme state management
- `apps/web/src/components/workspace/MotionSidebar.tsx` -- add theme toggle button
- `apps/web/src/components/workspace/AppLayout.tsx` -- initialize theme on mount
- Various component files -- audit and replace any inline hardcoded colors

## Verification

1. Toggle to dark mode -> entire UI switches (sidebar, editor, modals, tooltips)
2. Toggle to system -> matches OS preference
3. Refresh page -> theme preference persisted
4. Editor content readable in dark mode (headings, lists, code blocks, callouts)
5. Collaboration cursors visible and color-coded
6. Suggestion marks (green/red) visible against dark background
7. Comment highlights visible
8. All Weave components (buttons, cards, modals, inputs) render correctly in dark mode
9. Images and media display correctly (no inverted colors)
10. Code blocks with syntax highlighting readable in dark mode
11. No flash of wrong theme on page load (apply theme class before first paint)

## Dependencies

None. Pure CSS + one small React hook. Can ship independently.
