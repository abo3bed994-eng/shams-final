import React from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { APP_VERSION } from "@/lib/version";
import { useApp } from "@/context/AppContext";

export default function ForceUpdateScreen() {
  const { settings } = useApp();
  const updateUrl =
    (settings as any)?.updateUrl ||
    (Platform.OS === "ios"
      ? "https://apps.apple.com/app/id0000000000"
      : "https://play.google.com/store/apps/details?id=com.shamstex.app");
  const minVersion = (settings as any)?.minVersion ?? "—";

  const openStore = () => {
    Linking.openURL(updateUrl).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="download" size={56} color="#D4AF37" />
        </View>
        <Text style={styles.title}>تحديث مطلوب</Text>
        <Text style={styles.body}>
          هذه النسخة قديمة ولا تدعم آخر التحديثات.{"\n"}
          يجب تحديث التطبيق للاستمرار في الاستخدام.
        </Text>
        <View style={styles.versionBox}>
          <Text style={styles.versionLabel}>نسختك الحالية</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
          <View style={styles.divider} />
          <Text style={styles.versionLabel}>الحد الأدنى المطلوب</Text>
          <Text style={styles.versionValue}>{minVersion}</Text>
        </View>
        <Pressable onPress={openStore} style={styles.btn}>
          <Icon name="download" size={18} color="#0A0A0A" />
          <Text style={styles.btnText}>تحديث الآن</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 400, backgroundColor: "#0F0F0F", borderRadius: 24, padding: 28, borderWidth: 1, borderColor: "#D4AF37", alignItems: "center" },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#D4AF3722", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { color: "#D4AF37", fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 12 },
  body: { color: "#CCC", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  versionBox: { width: "100%", backgroundColor: "#1A1A1A", borderRadius: 14, padding: 16, marginBottom: 20 },
  versionLabel: { color: "#888", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  versionValue: { color: "#FFF", fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 4 },
  divider: { height: 1, backgroundColor: "#2A2A2A", marginVertical: 12 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#D4AF37", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, width: "100%" },
  btnText: { color: "#0A0A0A", fontSize: 16, fontFamily: "Inter_700Bold" },
});
