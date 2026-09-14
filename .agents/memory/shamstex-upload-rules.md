---
name: Shams Tex upload path / storage rules contract
description: Why media uploads silently fail and how the proofs path is bound to order ownership.
---

# Upload paths must match storage.rules

Shams Tex uploads media via `utils/persistImage.ts` to top-level folders
(`images/`, `videos/`, `proofs/<orderId>/`). Firebase Storage rules end in a
default-deny, so any client write to a path the rules do NOT explicitly allow is
**silently rejected** — the UI just reports a failed upload with no obvious cause.

**Why:** A past incident had the client writing to `images/` and `videos/` while
`storage.rules` only allowed `products/`/`invoices/`/`returns/`, so *every* video
and product-image upload failed.

**How to apply:**
- Any new upload destination in `persistImage.ts` (or a new `UploadFolder`) must
  have a matching `match` block added to `artifacts/shamstex/storage.rules`.
- Sensitive order images go to `proofs/<orderId>/<file>`; the rule binds access via
  `ownsOrder(orderId)` (compares `orders/<orderId>.userPhone` to the caller's
  E.164 or local phone) so only the order owner or staff can read/upload. Keep the
  orderId as the first path segment — the rule depends on it.
- Phone formats differ: Firebase Auth gives E.164 (+20…) but some legacy docs are
  local (01…). Role/ownership checks in the rules must try both.

**Critical:** Editing `storage.rules` changes nothing in production until deployed
with `firebase deploy --only storage`. The sandbox has no Firebase credentials, so
deployment is a user action.
