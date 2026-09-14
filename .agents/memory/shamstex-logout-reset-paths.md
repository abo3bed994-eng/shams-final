---
name: Shams Tex logout reset paths
description: Per-session in-memory state (cart, editingOrderId) must be cleared in ALL logout paths, not just setUser(null).
---

In `context/AppContext.tsx` there are FIVE places that end a session, and most bypass `setUser(null)`:
- explicit logout: `setUser(null)` branch
- session takeover (logged in on another device)
- banned-now sync handler
- role-changed sync handler
- `forceLogoutAccountRemoved` (admin deleted the account)

The forced-logout paths call `setUserState(null)` directly and clear `notifications`/`orders`/`returnRequests` — but historically did NOT clear the in-memory **cart** or **editingOrderId**.

**Rule:** any per-session in-memory state that must not leak into the next account logged in on the same app process must be cleared in EVERY one of these paths.

**Why:** cart is `useState([])` (not persisted), so logging out then logging in as another account in the same process left the previous user's cart visible. Clearing only in `setUser(null)` is insufficient because takeover/ban/role-change/account-removal never go through `setUser`.

**How to apply:** when adding new session-scoped in-memory state (or fixing a "X leaks across accounts" bug), grep for every `setUserState(null)` and the `setUser` null branch, and reset there. Consider routing them through one shared reset helper.
