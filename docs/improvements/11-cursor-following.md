# Cursor Following & Selection Highlighting

## Problem

Presence shows who's online but you can't follow someone's scroll position or cursor. Other users' text selections are not visible. These are the multiplayer features that create "wow" moments (Figma proved this) and are essential for meetings where someone says "let me show you what I'm looking at."

## Priority

**Sprint 11.** ~1–2 days of effort. High wow factor, moderate adoption impact.

## What to Build

### 1. Selection highlighting for other users

Yjs Awareness already broadcasts cursor positions. The `y-prosemirror` collaboration cursor extension renders remote cursors as colored carets. Extend this to also show remote **selections**:

- When another user selects text, highlight that range with a translucent version of their cursor color
- The `y-prosemirror` `yCursorPlugin` likely already supports this — verify and enable
- If not built-in, create a ProseMirror decoration that reads selection ranges from awareness states

### 2. Cursor following

Click a user's avatar in the presence bar to "follow" them:

- Your viewport scrolls to match their cursor position in real-time
- A banner appears at the top: "Following Alice" with a "Stop following" button
- Following ends when: you click "Stop", you start typing, or the followed user disconnects
- Smooth scroll animation when the followed user's cursor moves

Implementation:
- Read the followed user's cursor position from Yjs Awareness state
- On each awareness update, scroll the editor to that position using ProseMirror's `scrollIntoView`
- Debounce scroll updates (100ms) for smooth animation

### 3. Scroll position in awareness

Extend the awareness state to include scroll position (viewport top offset):

```typescript
provider.awareness.setLocalStateField("user", {
  name, color, isAgent,
  scrollTop: editorElement.scrollTop,  // add this
});
```

Update on scroll events (throttled to 200ms).

### 4. "Go to user" without following

In the presence bar tooltip, add a "Go to cursor" button:
- One-time scroll to the user's current position
- Doesn't lock your viewport to theirs (unlike following)

## Files to Modify

- `apps/web/src/hooks/useYjsProvider.ts` — extend awareness state with scroll position
- `apps/web/src/hooks/usePresence.ts` — add follow state management
- `apps/web/src/components/editor/PresenceBar.tsx` — add click-to-follow + go-to-cursor
- `apps/web/src/components/editor/FollowBanner.tsx` (new) — "Following X" banner
- `packages/editor-extensions/src/extensions.ts` — verify selection highlighting is enabled

## Verification

1. User A selects text → User B sees the selection highlighted in User A's color
2. User B clicks User A's avatar → viewport scrolls to User A's position
3. User A scrolls down → User B's viewport follows
4. User B starts typing → following stops, banner disappears
5. "Go to cursor" → one-time scroll without locking

## Dependencies

None. Uses existing Yjs Awareness infrastructure.
