import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Icon from "./Icon";
import { useColors } from "@/hooks/useColors";

// Network gate that blocks ALL interaction with the app while the device is
// offline OR the connection is too slow to reach our backend. A frosted blur
// overlay covers the whole UI so users cannot tap anything, type, or submit
// requests during disconnected/degraded periods.
//
// Detection:
//   1. NetInfo: hard offline (`isConnected === false` or `isInternetReachable === false`).
//   2. Soft-stall: even when NetInfo says we're online, we ping a fast endpoint
//      with an 8s timeout. If it fails (timeout / network error), we treat the
//      device as offline. Re-checked on a slow heartbeat + whenever NetInfo
//      fires a change event.
const PING_URL = "https://www.gstatic.com/generate_204";
const PING_TIMEOUT_MS = 30000;
const PING_INTERVAL_MS = 90000;
// Bumped to 6 so a heavy media upload (videos saturate cellular for many minutes
// during base64 fallback) cannot trip the offline gate and abort mid-upload with
// a misleading "no network" overlay.
const PING_FAILURES_TO_TRIP = 6;

async function pingReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(PING_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export default function OfflineGate() {
  const colors = useColors();
  const [netOffline, setNetOffline] = useState(false);
  const [pingOffline, setPingOffline] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const failuresRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const offline = netOffline || pingOffline;

  useEffect(() => {
    if (Platform.OS === "web") return;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const NetInfo = await import("@react-native-community/netinfo");
        unsub = NetInfo.default.addEventListener((state) => {
          const offNow = !(state.isConnected && state.isInternetReachable !== false);
          setNetOffline(offNow);
          if (!offNow) {
            // NetInfo says we're back; clear soft-offline and reset failure count.
            failuresRef.current = 0;
            setPingOffline(false);
          }
        });
      } catch {
        setNetOffline(false);
      }
    })();
    return () => {
      unsub?.();
    };
  }, []);

  // Heartbeat ping while we believe we're online — catches dead-air / captive
  // portal cases where NetInfo reports connected but no traffic flows.
  //
  // To avoid false-positives during legitimate heavy traffic (large media
  // uploads can saturate the link and make a generic ping time out), we require
  // PING_FAILURES_TO_TRIP consecutive failures before flipping to offline.
  // A single success immediately resets and clears the gate.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (netOffline) return;
    let cancelled = false;
    const runPing = async () => {
      const ok = await pingReachable();
      if (cancelled) return;
      if (ok) {
        failuresRef.current = 0;
        setPingOffline(false);
      } else {
        failuresRef.current += 1;
        if (failuresRef.current >= PING_FAILURES_TO_TRIP) {
          setPingOffline(true);
        }
      }
    };
    runPing();
    const t = setInterval(runPing, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [netOffline, retryTick]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: offline ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [offline]);

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fadeAnim }]}
    >
      {Platform.OS !== "web" ? (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.75)" }]} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.tint]} />

      <View style={styles.center}>
        <View style={styles.iconHalo}>
          <View
            style={[
              styles.iconRingOuter,
              { borderColor: colors.gold, shadowColor: colors.gold },
            ]}
          >
            <View
              style={[
                styles.iconRingInner,
                { borderColor: colors.gold, backgroundColor: "rgba(0,0,0,0.55)" },
              ]}
            >
              <Icon name="wifi-off" size={46} color={colors.gold} />
            </View>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.gold }]}>لا يوجد اتصال بالإنترنت</Text>
        <Text style={styles.subtitle}>
          سيعود التطبيق تلقائياً بمجرد عودة الاتصال.
        </Text>

        <Pressable
          onPress={() => setRetryTick((n) => n + 1)}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="refresh-cw" size={16} color="#000" />
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 99999,
    elevation: 99999,
  },
  tint: {
    backgroundColor: "rgba(8,8,8,0.55)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  iconHalo: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  iconRingInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: "#000",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
