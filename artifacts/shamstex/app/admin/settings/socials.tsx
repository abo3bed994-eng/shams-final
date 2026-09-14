import React from "react";
import { Pressable, Text, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { SocialEntry } from "@/context/AppContext";
import { Card, Field, SettingsScreen, useSettingsDraft, styles, SOCIAL_ICONS } from "./_shared";

export default function SocialsSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const updateSocial = (id: string, field: keyof SocialEntry, value: string) =>
    setDraft((d) => ({ ...d, social: d.social.map((s) => (s.id === id ? { ...s, [field]: value } : s)) }));
  const deleteSocial = (id: string) => setDraft((d) => ({ ...d, social: d.social.filter((s) => s.id !== id) }));
  const addSocial = () => {
    const entry: SocialEntry = { id: Date.now().toString(), label: "رابط جديد", icon: "globe", url: "https://" };
    setDraft((d) => ({ ...d, social: [...d.social, entry] }));
  };
  return (
    <SettingsScreen title="روابط التواصل" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="روابط التواصل الاجتماعي">
        {draft.social.map((item) => (
          <View key={item.id} style={[styles.entryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => deleteSocial(item.id)} style={styles.deleteBtn}>
              <Icon name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
            <View style={styles.entryFields}>
              <Field label="الاسم" value={item.label} onChange={(v) => updateSocial(item.id, "label", v)} placeholder="مثال: إنستغرام" />
              <Field label="الرابط" value={item.url} onChange={(v) => updateSocial(item.id, "url", v)} placeholder="https://..." keyboardType="url" />
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right", fontFamily: "Inter_400Regular" }}>الأيقونة</Text>
                <View style={styles.iconRow}>
                  {SOCIAL_ICONS.map((ic) => (
                    <Pressable
                      key={ic}
                      onPress={() => updateSocial(item.id, "icon", ic)}
                      style={[styles.iconBtn, { backgroundColor: item.icon === ic ? colors.gold + "33" : colors.surface, borderColor: item.icon === ic ? colors.gold : colors.border }]}
                    >
                      <Icon name={ic} size={18} color={item.icon === ic ? colors.gold : colors.mutedForeground} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ))}
        <GoldButton label="إضافة رابط" onPress={addSocial} variant="outline" size="sm" style={{ width: "100%" }} />
      </Card>
    </SettingsScreen>
  );
}
