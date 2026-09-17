---
name: Shams Tex GitHub synchronization
description: Safe synchronization when the local Replit branch and GitHub main have unrelated commit histories
---

The local Replit `main` and GitHub `main` have independent commit histories. Never force-push the local branch over GitHub. Preserve the current GitHub head and apply the local tree differences in a new commit based on that head.

**Why:** GitHub contains commits that are not ancestors of the local branch, while the local branch also contains commits absent from GitHub. A normal push is rejected, and a force push would erase the remote-only history.

**How to apply:** Compare the two trees, create a commit whose parent is the current GitHub `main`, upload only the differing files, fast-forward the remote ref, then verify that the remote and local trees match exactly.