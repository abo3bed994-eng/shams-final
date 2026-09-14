// Platform-resolved Firebase data layer — WEB / default implementation.
//
// This file is picked by Metro on web (and used by tsc for type resolution).
// The native counterpart `fb.native.ts` provides the same export surface backed
// by @react-native-firebase so that Firestore/Storage share the SAME auth
// session as native phone sign-in (otherwise native writes run unauthenticated
// and Firestore rules reject them → "تعذّر الحفظ").
import { initializeApp, getApps, getApp, type FirebaseApp } from "@firebase/app";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
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
  type Unsubscribe,
} from "@firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "@firebase/storage";
import { getAuth, type Auth } from "@firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyD9tLziFlwyRBpSgMj0Pa_qfNG--XP2csQ",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "shamstexapp.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "shamstexapp",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "shamstexapp.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID || "22978900641",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:22978900641:web:c9fdc26bb0b7baea8db6e0",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HK64J683SZ",
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch {
  db = getFirestore(app);
}

const storage = getStorage(app);

let auth: Auth;
try {
  auth = getAuth(app);
  auth.languageCode = "ar";
} catch {
  auth = getAuth(app);
}

// Upload a local/blob URI to Storage and return its download URL.
// Web: convert the URI to a Blob and use a resumable upload.
async function uploadToStorage(path: string, localUri: string, contentType: string): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const fileRef = storageRef(storage, path);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, blob, { contentType });
    task.on("state_changed", undefined, (err) => reject(err), () => resolve());
  });
  return await getDownloadURL(fileRef);
}

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
export type { Unsubscribe };
