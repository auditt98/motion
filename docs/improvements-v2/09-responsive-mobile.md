# Responsive Design (Mobile)

## Problem

Motion is desktop-only. The layout assumes a wide viewport: fixed sidebar (~250px), editor area (max-w-3xl), and optional right panels (comments, versions) at 320px each. Below ~1024px, the UI breaks -- sidebar and editor compete for space, right panels overflow, toolbar buttons wrap awkwardly, and touch interactions are not supported. Users on tablets and phones cannot use Motion at all.

## Priority

~4-5 days of effort. Large scope due to the number of components that need responsive behavior.

## What to Build

### 1. Responsive breakpoints

Define three breakpoints:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Desktop** | >= 1024px | Current layout: sidebar + editor + optional right panel |
| **Tablet** | 768px - 1023px | Collapsible sidebar overlay + editor + panels as sheets |
| **Mobile** | < 768px | Full-screen editor, sidebar as drawer, bottom sheets for panels |

Use Tailwind's responsive prefixes (`md:`, `lg:`) where possible. For JS-driven responsive behavior, use a `useBreakpoint` hook.

### 2. Sidebar as overlay drawer (< 1024px)

On narrow viewports, convert the sidebar from a fixed column to a slide-out drawer:

- **Collapsed by default** on tablet/mobile
- **Hamburger menu button** in the top-left corner to open
- **Slide-in from left** with backdrop overlay (click backdrop to close)
- **Same sidebar content**: page tree, folders, favorites, trash, workspace switcher
- **Auto-close** when navigating to a page
- The existing `sidebarCollapsed` state in `AppLayout.tsx` can be reused

```tsx
// apps/web/src/components/workspace/AppLayout.tsx
const isMobile = useBreakpoint('< 1024px');

// When mobile, sidebar renders as an overlay drawer
{isMobile ? (
  <SidebarDrawer open={!sidebarCollapsed} onClose={() => setSidebarCollapsed(true)}>
    <MotionSidebar ... />
  </SidebarDrawer>
) : (
  <MotionSidebar ... />
)}
```

### 3. Editor toolbar adaptation (< 768px)

The editor toolbar has many buttons that won't fit on a narrow screen. On mobile:

- Show only essential buttons: Bold, Italic, heading toggle, list toggle
- Move remaining actions to a "..." overflow menu (dropdown)
- The suggestion mode toggle, comments button, versions button, and export button move to the overflow menu
- Toolbar becomes sticky at the top of the editor area

### 4. Right panels as bottom sheets (< 1024px)

The comment sidebar, version history panel, and any future panels (TOC, AI chat) should render as bottom sheets on mobile:

- **Slide up from bottom** covering ~60-70% of the screen
- **Drag handle** at the top to dismiss or expand
- **Backdrop** behind the sheet (tap to dismiss)
- Same content, adapted layout (full-width cards, larger touch targets)

```tsx
// Reusable BottomSheet component
function BottomSheet({ open, onClose, title, children }) {
  return open ? (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-xl overflow-y-auto"
           style={{ background: 'var(--color-bg)' }}>
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  ) : null;
}
```

### 5. Touch interactions

Add touch-friendly interactions:

- **Long-press** on a page in sidebar -> context menu (instead of right-click)
- **Swipe right** from left edge -> open sidebar drawer
- **Swipe down** on bottom sheet -> dismiss
- **Larger touch targets**: minimum 44x44px for all interactive elements (Apple HIG)
- **No hover-only interactions**: anything revealed on hover (tooltips, action buttons) must have a tap alternative

### 6. Mobile editor adjustments

- **Editor width**: remove `max-w-3xl` constraint on mobile, use full width with horizontal padding
- **Font size**: slightly larger body text for readability (16px minimum to prevent iOS zoom)
- **Floating toolbar**: consider a floating bubble toolbar that appears on text selection (instead of the fixed top toolbar)
- **Slash command menu**: full-width on mobile, positioned above the keyboard
- **Image upload**: support camera capture via `accept="image/*"` on the file input

### 7. Navigation and header

- **Mobile header**: page title (truncated), hamburger button (left), action buttons (right)
- **Presence bar**: collapse to overlapping avatars (max 3 visible) with "+N" badge
- **Share button**: full-screen modal on mobile instead of popover
- **Command palette**: full-screen overlay on mobile

### 8. useBreakpoint hook

```typescript
// apps/web/src/hooks/useBreakpoint.ts
function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
```

### 9. Viewport meta tag

Ensure `apps/web/index.html` has proper viewport settings:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

The `maximum-scale=1` prevents unwanted zoom on iOS when focusing input fields (if font size >= 16px).

## Files to Modify

- `apps/web/src/hooks/useBreakpoint.ts` (new) -- responsive breakpoint hook
- `apps/web/src/components/shared/BottomSheet.tsx` (new) -- reusable bottom sheet
- `apps/web/src/components/shared/SidebarDrawer.tsx` (new) -- overlay drawer wrapper
- `apps/web/src/components/workspace/AppLayout.tsx` -- responsive sidebar behavior
- `apps/web/src/components/workspace/MotionSidebar.tsx` -- touch interactions, auto-close on navigate
- `apps/web/src/components/editor/EditorPage.tsx` -- responsive panels, toolbar, editor width
- `apps/web/src/components/editor/EditorToolbar.tsx` -- overflow menu for mobile
- `apps/web/src/components/editor/CommentSidebar.tsx` -- bottom sheet on mobile
- `apps/web/src/components/editor/VersionHistory.tsx` -- bottom sheet on mobile
- `apps/web/src/components/workspace/PresenceBar.tsx` -- collapsed avatar display
- `apps/web/src/components/workspace/ShareButton.tsx` -- full-screen modal on mobile
- `apps/web/src/components/workspace/CommandPalette.tsx` -- full-screen on mobile
- `apps/web/src/index.css` -- responsive utility styles, touch-friendly spacing
- `apps/web/index.html` -- viewport meta tag

## Verification

1. Desktop (>= 1024px) -> existing layout unchanged
2. Tablet (768-1023px) -> sidebar collapses to overlay, panels as sheets
3. Mobile (< 768px) -> full-screen editor, hamburger menu, bottom sheets
4. Open sidebar on mobile -> slides in from left, backdrop visible
5. Tap a page in sidebar -> navigates and auto-closes sidebar
6. Open comments on mobile -> bottom sheet slides up
7. Toolbar on mobile -> essential buttons visible, overflow menu for rest
8. Long-press page in sidebar -> context menu appears
9. Text selection on mobile -> editing controls accessible
10. Slash command menu on mobile -> full-width, usable
11. Share dialog on mobile -> full-screen modal
12. Presence bar on mobile -> compact avatar display
13. No horizontal scrolling on any viewport size
14. Input fields don't trigger unwanted zoom on iOS

## Dependencies

None. Can be built incrementally -- start with sidebar drawer and toolbar overflow, then add bottom sheets and touch interactions.
