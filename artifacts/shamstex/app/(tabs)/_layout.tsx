import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import Icon from "@/components/Icon";
import React from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/lib/i18n";

function AnimatedTabItem({
  focused,
  onPress,
  children,
  accessibilityRole,
  accessibilityState,
}: {
  focused: boolean;
  onPress: () => void;
  children: React.ReactNode;
  accessibilityRole: "tab" | "button";
  accessibilityState?: { selected?: boolean };
}) {
  const progress = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  const lift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Pressable
      onPress={onPress}
      style={styles.tabItem}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <Animated.View
        style={[
          styles.animatedTabContent,
          focused && styles.activeTabContent,
          { transform: [{ translateY: lift }, { scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function MovingTabBubble({
  activeSlot,
  tabWidth,
  color,
  useNativeDriver,
}: {
  activeSlot: number;
  tabWidth: number;
  color: string;
  useNativeDriver: boolean;
}) {
  const position = React.useRef(new Animated.Value(activeSlot)).current;

  React.useEffect(() => {
    Animated.spring(position, {
      toValue: activeSlot,
      friction: 7,
      tension: 70,
      useNativeDriver,
    }).start();
  }, [activeSlot, position, useNativeDriver]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.movingBubble,
        {
          backgroundColor: color,
          left: tabWidth / 2 - 25,
          transform: [{
            translateX: position.interpolate({
              inputRange: [0, 1, 2, 3, 4],
              outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3, tabWidth * 4],
            }),
          }],
        },
      ]}
    />
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { theme, orders, user, returnRequests, cart } = useApp();
  const { t } = useTranslation();
  const systemScheme = useColorScheme();
  const isDark = theme === "system" ? systemScheme !== "light" : theme === "dark";

  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";
  const pendingOrdersCount = isStaff
    ? orders.filter((o) => o.status === "pending").length
    : 0;
  const pendingReturnsCount = isStaff
    ? returnRequests.filter((r) => r.status === "pending").length
    : 0;
  const badgeCount = pendingOrdersCount + pendingReturnsCount;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
    const tabNames = ["cart", "products", "index", "orders", "contact"];
  const cartCount = cart.length;

  const tabBar = (props: any) => {
    const routes = props.state.routes as { name: string; key: string }[];
    const routeByName = new Map(routes.map((route) => [route.name, route]));
    const activeRouteName = routes[props.state.index]?.name;
    const activeSlot = Math.max(0, tabNames.indexOf(activeRouteName));
    const tabWidth = width / tabNames.length;

    return (
      <View style={[styles.tabBar, {
        backgroundColor: isIOS ? "transparent" : colors.background,
        borderTopColor: colors.border,
        height: (isWeb ? 84 : 62) + props.insets.bottom,
        paddingBottom: (isWeb ? 16 : 8) + props.insets.bottom,
      }]}>
        {isIOS && (
          <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        )}
        <MovingTabBubble
          activeSlot={activeSlot}
          tabWidth={tabWidth}
          color={colors.gold}
          useNativeDriver={!isWeb}
        />
        {tabNames.map((name) => {
          if (name === "cart") {
            return (
              <AnimatedTabItem
                key={name}
                onPress={() => router.push("/cart")}
                focused={false}
                accessibilityRole="button"
              >
                <View style={styles.cartTab}>
                  <View style={styles.cartTabIconWrap}>
                    <Icon name="shopping-cart" size={21} color={colors.mutedForeground} />
                    {cartCount > 0 && (
                      <View style={styles.cartTabBadge}>
                        <Text style={styles.cartTabBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.tabLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>السلة</Text>
                </View>
              </AnimatedTabItem>
            );
          }

          const route = routeByName.get(name);
          if (!route) return <View key={name} style={styles.tabItem} />;
          const descriptor = props.descriptors[route.key];
          const focused = props.state.index === routes.findIndex((item) => item.key === route.key);
          const color = focused ? (isDark ? colors.gold : colors.goldLight) : colors.mutedForeground;
          const badge = descriptor.options.tabBarBadge;
          const onPress = () => {
            const event = props.navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) props.navigation.navigate(route.name);
          };

          return (
            <AnimatedTabItem
              key={name}
              onPress={onPress}
              focused={focused}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
            >
              <View>
                {descriptor.options.tabBarIcon?.({ focused, color: focused ? colors.background : color, size: 20 })}
                {typeof badge === "number" && badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.tabLabel,
                focused && styles.activeTabLabel,
                { color: focused ? colors.background : color, fontFamily: focused ? "Inter_700Bold" : "Inter_500Medium" },
              ]}>
                {descriptor.options.title ?? route.name}
              </Text>
            </AnimatedTabItem>
          );
        })}
      </View>
    );
  };

  return (
    <Tabs
      tabBar={tabBar}
      screenOptions={{
        tabBarActiveTintColor: isDark ? colors.gold : colors.goldLight,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: { position: "absolute" },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <Icon name="home" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: t("products"),
          tabBarIcon: ({ color }) => <Icon name="grid" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("orders"),
          tabBarIcon: ({ color }) => <Icon name="package" size={20} color={color} />,
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#C0392B", fontSize: 10, minWidth: 16, height: 16 },
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: t("contact"),
          tabBarIcon: ({ color }) => <Icon name="phone" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    elevation: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3,
    minWidth: 52,
  },
  animatedTabContent: { alignItems: "center", gap: 3 },
  activeTabContent: {
    position: "absolute",
    top: -7,
    width: 50,
    height: 50,
    justifyContent: "center",
    gap: 0,
  },
  movingBubble: {
    position: "absolute",
    top: -7,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#00000018",
  },
  cartTab: { alignItems: "center", gap: 3 },
  cartTabIconWrap: { width: 24, height: 24, position: "relative" },
  cartTabBadge: {
    position: "absolute",
    right: -11,
    top: -9,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: "#E74C3C",
    alignItems: "center",
    justifyContent: "center",
  },
  cartTabBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  tabLabel: { fontSize: 11 },
  activeTabLabel: { fontSize: 10, maxWidth: 46 },
  badge: {
    position: "absolute",
    right: -10,
    top: -7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#C0392B",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
});
