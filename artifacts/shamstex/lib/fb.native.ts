// Platform-resolved Firebase data layer — NATIVE (iOS/Android) implementation.
//
// Metro picks this file over `fb.ts` on native builds. It is backed by
// @react-native-firebase so Firestore/Storage share the SAME native auth
// session created by phone sign-in (@react-native-firebase/auth). This is the
// fix for native writes failing with "تعذّر الحفظ": the Firebase JS SDK auth
// state never reaches the native session, so JS-SDK Firestore writes ran
// unauthenticated and were rejected by the security rules.
import "@react-native-firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  runTransaction,
  writeBatch,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteField,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  putFile,
  getDownloadURL,
} from "@react-native-firebase/storage";
import rnAuth from "@react-native-firebase/auth";

// Native config comes from google-services.json / GoogleService-Info.plist,
// so no JS config object is required here.
const app: unknown = undefined;
const db = getFirestore();
const storage = getStorage();
// Same instance used by phone sign-in → carries request.auth on every write.
const auth = rnAuth();

// Upload a local file URI to Storage and return its download URL.
// Native: stream the file directly with putFile (no in-memory Blob — avoids the
// out-of-memory crashes that large videos cause on low-end Android devices).
async function uploadToStorage(path: string, localUri: string, contentType: string): Promise<string> {
  const fileRef = storageRef(storage, path);
  await putFile(fileRef, localUri, { contentType });
  return await getDownloadURL(fileRef);
}

export type Unsubscribe = () => void;

export {
  app,
  db,
  storage,
  auth,
  uploadToStorage,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  runTransaction,
  writeBatch,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteField,
};
