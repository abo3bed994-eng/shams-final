---
name: Shams Tex local notification de-duplication
description: Why local OS notifications re-fired on logout/login and how the watermark fixes it
---

# Local OS notification re-fire (Shams Tex)

Local OS notifications (expo-notifications `scheduleNotificationAsync`) are fired
from the Firestore notifications listener in `context/AppContext.tsx`, NOT from a
backend. The app must itself avoid re-presenting already-delivered notifications.

**Rule:** Decide "is this notification new?" by comparing its `createdAt` to a
login-scoped watermark (`notifWatermarkRef`), reset to `new Date().toISOString()`
at the start of the subscription `useEffect` on every login. Fire only when
`createdAt > watermark`, then advance the watermark to the snapshot's max
`createdAt`.

**Why:** The previous approach (in-memory `prevIds` set + `isFirstNotifLoad`
flag) re-fired old notifications after logout/login and on a second device,
because:
1. `FS.subscribeNotificationsForUser` delivers snapshots in TWO merged batches
   (two parallel Firestore listeners merged in memory). The second batch looked
   "new" relative to the first.
2. Those in-memory guards reset whenever the effect re-runs (logout/login,
   single-device enforcement kicking the first device), so historical docs were
   treated as new.

The watermark is immune to both: pre-existing docs always have
`createdAt < login time`, and the second merge batch re-emits items already
`<= watermark`.

**How to apply:** Keep all notification `createdAt` values as ISO strings
(`new Date().toISOString()`) so lexicographic compare == chronological. If you
ever add a new notification-creation path, set `createdAt` the same way, or it
may be silently skipped (or, with a future clock, re-alert). Do NOT reintroduce
`prevIds`/`isFirstNotifLoad`-based newness detection.

## Second dedup source: author-side immediate fire

`addNotification` ALSO fires an immediate local notification on the author's
device. There are therefore TWO local-fire paths: (1) the listener (above), and
(2) `addNotification`'s immediate fire. They collide whenever the author is also
a recipient — the listener re-fires the same doc when the Firestore write echoes
back.

**Rule:** `addNotification`'s immediate fire must be restricted to notifications
explicitly aimed at the current user that they did NOT author
(`targetUserId === "self"` OR `targetUserId === me.id && sourceUserId !== me.id`).
Broadcasts and role-targeted items must be delivered to recipients ONLY via the
listener path. Composed broadcasts (e.g. `app/admin/notifications.tsx`) must
stamp `sourceUserId = author.id` so the listener's `sourceUserId === me.id` skip
prevents the author from notifying themselves.

**Why:** Previously `isForMe` treated "no `targetUserId`" (every broadcast) as
"for me", so an admin sending an "all" broadcast got it twice (immediate +
listener echo) and got spurious local alerts for role broadcasts aimed at other
roles. The listener already handles correct recipient delivery + watermark
dedup, so the immediate fire only needs to cover true direct-to-self items.
