import React from "react";
import { Pressable, Text, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Branch, PaymentMethod, PAYMENT_METHOD_LABELS } from "@/context/AppContext";
import { Card, Field, SettingsScreen, useSettingsDraft } from "./_shared";

const ALL_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "ewallet", "instapay"];

export default function BranchesSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const branches = draft.branches ?? [];
  const updateBranch = (id: string, patch: Partial<Branch>) =>
    setDraft((d) => ({ ...d, branches: (d.branches ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const removeBranch = (id: string) => setDraft((d) => ({ ...d, branches: (d.branches ?? []).filter((b) => b.id !== id) }));
  const addBranch = () => setDraft((d) => ({
    ...d,
    branches: [...(d.branches ?? []), { id: `br_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: "", address: "", phone: "", mapsUrl: "", allowedPayments: [...ALL_METHODS] }],
  }));
  const togglePayment = (b: Branch, m: PaymentMethod) => {
    const cur = b.allowedPayments && b.allowedPayments.length > 0 ? b.allowedPayments : [...ALL_METHODS];
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    updateBranch(b.id, { allowedPayments: next });
  };

  return (
    <SettingsScreen title="الفروع" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="🏬 الفروع ووسائل الدفع لكل فرع">
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", marginBottom: 8 }}>
          أضف فروع الاستلام (تشمل المحل الرئيسي). لكل فرع حدّد وسائل الدفع المتاحة فيه.
        </Text>
        <View style={{ gap: 10 }}>
          {branches.length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", fontStyle: "italic" }}>لا توجد فروع — أضف الفرع الأول</Text>
          )}
          {branches.map((b, idx) => {
            const allowed = b.allowedPayments && b.allowedPayments.length > 0 ? b.allowedPayments : [...ALL_METHODS];
            return (
              <View key={b.id} style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, gap: 8, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>فرع #{idx + 1}</Text>
                  <Pressable onPress={() => removeBranch(b.id)} style={{ padding: 6 }}>
                    <Icon name="trash-2" size={16} color="#E74C3C" />
                  </Pressable>
                </View>
                <Field label="اسم الفرع" value={b.name} onChange={(v) => updateBranch(b.id, { name: v })} placeholder="المحل الرئيسي / فرع المنصورة..." />
                <Field label="العنوان" value={b.address ?? ""} onChange={(v) => updateBranch(b.id, { address: v })} placeholder="شارع... رقم..." />
                <Field label="الهاتف (اختياري)" value={b.phone ?? ""} onChange={(v) => updateBranch(b.id, { phone: v })} placeholder="01000000000" keyboardType="phone-pad" />
                <Field label="رابط الخرائط (Google Maps)" value={b.mapsUrl ?? ""} onChange={(v) => updateBranch(b.id, { mapsUrl: v })} placeholder="https://maps.app.goo.gl/..." />

                <View style={{ gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "right" }}>وسائل الدفع المتاحة في هذا الفرع</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "right" }}>
                    اختر وسيلة واحدة على الأقل — تظهر للعميل عند اختيار هذا الفرع
                  </Text>
                  <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {ALL_METHODS.map((m) => {
                      const on = allowed.includes(m);
                      return (
                        <Pressable
                          key={m}
                          onPress={() => togglePayment(b, m)}
                          style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold + "20" : colors.background }}
                        >
                          <Icon name={on ? "check-square" : "square"} size={13} color={on ? colors.gold : colors.mutedForeground} />
                          <Text style={{ color: on ? colors.gold : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{PAYMENT_METHOD_LABELS[m]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
          <GoldButton label="+ إضافة فرع جديد" onPress={addBranch} variant="outline" size="sm" style={{ width: "100%" }} />
        </View>
      </Card>
    </SettingsScreen>
  );
}
