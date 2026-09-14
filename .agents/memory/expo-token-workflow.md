---
name: Expo token failure
description: Environment-specific behavior when Expo authentication is invalid in the Shams Tex workflow.
---

An existing but invalid `EXPO_TOKEN` causes Expo Metro to fail during startup with a bearer-token error, before the QR code and Expo Go endpoint become available. Replacing the secret through Replit's secure secrets flow and restarting the managed workflow restores the preview.

**Why:** The workflow can look like an app or Android build problem, but the failure happens during Expo authentication before the project bundles.

**How to apply:** When the Shams Tex Expo workflow exits with an invalid bearer-token error, update `EXPO_TOKEN` securely and restart the workflow; never paste or print the token.