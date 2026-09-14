---
name: Shams Tex Icon mapping
description: components/Icon.tsx renders null for any unmapped key; icon-name lists elsewhere must stay in sync with its map.
---

`components/Icon.tsx` maps a fixed set of string keys to `lucide-react-native`
components and renders **null** for any key not in the map (no fallback glyph).

**Why:** Picker lists like `SOCIAL_ICONS` in `app/admin/settings/_shared.tsx`
offer icon-name strings to admins. If a name there (or any `Icon name="..."`)
has no entry in Icon.tsx's map, the icon silently disappears at runtime — easy to
miss because typecheck passes (the prop is a plain string).

**How to apply:** Whenever you add a name to any icon-name list or use a new
`Icon name="x"`, confirm `x` exists as a key in the Icon.tsx map (add the lucide
import + key if not). Distinct keys can share a component (e.g. `website` and
`globe` both → `Globe`).
