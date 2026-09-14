import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, SettingsScreen, useSettingsDraft, styles } from "./_shared";

const pad2 = (n: number) => n.toString().padStart(2, "0");

function TimeField({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  const [open, setOpen] = useState(false);
  const parsed = /^(\d{1,2}):(\d{1,2})$/.exec(value || "");
  const curH = parsed ? Math.min(23, Math.max(0, parseInt(parsed[1], 10))) : 9;
  const curM = parsed ? Math.min(59, Math.max(0, parseInt(parsed[2], 10))) : 0;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.timeInput,
          {
            backgroundColor: colors.input,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text style={{ color: value ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
          {value || "--:--"}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: 280,
              backgroundColor: colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 12,
            }}
          >
            <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "center" }}>
              {label}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, height: 200 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginBottom: 6 }}>
                  الساعة
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {hours.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => onChange(`${pad2(h)}:${pad2(curM)}`)}
                      style={{
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: h === curH ? colors.gold + "22" : "transparent",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: h === curH ? colors.gold : colors.foreground, fontFamily: h === curH ? "Inter_700Bold" : "Inter_400Regular", fontSize: 15 }}>
                        {pad2(h)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginBottom: 6 }}>
                  الدقيقة
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {minutes.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => onChange(`${pad2(curH)}:${pad2(m)}`)}
                      style={{
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: m === curM ? colors.gold + "22" : "transparent",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: m === curM ? colors.gold : colors.foreground, fontFamily: m === curM ? "Inter_700Bold" : "Inter_400Regular", fontSize: 15 }}>
                        {pad2(m)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              style={{ backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
            >
              <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 14 }}>تم</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function HoursSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  return (
    <SettingsScreen title="مواعيد العمل" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="ساعات العمل">
        {(draft.workingHours ?? []).map((day, idx) => (
          <View key={day.day} style={[styles.workDayRow, { backgroundColor: colors.surface, borderColor: day.enabled ? colors.gold + "44" : colors.border }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: day.enabled ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{day.day}</Text>
              <Switch
                value={day.enabled}
                onValueChange={(v) => setDraft((d) => ({ ...d, workingHours: (d.workingHours ?? []).map((wd, i) => (i === idx ? { ...wd, enabled: v } : wd)) }))}
                trackColor={{ false: colors.border, true: colors.gold + "66" }}
                thumbColor={day.enabled ? colors.gold : colors.mutedForeground}
              />
            </View>
            {day.enabled && (
              <View style={{ flexDirection: "row-reverse", gap: 10, alignItems: "center" }}>
                <TimeField
                  label="من"
                  value={day.from}
                  colors={colors}
                  onChange={(v) => setDraft((d) => ({ ...d, workingHours: (d.workingHours ?? []).map((wd, i) => (i === idx ? { ...wd, from: v } : wd)) }))}
                />
                <TimeField
                  label="إلى"
                  value={day.to}
                  colors={colors}
                  onChange={(v) => setDraft((d) => ({ ...d, workingHours: (d.workingHours ?? []).map((wd, i) => (i === idx ? { ...wd, to: v } : wd)) }))}
                />
              </View>
            )}
          </View>
        ))}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, marginTop: 4, borderTopWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1, marginEnd: 12 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>تعليق الطلبات خارج أوقات العمل</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right", fontFamily: "Inter_400Regular", marginTop: 2 }}>
              {draft.suspendOrdersOutsideHours !== false ? "العميل يستطيع الطلب لكن يصل الطاقم تلقائياً عند بدء الدوام" : "كل الطلبات تصل الطاقم فوراً (24/7)"}
            </Text>
          </View>
          <Switch
            value={draft.suspendOrdersOutsideHours !== false}
            onValueChange={(v) => setDraft((d) => ({ ...d, suspendOrdersOutsideHours: v }))}
            trackColor={{ false: colors.border, true: colors.gold + "66" }}
            thumbColor={draft.suspendOrdersOutsideHours !== false ? colors.gold : colors.mutedForeground}
          />
        </View>
      </Card>
    </SettingsScreen>
  );
}
