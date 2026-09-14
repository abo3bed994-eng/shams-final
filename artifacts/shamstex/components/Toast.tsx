import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { EDIT_BAR_CONTENT_H, isEditWindowLive, selectActiveEditOrder } from "@/lib/editOrder";

export default function Toast() {
  const { toast, orders, user } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (toast.visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 20, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [toast.visible]);

  const bgColor = toast.type === "success" ? colors.gold : "#E74C3C";
  const icon = toast.type === "success" ? "check-circle" : "alert-circle";
  // In light mode the gold pill needs white text/icon for contrast; dark mode
  // keeps the near-black look the user prefers. Error toasts (red) stay white.
  const contentColor = toast.type === "success" && colors.isDark ? "#0A0A0A" : "#fff";
  // Show the toast near the bottom (above the tab bar / home indicator) so it
  // never covers the cart icon and other action buttons in the top header.
  const bottomOffset = (Platform.OS === "web" ? 24 : insets.bottom + 24) + 64;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: bottomOffset, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: bgColor }]}>
        <Icon name={icon} size={16} color={contentColor} />
        <Text style={[styles.text, { color: contentColor }]}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
