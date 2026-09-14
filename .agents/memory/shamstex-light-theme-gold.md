---
name: Shams Tex light-theme gold contrast
description: Why the light-theme gold token must stay dark, not bright.
---

# Light-theme gold must stay dark enough to read as text

In `constants/colors.ts` the `gold` / `primary` / `accent` / `tint` tokens are
used **pervasively as TEXT color** (prices, labels, links, chip text), not just
as decorative accents. So in the `light` palette the gold cannot be a bright,
high-luminance gold — it must stay a deep/rich gold with **>=4.5:1 contrast on
white (#FFFFFF) and ivory (#FBF7EF)**. A bright gold like `#BD972A`/`#B8923A`
only hits ~2.7-2.9:1 and reads as washed-out.

**Why:** A user reported the light mode looked "faded/باهتة". The root cause was
low contrast (muddy beige bg + low-contrast gold text), NOT insufficient
brightness. Counter-intuitively, *darkening* the gold (to ~`#8C6D14`, ~4.8:1)
plus a brighter ivory background and deeper near-black text makes the theme look
richer/less faded AND fixes readability. Bright gold = faded + unreadable.

**How to apply:** when adjusting the light theme, keep `gold`/`primary`/`accent`
deep (~`#8C6D14`). Use the separate `goldLight` token (`#DCB94E`) for purely
decorative highlights/gradients only — never for small text on light bg. The
dark theme has its own gold (`#D4B25C` on dark bg) and is unaffected.
