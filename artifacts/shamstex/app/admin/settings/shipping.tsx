import React from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { PaymentMethod, PAYMENT_METHOD_LABELS, ShippingProviderConfig, ShippingProviderId, SHIPPING_PROVIDER_DEFAULTS } from "@/context/AppContext";
import { Card, SettingsScreen, useSettingsDraft } from "./_shared";

const ALL_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "ewallet", "instapay"];

export default function ShippingSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const current: ShippingProviderConfig[] = draft.shippingProviders ?? SHIPPING_PROVIDER_DEFAULTS;
  const shippingAllowed: PaymentMethod[] =
    draft.shippingAllowedPayments && draft.shippingAllowedPayments.length > 0
      ? draft.shippingAllowedPayments
      : [...ALL_METHODS];

  const toggleShippingPayment = (m: PaymentMethod) => {
    const next = shippingAllowed.includes(m)
      ? shippingAllowed.filter((x) => x !== m)
      : [...shippingAllowed, m];
    setDraft((d) => ({ ...d, shippingAllowedPayments: next }));
  };

  const updateProvider = (id: ShippingProviderId, patch: Partial<ShippingProviderConfig>) => {
    setDraft((d) => {
      const base = d.shippingProviders ?? SHIPPING_PROVIDER_DEFAULTS;
      return { ...d, shippingProviders: base.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    });
  };
  const removeProvider = (id: ShippingProviderId) => {
    Alert.alert("حذف شركة الشحن", "هل أنت متأكد من حذف شركة الشحن؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => setDraft((d) => {
        const base = d.shippingProviders ?? SHIPPING_PROVIDER_DEFAULTS;
        return { ...d, shippingProviders: base.filter((p) => p.id !== id) };
      }) },
    ]);
  };
  const addProvider = () => {
    const newId = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setDraft((d) => {
      const base = d.shippingProviders ?? SHIPPING_PROVIDER_DEFAULTS;
      return { ...d, shippingProviders: [...base, { id: newId, name: "شركة شحن جديدة", enabled: true }] };
    });
  };

  return (
    <SettingsScreen title="شركات الشحن" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="💳 طرق الدفع المتاحة عند الشحن">
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", marginBottom: 8 }}>
          تُطبَّق هذه الإعدادات على جميع شركات الشحن. اختر طريقة دفع واحدة على الأقل.
        </Text>
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
          {ALL_METHODS.map((m) => {
            const on = shippingAllowed.includes(m);
            return (
              <Pressable
                key={m}
                onPress={() => toggleShippingPayment(m)}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: on ? colors.gold : colors.border,
                  backgroundColor: on ? colors.gold + "20" : colors.background,
                }}
              >
                <Icon name={on ? "check-square" : "square"} size={14} color={on ? colors.gold : colors.mutedForeground} />
                <Text style={{ color: on ? colors.gold : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {PAYMENT_METHOD_LABELS[m]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title="🚚 شركات الشحن">
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", marginBottom: 8 }}>
          أضف/عدّل/احذف شركات الشحن المتاحة للعميل. ثمن الشحن لا يُحسب داخل التطبيق ويُتفق عليه خارجياً.
        </Text>
        <View style={{ gap: 8 }}>
          {current.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", padding: 12 }}>لا توجد شركات شحن. أضف شركة جديدة لتفعيل خيار الشحن.</Text>
          ) : null}
          {current.map((p) => {
            const enabled = p.enabled !== false;
            return (
              <View key={p.id} style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, gap: 8 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Icon name="package" size={16} color={enabled ? colors.gold : colors.mutedForeground} />
                  <TextInput
                    value={p.name}
                    onChangeText={(v) => updateProvider(p.id, { name: v })}
                    placeholder="اسم شركة الشحن"
                    placeholderTextColor={colors.mutedForeground}
                    style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right", borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, backgroundColor: colors.background }}
                  />
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{enabled ? "مفعّلة" : "معطّلة"}</Text>
                    <Switch
                      value={enabled}
                      onValueChange={(v) => updateProvider(p.id, { enabled: v })}
                      trackColor={{ true: colors.gold, false: colors.border }}
                      thumbColor={enabled ? colors.gold : colors.mutedForeground}
                    />
                  </View>
                  <Pressable onPress={() => removeProvider(p.id)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E74C3C44" }}>
                    <Icon name="trash-2" size={13} color="#E74C3C" />
                    <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>حذف</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <GoldButton label="+ إضافة شركة شحن" onPress={addProvider} variant="outline" size="sm" style={{ width: "100%" }} />
        </View>
      </Card>
    </SettingsScreen>
  );
}
