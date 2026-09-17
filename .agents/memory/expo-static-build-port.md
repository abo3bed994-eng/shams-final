---
name: Expo static build port
description: The Expo static build script uses Metro on port 8081 and can conflict with the Canvas preview workflow.
---

The Expo static build must have port 8081 available for its temporary Metro server.

**Why:** The Canvas preview also uses port 8081, so the build can enter Expo's non-interactive alternate-port prompt and fail before bundling. A running Expo workflow can also consume enough file watchers to trigger ENOSPC during a second Metro startup.

**How to apply:** Stop Canvas and the running Expo workflow before running the static build, then restart both workflows after validation.