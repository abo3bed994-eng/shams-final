---
name: Shams Tex notification targeting (id vs phone)
description: Why the in-app heads-up "forMe" filter must match direct notifications by phone, not just userId.
---

For non-staff users, the notification subscription delivers direct notifications by `targetUserPhone == userPhone` (phone is the stable identity in this phone-login app). But the in-app heads-up local-fire filter (`forMe` in `context/AppContext.tsx`) historically only fired when `targetUserId === me.id`.

**Problem:** an order's stored `userId` can differ from the current session's `user.id` (regenerated across sessions/devices), so order-status notifications landed in the in-app list (phone match) but the heads-up never popped (id mismatch) — users reported "notifications don't arrive."

**Rule:** direct-to-user notifications must be matched by **id OR phone** in `forMe`. Keep phone as the primary identity for any non-staff notification gating.

**Why:** the subscription is phone-keyed; gating the heads-up on a different field (userId) than the delivery query silently drops alerts.

**How to apply:** whenever adding/changing customer-facing notification delivery or local-fire logic, gate on `targetUserPhone === me.phone` (optionally also id), never id alone. Staff false-positives are avoided because customer docs carry the customer's phone, not staff phones.

## Use the live customer phone, not the order's frozen phone

Both customer notification delivery sinks are **exact** phone matches with no canonicalization: the Firestore subscription (`where("targetUserPhone","==",userPhone)`) and the push lookup (`getPushTokenByPhone` → `pushTokens/{phone}` doc id). An order/return stores `userPhone` frozen at creation time; if the phone format later drifts (legacy local `01…` vs E.164 `+20…`/canonical) those exact matches miss and the customer gets neither in-app nor push — while admin "message" notifications still work because they read the live customer record.

**Rule:** when emitting any customer-targeted notification, resolve the recipient's CURRENT phone via `resolveRecipientPhone(userId, userPhone)` in `context/AppContext.tsx` (looks up the live customer in `registeredCustomersRef.current` by id or `samePhone`, falls back to the frozen value) and use that for BOTH `targetUserPhone` and the `notifyUserByPhone(...)` argument. Never pass raw `order.userPhone`/`req.userPhone` to either sink.

**Why:** the two sinks do not use `samePhone`/`canonicalPhone`, so the only safe place to reconcile format drift is at emit time by reading the live record.

**How to apply:** any new customer notification path (status, message, editable, invoice, return status/cancel, scheduled release) must call `resolveRecipientPhone` first. Staff-targeted notifications are unaffected and stay as-is.

## Third sink: the display filter must also match by phone

There are THREE independent sinks that gate a notification, and all three must agree on the id-OR-phone rule: (1) the Firestore subscription (phone-keyed), (2) the local heads-up `forMe` in AppContext, and (3) the display-list filter `filterNotificationsForUser` in `lib/notificationFilter.ts`. Staff download ALL notifications, so the display filter is what keeps a customer's private notifications out of staff inboxes.

**Bug:** `filterNotificationsForUser` treated a notification as private only when `targetUserId` was set. Order-status notifications often carry only `targetUserPhone` (userId empty/drifts), so with an empty `targetUserId` they looked like broadcasts and leaked into EVERY staff member's list.

**Rule:** in the display filter, "direct/private" = `targetUserId || targetUserPhone`, and it matches me only if `targetUserId===user.id || targetUserPhone===user.phone`. The pre-registration broadcast cutoff must gate on `!isDirect` (never suppress a direct notification by date).
