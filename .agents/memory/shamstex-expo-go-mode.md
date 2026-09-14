---
name: Expo Go vs dev-build mode (shamstex)
description: Why the app "won't open / exits immediately" in Expo Go, and the dev-script fix.
---

# Shams Tex must start Metro in Expo Go mode

`expo-dev-client` is a dependency of `artifacts/shamstex`. When it is installed,
`expo start` defaults to **development-build** mode: Metro advertises the URL
scheme `exp+shamstex://expo-development-client/...`. Expo Go cannot open that
scheme, so scanning the QR / opening the URL on a phone makes Expo Go exit
immediately ("لا يدخل على اكسبو").

**Fix:** the `dev` script in `artifacts/shamstex/package.json` must pass `--go`
to `expo start`. That forces the Expo-Go-compatible `exp://` URL while keeping
`expo-dev-client` available for EAS dev/native builds.

**Why this is safe:** the app is designed to run in Expo Go — every truly-native
module that Expo Go lacks (e.g. `@react-native-firebase/*`) is lazy-`require`d
inside try/catch with a JS/web fallback, so Go mode never hard-crashes on a
missing native module.

**How to apply:** if the user reports the app won't open / exits on Expo Go,
check the workflow log for `Using development build` or an
`exp+shamstex://expo-development-client` URL. If present, ensure `--go` is in the
`dev` script and restart the `artifacts/shamstex: expo` workflow. Do NOT remove
`expo-dev-client` (it's needed for native/EAS builds).

# "Opens then closes immediately" = native module version mismatch

If the app opens for a split second then closes itself on Expo Go (no red
screen — a hard native crash, not a JS error), the cause is almost always a
native module whose JS version does not match the native binary baked into the
Expo Go app. The Expo start log lists every offender under
"The following packages should be updated for best compatibility…" with the
exact expected version.

**Concrete case that bit us:** `@react-native-community/netinfo@12.x` was
installed but Expo Go SDK 54 ships **11.4.1** natively. `OfflineGate` (mounted
globally in `app/_layout.tsx`) subscribes to NetInfo at startup, so the
mismatch crashed the app instantly on device. It ran fine on web because
NetInfo is a JS no-op there — a JS-only "it works on web" does NOT prove Expo
Go will launch.

**Why:** Expo Go is a prebuilt binary; its native modules are fixed per SDK
patch. JS that calls a native API at a version the binary doesn't expose
crashes below the React error boundary, so there's no redbox — the OS just
kills the app.

**How to apply:** align every package to the Expo-expected versions before
debugging anything else. `expo install --fix` does it but can get killed
mid-run in this monorepo (leaving package.json half-updated) — re-read the
log's expected-version list and finish the bumps by hand, then `pnpm install`
and confirm with `cat node_modules/<pkg>/package.json`. The native-module ones
(netinfo, anything `react-native-*`) matter most; pure-JS expo packages are
lower risk.
