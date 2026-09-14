---
name: Shams Tex notification icon
description: Android small-notification-icon must be a transparent silhouette; how it's wired in app.json
---

# Android notification (small) icon

Android does NOT show a colored notification small icon — it uses only the PNG's
alpha channel: every non-transparent pixel is rendered solid white, then tinted by
the `expo-notifications` `color`. So the notification icon must be a logo on a
**transparent background** (any opaque color works; it becomes white).

**Why:** user reported notifications arriving with the full colored app icon; cause
was `expo-notifications.icon` pointing at the colored app icon. Fix = point it at a
transparent-background logo so Android produces the "مفرّغ" (hollow/silhouette) look.

**How to apply:** in `artifacts/shamstex/app.json`, `expo-notifications.icon` →
`./assets/images/notification-icon.png` (transparent), keep gold `color: #C9A84C`.
The app launcher icon (`expo.icon`, `ios.icon`, `android.adaptiveIcon.foregroundImage`)
is a separate opaque image (`app-icon.png`). Icon changes only show in a native EAS
build, never in Expo Go or web preview.
