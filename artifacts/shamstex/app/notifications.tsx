import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Notification } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import { filterNotificationsForUser } from "@/lib/notificationFilter";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, markNotificationRead, markAllNotificationsRead, user, registeredCustomers, updateRegisteredCustomer, isNotifReadForUser } = useApp();
  const markedRef = useRef(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const visibleNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user]);

  useEffect(() => {
    if (!markedRef.current && visibleNotifications.some((n) => !isNotifReadForUser(n))) {
      markedRef.current = true;
      markAllNotificationsRead();
    }
  }, []);

  const goingBack = useRef(false);
  const safeBack = useCallback(() => {
    if (goingBack.current) return;
    goingBack.current = true;
    router.back();
  }, []);

  const navigatingRef = useRef(false);
  const handleNotifPress = useCallback((notif: Notification) => {
    if (notif.actionType === "upgrade_request" && notif.actionUserId && (user?.role === "admin" || user?.role === "supervisor")) {
      const targetUser = registeredCustomers.find((c) => c.id === notif.actionUserId);
      const userName = targetUser?.name ?? "المستخدم";

      if (targetUser?.upgradeStatus === "approved" || targetUser?.role === "merchant") {
        Alert.alert("تم", `تمت ترقية ${userName} إلى تاجر مسبقاً`);
        return;
      }
      if (targetUser?.upgradeStatus === "rejected") {
        Alert.alert("تم", `تم رفض طلب ترقية ${userName} مسبقاً`);
        return;
      }

      Alert.alert(
        "طلب ترقية إلى تاجر",
        `يطلب ${userName} الترقية إلى تاجر. ما قرارك؟`,
        [
          { text: "رفض", style: "destructive", onPress: () => {
            if (targetUser) updateRegisteredCustomer({ ...targetUser, upgradeStatus: "rejected" });
          }},
          { text: "إلغاء", style: "cancel" },
          { text: "موافقة", onPress: () => {
            if (targetUser) updateRegisteredCustomer({ ...targetUser, role: "merchant", upgradeStatus: "approved" });
            Alert.alert("تم", `تمت ترقية ${userName} إلى تاجر`);
          }},
        ]
      );
      return;
    }

    if (navigatingRef.current) return;
    navigatingRef.current = true;
    if (notif.linkedOrderId) {
      router.push(`/order/${notif.linkedOrderId}`);
    } else if (notif.linkedReturnId) {
      router.push(`/return/${notif.linkedReturnId}`);
    }
    setTimeout(() => { navigatingRef.current = false; }, 500);
  }, [user, registeredCustomers, updateRegisteredCustomer]);

  const getNotifIcon = (notif: Notification) => {
    if (notif.actionType === "upgrade_request") return "user-plus";
    if (notif.linkedReturnId) return "rotate-ccw";
    if (notif.linkedOrderId) return "package";
    if (notif.targetRole === "employee" || notif.targetRole === "supervisor") return "package";
    if (notif.targetUserId) return "bell";
    return "bell";
  };

  const renderItem = useCallback(({ item: notif }: { item: Notification }) => {
    const isAction = notif.actionType === "upgrade_request";
    const isReturn = !!notif.linkedReturnId;
    const iconName = getNotifIcon(notif);
    const activeColor = isReturn ? "#C0392B" : colors.gold;

    return (
      <Pressable
        onPress={() => handleNotifPress(notif)}
        style={({ pressed }) => [
          styles.notifCard,
          {
            backgroundColor: colors.card,
            borderColor: isReturn ? "#C0392B44" : colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: activeColor + "22" }]}>
          <Icon name={iconName as any} size={18} color={activeColor} />
        </View>
        <View style={styles.notifContent}>
          <Text
            style={[
              styles.notifTitle,
              { color: isReturn ? "#C0392B" : colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {notif.title}
          </Text>
          <Text style={[styles.notifBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {notif.body}
          </Text>
          {isAction && (
            <Text style={[styles.tapHint, { color: colors.gold, fontFamily: "Inter_500Medium" }]}>
              اضغط للمراجعة والرد ←
            </Text>
          )}
          {notif.linkedOrderId && !isAction && (
            <Text style={[styles.tapHint, { color: colors.gold, fontFamily: "Inter_500Medium" }]}>
              اضغط لعرض الطلب ←
            </Text>
          )}
          <Text style={[styles.notifTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {new Date(notif.createdAt).toLocaleDateString("ar-EG")}
          </Text>
        </View>
      </Pressable>
    );
  }, [colors, handleNotifPress]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="الإشعارات" onBack={safeBack} />

      {visibleNotifications.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell-off" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            لا توجد إشعارات
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16 },
  notifCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: { flex: 1, gap: 4 },
  notifTitle: { fontSize: 14, textAlign: "right" },
  notifBody: { fontSize: 13, textAlign: "right", lineHeight: 20 },
  tapHint: { fontSize: 12, textAlign: "right" },
  notifTime: { fontSize: 11 },
});
