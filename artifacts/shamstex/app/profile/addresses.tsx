import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useApp, SavedAddress, formatAddress } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GovernoratePicker from "@/components/GovernoratePicker";
import CityPicker from "@/components/CityPicker";

type FormState = {
  label: string;
  city: string;
  district: string;
  street: string;
  building: string;
  landmark: string;
};

const EMPTY_FORM: FormState = { label: "", city: "", district: "", street: "", building: "", landmark: "" };

export default function AddressesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return null;
  }

  const addresses: SavedAddress[] = user.addresses ?? [];
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (a: SavedAddress) => {
    setEditingId(a.id);
    setForm({
      label: a.label ?? "",
      city: a.city,
      district: a.district,
      street: a.street,
      building: a.building ?? "",
      landmark: a.landmark ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.city.trim() || !form.district.trim() || !form.street.trim()) {
      Alert.alert("بيانات ناقصة", "المدينة والحي والشارع حقول إجبارية.");
      return;
    }
    setSaving(true);
    try {
      const patch = {
        label: form.label.trim() || undefined,
        city: form.city.trim(),
        district: form.district.trim(),
        street: form.street.trim(),
        building: form.building.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
      };
      if (editingId) {
        await updateAddress(editingId, patch);
      } else {
        await addAddress(patch);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (a: SavedAddress) => {
    const run = async () => {
      await deleteAddress(a.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    if (Platform.OS === "web") {
      if (window.confirm(`حذف العنوان "${a.label || a.city}"؟`)) run();
      return;
    }
    Alert.alert("حذف العنوان", `هل تريد حذف "${a.label || a.city}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: run },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GoldHeader title="عناويني" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {addresses.length === 0 && !showForm && (
          <View style={{ alignItems: "center", padding: 24, gap: 10, borderRadius: colors.radius, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <Icon name="map-pin" size={36} color={colors.gold} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "center" }}>
              لا توجد عناوين محفوظة
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
              أضف عنوان شحن مرة واحدة واستخدمه في طلباتك القادمة.
            </Text>
          </View>
        )}

        {addresses.map((a) => (
          <View
            key={a.id}
            style={{ padding: 14, borderRadius: colors.radius, backgroundColor: colors.card, borderWidth: 1, borderColor: a.isDefault ? colors.gold + "66" : colors.border, gap: 10 }}
          >
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Icon name="map-pin" size={16} color={colors.gold} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, flex: 1, textAlign: "right" }}>
                {a.label || a.city}
              </Text>
              {a.isDefault && (
                <View style={{ backgroundColor: colors.gold + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 10 }}>افتراضي</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", lineHeight: 18 }}>
              {formatAddress(a)}
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
              {!a.isDefault && (
                <Pressable
                  onPress={() => setDefaultAddress(a.id)}
                  style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: colors.gold + "55", opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="star" size={12} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 11 }}>افتراضي</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => openEdit(a)}
                style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="edit-2" size={12} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>تعديل</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(a)}
                style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: colors.destructive + "55", opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="trash-2" size={12} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {!showForm && (
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius, backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="plus" size={16} color="#000" />
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 14 }}>إضافة عنوان جديد</Text>
          </Pressable>
        )}

        {showForm && (
          <View style={{ padding: 14, borderRadius: colors.radius, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.gold + "55", gap: 10 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
              {editingId ? "تعديل العنوان" : "عنوان جديد"}
            </Text>
            <TextInput
              value={form.label}
              onChangeText={(v) => setForm((prev) => ({ ...prev, label: v }))}
              placeholder="اسم مختصر (مثل: المنزل، الشغل) — اختياري"
              placeholderTextColor={colors.mutedForeground}
              style={{
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.gold + "44",
                borderRadius: 8,
                padding: 11,
                color: colors.foreground,
                textAlign: "right",
                fontFamily: "Inter_400Regular",
                fontSize: 13,
              }}
            />
            <GovernoratePicker
              value={form.city}
              onChange={(v) => setForm((prev) => ({ ...prev, city: v, district: "" }))}
              invalid={!form.city.trim()}
              placeholder="المحافظة *"
            />
            <CityPicker
              governorate={form.city}
              value={form.district}
              onChange={(v) => setForm((prev) => ({ ...prev, district: v }))}
              invalid={!form.district.trim()}
              placeholder="المدينة / المركز *"
            />
            {[
              { key: "street" as const, ph: "الشارع *", req: true },
              { key: "building" as const, ph: "المبنى / رقم العقار (اختياري)", req: false },
              { key: "landmark" as const, ph: "علامة مميزة (اختياري)", req: false },
            ].map((f) => (
              <TextInput
                key={f.key}
                value={form[f.key]}
                onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={f.ph}
                placeholderTextColor={colors.mutedForeground}
                style={{
                  backgroundColor: colors.input,
                  borderWidth: 1,
                  borderColor: f.req && !form[f.key].trim() ? colors.border : colors.gold + "44",
                  borderRadius: 8,
                  padding: 11,
                  color: colors.foreground,
                  textAlign: "right",
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                }}
              />
            ))}
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.gold, opacity: (pressed || saving) ? 0.7 : 1 })}
              >
                <Icon name="check" size={14} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "حفظ العنوان"}
                </Text>
              </Pressable>
              <Pressable
                onPress={closeForm}
                style={({ pressed }) => ({ paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
