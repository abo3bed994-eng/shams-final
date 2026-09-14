# Shams Tex — Production Setup Checklist

Follow these steps **in order** before publishing the app to stores.

---

## 1. Firebase Console — Enable Phone Authentication

1. Open [Firebase Console](https://console.firebase.google.com) → project **shamstexapp**.
2. Left menu → **Build → Authentication** → tab **Sign-in method**.
3. Click **Phone** → toggle **Enable** → **Save**.

### Free quota (Spark plan)
- ~10 SMS per day per project — enough for early testing.
- Once you exceed it, SMS sends will fail until next day.
- Upgrade to Blaze (pay-as-you-go) when you launch publicly.

---

## 2. Add SHA-1 Fingerprint (Android only)

Required so Google can verify SMS sent to your APK.

### Get SHA-1 from EAS (recommended)
```bash
cd artifacts/shamstex
eas credentials
# Choose: Android → production → keystore → "View"
# Copy the SHA-1 line.
```

### Add it to Firebase
1. Firebase Console → ⚙️ **Project Settings** → tab **General**.
2. Scroll to **Your apps** → Android app `com.shamstex.app`.
3. Click **Add fingerprint** → paste SHA-1 → **Save**.
4. Re-download `google-services.json` and replace the file in `artifacts/shamstex/`.

⚠️ Do this for **every** keystore you use (debug + production).

---

## 3. Deploy Firestore + Storage Rules

```bash
cd artifacts/shamstex
npm install -g firebase-tools     # one time
firebase login
firebase deploy --only firestore:rules,storage:rules
```

After deploy, test by trying to read/write from a non-authenticated session — it must be denied.

---

## 4. Admin Bypass Password

The app includes a hidden admin login (long-press the logo on the login screen).
Set the password via env var **before building**:

```bash
# In artifacts/shamstex/.env (do NOT commit this file)
EXPO_PUBLIC_ADMIN_BYPASS_PASSWORD=YourStrongPasswordHere
```

If unset, the bypass is disabled.

---

## 5. Build a Production APK

```bash
cd artifacts/shamstex
eas build --platform android --profile production
```

Test on a real device:
- ✅ Real phone number receives real SMS
- ✅ Admin bypass works with secret password
- ✅ Existing customer phones still work after migration

---

## 6. Optional: Enable App Check

Protects your Firebase quota from abuse (someone spamming OTP on your dime).

1. Firebase Console → **App Check** → register Android app with **Play Integrity**.
2. Enforce on **Authentication** + **Firestore**.

---

## Quick Troubleshooting

| Problem | Fix |
|---|---|
| "SMS quota exceeded" | Wait 24h or upgrade to Blaze |
| OTP never arrives on Android | SHA-1 not registered in Firebase |
| `auth/captcha-check-failed` on web | reCAPTCHA blocked by browser; allow scripts |
| Old customer can't log in | Phone migration didn't run; have them re-register |
