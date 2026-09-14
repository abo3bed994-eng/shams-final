---
name: Shams Tex native Firebase auth-state split
description: Why native Firestore/Storage writes failed ("تعذّر الحفظ") and the platform-resolved data-layer fix.
---

On native (the APK), phone sign-in uses `@react-native-firebase/auth` (native
session), but if Firestore/Storage go through the **Firebase JS SDK**
(`getFirestore`/`getStorage`/`getAuth` from `firebase/*`), those run in a
SEPARATE JS-SDK auth context that is UNAUTHENTICATED on native. Security rules
then reject every write → generic "تعذّر الحفظ / تأكد من اتصال الإنترنت"
(it is NOT an internet problem). Web works because the JS SDK auth is actually
signed in there.

**Rule:** the native data layer must use `@react-native-firebase/firestore` +
`/storage` so they share the SAME native default app/auth as RNFirebase phone
auth. Keep web on the JS SDK.

**How to apply:** platform-resolved module pair — `lib/fb.ts` (web/default, JS
SDK) and `lib/fb.native.ts` (RNFirebase), with an IDENTICAL export surface
(db, storage, auth, firestore modular fns, `uploadToStorage`, `Unsubscribe`).
Metro picks `.native.ts` on native and `.ts` on web/tsc. `lib/firebase.ts` and
`utils/persistImage.ts` import everything from `./fb` — never from `firebase/*`
directly in data paths. Both files are in the tsc program, but tsc only enforces
the web file's types against importers; the native file is checked standalone, so
the export-shape contract is manual — keep them in lockstep.

**Why putFile on native:** native `uploadToStorage` uses `putFile(ref, localUri)`
(streams the file) instead of building an in-memory Blob — avoids OOM crashes on
large videos. Web fetches the uri → Blob → `uploadBytesResumable`.

**Cannot verify in this env:** Expo Go can't load these native modules; needs a
dev/EAS build to smoke-test an authenticated write + upload. RNFirebase
`snapshot.exists()` is a METHOD in v24 (same as JS SDK), so no normalization.

**Build-time trap (cost many turns):** the installed APK runs the JS that was
bundled AT BUILD TIME. A code fix to `fb.native.ts` does NOT reach the user
until a NEW EAS build is installed. The Replit dev server runs `--go` and only
bundles `lib/fb.ts` (web), so on-device diagnostics opened in a browser, and
the web write/upload tests, can ALL pass while the user's old native binary
still fails. Never conclude "native is fixed" from web/dev-server diagnostics —
confirm the APK was rebuilt after the fix landed. Symptom signature: web ✅
everything, but installed app can neither add NOR delete (any product save
fails because a prior failed upload left a multi-MB base64 string in the doc,
pushing it over Firestore's 1MB limit).
