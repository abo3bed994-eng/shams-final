---
name: Shams Tex realtime auto-exit screens
description: How to auto-lock/exit a screen driven by a realtime order/edit-window state without false exits or stranding the user.
---

When a screen must auto-exit because a realtime-synced state closed (e.g. the cart
edit mode when staff close the edit window, the order is cancelled, or
`editableExpiresAt` passes):

- Do NOT gate the exit on a "saw-it-valid-at-least-once" ref. That strands the
  user when they open the screen while the state is *already* closed/expired —
  the ref never flips true, so the effect never exits.
- Exit on ANY invalid state (missing / not editable / cancelled / expired). The
  only false-exit risk is the realtime list not having synced yet, which shows up
  as `order === undefined`. Guard ONLY that case with a short mount-grace
  (`mountedAtRef`, ~2.5s); a present-but-closed order should exit immediately.
- Reset the grace + the owner-exit guard ref per session (effect keyed on the id)
  in case the screen stays mounted across flows (Expo Router tabs do).
- Run a short interval (~3s) bumping a tick state so expiry / a late sync is
  caught even when no Firestore push arrives (deps include the realtime list +
  the tick).

**Why:** an earlier version gated on `sawEditableRef` and could leave a customer
editing an order whose window had already closed. The architect flagged it; the
fix was the sync-grace approach above.

**How to apply:** any screen whose lifecycle is owned by a realtime document
state. Always keep a separate `exitingEditRef`-style guard so the user's OWN
confirm/cancel/back doesn't trigger the "closed by staff" message.
