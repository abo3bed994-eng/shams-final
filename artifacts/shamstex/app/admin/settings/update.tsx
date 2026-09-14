import React from "react";
import { Pressable, Text } from "react-native";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, Field, SettingsScreen, useSettingsDraft } from "./_shared";
import { useColors } from "@/hooks/useColors";
import { APP_VERSION, isValidVersion } from "@/lib/version";

export default function UpdateSettings() {
  useAdminGuard("manage_settings");
  const colors = useColors();
  const { bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const minVersion = draft.minVersion ?? "";
  const invalidMinVersion = minVersion.trim().length > 0 && !isValidVersion(minVersion);
  return (
    <SettingsScreen title="التحديث الإجباري" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="🔄 التحديث الإجباري">
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", marginBottom: 8 }}>
          عند تعيين رقم نسخة هنا، أي مستخدم نسخته أقدم سيُمنع من استخدام التطبيق ويظهر له طلب التحديث. المدير لا يتأثر بهذا القيد ويمكنه دائماً تعديل الرقم من هنا.
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 12, textAlign: "right", marginBottom: 8, fontFamily: "Inter_600SemiBold" }}>
          نسخة التطبيق الحالية: {APP_VERSION}
        </Text>
        <Field
          label="الحد الأدنى للنسخة (مثل 1.1.0)"
          value={draft.minVersion ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, minVersion: v.trim() }))}
          placeholder="اتركه فارغاً للتعطيل"
        />
        {invalidMinVersion && (
          <Text style={{ color: "#E74C3C", fontSize: 12, textAlign: "right", marginTop: -4 }}>
            صيغة رقم النسخة غير صحيحة (مثال صحيح: 1.1.0). الرقم غير الصحيح يتم تجاهله ولن يفعّل التحديث الإجباري.
          </Text>
        )}
        {minVersion.trim().length > 0 && (
          <Pressable
            onPress={() => setDraft((d) => ({ ...d, minVersion: "" }))}
            style={({ pressed }) => ({ alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1, marginTop: 4 })}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>تعطيل التحديث الإجباري</Text>
          </Pressable>
        )}
        <Field
          label="رابط متجر التحديث"
          value={draft.updateUrl ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, updateUrl: v.trim() }))}
          placeholder="https://play.google.com/store/apps/details?id=com.shamstex.app"
        />
      </Card>
    </SettingsScreen>
  );
}
