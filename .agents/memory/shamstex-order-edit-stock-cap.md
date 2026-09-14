---
name: Shams Tex order-edit availability cap
description: How the "available only" cap works when a customer edits an order; the editMaxQty trap.
---

# Order-edit availability cap uses availableQuantity, NOT editMaxQty

When staff mark an item partially available during an order edit, the data is
`stockStatus: "partial"` + `availableQuantity` on the cart/order item. The
`editMaxQty` field exists in the CartItem type but is **never assigned anywhere**
— it's dead. Any cap logic that reads only `editMaxQty` silently never fires, so
the customer can exceed the available amount.

**Cap source (correct):**
`item.stockStatus === "partial" && item.availableQuantity != null ? item.availableQuantity : item.editMaxQty`

**Units:** `availableQuantity` is a WEIGHT (كغ/متر) for BOTH order types. It caps
`weight` for weight orders and `actualWeight` for pieces (ثوب) orders — the
quantity (عدد الأثواب) is decoupled; pricing uses weight/actualWeight.

**Where it must be enforced:** clamp in the AppContext mutators
(`updateCartWeight`, `updateCartActualWeight`) so it holds regardless of UI, AND
in cart.tsx display/price (`piecesEstTotal`) and the +/- buttons. The checkout
minimum-quantity check must skip partial items (available can be below the
normal 20kg/100m minimum).

**Why:** a customer-reported bug — editing an order let them raise the amount
above what staff wrote as available. Root cause was the dead editMaxQty cap.
