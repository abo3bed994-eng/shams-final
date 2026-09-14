import React from "react";
import { Pressable, Text, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { PaymentSettings, WalletEntry, InstapayEntry } from "@/context/AppContext";
import { Card, Field, SettingsScreen, useSettingsDraft } from "./_shared";

export default function PaymentSettingsPage() {
  useAdminGuard("manage_payments");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();

  const wallets: WalletEntry[] = (draft.payment?.ewallets && draft.payment.ewallets.length > 0)
    ? draft.payment.ewallets
    : (draft.payment?.ewalletNumber ? [{ id: "_legacy", number: draft.payment.ewalletNumber, name: draft.payment.ewalletName ?? "", provider: "" }] : []);
  const updateWallet = (id: string, field: keyof WalletEntry, value: string) => setDraft((d) => {
    const list: WalletEntry[] = (d.payment?.ewallets ?? wallets).map((w) => (w.id === id ? { ...w, [field]: value } : w));
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), ewallets: list, ewalletNumber: undefined, ewalletName: undefined } };
  });
  const removeWallet = (id: string) => setDraft((d) => {
    const list = (d.payment?.ewallets ?? wallets).filter((w) => w.id !== id);
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), ewallets: list, ewalletNumber: undefined, ewalletName: undefined } };
  });
  const addWallet = () => setDraft((d) => {
    const list = [...((d.payment?.ewallets ?? wallets)), { id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, number: "", name: "", provider: "" }];
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), ewallets: list, ewalletNumber: undefined, ewalletName: undefined } };
  });

  const ips: InstapayEntry[] = (draft.payment?.instapays && draft.payment.instapays.length > 0)
    ? draft.payment.instapays
    : (draft.payment?.instapayNumber ? [{ id: "_legacy", handle: draft.payment.instapayNumber, name: draft.payment.instapayName ?? "" }] : []);
  const updateIp = (id: string, field: keyof InstapayEntry, value: string) => setDraft((d) => {
    const list: InstapayEntry[] = (d.payment?.instapays ?? ips).map((x) => (x.id === id ? { ...x, [field]: value } : x));
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), instapays: list, instapayNumber: undefined, instapayName: undefined } };
  });
  const removeIp = (id: string) => setDraft((d) => {
    const list = (d.payment?.instapays ?? ips).filter((x) => x.id !== id);
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), instapays: list, instapayNumber: undefined, instapayName: undefined } };
  });
  const addIp = () => setDraft((d) => {
    const list = [...((d.payment?.instapays ?? ips)), { id: `ip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, handle: "", name: "" }];
    return { ...d, payment: { ...(d.payment ?? {} as PaymentSettings), instapays: list, instapayNumber: undefined, instapayName: undefined } };
  });

  const methodEnabled = (key: "cashEnabled" | "bankTransferEnabled" | "ewalletEnabled" | "instapayEnabled") =>
    draft.payment?.[key] !== false;
  const toggleMethod = (key: "cashEnabled" | "bankTransferEnabled" | "ewalletEnabled" | "instapayEnabled") =>
    setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), [key]: d.payment?.[key] === false } }));

  const PAYMENT_TOGGLES: { key: "cashEnabled" | "bankTransferEnabled" | "ewalletEnabled" | "instapayEnabled"; label: string; icon: string }[] = [
    { key: "cashEnabled", label: "الدفع نقدًا عند الاستلام", icon: "wallet" },
    { key: "bankTransferEnabled", label: "التحويل البنكي", icon: "credit-card" },
    { key: "ewalletEnabled", label: "المحافظ الإلكترونية", icon: "wallet" },
    { key: "instapayEnabled", label: "انستاباي", icon: "wallet" },
  ];

  return (
    <SettingsScreen title="إعدادات الدفع" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="وسائل الدفع المتاحة">
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
          فعّل أو عطّل أي وسيلة دفع — الوسائل المعطّلة لن تظهر للعميل عند الشراء.
        </Text>
        {PAYMENT_TOGGLES.map((m) => {
          const on = methodEnabled(m.key);
          return (
            <Pressable
              key={m.key}
              onPress={() => toggleMethod(m.key)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: on ? colors.gold + "55" : colors.border, borderRadius: 10, backgroundColor: on ? colors.gold + "11" : colors.surface }}
            >
              <Icon name={m.icon} size={18} color={on ? colors.gold : colors.mutedForeground} />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>{m.label}</Text>
              <Icon name={on ? "check-circle" : "circle"} size={20} color={on ? colors.gold : colors.mutedForeground} />
            </Pressable>
          );
        })}
      </Card>
      <Card title="إعدادات الدفع">
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, backgroundColor: colors.gold + "11", borderRadius: 8, borderWidth: 1, borderColor: colors.gold + "33" }}>
          <Icon name="wallet" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: "right" }}>
            أرقام الدفع التي تظهر للعميل عند الشراء. توفّر كل وسيلة لكل فرع يُحدَّد من صفحة "الفروع".
          </Text>
        </View>

        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>
          المحافظ الإلكترونية (يمكن إضافة أكثر من رقم)
        </Text>
        <View style={{ gap: 10 }}>
          {wallets.map((w, idx) => (
            <View key={w.id} style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, gap: 8, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>محفظة #{idx + 1}</Text>
                <Pressable onPress={() => removeWallet(w.id)} style={{ padding: 6 }}>
                  <Icon name="trash-2" size={16} color="#E74C3C" />
                </Pressable>
              </View>
              <Field label="مزود الخدمة (اختياري)" value={w.provider ?? ""} onChange={(v) => updateWallet(w.id, "provider", v)} placeholder="فودافون كاش / أورنج / اتصالات / WE" />
              <Field label="رقم المحفظة" value={w.number} onChange={(v) => updateWallet(w.id, "number", v)} placeholder="01000000001" keyboardType="phone-pad" />
              <Field label="اسم صاحب المحفظة" value={w.name} onChange={(v) => updateWallet(w.id, "name", v)} placeholder="شمس تكس" />
            </View>
          ))}
          <GoldButton label="+ إضافة محفظة جديدة" onPress={addWallet} variant="outline" size="sm" style={{ width: "100%" }} />
        </View>
        <Field
          label="نسبة الرسوم على المحفظة (%)"
          value={String(draft.payment?.ewalletFeePercent ?? 1)}
          onChange={(v) => { const num = Math.max(0, Math.min(100, Number(v) || 0)); setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), ewalletFeePercent: num } })); }}
          placeholder="1" keyboardType="decimal-pad"
        />

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>
          حسابات انستاباي (يمكن إضافة أكثر من حساب)
        </Text>
        <View style={{ gap: 10 }}>
          {ips.map((ip, idx) => (
            <View key={ip.id} style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, gap: 8, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>انستاباي #{idx + 1}</Text>
                <Pressable onPress={() => removeIp(ip.id)} style={{ padding: 6 }}>
                  <Icon name="trash-2" size={16} color="#E74C3C" />
                </Pressable>
              </View>
              <Field label="الانستاباي (رقم أو @ipa)" value={ip.handle} onChange={(v) => updateIp(ip.id, "handle", v)} placeholder="01000000001 أو name@instapay" />
              <Field label="اسم صاحب الحساب" value={ip.name} onChange={(v) => updateIp(ip.id, "name", v)} placeholder="شمس تكس" />
            </View>
          ))}
          <GoldButton label="+ إضافة حساب انستاباي جديد" onPress={addIp} variant="outline" size="sm" style={{ width: "100%" }} />
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>التحويل البنكي</Text>
        <Field label="اسم البنك" value={draft.payment?.bankName ?? ""} onChange={(v) => setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), bankName: v } }))} placeholder="البنك الأهلي المصري" />
        <Field label="اسم صاحب الحساب" value={draft.payment?.bankAccountName ?? ""} onChange={(v) => setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), bankAccountName: v } }))} placeholder="شمس تكس للأقمشة" />
        <Field label="رقم الحساب" value={draft.payment?.bankAccountNumber ?? ""} onChange={(v) => setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), bankAccountNumber: v } }))} placeholder="1234567890123" keyboardType="decimal-pad" />
        <Field label="IBAN" value={draft.payment?.bankIBAN ?? ""} onChange={(v) => setDraft((d) => ({ ...d, payment: { ...(d.payment ?? {} as PaymentSettings), bankIBAN: v } }))} placeholder="EG000012345678901234567890" />
      </Card>
    </SettingsScreen>
  );
}
