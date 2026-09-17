---
name: Shams Tex presence Firebase auth keys
description: Why presence uses Firebase UID and relies on lastSeen expiry instead of deleting during logout cleanup
---

Presence documents must use the authenticated Firebase UID as their key. Keep the app-level user ID as document data for display. Do not delete the presence document during React effect cleanup; stop heartbeats and let the lastSeen window expire it.

**Why:** The deployed strict rules require the presence document ID to equal request.auth.uid. The same Firebase account has the same UID on both phones, so deleting during old-phone cleanup can erase the new phone's active heartbeat. A lastSeen expiry avoids that race and leaves only one document per account.

**How to apply:** Wait for Firebase auth readiness, write heartbeats to presence/{request.auth.uid}, retry temporary failures, and count only records inside the freshness window. Development login shortcuts without Firebase auth cannot use presence.

The deployed rules must also let the authenticated owner/admin read the presence collection. Local firestore.rules changes do nothing until published; if the app shows admin locally but the deployed customer record is not role admin and deployed rules lack the owner exception, the listener is denied and the UI remains at zero.