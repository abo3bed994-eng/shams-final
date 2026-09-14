---
name: Expo web font gate
description: Prevents the Expo web preview from staying blank when bundled Google fonts remain pending behind the preview proxy.
---

The web build should render the application with system font fallbacks while Expo font loading is pending; native builds may keep the font gate for the splash experience.

**Why:** The preview proxy can leave `useFonts` pending without a browser error, which otherwise prevents the app tree from mounting and makes the preview appear blank or stuck on the splash screen.

**How to apply:** Keep the font-loading gate platform-specific in the root layout, allowing web to mount before `fontsLoaded` is true while retaining the native gate.