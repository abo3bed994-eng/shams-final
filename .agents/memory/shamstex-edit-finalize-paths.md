---
name: Shams Tex order-edit finalize paths
description: Two distinct finalize paths for a customer order edit and why they clamp vs force differently
---

There are two ways a customer's in-flight order edit gets finalized, and they must
handle the availability cap differently:

- **Customer-driven (cart «تأكيد التعديل»)** finalizes via `finalizeEditedItem` —
  it CLAMPS each item's weight/actualWeight DOWN to the cap (`min(current, cap)`)
  while preserving the customer's manually entered actual weight for pieces.
- **Staff-acceptance / auto-accept-on-expiry** finalizes via
  `acceptStaffAvailability` — it FORCES partial items UP to `availableQuantity`.

**Why:** in the cart the customer can manually reduce a quantity below the cap, so
forcing to the cap would silently overwrite their choice. The cart UI also only
*displays* the capped value (`min(rawAw, cap)`) without mutating an untouched
item, so finalize must clamp or an over-cap untouched item would survive the save.
On the auto/staff path there is no customer interaction, so "accept what's
available" (force to cap) is the right default.

**How to apply:** never swap `acceptStaffAvailability` into the cart finalize path
(or vice-versa). Keep `computeItemsTotal` after whichever pass runs so the saved
total matches the clamped/forced items.

## Pieces (ثوب/bolt) cap — a bolt is NOT always a full 20kg/100m; keep ≥1, never delete

A ثوب is NORMALLY `bltOf` (20kg or 100m), but the last/only bolt can be a partial
remnant (e.g. 9kg) — this is a real domain fact confirmed by the owner. So a
sub-one-bolt availability is still sellable as a partial bolt; it must NOT be
auto-deleted and must NOT be rounded up to a full 20kg.
**Why:** an earlier "drop the item when `floor(cap/perBolt) < 1`" rule silently
deleted every partial-remnant item on entering edit (and, combined with the staff
modal asking availability in kg/m, deleted all-but-one item). The owner explicitly
wants the customer to SEE the real remnant weight (9 كغ) + the cap + a capped
bolt counter, never a silent delete.
**How to apply:**
- bolt cap = `Math.max(1, Math.ceil(cap / perBolt))` everywhere (≥1), because availability is measured weight/length and may represent a partial final bolt.
- `acceptStaffAvailability` pieces branch: `bolts = max(1, min(requestedBolts, ceil(avail/perBolt)))`, and preserve `actualWeight = availableQuantity`.
- cart clamp-on-load effect: NO `removeFromCart`; pin actualWeight to `min(q*perBolt, cap)`.
- `finalizeEditedItem` / cart stepper `maxBolts`: `Math.max(1, ceil)`, but preserve the cart's actualWeight choice and only clamp it down to the cap.
- Display: «الوزن المتوفر» row shows the capped `aw` prominently (gold, ~18px), and the cap line shows `min(maxBolts*perBolt, cap)` (e.g. "1 ثوب (9 كغ)").

## Edit save must NOT hard-throw (offline tolerance)

`updateOrderItems` used to `throw new Error("save_failed")` when
`saveOrderReliable` returned false — the ONLY save path that did. Every other save
(`addOrder`, scheduled release) uses `FS.saveOrder(...).catch(()=>{})` and relies
on the `pendingOrderSaves` retry queue. `saveOrderReliable` already updates local
state + queues for retry before returning false, so the edit is never lost.
**Why:** the throw surfaced a spurious "تعذّر حفظ التعديل" to customers on any
transient Firestore hiccup, inconsistent with the create path.
**How to apply:** keep edit/confirm save paths offline-tolerant (warn + rely on
the queue); don't reintroduce a hard throw that alerts the user on a queued save.
