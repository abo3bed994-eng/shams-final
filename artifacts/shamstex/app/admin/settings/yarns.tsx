import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, SettingsScreen, useSettingsDraft, styles } from "./_shared";

export default function YarnsSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const [newYarn, setNewYarn] = useState("");

  const yarns = draft.yarnTypes ?? [];

  const addYarn = () => {
    const t = newYarn.trim();
    if (!t || yarns.includes(t)) return;
    setDraft((d) => ({ ...d, yarnTypes: [...(d.yarnTypes ?? []), t] }));
    setNewYarn("");
  };
  const deleteYarn = (yarn: string) => {
    setDraft((d) => ({ ...d, yarnTypes: (d.yarnTypes ?? []).filter((y) => y !== yarn) }));
  };

  return (
    <SettingsScreen title="أنواع الفتلة" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="أنواع الفتلة (للتركيب)">
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", fontFamily: "Inter_400Regular" }}>
          تُستخدم هذه الأسماء في قائمة تركيب القماش عند إضافة أو تعديل منتج.
        </Text>
        {yarns.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "right", fontSize: 13, fontFamily: "Inter_400Regular" }}>
            لا توجد أنواع فتلة بعد
          </Text>
        ) : (
          <View style={styles.subTagsWrap}>
            {yarns.map((yarn) => (
              <View key={yarn} style={[styles.subTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable onPress={() => deleteYarn(yarn)} style={{ padding: 2 }}>
                  <Icon name="x" size={12} color={colors.mutedForeground} />
                </Pressable>
                <Text style={[styles.subTagText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{yarn}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.addRow}>
          <GoldButton label="إضافة" onPress={addYarn} size="sm" style={{ minWidth: 80 }} disabled={!newYarn.trim()} />
          <TextInput
            style={[styles.addInput, { flex: 1, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            value={newYarn}
            onChangeText={setNewYarn}
            placeholder="اسم الفتلة (مثال: قطن)"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            onSubmitEditing={addYarn}
            returnKeyType="done"
          />
        </View>
      </Card>
    </SettingsScreen>
  );
}
