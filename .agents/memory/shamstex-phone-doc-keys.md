---
name: Shams Tex phone-keyed docs vs firestore.rules
description: sessions/customers doc IDs must be E.164 to pass rules; getCustomer null = authoritative missing (throws on error)
---

Firestore rules require `phone == request.auth.token.phone_number` (E.164, e.g. +20...) for phone-keyed docs (`sessions/{phone}`, `customers/{phone}`).

**Rule 1 — always key writes AND reads/subscriptions with `migrateLocalToE164(phone)`.**
**Why:** a legacy local-format key (01x...) makes the write silently rejected. For sessions this left the OLD token on the server, so the single-device enforcement listener kicked the device right after its own login ("تم تسجيل الدخول من جهاز آخر"). Writer and subscriber must use the SAME normalized key.
**How to apply:** any new phone-keyed collection: normalize the key in every code path (login write, listener, startup check). If a session write fails after retry, strip the local sessionToken instead of keeping it — a stale local token + old remote token = false self-kick; missing token just disables enforcement for that session.

**Rule 2 — `FS.getCustomer` THROWS on read failure; `null` means authoritative "doc does not exist".**
**Why:** login purges the local customer cache when Firestore says the account is gone (admin deleted it). If getCustomer caught errors and returned null, offline/network errors would masquerade as "deleted" and wrongly purge the cache. Never reintroduce catch→null.
**How to apply:** callers must try/catch and fall back to cache on error; purge only on success+null.

**Rule 3 — deleted-account re-registration needs a clean slate.**
**Why:** the cached registered_customers record survives forced logout and resurrects the old role/permissions/vip/legacy phone into `registerCustomer`, whose self-create then violates rules (create allows only role customer/merchant, no permissions, no vip, E.164 key) → doc never recreated → "تم حذف حسابك" logout loop on every login.
**How to apply:** `forceLogoutAccountRemoved` clears registered_customers; login's `lookupCustomer` calls `purgeCustomerCache(phone)` when Firestore authoritatively reports no doc.
