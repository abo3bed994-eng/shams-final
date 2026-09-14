---
name: Shams Tex pieces vs weight measure storage
description: Which CartItem field holds the priced quantity for pieces vs weight orders
---

For Shams Tex order/return items, the field that holds the *priced* measure differs by orderType, and price is always `unitPrice × measure`:

- `orderType === "weight"`: measure lives in `item.weight` (kg/meter). `quantity` is incidental.
- `orderType === "pieces"`: `quantity` = bolt count (عدد الأثواب); the priced measure lives in `item.actualWeight` (kg/meter), NOT `weight`. perBolt fallback = meter?100:20, i.e. `actualWeight ?? quantity*perBolt`.

**Why:** A return form that wrote the measure into `weight` for pieces orders produced wrong prices/maxes — pieces pricing everywhere (order detail, invoiceHtml, cart) reads `actualWeight`, never `weight`.

**How to apply:** Any code that captures or displays a per-item measure/price for pieces must use `actualWeight` (with `?? quantity*perBolt` fallback); only weight-orders use `weight`. When building return items, set `quantity` (bolts) always, plus `weight` for weight-orders OR `actualWeight` for pieces.
