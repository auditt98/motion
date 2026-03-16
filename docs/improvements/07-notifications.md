# Notification System

## Problem

Comments support @mentions but there's no notification delivery. Mentioned users have no idea they were tagged. Comments without notifications are comments nobody reads — this breaks the entire review and feedback loop that makes collaboration work.

## Priority

**Sprint 7.** ~2–3 days of effort. Critical for making comments useful.

## What to Build

### 1. DB migration: `notifications` table

New migration `supabase/migrations/013_notifications.sql`:

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,                    -- 'mention', 'comment_reply', 'page_shared', 'suggestion'
  title text NOT NULL,                   -- "Alice mentioned you in Project Brief"
  body text,                             -- preview text
  page_id uuid REFERENCES pages(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES comment_threads(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),    -- who triggered the notification
  read_at timestamptz,                   -- NULL = unread
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
```

### 2. Notification triggers

Create notifications on these events:

| Event | Who gets notified | Type |
|-------|------------------|------|
| @mention in comment | The mentioned user | `mention` |
| Reply to a comment thread | Thread creator + all participants | `comment_reply` |
| Comment on your page | Page creator | `comment_reply` |
| Agent finishes editing | Page creator / last editor | `agent_edit` (future) |

Implementation: Supabase database triggers or client-side insert after the triggering action.

### 3. In-app notification bell

New component in the app header / sidebar:

- Bell icon with unread count badge (red dot with number)
- Click opens a notification dropdown/panel
- Each notification shows: actor avatar, title, relative time, read/unread state
- Click a notification → navigate to the page and scroll to the relevant comment
- "Mark all as read" button
- Real-time updates via Supabase `postgres_changes` subscription on the `notifications` table

### 4. Mark as read logic

- Clicking a notification marks it as read (`read_at = now()`)
- Opening a page could auto-mark all notifications for that page as read
- Notifications older than 30 days auto-archive

### 5. Future: Email notifications (stretch)

- Supabase edge function triggered by notification insert
- Send email for unread mentions after 5-minute delay (skip if user already read it)
- User preference: "Email me for mentions" toggle in settings

## Files to Modify

- `supabase/migrations/013_notifications.sql` (new)
- `apps/web/src/hooks/useNotifications.ts` (new)
- `apps/web/src/components/workspace/NotificationBell.tsx` (new)
- `apps/web/src/hooks/useComments.ts` — trigger notification on comment/mention
- `apps/web/src/components/workspace/Sidebar.tsx` or `AppLayout.tsx` — add bell to header

## Verification

1. User A @mentions User B in a comment → User B sees notification badge
2. Click notification → navigates to the page and highlights the comment
3. Mark as read → badge count decreases
4. Real-time: notification appears without page refresh
5. Reply to a thread → all thread participants get notified
6. Delete a comment → associated notifications are cleaned up (CASCADE)

## Dependencies

Depends on the existing comments system being functional (it is).
