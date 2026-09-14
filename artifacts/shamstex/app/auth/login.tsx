import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/lib/i18n";
import GoldButton from "@/components/GoldButton";
import Icon from "@/components/Icon";
import CountryPicker from "@/components/CountryPicker";
import { COUNTRIES, DEFAULT_COUNTRY, Country } from "@/lib/countries";
import { isValidLocal, toE164, migrateLocalToE164, samePhone } from "@/lib/phoneUtils";
import { startPhoneSignIn, getCurrentAuthPhone, PhoneAuthConfirmation } from "@/lib/phoneAuth";
import { cardShadow } from "@/constants/shadows";

type Step = "phone" | "otp" | "name" | "enterPin" | "setPin";

// Primary admin account (the one signed in when secret bypass is used)
const PRIMARY_ADMIN = { id: "u0", phone: "+201221131138", name: "المدير", role: "admin" as const };

// Phones that should ALWAYS be treated as admin, even if their Firestore record
// says otherwise (e.g. owner registered earlier as a customer). Must match the
// `isOwnerPhone()` whitelist in firestore.rules.
const OWNER_PHONES = new Set<string>([
  "+201221131138",
]);
const isOwnerPhone = (phone: string) => OWNER_PHONES.has(phone);

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUser, findCustomerByPhone, registerCustomer, updateRegisteredCustomer, purgeCustomerCache, settings, setCustomerPin, verifyCustomerPin, language, theme, setTheme } = useApp();
  const systemScheme = useColorScheme();
  const themeResolved: "dark" | "light" =
    theme === "system" ? (systemScheme === "light" ? "light" : "dark") : theme;
  const { t } = useTranslation();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinPurpose, setPinPurpose] = useState<"newUser" | "existingNoPin" | "reset">("newUser");
  const confirmRef = useRef<PhoneAuthConfirmation | null>(null);
  const forgotPinModeRef = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const e164Phone = toE164(country, phone);
  const phoneValid = isValidLocal(country, phone);

  // Cache-first, Firestore-fallback customer lookup. Critical now that
  // customers/merchants no longer subscribe to the full customers collection:
  // a first-time login on a new device has no local cache, so we MUST query
  // Firestore directly to detect existing accounts and avoid overwriting them.
  const lookupCustomer = async (p: string): Promise<any | undefined> => {
    // ALWAYS verify with Firestore — even if cached. If the admin deleted the
    // account on another device, the local cache may still have the record
    // (including a PIN hash) and would otherwise let a deleted user back in.
    try {
      const { FS } = await import("@/lib/firebase");
      const fresh = await FS.getCustomer(p);
      if (fresh) {
        updateRegisteredCustomer(fresh as any);
        return fresh;
      }
      // Firestore says no such customer → treat as new account regardless of
      // local cache. Purge the stale cached record too: otherwise finishLogin/
      // registerCustomer would resurrect its old role/permissions/phone format
      // and the recreated doc would be rejected by security rules, locking the
      // user out with "تم حذف حسابك" forever.
      purgeCustomerCache(p);
      return undefined;
    } catch {
      // Network/Firestore failure: fall back to cache so legitimate users
      // aren't locked out when offline.
      const cached = findCustomerByPhone(p);
      return cached;
    }
  };

  // ---------- Phone submit: PIN-first routing ----------
  const handlePhoneSubmit = async () => {
    if (!phoneValid) {
      setError("رقم الهاتف غير صحيح");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError("");
    // Owner phones bypass PIN — go straight to OTP
    if (isOwnerPhone(e164Phone)) {
      forgotPinModeRef.current = false;
      await sendOtp();
      return;
    }
    const existing = await lookupCustomer(e164Phone);
    if (existing && (existing as any).banned) {
      setError(
        (existing as any).bannedReason
          ? `تم حظر هذا الحساب: ${(existing as any).bannedReason}`
          : "تم حظر هذا الحساب من قِبل الإدارة."
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (existing) {
      setPin("");
      setConfirmPin("");
      if (existing.pin) {
        // PIN is only a QUICK-UNLOCK for a device that already holds a
        // matching Firebase phone-auth identity. A brand-new device must
        // verify via OTP first — otherwise it would have no Firebase auth
        // session, Firestore rules would silently reject its session
        // registration (breaking single-device enforcement) and every other
        // protected write (orders, uploads).
        const authPhone = getCurrentAuthPhone();
        if (authPhone && samePhone(authPhone, e164Phone)) {
          setStep("enterPin");
        } else {
          forgotPinModeRef.current = false;
          await sendOtp();
        }
      } else {
        // SECURITY: existing account without PIN must verify ownership via SMS
        // before being allowed to set one — otherwise anyone who knows the
        // phone number could claim the account.
        forgotPinModeRef.current = true;
        await sendOtp();
      }
      return;
    }
    // New customer → OTP first, then name, then setPin
    forgotPinModeRef.current = false;
    await sendOtp();
  };

  // ---------- Real OTP send ----------
  const sendOtp = async () => {
    setLoading(true);
    // Rate-limit OTP requests: 5 per phone per 24 hours. Owner phones are exempt.
    if (!isOwnerPhone(e164Phone)) {
      try {
        const { FS } = await import("@/lib/firebase");
        const result = await FS.checkOtpThrottle(e164Phone);
        if (!result.allowed) {
          const hours = Math.ceil((result.retryAfterMs || 0) / (60 * 60 * 1000));
          setError(
            `وصلت الحد الأقصى للمحاولات. حاول مرة أخرى بعد ${hours} ساعة.`
          );
          setLoading(false);
          return;
        }
      } catch (throttleErr: any) {
        // If throttle check itself fails, let the request through rather than
        // blocking legitimate users.
        console.warn("[OTP throttle] check failed:", throttleErr?.message || throttleErr);
      }
    }
    try {
      const conf = await startPhoneSignIn(e164Phone);
      confirmRef.current = conf;
      setStep("otp");
    } catch (e: any) {
      const code = e?.code || "";
      const msg = String(e?.message || e);
      // Log details to the developer console only (dev builds) — never surface
      // to user, and never log the phone number.
      if (__DEV__) console.log("[PhoneAuth ERROR]", { code, msg });
      let friendly = "تعذّر إرسال الكود حالياً، حاول مرة أخرى";
      if (msg.includes("quota")) friendly = "وصلت الحصة اليومية للرسائل، حاول غداً";
      else if (code.includes("invalid-phone") || msg.includes("invalid-phone")) friendly = "رقم الهاتف غير صحيح";
      else if (code.includes("too-many-requests") || msg.includes("too-many-requests")) friendly = "محاولات كثيرة، انتظر قليلاً";
      else if (msg.includes("network") || msg.includes("Network")) friendly = "تعذّر الاتصال بالإنترنت";
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Real OTP verify ----------
  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError("");

    if (!confirmRef.current) {
      setError("انتهت صلاحية الجلسة، أعد المحاولة");
      setLoading(false);
      return;
    }
    try {
      const result = await confirmRef.current.confirm(otp);
      const verifiedPhone = result.phoneNumber || e164Phone;
      const existing = await lookupCustomer(verifiedPhone);
      if (existing && (existing as any).banned && !isOwnerPhone(verifiedPhone)) {
        setError(
          (existing as any).bannedReason
            ? `تم حظر هذا الحساب: ${(existing as any).bannedReason}`
            : "تم حظر هذا الحساب من قِبل الإدارة."
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      // Owner phones bypass PIN entirely
      if (isOwnerPhone(verifiedPhone) && existing) {
        await finishLogin(existing.name, existing.role as any, { ...existing, phone: verifiedPhone });
      } else if (forgotPinModeRef.current && existing) {
        // Forgot-PIN flow: OTP verified → set new PIN
        forgotPinModeRef.current = false;
        setPin("");
        setConfirmPin("");
        setPinPurpose("reset");
        setStep("setPin");
      } else if (existing) {
        // Existing user (no forgot-pin) — should not normally happen since
        // existing users skip OTP. But if reached, route by pin presence.
        if (existing.pin) {
          setStep("enterPin");
        } else {
          setPinPurpose("existingNoPin");
          setStep("setPin");
        }
      } else {
        // Always store new accounts under E.164
        setStep("name");
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (__DEV__) console.log("[OTP verify ERROR]", { msg });
      let friendly = "كود التحقق غير صحيح";
      if (msg.includes("expired") || msg.includes("session-expired")) {
        friendly = "انتهت صلاحية الكود، أعد إرساله";
      }
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp("");
    setError("");
    await sendOtp();
  };

  const handleForgotPin = async () => {
    setError("");
    forgotPinModeRef.current = true;
    await sendOtp();
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      setError("الرمز السري يجب أن يكون 4 أرقام");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError("");
    try {
      let ok = verifyCustomerPin(e164Phone, pin);
      // Fallback: local cache may be stale (e.g. PIN was just set on another
      // device, or Firestore subscription hasn't caught up yet). Refetch the
      // authoritative customer doc and retry once before showing an error.
      if (!ok) {
        try {
          const { FS } = await import("@/lib/firebase");
          const fresh = await FS.getCustomer(e164Phone);
          if (fresh) {
            await updateRegisteredCustomer(fresh as any);
            await new Promise((r) => setTimeout(r, 50));
            ok = verifyCustomerPin(e164Phone, pin);
          }
        } catch {}
      }
      if (!ok) {
        setError("الرمز السري غير صحيح");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const existing = findCustomerByPhone(e164Phone);
      if (!existing) {
        setError("الحساب غير موجود");
        return;
      }
      // Authoritative ban recheck: a user could be banned between phone-submit
      // and PIN entry. Fetch fresh customer doc before granting access. Owner
      // phones are exempt (can never be banned).
      if (!isOwnerPhone(e164Phone)) {
        try {
          const { FS } = await import("@/lib/firebase");
          const fresh = await FS.getCustomer(e164Phone);
          if (fresh && (fresh as any).banned) {
            await updateRegisteredCustomer(fresh as any);
            setError(
              (fresh as any).bannedReason
                ? `تم حظر هذا الحساب: ${(fresh as any).bannedReason}`
                : "تم حظر هذا الحساب من قِبل الإدارة."
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
        } catch {
          // Network failure: fall back to cached existing record check.
          if ((existing as any).banned) {
            setError("تم حظر هذا الحساب من قِبل الإدارة.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
        }
      }
      // Defensive: NEVER finish a PIN login on a device without a matching
      // Firebase auth identity (protected writes would all silently fail).
      const authPhone = getCurrentAuthPhone();
      if (!authPhone || !samePhone(authPhone, e164Phone)) {
        forgotPinModeRef.current = false;
        await sendOtp();
        return;
      }
      await finishLogin(existing.name, existing.role as any, { ...existing, phone: e164Phone });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPinSubmit = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("الرمز السري يجب أن يكون 4 أرقام");
      return;
    }
    if (pin !== confirmPin) {
      setError("الرمزان غير متطابقين");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError("");
    try {
      await setCustomerPin(e164Phone, pin);
      const existing = findCustomerByPhone(e164Phone);
      if (existing && existing.pin) {
        // Pass the freshly-persisted record (with PIN) so finishLogin's
        // registerCustomer write does not clobber it.
        await finishLogin(existing.name, existing.role as any, { ...existing, phone: e164Phone });
      } else {
        setError("تعذّر حفظ الرمز السري، حاول مرة أخرى");
      }
    } catch (e: any) {
      setError("تعذّر حفظ الرمز السري");
    } finally {
      setLoading(false);
    }
  };

  // ---------- New customer name ----------
  const handleNameSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    const isOwner = isOwnerPhone(e164Phone);
    const newUser = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
      phone: e164Phone,
      name: trimmed,
      role: (isOwner ? "admin" : "customer") as "admin" | "customer",
      registeredAt: new Date().toISOString(),
    };
    if (isOwner) {
      // Force-update so an old customer record gets upgraded — owners skip PIN.
      updateRegisteredCustomer(newUser as any);
      await finishLogin(trimmed, newUser.role, newUser);
      return;
    }
    setLoading(true);
    try {
      // Cap the awaited Firestore write at 10s. The local AsyncStorage write
      // inside registerCustomer is synchronous-ish and already completes; this
      // timeout just prevents a hung backend from freezing the signup button.
      await Promise.race([
        registerCustomer(newUser),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
    } finally {
      setLoading(false);
    }
    // After registering, prompt the new customer to set a 4-digit PIN.
    setPin("");
    setConfirmPin("");
    setPinPurpose("newUser");
    setStep("setPin");
  };

  // ---------- DEV-ONLY admin login (stripped from production builds) ----------
  // Lets developers enter the app as the primary admin without sending a real
  // SMS. Guarded by __DEV__ so it never ships in a release build. In production
  // the owner signs in normally with the owner phone + real OTP (isOwnerPhone).
  const handleDevLogin = async () => {
    if (!__DEV__) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const existing = findCustomerByPhone(PRIMARY_ADMIN.phone);
    const userObj = existing
      ? { ...existing, phone: PRIMARY_ADMIN.phone, role: "admin" as const }
      : { ...PRIMARY_ADMIN };
    await finishLogin(userObj.name, "admin", userObj);
  };

  // ---------- Finish login (shared) ----------
  const finishLogin = async (
    displayName: string,
    role: "admin" | "supervisor" | "merchant" | "employee" | "customer",
    existingUser: any
  ) => {
    setLoading(true);
    const sessionToken = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const phoneToUse = existingUser?.phone || e164Phone;

    const existingRecord = findCustomerByPhone(phoneToUse);
    const ownerOverride = isOwnerPhone(phoneToUse);
    // Prefer the explicit caller-provided role (handles admin bypass overriding stale registry).
    // Owner phones are ALWAYS upgraded to admin, regardless of any stale "customer" record.
    const resolvedRole = ownerOverride
      ? ("admin" as const)
      : (existingUser?.role || existingRecord?.role || role);
    const resolvedPerms = existingUser?.permissions ?? existingRecord?.permissions;
    const resolvedVip = existingUser?.vip ?? existingRecord?.vip;

    const userToSet = {
      ...(existingUser ?? {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
        phone: phoneToUse,
        name: displayName,
      }),
      phone: phoneToUse,
      role: resolvedRole,
      permissions: resolvedPerms,
      vip: resolvedVip,
      sessionToken,
    };
    // Sessions MUST be keyed by the E.164 phone so firestore.rules
    // (`phone == request.auth.token.phone_number`) accepts the write. A legacy
    // local-format phone here would get silently rejected, leaving the OLD
    // token on the server — and the enforcement listener would then kick this
    // device right after login ("تم تسجيل الدخول من جهاز آخر").
    let sessionSaved = false;
    try {
      const { FS } = await import("@/lib/firebase");
      const sessionKey = migrateLocalToE164(userToSet.phone);
      try {
        await FS.saveSession(sessionKey, sessionToken);
        sessionSaved = true;
      } catch {
        // One retry for transient network hiccups.
        await FS.saveSession(sessionKey, sessionToken);
        sessionSaved = true;
      }
    } catch {}
    if (!sessionSaved) {
      // Couldn't register this session (offline or rules rejection). Do NOT
      // keep a local token: the enforcement listener would compare it against
      // a stale remote token and immediately log this device out. Skipping the
      // token simply disables single-device enforcement for this session.
      delete (userToSet as any).sessionToken;
      try {
        const { deleteSecureItem } = await import("@/lib/secureStorage");
        await deleteSecureItem("sessionToken");
      } catch {}
    }
    if (ownerOverride) {
      // updateRegisteredCustomer overwrites role; registerCustomer would preserve
      // the stale "customer" role and silently keep the owner downgraded.
      updateRegisteredCustomer(userToSet);
    } else {
      await registerCustomer(userToSet);
    }
    await setUser(userToSet);
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTheme(themeResolved === "dark" ? "light" : "dark");
            }}
            hitSlop={10}
            style={[
              styles.themeToggle,
              {
                backgroundColor: themeResolved === "dark" ? colors.gold + "22" : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Icon name={themeResolved === "dark" ? "moon" : "sun"} size={18} color={colors.gold} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={[styles.brand, { color: colors.gold, fontFamily: language === "ar" ? "Amiri_700Bold" : "Inter_700Bold" }]}>
            {t("tagline")}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            cardShadow(colors.isDark, "soft"),
          ]}
        >
          {step === "phone" && (
            <>
              <View style={styles.stepIcon}>
                <Icon name="smartphone" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {t("login")}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("enterPhone")}
              </Text>

              <View style={{ gap: 8 }}>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 },
                  ]}
                >
                  <Pressable
                    onPress={() => setShowCountryPicker(true)}
                    style={[styles.countryCodeBox, { borderLeftColor: colors.border }]}
                  >
                    <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {country.dial}
                    </Text>
                    <Icon name="chevron-down" size={14} color={colors.mutedForeground} />
                  </Pressable>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                    placeholder={t("phone")}
                    placeholderTextColor={colors.mutedForeground}
                    value={phone}
                    onChangeText={(val) => { setPhone(val); setError(""); }}
                    keyboardType="phone-pad"
                    textAlign="right"
                    returnKeyType="done"
                    onSubmitEditing={handlePhoneSubmit}
                  />
                  <Icon name="phone" size={18} color={colors.mutedForeground} />
                </View>
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#E74C3C11", borderColor: "#E74C3C44" }]}>
                  <Icon name="alert-circle" size={14} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <GoldButton
                label={t("sendOtp")}
                onPress={handlePhoneSubmit}
                loading={loading}
                disabled={!phoneValid}
                style={{ width: "100%" }}
              />

              {__DEV__ ? (
                <Pressable onPress={handleDevLogin} style={{ marginTop: 12, alignSelf: "center" }} hitSlop={8}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    دخول مطوّر (تجريبي)
                  </Text>
                </Pressable>
              ) : null}

              <View style={[styles.divider, { borderColor: colors.border }]} />
              <Text style={[styles.newCustomerNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("newCustomer")}
              </Text>
            </>
          )}

          {step === "otp" && (
            <>
              <View style={styles.backRow}>
                <Pressable onPress={() => { setStep("phone"); setOtp(""); setError(""); confirmRef.current = null; }}>
                  <Icon name="arrow-right" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.stepIcon}>
                <Icon name="lock" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {t("otpTitle")}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {`${t("otpSentTo")} ${e164Phone}`}
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 },
                ]}
              >
                <Icon name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold", letterSpacing: 8 }]}
                  placeholder="_ _ _ _ _ _"
                  placeholderTextColor={colors.mutedForeground}
                  value={otp}
                  onChangeText={(val) => { setOtp(val); setError(""); }}
                  keyboardType="numeric"
                  textAlign="center"
                  maxLength={6}
                  returnKeyType="done"
                  autoFocus
                  onSubmitEditing={handleVerifyOtp}
                />
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#E74C3C11", borderColor: "#E74C3C44" }]}>
                  <Icon name="alert-circle" size={14} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <GoldButton
                label={t("verify")}
                onPress={handleVerifyOtp}
                loading={loading}
                disabled={otp.length < 6}
                style={{ width: "100%" }}
              />

              <Pressable onPress={handleResendOtp} disabled={loading}>
                <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" }}>
                  إعادة إرسال الكود
                </Text>
              </Pressable>
            </>
          )}

          {step === "enterPin" && (
            <>
              <View style={styles.backRow}>
                <Pressable onPress={() => { setStep("phone"); setPin(""); setError(""); }}>
                  <Icon name="arrow-right" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.stepIcon}>
                <Icon name="lock" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                الرمز السري
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                أدخل الرمز السري المكوّن من 4 أرقام
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Icon name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold", letterSpacing: 12 }]}
                  placeholder="• • • •"
                  placeholderTextColor={colors.mutedForeground}
                  value={pin}
                  onChangeText={(v) => { setPin(v.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                  keyboardType="numeric"
                  textAlign="center"
                  maxLength={4}
                  secureTextEntry
                  autoFocus
                  onSubmitEditing={handleVerifyPin}
                />
              </View>
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#E74C3C11", borderColor: "#E74C3C44" }]}>
                  <Icon name="alert-circle" size={14} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>{error}</Text>
                </View>
              ) : null}
              <GoldButton label="دخول" onPress={handleVerifyPin} loading={loading} disabled={pin.length !== 4} style={{ width: "100%" }} />
              <Pressable onPress={handleForgotPin} disabled={loading}>
                <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" }}>
                  نسيت الرمز السري؟ إعادة تعيين عبر SMS
                </Text>
              </Pressable>
            </>
          )}

          {step === "setPin" && (
            <>
              <View style={styles.backRow}>
                <Pressable onPress={() => { setStep("phone"); setPin(""); setConfirmPin(""); setError(""); }}>
                  <Icon name="arrow-right" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.stepIcon}>
                <Icon name="shield" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {pinPurpose === "reset" ? "إعادة تعيين الرمز السري" : "إنشاء رمز سري"}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                اختر رمزاً مكوّناً من 4 أرقام لتسجيل الدخول السريع
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Icon name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold", letterSpacing: 12 }]}
                  placeholder="رمز جديد"
                  placeholderTextColor={colors.mutedForeground}
                  value={pin}
                  onChangeText={(v) => { setPin(v.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                  keyboardType="numeric"
                  textAlign="center"
                  maxLength={4}
                  secureTextEntry
                  autoFocus
                />
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Icon name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold", letterSpacing: 12 }]}
                  placeholder="تأكيد الرمز"
                  placeholderTextColor={colors.mutedForeground}
                  value={confirmPin}
                  onChangeText={(v) => { setConfirmPin(v.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                  keyboardType="numeric"
                  textAlign="center"
                  maxLength={4}
                  secureTextEntry
                  onSubmitEditing={handleSetPinSubmit}
                />
              </View>
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#E74C3C11", borderColor: "#E74C3C44" }]}>
                  <Icon name="alert-circle" size={14} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>{error}</Text>
                </View>
              ) : null}
              <GoldButton label="حفظ ودخول" onPress={handleSetPinSubmit} loading={loading} disabled={pin.length !== 4 || confirmPin.length !== 4} style={{ width: "100%" }} />
            </>
          )}

          {step === "name" && (
            <>
              <View style={styles.backRow}>
                <Pressable onPress={() => { setStep("otp"); setName(""); }}>
                  <Icon name="arrow-right" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.stepIcon}>
                <Icon name="user-plus" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {t("enterName")}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("enterNameHint")}
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 },
                ]}
              >
                <Icon name="user" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder={t("nameLabel")}
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  textAlign="right"
                  returnKeyType="done"
                  autoFocus
                  onSubmitEditing={handleNameSubmit}
                />
              </View>

              <GoldButton
                label={t("startShopping")}
                onPress={handleNameSubmit}
                loading={loading}
                disabled={name.trim().length < 2}
                style={{ width: "100%" }}
              />

              <View style={[styles.privacyBox, { backgroundColor: colors.gold + "11", borderColor: colors.gold + "33" }]}>
                <Icon name="shield-check" size={14} color={colors.gold} />
                <Text style={[styles.privacyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  بياناتك محفوظة وآمنة ولن تُشارك مع أي طرف
                </Text>
              </View>
            </>
          )}

        </View>

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push("/legal/privacy" as any)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.gold }]}>سياسة الخصوصية</Text>
          </Pressable>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>•</Text>
          <Pressable onPress={() => router.push("/legal/terms" as any)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.gold }]}>الشروط والأحكام</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CountryPicker
        visible={showCountryPicker}
        selected={country}
        onClose={() => setShowCountryPicker(false)}
        onSelect={(c) => setCountry(c)}
      />

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 16 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: -16 },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { alignItems: "center", gap: 4 },
  logoImg: { width: 120, height: 120 },
  brand: { fontSize: 20, letterSpacing: 1.5, lineHeight: 30, textAlign: "center" },
  subtitle: { fontSize: 14, letterSpacing: 1 },
  card: { padding: 24, borderWidth: 1, gap: 16 },
  stepIcon: { alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 20, textAlign: "center" },
  cardSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  inputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    height: 52,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 16, height: "100%" },
  countryCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderLeftWidth: 1,
    paddingLeft: 8,
    paddingRight: 4,
    marginLeft: 4,
    height: 30,
  },
  backRow: { flexDirection: "row-reverse", marginBottom: -4 },
  divider: { borderTopWidth: 1, marginVertical: 4 },
  newCustomerNote: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  privacyBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  privacyText: { fontSize: 11, flex: 1, textAlign: "right", lineHeight: 17 },
  legalRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 18 },
  legalLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
});
