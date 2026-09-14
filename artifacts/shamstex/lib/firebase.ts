// Firestore/Storage/Auth instances + the modular API come from the
// platform-resolved data layer (./fb on web, ./fb.native on native) so the
// native build shares its auth session with @react-native-firebase phone auth.
import {
  db,
  storage,
  auth,
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
} from "./fb";
import { RecaptchaVerifier, type ConfirmationResult } from "@firebase/auth";
import { canonicalPhone } from "./phoneUtils";

// Re-export the platform-resolved instances so existing importers keep working
// (phoneAuth.ts → auth, utils/persistImage.ts → storage).
export { db, storage, auth };

// Canonical Firestore doc key for a phone number. Strips formatting and prefers
// the canonical (last 10 digits) form so the same person resolves to the same
// document regardless of how the phone was typed (legacy local vs E.164).
function sessionKey(phone: string): string {
  const c = canonicalPhone(phone);
  return c || (phone || "").replace(/[^0-9A-Za-z]/g, "_") || "_";
}

let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

export function setupRecaptcha(): RecaptchaVerifier {
  if (recaptchaVerifierInstance) {
    try { recaptchaVerifierInstance.clear(); } catch {}
    recaptchaVerifierInstance = null;
  }

  const oldContainer = document.getElementById("recaptcha-container");
  if (oldContainer) {
    oldContainer.remove();
  }
  const container = document.createElement("div");
  container.id = "recaptcha-container";
  document.body.appendChild(container);

  recaptchaVerifierInstance = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {
      recaptchaVerifierInstance = null;
    },
  });
  return recaptchaVerifierInstance;
}

// Real phone authentication is implemented in lib/phoneAuth.ts using:
//   • Firebase JS SDK (web)
//   • @react-native-firebase/auth (native)
// The fake client-side OTP previously implemented here has been removed.
export type { ConfirmationResult };

// Firebase JS SDK throws on `undefined` field values. setDoc() replaces the
// whole document, so stripping undefined keys here is equivalent to deleting
// them — exactly what we want for unset-style updates (e.g. clearing
// bannedAt / bannedReason on unban).
function stripUndefined(value: any): any {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v));
  }
  if (value !== null && typeof value === "object") {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) clean[k] = stripUndefined(v);
    }
    return clean;
  }
  return value;
}

export const FS = {
  // NOTE: throws on read failure (network/rules) — callers must catch and fall
  // back to their local cache. Returning null here would be indistinguishable
  // from an authoritative "account does not exist", and login uses that signal
  // to purge the local cache of deleted accounts.
  async getCustomer(phone: string): Promise<any | null> {
    const snap = await getDoc(doc(db, "customers", phone));
    return snap.exists() ? snap.data() : null;
  },

  async saveCustomer(customer: object & { id: string; phone: string }) {
    // Use phone as Firestore doc ID — prevents duplicate docs per phone number
    const withTimestamp = { ...customer, lastUpdated: new Date().toISOString() };
    await setDoc(doc(db, "customers", customer.phone), stripUndefined(withTimestamp));
  },

  async deleteCustomer(phone: string) {
    await deleteDoc(doc(db, "customers", phone));
  },

  async getAllCustomers(): Promise<any[]> {
    const snap = await getDocs(collection(db, "customers"));
    return snap.docs.map((d) => d.data());
  },

  async saveProduct(product: object & { id: string }) {
    await setDoc(doc(db, "products", product.id), stripUndefined(product));
  },

  async deleteProduct(productId: string) {
    await deleteDoc(doc(db, "products", productId));
  },

  async getAllProducts(): Promise<any[]> {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map((d) => d.data());
  },

  async saveOrder(order: object & { id: string }) {
    await setDoc(doc(db, "orders", order.id), stripUndefined(order));
  },

  // Targeted field update on an order doc. Unlike saveOrder (full-doc setDoc),
  // this only touches the given fields, so field-restricted security rules
  // (e.g. the customer transfer-proof rule using affectedKeys().hasOnly)
  // can't be broken by unrelated local/remote drift. Pass `null` to remove
  // a field from the document.
  async patchOrder(orderId: string, fields: Record<string, any>) {
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      patch[key] = value === null ? deleteField() : value;
    }
    if (Object.keys(patch).length === 0) return;
    await updateDoc(doc(db, "orders", orderId), patch);
  },

  async getAllOrders(): Promise<any[]> {
    const snap = await getDocs(collection(db, "orders"));
    return snap.docs.map((d) => d.data());
  },

  async deleteOrder(orderId: string) {
    await deleteDoc(doc(db, "orders", orderId));
  },

  // Delete every order belonging to a given user phone. Used when an admin
  // changes a user's role so stale pending orders don't leak across roles.
  async deleteOrdersForUserPhone(userPhone: string) {
    if (!userPhone) return;
    const variants = new Set<string>();
    variants.add(userPhone);
    const canon = canonicalPhone(userPhone);
    if (canon) variants.add(canon);
    const all: any[] = [];
    for (const v of variants) {
      try {
        const snap = await getDocs(query(collection(db, "orders"), where("userPhone", "==", v)));
        for (const d of snap.docs) all.push(d);
      } catch {}
    }
    const seen = new Set<string>();
    // Keep COMPLETED orders (delivered / shipped) — only those are a permanent
    // record. Everything still in-flight is removed so it doesn't carry across a
    // role change (retail ⇄ wholesale pricing would otherwise be inconsistent).
    const COMPLETED = new Set(["delivered", "shipped"]);
    await Promise.all(
      all
        .filter((d) => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          const status = (d.data() as any)?.status;
          if (COMPLETED.has(status)) return false;
          return true;
        })
        .map((d) => deleteDoc(d.ref).catch(() => {}))
    );
  },

  async saveSettings(settings: object) {
    // Same as products/orders: strip undefined recursively. The settings blob
    // is large and nested (payment, subcategories, stats, workingHours,
    // globalColors, featuredProductIds…); a single nested `undefined` makes
    // setDoc throw, which surfaced as a generic "تأكد من اتصال الإنترنت" and
    // meant featured/colors/settings edits saved locally but never to the
    // server (so they showed only for the person who made the change).
    await setDoc(doc(db, "config", "main"), stripUndefined(settings));
  },

  async getSettings(): Promise<any | null> {
    const snap = await getDoc(doc(db, "config", "main"));
    return snap.exists() ? snap.data() : null;
  },

  subscribeSettings(callback: (settings: any | null) => void): Unsubscribe {
    return onSnapshot(
      doc(db, "config", "main"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      () => {}
    );
  },

  subscribeProducts(callback: (products: any[]) => void): Unsubscribe {
    return onSnapshot(
      collection(db, "products"),
      (snap) => callback(snap.docs.map((d) => d.data())),
      () => {}
    );
  },

  subscribeOrders(callback: (orders: any[]) => void): Unsubscribe {
    // Try with orderBy, fallback to unordered on error
    let unsub = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        const data = snap.docs.map((d) => d.data());
        callback(data);
      },
      (_err) => {
        // Fallback: subscribe without ordering
        unsub = onSnapshot(
          collection(db, "orders"),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  // Privacy-aware: customers see only their own orders; staff see all.
  // Queries by userPhone to align with Firestore rules that authorize via
  // request.auth.token.phone_number.
  subscribeOrdersForUser(
    userPhone: string,
    isStaff: boolean,
    callback: (orders: any[]) => void
  ): Unsubscribe {
    if (isStaff) {
      return FS.subscribeOrders(callback);
    }
    let unsub = onSnapshot(
      query(collection(db, "orders"), where("userPhone", "==", userPhone), orderBy("createdAt", "desc")),
      (snap) => callback(snap.docs.map((d) => d.data())),
      (_err) => {
        unsub = onSnapshot(
          query(collection(db, "orders"), where("userPhone", "==", userPhone)),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  // Atomic claim: prevents two staff from receiving the same order at once.
  async claimOrder(orderId: string, staffId: string, staffName: string, staffPhone?: string): Promise<{ ok: boolean; reason?: string; takenBy?: string; takenById?: string; takenByPhone?: string }> {
    try {
      const result = await runTransaction(db, async (tx) => {
        const ref = doc(db, "orders", orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return { ok: false, reason: "not_found" } as const;
        const data = snap.data() as any;
        if (data.assignedTo && data.assignedTo !== staffId) {
          return {
            ok: false,
            reason: "already_taken",
            takenBy: data.assignedToName ?? data.assignedTo,
            takenById: data.assignedTo,
            takenByPhone: data.assignedToPhone,
          } as const;
        }
        const update: Record<string, any> = {
          status: "received",
          assignedTo: staffId,
          assignedToName: staffName,
        };
        if (staffPhone) update.assignedToPhone = staffPhone;
        tx.update(ref, update);
        return { ok: true } as const;
      });
      return result;
    } catch (e) {
      return { ok: false, reason: "tx_failed" };
    }
  },

  async appendAuditLog(entry: {
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetId?: string;
    targetType?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      await addDoc(collection(db, "audit_log"), {
        ...entry,
        createdAt: new Date().toISOString(),
        ts: serverTimestamp(),
      });
    } catch (e) {
      console.warn("audit log failed:", e);
    }
  },

  subscribeAuditLog(callback: (entries: any[]) => void, max = 200): Unsubscribe {
    let unsub = onSnapshot(
      query(collection(db, "audit_log"), orderBy("createdAt", "desc"), limit(max)),
      (snap) => callback(snap.docs.map((d) => d.data())),
      (_err) => {
        unsub = onSnapshot(
          query(collection(db, "audit_log"), limit(max)),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  subscribeCustomers(callback: (customers: any[]) => void): Unsubscribe {
    return onSnapshot(
      collection(db, "customers"),
      (snap) => callback(snap.docs.map((d) => d.data())),
      () => {}
    );
  },

  // Single-doc listener for own customer record (used by customer/merchant
  // sessions to receive role/vip/permission updates without paying for the
  // full customers collection scan on every change).
  subscribeCustomerByPhone(phone: string, callback: (customer: any | null) => void): Unsubscribe {
    return onSnapshot(
      doc(db, "customers", phone),
      (snap) => callback(snap.exists() ? snap.data() : null),
      () => {}
    );
  },

  subscribeNotifications(callback: (notifs: any[]) => void): Unsubscribe {
    let unsub = onSnapshot(
      query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(200)),
      (snap) => callback(snap.docs.map((d) => d.data())),
      (_err) => {
        unsub = onSnapshot(
          query(collection(db, "notifications"), limit(200)),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  // Privacy + cost aware: customers/merchants only subscribe to their own
  // targeted notifications + role/all broadcasts. Staff fall through to the
  // unfiltered subscription. We use two parallel listeners and merge in memory
  // so we don't need a composite Firestore index.
  subscribeNotificationsForUser(
    userId: string,
    userPhone: string,
    role: string,
    isStaff: boolean,
    callback: (notifs: any[]) => void
  ): Unsubscribe {
    if (isStaff) {
      return FS.subscribeNotifications(callback);
    }
    const merged = new Map<string, any>();
    const emit = () => {
      const arr = [...merged.values()].sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      );
      callback(arr);
    };
    // Query private notifications by targetUserPhone (matches Firestore rules
    // that authorize via auth.token.phone_number). Notifications without
    // targetUserPhone (legacy) won't be visible to non-staff users.
    const subTargeted = onSnapshot(
      query(collection(db, "notifications"), where("targetUserPhone", "==", userPhone), limit(100)),
      (snap) => {
        // Remove any previously stored docs from this listener that no longer match,
        // then add/update fresh ones.
        const incoming = new Set(snap.docs.map((d) => d.id));
        for (const [k, v] of merged) {
          if ((v as any).__src === "t" && !incoming.has(k)) merged.delete(k);
        }
        snap.docs.forEach((d) => merged.set(d.id, { ...d.data(), __src: "t" }));
        emit();
      },
      () => {}
    );
    const subRole = onSnapshot(
      query(collection(db, "notifications"), where("targetRole", "in", ["all", role]), limit(100)),
      (snap) => {
        const incoming = new Set(snap.docs.map((d) => d.id));
        for (const [k, v] of merged) {
          if ((v as any).__src === "r" && !incoming.has(k)) merged.delete(k);
        }
        snap.docs.forEach((d) => merged.set(d.id, { ...d.data(), __src: "r" }));
        emit();
      },
      () => {}
    );
    return () => {
      subTargeted();
      subRole();
    };
  },

  async saveNotification(notification: object & { id: string }) {
    // Strip client-only metadata before persisting.
    const { __src, ...clean } = notification as any;
    await setDoc(doc(db, "notifications", notification.id), clean);
  },

  // Mark a single notification's `read` flag without touching other fields.
  // Pairs with the strict Firestore rule that limits non-staff updates to
  // affectedKeys().hasOnly(['read']).
  async markNotificationReadFlag(id: string) {
    await updateDoc(doc(db, "notifications", id), { read: true });
  },

  async batchMarkRead(ids: string[]) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + BATCH_SIZE);
      for (const id of chunk) {
        batch.set(doc(db, "notifications", id), { read: true }, { merge: true });
      }
      await batch.commit();
    }
  },

  async saveReturnRequest(req: object & { id: string }) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(req)) {
      if (v !== undefined) clean[k] = v;
    }
    await setDoc(doc(db, "returnRequests", req.id), clean);
  },

  subscribeReturnRequests(callback: (reqs: any[]) => void): Unsubscribe {
    let unsub = onSnapshot(
      query(collection(db, "returnRequests"), orderBy("createdAt", "desc")),
      (snap) => callback(snap.docs.map((d) => d.data())),
      (_err) => {
        unsub = onSnapshot(
          collection(db, "returnRequests"),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  // Customer/merchant: only their own returns. Staff: all returns.
  // Queries by userPhone to align with Firestore rules that authorize via
  // request.auth.token.phone_number.
  subscribeReturnRequestsForUser(
    userPhone: string,
    isStaff: boolean,
    callback: (reqs: any[]) => void
  ): Unsubscribe {
    if (isStaff) {
      return FS.subscribeReturnRequests(callback);
    }
    let unsub = onSnapshot(
      query(collection(db, "returnRequests"), where("userPhone", "==", userPhone), orderBy("createdAt", "desc")),
      (snap) => callback(snap.docs.map((d) => d.data())),
      (_err) => {
        unsub = onSnapshot(
          query(collection(db, "returnRequests"), where("userPhone", "==", userPhone)),
          (snap) => callback(snap.docs.map((d) => d.data())),
          () => {}
        );
      }
    );
    return () => unsub();
  },

  async saveSession(phone: string, token: string) {
    // Sessions are keyed by the exact E.164 phone number so the rule
    // `phone == request.auth.token.phone_number` matches.
    await setDoc(doc(db, "sessions", phone), { token, phone, updatedAt: new Date().toISOString() });
  },

  async getSession(phone: string): Promise<string | null> {
    const snap = await getDoc(doc(db, "sessions", phone));
    return snap.exists() ? snap.data().token : null;
  },

  subscribeSession(phone: string, callback: (token: string | null) => void): Unsubscribe {
    return onSnapshot(
      doc(db, "sessions", phone),
      (snap) => callback(snap.exists() ? (snap.data().token as string) : null),
      () => {}
    );
  },

  // Push notification tokens — keyed by user phone
  async savePushToken(phone: string, role: string, expoPushToken: string) {
    await setDoc(doc(db, "pushTokens", phone), {
      phone,
      role,
      expoPushToken,
      updatedAt: new Date().toISOString(),
    });
  },

  async deletePushToken(phone: string) {
    await deleteDoc(doc(db, "pushTokens", phone));
  },

  async getPushTokensByRoles(roles: string[]): Promise<string[]> {
    const snap = await getDocs(collection(db, "pushTokens"));
    return snap.docs
      .map((d) => d.data())
      .filter((d) => roles.includes(d.role) && d.expoPushToken)
      .map((d) => d.expoPushToken as string);
  },

  async getPushTokenByPhone(phone: string): Promise<string | null> {
    const snap = await getDoc(doc(db, "pushTokens", phone));
    return snap.exists() ? (snap.data().expoPushToken as string) : null;
  },

  async getAllPushTokens(): Promise<{ phone: string; role: string; expoPushToken: string }[]> {
    const snap = await getDocs(collection(db, "pushTokens"));
    return snap.docs.map((d) => d.data() as any);
  },

  async setPresence(userId: string, info: { name: string; role: string; phone?: string }) {
    await setDoc(doc(db, "presence", userId), {
      userId,
      name: info.name,
      role: info.role,
      phone: info.phone || "",
      lastSeen: Date.now(),
    });
  },

  async clearPresence(userId: string) {
    await deleteDoc(doc(db, "presence", userId)).catch(() => {});
  },

  subscribePresence(callback: (entries: { userId: string; name: string; role: string; phone: string; lastSeen: number }[]) => void): Unsubscribe {
    return onSnapshot(collection(db, "presence"), (snap) => {
      callback(snap.docs.map((d) => d.data() as any));
    });
  },

  // OTP rate limiting — keyed by canonical phone. Returns whether the request
  // is allowed AND a retry-after message if blocked. Uses a transaction so
  // concurrent requests cannot bypass the limit.
  async checkOtpThrottle(
    phone: string,
    options: { maxPerWindow?: number; windowMs?: number } = {}
  ): Promise<{ allowed: boolean; retryAfterMs?: number; remaining?: number }> {
    const max = options.maxPerWindow ?? 5;
    const win = options.windowMs ?? 24 * 60 * 60 * 1000; // 24h
    const key = sessionKey(phone);
    const ref = doc(db, "otpThrottle", key);
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      if (!snap.exists()) {
        tx.set(ref, { count: 1, windowStart: now, phone });
        return { allowed: true, remaining: max - 1 };
      }
      const data = snap.data() as any;
      const elapsed = now - (data.windowStart || 0);
      if (elapsed >= win) {
        // Window expired — reset.
        tx.set(ref, { count: 1, windowStart: now, phone });
        return { allowed: true, remaining: max - 1 };
      }
      if ((data.count || 0) >= max) {
        return { allowed: false, retryAfterMs: win - elapsed };
      }
      tx.update(ref, { count: (data.count || 0) + 1 });
      return { allowed: true, remaining: max - 1 - (data.count || 0) };
    });
  },
};
