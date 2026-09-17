---
name: EAS build metadata
description: How to distinguish Shams Tex APK build profiles and source revisions when Expo reports only a generic install failure.
---

Before diagnosing an Expo Android failure, verify the build metadata: profile, distribution, Git commit, and failing phase. `UNKNOWN_ERROR` with `pnpm install --frozen-lockfile` is not enough to identify the cause; Production/STORE and Preview/INTERNAL builds can follow different paths, and a build may still be using an older commit.

**Why:** The same short install-failure message appeared while different EAS builds were being compared, which made a successful old Preview APK look inconsistent with a failed newer Production build.

**How to apply:** Inspect the EAS build details first, then compare the selected profile and commit with the intended APK source before changing dependencies or retrying.