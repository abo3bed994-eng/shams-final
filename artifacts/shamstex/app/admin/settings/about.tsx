import React from "react";
import { Text, TextInput, View } from "react-native";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, Field, SettingsScreen, useSettingsDraft, styles } from "./_shared";

export default function AboutSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  return (
    <SettingsScreen title="النبذة التعريفية" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="النبذة التعريفية">
        <Field
          label="عنوان النبذة"
          value={draft.aboutTitle}
          onChange={(v) => setDraft((d) => ({ ...d, aboutTitle: v }))}
          placeholder="مثال: شمس تكس"
        />
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>نص النبذة</Text>
          <TextInput
            style={[styles.multiline, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            value={draft.aboutText}
            onChangeText={(v) => setDraft((d) => ({ ...d, aboutText: v }))}
            multiline
            numberOfLines={4}
            textAlign="right"
            placeholder="اكتب نبذة عن الشركة..."
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      </Card>
    </SettingsScreen>
  );
}
