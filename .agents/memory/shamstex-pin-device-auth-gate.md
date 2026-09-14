---
name: PIN quick-unlock must be device-auth-gated
description: Why PIN login alone must never grant access on a device without a matching Firebase phone-auth session
---

Rule: PIN login is ONLY a quick-unlock for a device that already holds a Firebase phone-auth session whose `phoneNumber` matches (via `samePhone`). A new device must complete OTP first, even if the account has a PIN.

**Why:** Firestore rules key protected writes on `request.auth.token.phone_number`. A PIN-only login on a fresh device has NO Firebase auth, so every protected write is silently rejected — session registration fails (single-device enforcement silently disabled → old phone never kicked), and orders/uploads would fail too. The session-save failure fallback intentionally strips the local token, which masks the problem completely.

**How to apply:** Any new login/unlock shortcut (biometrics, remembered device, etc.) must first verify a matching Firebase auth identity exists on the device (`getCurrentAuthPhone()`), else route through OTP. Logout must NOT call Firebase signOut, or same-device quick-unlock breaks.
