---
name: Shams Tex owner-admin whitelist sync
description: Owner/admin authority is a phone whitelist duplicated in client + rules + Firebase Console; all three must agree.
---

Owner (super-admin) authority in Shams Tex is granted by a PHONE WHITELIST that lives in THREE places that must stay in lockstep:

1. `app/auth/login.tsx` → `OWNER_PHONES` / `isOwnerPhone()` — client-side: forces the phone to `admin` role and skips PIN.
2. `firestore.rules` → `isOwnerPhone()` — server-side: grants admin read/write even without an admin Firestore doc.
3. Firebase Console → Authentication → test phone numbers — if a phone there maps to an owner number, anyone who enters that number + its test code authenticates as the owner.

**Why:** Pre-launch hardening removed a shipped admin backdoor (a "Method D" magic-phone + hardcoded password/verify-code, plus a bypass test phone). The bundle had real secrets a decompiler could read. Editing client code alone does NOT close the hole: a matching Firebase **test phone** is a server-side backdoor, and `firestore.rules` are inert until `firebase deploy --only firestore:rules`.

**How to apply:** When changing who is an owner/admin, update all three in the same change (the concrete phone values live in those files — do not duplicate them here). After editing `firestore.rules`, it has no effect until deployed. To retire an emergency/test login, the test number must be removed in Firebase Console too — code removal isn't enough. Never hardcode passwords/verify-codes/magic phones in the client; for dev convenience use a `__DEV__`-gated path (stripped from release builds) instead.
