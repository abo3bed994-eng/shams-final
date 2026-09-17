import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Amiri_400Regular,
  Amiri_700Bold,
} from "@expo-google-fonts/amiri";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { I18nManager, Platform, View } from "react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import SplashScreenComponent from "@/components/SplashScreenComponent";
import Toast from "@/components/Toast";
import NotificationBanner from "@/components/NotificationBanner";
import OfflineGate from "@/components/OfflineGate";
import LoadingScreen from "@/components/LoadingScreen";
import RoleSwitchOverlay from "@/components/RoleSwitchOverlay";
import ForceUpdateScreen from "@/components/ForceUpdateScreen";
import EditCountdownBar from "@/components/EditCountdownBar";
import { KeyboardProviderSafe } from "@/components/KeyboardAware";
import { registerForPushNotifications } from "@/lib/pushService";
import { isUpdateRequired } from "@/lib/version";

if (Platform.OS !== "web") {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading, settings } = useApp();
  const [splashDone, setSplashDone] = useState(Platform.OS === "web");
  const navigated = useRef(false);
  const pushRegistered = useRef<string | null>(null);
  // Store pending notification navigation until the app is fully ready
  const pendingNotifNav = useRef<string | null>(null);
  const appReady = splashDone && !isLoading && navigated.current;

  // Register for push notifications whenever a user logs in
  useEffect(() => {
    if (user && pushRegistered.current !== user.phone) {
      pushRegistered.current = user.phone;
      registerForPushNotifications(user.phone, user.role).catch(() => {});
    }
    if (!user) {
      pushRegistered.current = null;
    }
  }, [user]);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, any>;
          let path = "/notifications";
          // Any notification carrying an orderId (or linkedOrderId) takes the user straight to the order page.
          const orderId = data?.orderId || data?.linkedOrderId;
          const returnId = data?.returnId || data?.linkedReturnId;
          if (orderId) {
            path = `/order/${orderId}`;
          } else if (returnId) {
            path = `/return/${returnId}`;
          }
          if (appReady) {
            router.push(path as any);
          } else {
            pendingNotifNav.current = path;
          }
        });
      } catch (_) {}
    })();
    return () => { sub?.remove(); };
  }, [appReady]);

  // Fire pending notification navigation once app is fully ready
  useEffect(() => {
    if (appReady && pendingNotifNav.current) {
      const path = pendingNotifNav.current;
      pendingNotifNav.current = null;
      setTimeout(() => router.push(path as any), 300);
    }
  }, [appReady]);

  useEffect(() => {
    if (splashDone && !isLoading && !navigated.current) {
      navigated.current = true;
      if (user) {
        router.replace("/(tabs)");
      } else {
        router.replace("/auth/login");
      }
    }
  }, [splashDone, isLoading, user]);

  if (!splashDone) {
    return <SplashScreenComponent onFinish={() => setSplashDone(true)} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Force-update gate runs only after settings have loaded, and admins bypass it
  // so they can correct a mistaken minVersion from the admin panel.
  if (user && user.role !== "admin" && isUpdateRequired((settings as any)?.minVersion)) {
    return <ForceUpdateScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <EditCountdownBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ headerShown: false }} />
        <Stack.Screen name="price-menu" options={{ headerShown: false }} />
        <Stack.Screen name="favorites" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
        <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
        <Stack.Screen name="admin/products" options={{ headerShown: false }} />
        <Stack.Screen name="admin/add-product" options={{ headerShown: false }} />
        <Stack.Screen name="admin/prices" options={{ headerShown: false }} />
        <Stack.Screen name="admin/users" options={{ headerShown: false }} />
        <Stack.Screen name="admin/notifications" options={{ headerShown: false }} />
        <Stack.Screen name="admin/tabs" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/about" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/stats" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/contacts" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/socials" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/ads" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/price-menu" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/categories" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/companion-materials" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/hours" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/branches" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/shipping" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/payment" options={{ headerShown: false }} />
        <Stack.Screen name="admin/settings/update" options={{ headerShown: false }} />
        <Stack.Screen name="admin/colors" options={{ headerShown: false }} />
        <Stack.Screen name="admin/featured" options={{ headerShown: false }} />
        <Stack.Screen name="admin/edit-product/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast />
      <NotificationBanner />
      <RoleSwitchOverlay />
      <OfflineGate />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Amiri_400Regular,
    Amiri_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "ar");
    }
  }, []);

  // The web font loader can remain pending behind the preview proxy. Render the
  // app with system fallbacks on web instead of leaving the preview blank.
  if (!fontsLoaded && !fontError && Platform.OS !== "web") return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
              <KeyboardProviderSafe>
                <RootLayoutNav />
              </KeyboardProviderSafe>
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
