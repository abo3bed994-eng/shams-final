---
name: Shams Tex OTP throttle
description: How to rate-limit phone OTP sends without locking users out because of failed delivery attempts
---

The OTP limit check must be read-only. Increment the counter only after Firebase accepts the phone sign-in request for delivery. Keep the app's maximum aligned with the maximum count permitted by Firestore rules.

**Why:** Incrementing before Firebase sends the SMS consumes attempts for network, CAPTCHA, or provider failures. The old five-attempt client limit then locked a legitimate number for the remainder of a 24-hour window and showed a long retry time.

**How to apply:** Run the read-only check before phone auth, call the recording transaction only after startPhoneSignIn succeeds, and never block code entry if recording the successful send fails.