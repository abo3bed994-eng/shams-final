import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, AppSettings } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { Alert } from "react-native";

export function useSettingsDraft() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSettings, user } = useApp();
  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, Platform.OS === "android" ? 24 : 0);
  const [draft, setDraft] = useState<AppSettings>({
    ...settings,
    subcategories: settings.subcategories ?? {},
    stats: settings.stats ?? { clients: "+500", products: "+50", years: "15+" },
    statLabels: settings.statLabels ?? { clients: "عميل", products: "خامة", years: "سنة خبرة" },
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setSettings(draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم", "تم حفظ الإعدادات بنجاح");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("تعذّر الحفظ", "تأكد من اتصال الإنترنت ثم حاول مجدداً");
    } finally {
      setSaving(false);
    }
  };
  return { colors, insets, bottomPad, draft, setDraft, saving, save, user };
}

export function SettingsScreen({
  title,
  children,
  bottomPad,
  save,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  bottomPad: number;
  save: () => void;
  saving: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title={title} onBack={() => router.back()} />
      <KeyboardAwareScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
      >
        {children}
      </KeyboardAwareScroll>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          },
        ]}
      >
        <GoldButton label="حفظ الإعدادات" onPress={save} loading={saving} style={{ flex: 1 }} size="lg" />
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
        keyboardType={keyboardType}
      />
    </View>
  );
}

export const Card = React.memo(function Card({ children, title }: { children: React.ReactNode; title: string }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>{title}</Text>
      {children}
    </View>
  );
});

export const SOCIAL_ICONS = ["message-circle", "instagram", "facebook", "snapchat", "telegram", "tiktok", "twitter", "youtube", "linkedin", "globe"];

export default SettingsScreen;

export const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 14, textAlign: "right", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 100, textAlignVertical: "top" },
  statsRow: { flexDirection: "row-reverse", gap: 10 },
  catFixedRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  catListRow: { flexDirection: "row-reverse", alignItems: "center", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  catRowArrows: { flexDirection: "column", alignItems: "center", gap: 2 },
  arrowBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  catListName: { flex: 1, fontSize: 14, textAlign: "right" },
  deleteCatBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row-reverse", gap: 10, alignItems: "center" },
  addInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  subCatGroup: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  subCatGroupTitle: { fontSize: 14, textAlign: "right" },
  subTagsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  subTag: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  subTagText: { fontSize: 12 },
  entryBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  deleteBtn: { alignSelf: "flex-start", width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  entryFields: { gap: 10 },
  iconRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  bannerPreview: { borderRadius: 10, borderWidth: 1, overflow: "hidden", height: 110, alignItems: "center", justifyContent: "center", position: "relative" },
  bannerPreviewImg: { width: "100%", height: 110 },
  videoBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  clearBannerBtn: { position: "absolute", top: 6, left: 6, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bannerBtns: { flexDirection: "row-reverse", gap: 10 },
  bannerBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  workDayRow: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  timeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, textAlign: "center" },
});
