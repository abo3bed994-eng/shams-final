// Unified Phone Auth wrapper that uses:
//   • Firebase JS SDK (web) — signInWithPhoneNumber + RecaptchaVerifier
//   • @react-native-firebase/auth (native iOS/Android) — signInWithPhoneNumber
//
// Both flows return a "confirmation" handle whose .confirm(code) verifies the OTP.

import { Platform } from "react-native";
import { auth as webAuth, setupRecaptcha } from "./firebase";
import {
  signInWithPhoneNumber as webSignInWithPhone,
  ConfirmationResult as WebConfirmationResult,
} from "@firebase/auth";

export type PhoneAuthConfirmation = {
  confirm: (code: string) => Promise<{ uid: string; phoneNumber: string | null }>;
};

let nativeAuthModule: any = null;
function getNativeAuth() {
  if (nativeAuthModule) return nativeAuthModule;
  try {
    // Lazy require so web bundle never tries to load native module.
    const mod = require("@react-native-firebase/auth").default;
    nativeAuthModule = mod;
    return mod;
  } catch (e) {
    return null;
  }
}

export async function startPhoneSignIn(
  e164Phone: string,
  options: { disableAppVerificationForTesting?: boolean } = {}
): Promise<PhoneAuthConfirmation> {
  if (Platform.OS === "web") {
    // Firebase fictional test numbers can skip reCAPTCHA in development. This
    // must never be enabled for normal numbers or production builds.
    webAuth.settings.appVerificationDisabledForTesting =
      __DEV__ && options.disableAppVerificationForTesting === true;
    const verifier = setupRecaptcha();
    const result: WebConfirmationResult = await webSignInWithPhone(webAuth, e164Phone, verifier);
    return {
      confirm: async (code: string) => {
        const cred = await result.confirm(code);
        return {
          uid: cred.user.uid,
          phoneNumber: cred.user.phoneNumber,
        };
      },
    };
  }

  // Native (iOS / Android)
  const rnAuth = getNativeAuth();
  if (!rnAuth) {
    throw new Error("@react-native-firebase/auth is not available in this build");
  }
  const confirmation = await rnAuth().signInWithPhoneNumber(e164Phone);
  return {
    confirm: async (code: string) => {
      const cred = await confirmation.confirm(code);
      return {
        uid: cred?.user?.uid ?? "",
        phoneNumber: cred?.user?.phoneNumber ?? null,
      };
    },
  };
}

// Returns the E.164 phone number of the Firebase auth session persisted on
// THIS device, or null if the device has never completed a phone OTP sign-in.
// Used to decide whether PIN quick-unlock is allowed: PIN alone must never
// grant access on a device that has no matching Firebase identity, because
// Firestore security rules would silently reject every protected write
// (session registration, orders, uploads) on that device.
export function getCurrentAuthPhone(): string | null {
  try {
    if (Platform.OS === "web") {
      return webAuth.currentUser?.phoneNumber ?? null;
    }
    const rnAuth = getNativeAuth();
    if (!rnAuth) return null;
    return rnAuth().currentUser?.phoneNumber ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await webAuth.signOut();
    } else {
      const rnAuth = getNativeAuth();
      if (rnAuth) await rnAuth().signOut();
    }
  } catch {}
}
