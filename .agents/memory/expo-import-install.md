---
name: Expo import installation
description: Environment-specific dependency constraints when importing Expo apps into this workspace.
---

When importing an existing Expo workspace, install only the app's dependency graph and keep the Expo CLI dependency tree compatible with the workspace package firewall; some transitive CLI/Firebase packages may be blocked.

**Why:** The package firewall can reject otherwise valid transitive archives, preventing Metro from starting even when the source code is intact.

**How to apply:** Preserve the app's runtime behavior, avoid unnecessary publishing CLIs in the app dependencies, and verify the managed Expo workflow after installation.