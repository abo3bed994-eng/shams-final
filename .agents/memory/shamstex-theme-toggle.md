---
name: Shams Tex theme toggle
description: How the single dark/light toggle preserves first-launch device-follow behavior
---

The profile screen shows ONE toggle button (dark↔light), not a 3-way selector. But the
underlying `AppTheme` union still includes `"system"`, and that value is the default until
the user taps the toggle once.

**Why:** Requirement was "one button to flip dark/light" AND "first launch follows the
device, then the manual choice persists." Keeping `theme === "system"` as the default lets
`useColors`/`useColorScheme` resolve to the device scheme on first launch; the first tap
writes an explicit `"dark"`/`"light"` which then persists via `setTheme`.

**How to apply:** In `profile.tsx`, `themeResolved` collapses `"system"` to the device
scheme for display; the toggle's onPress sets the opposite explicit value. Do NOT remove
`"system"` from `AppTheme` or change the default to an explicit value — that would break the
first-launch device-follow behavior.
