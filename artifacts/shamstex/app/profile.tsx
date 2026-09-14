import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, AppTheme } from "@/context/AppContext";
import { useTranslation } from "@/lib/i18n";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setUser, orders, addNotification, updateRegisteredCustomer, theme, setTheme, language, setLanguage, registeredCustomers, settings } = useApp();
  const { t, isRTL } = useTranslation();

  const systemScheme = useColorScheme();
  const themeResolved: "dark" | "light" =
    theme === "system" ? (systemScheme === "light" ? "light" : "dark") : theme;
  const [requestSent, setRequestSent] = useState(false);
  const ROLE_LABELS: Record<string, string> = {
    customer: t("roleCustomer"),
    merchant: t("roleMerchant"),
    employee: t("roleEmployee"),
    supervisor: t("roleSupervisor"),
    admin: t("roleAdmin"),
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const myOrdersCount = orders.filter((o) => o.userId === user?.id).length;

  const handleUpgradeRequest = () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRequestSent(true);
    // Persist upgradeStatus = "pending" so re-login won't allow re-request
    const pendingUser = { ...user, upgradeStatus: "pending" as const };
    updateRegisteredCustomer(pendingUser);
    // Also update current session immediately so UI shows disabled button right away
    setUser(pendingUser);
    addNotification({
      id: `upgrade_${user.id}_${Date.now()}`,
      title: "طلب ترقية إلى تاجر",
      body: `${user.name} (${user.phone}) يطلب الترقية إلى تاجر`,
      createdAt: new Date().toISOString(),
      read: false,
      targetRole: "admin",
      actionType: "upgrade_request",
      actionUserId: user.id,
      sourceUserId: user.id,
    });
    Alert.alert(
      isRTL ? "تم إرسال الطلب" : "Request Sent",
      isRTL ? "سيتم مراجعة طلبك من قبل الإدارة وإبلاغك بالنتيجة." : "Your request will be reviewed by the admin team."
    );
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(t("logoutConfirm"));
      if (confirmed) {
        setUser(null).then(() => router.replace("/auth/login"));
      }
      return;
    }
    Alert.alert(t("logout"), t("logoutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("exit"),
        style: "destructive",
        onPress: async () => {
          await setUser(null);
          router.replace("/auth/login");
        },
      },
    ]);
  };

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
    }
  }, [user]);

  if (!user) return null;

  const allAdminLinks = [
    { label: t("manageProducts"), icon: "layers", route: "/admin/products", permission: "view_products" },
    { label: t("managePrices"), icon: "dollar-sign", route: "/admin/prices", permission: "edit_products" },
    { label: t("manageUsers"), icon: "users", route: "/admin/users", permission: "view_users" },
    { label: t("sendNotification"), icon: "bell", route: "/admin/notifications", permission: "send_notifications" },
    { label: t("featuredProducts"), icon: "star", route: "/admin/featured", permission: "edit_products" },
    { label: t("colorPalette"), icon: "droplet", route: "/admin/colors", permission: null },
    { label: t("appSettings"), icon: "settings", route: "/admin/settings", permission: null },
  ];

  const adminLinks = user.role === "admin"
    ? allAdminLinks
    : allAdminLinks.filter((link) => {
        if (link.route === "/admin/settings") {
          return (user.permissions ?? []).includes("manage_settings");
        }
        if (!link.permission) return user.role === "supervisor";
        return (user.permissions ?? []).includes(link.permission as any);
      });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title={t("myProfile")} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.gold + "33", borderRadius: 20 }]}>
          <View style={[styles.avatar, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
            <Text style={[styles.avatarText, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
              {user.name.charAt(0)}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {user.name}
          </Text>
          <Text style={[styles.phone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {user.phone}
          </Text>
          {user.role !== "customer" && (
            <View style={[styles.roleBadge, { backgroundColor: colors.isDark ? colors.gold + "22" : colors.gold }]}>
              <Text style={[styles.roleText, { color: colors.isDark ? colors.gold : colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Text>
            </View>
          )}
          {user.vip && (
            <View style={[styles.vipBadge, { backgroundColor: colors.gold + "33", borderColor: colors.gold + "44" }]}>
              <Icon name="star" size={13} color={colors.gold} />
              <Text style={[{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }]}>
                {t("vipCustomer")}
              </Text>
            </View>
          )}
        </View>

        {user.role !== "customer" && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                {myOrdersCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("myOrdersCount")}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Icon name={user.vip ? "star" : "user"} size={24} color={user.vip ? colors.gold : colors.mutedForeground} />
              <Text style={[styles.statLabel, { color: user.vip ? colors.gold : colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {user.vip ? t("vipCustomer") : t("regularCustomer")}
              </Text>
            </View>
          </View>
        )}

        {user.role === "customer" && !user.vip && (
          <View style={[styles.upgradeCard, { backgroundColor: colors.card, borderColor: colors.gold + "44", borderRadius: colors.radius }]}>
            <View style={styles.upgradeHeader}>
              <Icon name="award" size={22} color={colors.gold} />
              <Text style={[styles.upgradeTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                {t("joinAsMerchant")}
              </Text>
            </View>
            <Text style={[styles.upgradeDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("merchantDesc")}
            </Text>
            {requestSent || user.upgradeStatus === "pending" ? (
              <View style={[styles.pendingBadge, { backgroundColor: colors.gold + "22" }]}>
                <Icon name="clock" size={14} color={colors.gold} />
                <Text style={[styles.pendingText, { color: colors.gold, fontFamily: "Inter_500Medium" }]}>
                  {t("upgradeUnderReview")}
                </Text>
              </View>
            ) : (
              <GoldButton
                label={t("requestUpgrade")}
                onPress={handleUpgradeRequest}
                variant="outline"
                size="sm"
                style={{ alignSelf: "flex-end" }}
              />
            )}
          </View>
        )}

        {(user.role === "customer" || user.role === "merchant") && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/profile/addresses" as any); }}
            style={({ pressed }) => [
              {
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: colors.radius,
                backgroundColor: colors.card,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 3,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold + "22" }}>
              <Icon name="map-pin" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                عناويني
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 2 }}>
                {(user.addresses ?? []).length > 0
                  ? `${(user.addresses ?? []).length} عنوان محفوظ`
                  : "لا توجد عناوين بعد"}
              </Text>
            </View>
            <Icon name="chevron-left" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}

        <View style={[styles.adminSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {[
            { label: "سياسة الخصوصية", labelEn: "Privacy Policy", icon: "shield", route: "/legal/privacy" },
            { label: "الشروط والأحكام", labelEn: "Terms & Conditions", icon: "file-text", route: "/legal/terms" },
          ].map((item, idx, arr) => (
            <Pressable
              key={item.route}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
              style={({ pressed }) => [
                styles.adminItem,
                { borderBottomColor: colors.border, borderBottomWidth: idx === arr.length - 1 ? 0 : 1, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.adminItemIcon, { backgroundColor: colors.gold + "22" }]}>
                <Icon name={item.icon as any} size={16} color={colors.gold} />
              </View>
              <Text style={[styles.adminItemText, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: "right" }]}>
                {language === "ar" ? item.label : item.labelEn}
              </Text>
              <Icon name="chevron-left" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        {(user.role === "admin" || user.role === "employee" || user.role === "supervisor") && adminLinks.length > 0 && (
          <View style={[styles.adminSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.adminTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("adminPanel")}
            </Text>
            {adminLinks.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [
                  styles.adminItem,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Icon name="chevron-left" size={16} color={colors.mutedForeground} />
                <Text style={[styles.adminItemText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {item.label}
                </Text>
                <View style={[styles.adminItemIcon, { backgroundColor: colors.gold + "22" }]}>
                  <Icon name={item.icon as any} size={16} color={colors.gold} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12 }}>
          <View style={[styles.themeCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.themeHeader}>
              <Icon name={themeResolved === "dark" ? "moon" : "sun"} size={20} color={colors.gold} />
              <Text style={[styles.themeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {isRTL ? "المظهر" : "Appearance"}
              </Text>
            </View>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTheme(themeResolved === "dark" ? "light" : "dark"); }}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: colors.radius - 4,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <Text style={[styles.themeBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {themeResolved === "dark" ? (isRTL ? "داكن" : "Dark") : (isRTL ? "فاتح" : "Light")}
              </Text>
              <View
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  padding: 3,
                  flexDirection: "row",
                  justifyContent: themeResolved === "dark" ? "flex-end" : "flex-start",
                  backgroundColor: themeResolved === "dark" ? colors.gold + "55" : colors.border,
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={themeResolved === "dark" ? "moon" : "sun"} size={12} color={colors.background} />
                </View>
              </View>
            </Pressable>
          </View>

          <View style={[styles.themeCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.themeHeader}>
              <Icon name="globe" size={20} color={colors.gold} />
              <Text style={[styles.themeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {language === "ar" ? "اللغة" : "Language"}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (language === "ar") {
                  Alert.alert(
                    "قريباً",
                    "اللغة الإنجليزية ستكون متاحة قريباً",
                    [{ text: "حسناً" }]
                  );
                } else {
                  setLanguage("ar");
                }
              }}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: colors.radius - 4,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <Text style={[styles.themeBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {language === "ar" ? "العربية" : "English"}
              </Text>
              <View
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  padding: 3,
                  flexDirection: "row",
                  justifyContent: language === "en" ? "flex-end" : "flex-start",
                  backgroundColor: colors.gold + "55",
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: colors.background }}>
                    {language === "ar" ? "ع" : "EN"}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <GoldButton
          label={language === "ar" ? "تسجيل الخروج" : "Sign Out"}
          onPress={handleLogout}
          variant="outline"
          style={{ borderColor: colors.destructive + "88" }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  profileCard: { alignItems: "center", padding: 24, borderWidth: 1, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 36 },
  name: { fontSize: 22 },
  phone: { fontSize: 15 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 14 },
  vipBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  statsRow: { flexDirection: "row-reverse", gap: 12 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 20, gap: 6, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  statNum: { fontSize: 28 },
  statLabel: { fontSize: 12 },
  upgradeCard: { padding: 18, borderWidth: 1, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  upgradeHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  upgradeTitle: { fontSize: 16 },
  upgradeDesc: { fontSize: 13, textAlign: "right", lineHeight: 20 },
  pendingBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: "flex-end" },
  pendingText: { fontSize: 13 },
  adminSection: { borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  adminTitle: { fontSize: 16, padding: 16, textAlign: "right", borderBottomWidth: 1 },
  adminItem: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1 },
  adminItemText: { flex: 1, fontSize: 14 },
  adminItemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  themeCard: { padding: 16, borderWidth: 1, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  themeHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  themeTitle: { fontSize: 15 },
  themeButtons: { flexDirection: "row-reverse", gap: 10 },
  themeBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1 },
  themeBtnText: { fontSize: 14 },
});
