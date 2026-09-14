---
name: Shams Tex order writes vs field-restricted rules
description: Customer-side order updates must be targeted patchOrder writes, never full-doc saveOrder; private proof images never fall back to base64
---

**Rule 1 — customer-side order updates use `FS.patchOrder` (updateDoc), never `FS.saveOrder` (full-doc setDoc).**
**Why:** the deployed firestore.rules gate customer updates with `diff().affectedKeys().hasOnly([...])`. A full-doc setDoc makes ANY drift between the customer's local copy and the server (staff edits, new fields) count as an affected key → write rejected → "تعذّر رفع الصورة"-style failures that look random.
**How to apply:** patchOrder maps null→deleteField() and skips undefined. Any new customer-writable order field: add a targeted patch + a matching hasOnly rules clause. Staff paths may keep saveOrder (staff clause has no hasOnly).

**Rule 2 — transfer-proof upload is allowed at any active status.**
Rules have a dedicated clause: owner may change ONLY transferProofImage while status in pending/scheduled/received/preparing/ready/ready_to_ship. The older payment-fields clause stays pending/scheduled-only (method changes). Customers pay AFTER staff confirms — don't re-restrict proof upload to pending.

**Rule 3 — private images (proofs/) never fall back to base64.**
**Why:** a base64 photo blows Firestore's 1MB doc limit, so the follow-up order write fails anyway and masks the real storage error. persistImageUri throws UploadFailedError (after a detailed Alert incl. lastUploadError) for dest==="private"; callers skip their generic alert when `err instanceof UploadFailedError`. Public media keeps base64 fallback for local preview.

Note: rules edits are inert until `firebase deploy --only firestore:rules` — no CLI/token in this environment; the user deploys from their machine.
