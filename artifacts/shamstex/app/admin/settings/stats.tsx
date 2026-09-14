import React from "react";
import { View } from "react-native";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useColors } from "@/hooks/useColors";
import { Card, Field, SettingsScreen, useSettingsDraft, styles } from "./_shared";

export default function StatsSettings() {
  useAdminGuard("manage_settings");
  const colors = useColors();
  const { bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  return (
    <SettingsScreen title="الإحصائيات" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="الإحصائيات">
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Field label="القيمة (الأولى)" value={draft.stats?.clients ?? "+500"} onChange={(v) => setDraft((d) => ({ ...d, stats: { ...(d.stats ?? {}), clients: v } as any }))} placeholder="+500" />
            <Field label="الاسم (الأولى)" value={draft.statLabels?.clients ?? "عميل"} onChange={(v) => setDraft((d) => ({ ...d, statLabels: { ...(d.statLabels ?? { clients: "عميل", products: "خامة", years: "سنة خبرة" }), clients: v } }))} placeholder="عميل" />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ gap: 8 }}>
            <Field label="القيمة (الثانية)" value={draft.stats?.products ?? "+50"} onChange={(v) => setDraft((d) => ({ ...d, stats: { ...(d.stats ?? {}), products: v } as any }))} placeholder="+50" />
            <Field label="الاسم (الثانية)" value={draft.statLabels?.products ?? "خامة"} onChange={(v) => setDraft((d) => ({ ...d, statLabels: { ...(d.statLabels ?? { clients: "عميل", products: "خامة", years: "سنة خبرة" }), products: v } }))} placeholder="خامة" />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ gap: 8 }}>
            <Field label="القيمة (الثالثة)" value={draft.stats?.years ?? "15+"} onChange={(v) => setDraft((d) => ({ ...d, stats: { ...(d.stats ?? {}), years: v } as any }))} placeholder="15+" />
            <Field label="الاسم (الثالثة)" value={draft.statLabels?.years ?? "سنة خبرة"} onChange={(v) => setDraft((d) => ({ ...d, statLabels: { ...(d.statLabels ?? { clients: "عميل", products: "خامة", years: "سنة خبرة" }), years: v } }))} placeholder="سنة خبرة" />
          </View>
        </View>
      </Card>
    </SettingsScreen>
  );
}
