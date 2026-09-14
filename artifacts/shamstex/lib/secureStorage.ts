import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SecureStore: typeof import("expo-secure-store") | null = null;
try {
  if (Platform.OS !== "web") {
    SecureStore = require("expo-secure-store");
  }
} catch {
  SecureStore = null;
}

const SENSITIVE_KEYS = ["sessionToken"] as const;

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {}
  }
  await AsyncStorage.setItem(`secure_${key}`, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (SecureStore) {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v !== null) return v;
    } catch {}
  }
  return AsyncStorage.getItem(`secure_${key}`);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
  await AsyncStorage.removeItem(`secure_${key}`);
}

export { SENSITIVE_KEYS };
