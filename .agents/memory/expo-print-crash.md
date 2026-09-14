---
name: expo native module versions must track the Expo SDK (Shams Tex)
description: every expo-* native module must match the installed Expo SDK, not jump to a future-SDK major, or the feature crashes at runtime (not build time)
---

# expo-* native module versions must track the Expo SDK

In `artifacts/shamstex` (Expo SDK 54), every `expo-*` native module must be in the
SDK-compatible range. Mismatches are silent at build/typecheck and only crash when the
feature is exercised. Confirmed offenders found in this app:
- `expo-print` → `~15.0.8` (a future-SDK major crashes invoice PDF: "تعذّر إنشاء ملف الفاتورة")
- `expo-sharing` was wrongly pinned `^55.0.19`; SDK 54 wants `~14.0.8` — broke the PDF *share* path.
- `expo-media-library` was wrongly pinned `^55.0.17`; SDK 54 wants `~18.2.1`.
The bogus `^55.x` pins are a recurring trap — treat any `expo-*` dep whose major looks like an
SDK number far above the installed SDK as broken. `react-native-webview` is kept at `13.15.0`.

**Why:** Expo native modules are versioned per SDK; installing a major from a newer SDK links
incompatible native code and crashes that module's path at runtime, not build time.

**How to apply:** The source of truth is `node_modules/.pnpm/expo@<ver>/.../expo/bundledNativeModules.json`
(grep it for the exact expected ranges). After any dependency bump, or when a PDF/print/share/media
feature misbehaves, cross-check every `expo-*` dep against that file. Prefer the bundled range over
a manual latest-major. Surface the real error in catch blocks to diagnose faster.
