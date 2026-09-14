---
name: Shams Tex Expo Go native-module crashes
description: Why react-native-keyboard-controller's scroll view crashes in Expo Go and the guarded wrapper that makes it safe everywhere
---

# react-native-keyboard-controller crashes in Expo Go (and the safe wrapper)

`KeyboardAwareScrollView` / `KeyboardProvider` from `react-native-keyboard-controller`
rely on native modules (e.g. ViewManager `ClippingScrollViewDecoratorView`) that are
NOT in the Expo Go binary. Rendering them in Expo Go crashes at runtime
("Can't find ViewManager …"), and mounting `KeyboardProvider` at the root crashes
`RootLayout` on launch ("error occurred in the <RootLayout> component", app exits).

**Why:** Edge-to-edge in Expo SDK 54 makes Android `adjustResize` ineffective, so the
old `KeyboardAvoidingView` with `behavior=undefined` gave NO Android keyboard avoidance
— the keyboard covered inputs even in a real APK. The real fix needs
keyboard-controller, but it must never load in Expo Go or on web.

**How to apply:** The library is re-added but ALWAYS accessed through
`components/KeyboardAware.tsx`, never imported at top level. That wrapper:
- exports `KeyboardAwareScroll` (a ScrollView drop-in, forwardRef) and
  `KeyboardProviderSafe`.
- lazy `require()`s keyboard-controller ONLY when
  `Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient`
  (i.e. real dev/standalone build). In Expo Go (StoreClient) and on web it falls back to
  RN's built-in `KeyboardAvoidingView` + `ScrollView` and `KeyboardProviderSafe` is a
  passthrough — so Expo Go/web behavior is unchanged and cannot crash.
- `KeyboardProviderSafe` is wired once around `RootLayoutNav` in `app/_layout.tsx`.

So: form screens use `KeyboardAwareScroll` instead of KAV+ScrollView; this is the
sanctioned way to use a native-module library that must be inert in Expo Go. The same
guard pattern (lazy require gated on executionEnvironment) is used in `lib/phoneAuth.ts`
for `@react-native-firebase/auth`. Do NOT top-level import keyboard-controller anywhere.
