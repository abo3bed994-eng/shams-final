/**
 * Expo Push Notification Service
 * Handles token registration and sending push notifications via Expo Push API.
 * Uses lazy imports to avoid crashing on Android Expo Go (SDK 53+).
 */

import { Platform } from "react-native";
import { FS } from "@/lib/firebase";

let _Notifications: typeof import("expo-notifications") | null = null;
let _Device: typeof import("expo-device") | null = null;
let _initDone = false;

async function getNotifications() {
  if (!_Notifications) {
    try {
      _Notifications = await import("expo-notifications");
    } catch (_) {
      return null;
    }
  }
  return _Notifications;
}

async function getDevice() {
  if (!_Device) {
    try {
      _Device = await import("expo-device");
    } catch (_) {
      return null;
    }
  }
  return _Device;
}

async function initHandler() {
  if (_initDone) return;
  _initDone = true;
  try {
    const Notif = await getNotifications();
    if (!Notif) return;
    Notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldShowAlert: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (_) {}
}

/**
 * Register this device for push notifications.
 * Saves the Expo push token to Firestore.
 * Totally safe — will not throw even if push is unavailable.
 */
export async function registerForPushNotifications(
  phone: string,
  role: string
): Promise<string | null> {
  try {
    const Device = await getDevice();
    if (!Device || !Device.isDevice) return null;

    await initHandler();
    const Notifications = await getNotifications();
    if (!Notifications) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "طلبات جديدة",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        lightColor: "#C9A84C",
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync("messages", {
        name: "رسائل",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "إشعارات عامة",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        lightColor: "#C9A84C",
        enableVibrate: true,
        showBadge: true,
      });
    }

    let expoPushToken: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      expoPushToken = tokenData.data;
    } catch (e1) {
      console.warn("Could not get Expo push token:", e1);
      return null;
    }

    if (expoPushToken) {
      await FS.savePushToken(phone, role, expoPushToken);
    }
    return expoPushToken;
  } catch (err) {
    console.warn("registerForPushNotifications error:", err);
    return null;
  }
}

/**
 * Send push notifications via Expo Push API.
 * Can be called from the client — no server required.
 */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId = "messages"
): Promise<void> {
  const validTokens = tokens.filter(
    (t) => t && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
  );
  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    channelId,
    data: data ?? {},
    badge: 1,
  }));

  try {
    const payload = messages.length === 1 ? messages[0] : messages;
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Expo push send failed:", err);
  }
}

/**
 * Send push to all employees and supervisors (for new orders).
 */
export async function notifyStaffNewOrder(
  orderId: string,
  customerName: string
): Promise<void> {
  try {
    const tokens = await FS.getPushTokensByRoles(["admin", "employee", "supervisor"]);
    await sendExpoPush(
      tokens,
      "🛍️ طلب جديد!",
      `طلب جديد من ${customerName} — #${orderId.slice(0, 8)}`,
      { type: "new_order", orderId },
      "orders"
    );
  } catch (err) {
    console.warn("notifyStaffNewOrder error:", err);
  }
}

/**
 * Send push to a user identified by phone.
 */
export async function notifyUserByPhone(
  phone: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const token = await FS.getPushTokenByPhone(phone);
    if (token) await sendExpoPush([token], title, body, data, "messages");
  } catch (err) {
    console.warn("notifyUserByPhone error:", err);
  }
}

/**
 * Send push to all users with given roles.
 */
export async function notifyByRoles(
  roles: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const tokens = await FS.getPushTokensByRoles(roles);
    await sendExpoPush(tokens, title, body, data, "messages");
  } catch (err) {
    console.warn("notifyByRoles error:", err);
  }
}

/**
 * Send push to ALL registered users.
 */
export async function notifyAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const all = await FS.getAllPushTokens();
    await sendExpoPush(all.map((t) => t.expoPushToken), title, body, data, "messages");
  } catch (err) {
    console.warn("notifyAll error:", err);
  }
}
