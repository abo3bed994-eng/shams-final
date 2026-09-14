---
name: Shams Tex user-field cross-device sync
description: Any new User field that must sync across devices has to be added to the syncUserWithRecords change-detection predicate, not just persisted.
---

When adding a new field to the `User` object in `context/AppContext.tsx` that should
sync across a customer's devices (e.g. `favorites`, `addresses`), persisting it via
`updateRegisteredCustomer → FS.saveCustomer` is NOT enough on its own.

Customer sessions receive remote updates through
`subscribeCustomerByPhone → applyFreshCustomers → syncUserWithRecords`. That function
only refreshes the in-memory `user` when its `changed` predicate is true. The predicate
compares a fixed allowlist of fields (role, banned, vip, upgradeStatus, name,
permissions, favorites, ...). A field NOT in that predicate will stay stale on other
devices until re-login or until some other tracked field changes.

**Why:** the listener fires on every customer-doc change, so the predicate exists to
avoid needless re-renders/persist churn — but it silently drops untracked fields.

**How to apply:** when you add a synced User field, also add a comparison for it in the
`changed` predicate in `syncUserWithRecords` (use `JSON.stringify(a ?? []) !== ...` for
arrays/objects). Note `addresses` was historically left out of this predicate.
