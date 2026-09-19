---
name: GitHub connector push
description: Upload repository changes through the Replit GitHub connector when the configured Git remote cannot authenticate
---

When the configured GitHub HTTPS remote rejects Git credentials, use the added Replit GitHub connector and Git Data API instead of requesting or exposing a token.

**Why:** The workspace's Git remote may not have usable command-line credentials even though the GitHub integration is authorized.

**How to apply:** Preserve the remote branch history, create blobs/tree/commit from the current remote head, update the branch with `force: false`, and verify the returned ref and tree.