import React, { useEffect, useRef, useState, useMemo } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Notification } from "@/context/AppContext";
import { filterNotificationsForUser } from "@/lib/notificationFilter";
import { router } from "expo-router";

export default function NotificationBanner() {
  const { notifications, user } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const [current, setCurrent] = useState<Notification | null>(null);
  const lastShownId = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisible = useRef(false);
  const navigating = useRef(false);

  const isAdmin = user?.role === "admin";
  const myNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy < -5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30) {
          dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    isVisible.current = false;
    Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }).start(() => {
      setCurrent(null);
    });
  };

  useEffect(() => {
    if (isAdmin || !myNotifications.length) return;
    const latest = myNotifications[0];
    if (!latest || latest.id === lastShownId.current) return;
    if (latest.read) return;

    const createdAt = new Date(latest.createdAt).getTime();
    if (Date.now() - createdAt > 10000) return;

    lastShownId.current = latest.id;
    setCurrent(latest);
    isVisible.current = true;

    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => dismiss(), 3000);
  }, [myNotifications, isAdmin]);

  if (!current || isAdmin) return null;

  const topOffset = Platform.OS === "web" ? 12 : insets.top + 4;

  const handlePress = () => {
    if (navigating.current) return;
    navigating.current = true;
    dismiss();
    if (current.linkedOrderId) {
      router.push(`/order/${current.linkedOrderId}` as any);
    } else if (current.linkedReturnId) {
      router.push(`/return/${current.linkedReturnId}` as any);
    } else {
      router.push("/notifications" as any);
    }
    setTimeout(() => { navigating.current = false; }, 500);
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY }] },
      ]}
    >
      <Pressable onPress={handlePress} style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconWrap}>
          <Icon name="bell" size={18} color={colors.gold} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {current.body}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
          <Icon name="x" size={14} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10000,
  },
  banner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C9A84C22",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    textAlign: "right",
  },
  body: {
    fontSize: 11,
    textAlign: "right",
  },
  closeBtn: {
    padding: 4,
  },
});
