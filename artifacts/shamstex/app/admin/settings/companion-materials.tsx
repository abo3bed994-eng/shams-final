import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useApp, CompanionMaterial, ProductUnit } from "@/context/AppContext";
import { Card, Field, SettingsScreen, useSettingsDraft, styles } from "./_shared";

const unitLabel = (unit: ProductUnit) => unit === "kilo" ? "بالكيلو" : "بالمتر";
const price = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const maxPercentage = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100;
};

export default function CompanionMaterialsSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const [name, setName] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [maxPercentageValue, setMaxPercentageValue] = useState("100");
  const [unit, setUnit] = useState<ProductUnit>("meter");

  const materials = draft.companionMaterials ?? [];
  const addMaterial = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (materials.some((material) => material.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      Alert.alert("تنبيه", "اسم الخامة المرافقة موجود بالفعل");
      return;
    }
    const material: CompanionMaterial = {
      id: `companion-${Date.now()}`,
      name: trimmed,
      unit,
      retailPrice: price(retailPrice),
      wholesalePrice: price(wholesalePrice),
      maxPercentage: maxPercentage(maxPercentageValue),
      colors: draft.globalColors,
      inStock: true,
    };
    setDraft((current) => ({ ...current, companionMaterials: [ ...(current.companionMaterials ?? []), material ] }));
    setName("");
    setRetailPrice("");
    setWholesalePrice("");
    setMaxPercentageValue("100");
  };

  const updateMaterial = (id: string, patch: Partial<CompanionMaterial>) => {
    setDraft((current) => ({
      ...current,
      companionMaterials: (current.companionMaterials ?? []).map((material) =>
        material.id === id ? { ...material, ...patch } : material
      ),
    }));
  };

  const deleteMaterial = (id: string) => {
    Alert.alert("حذف الخامة", "سيؤدي الحذف إلى إخفائها من المنتجات المرتبطة بها.", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => setDraft((current) => ({
          ...current,
          companionMaterials: (current.companionMaterials ?? []).filter((material) => material.id !== id),
        })),
      },
    ]);
  };

  return (
    <SettingsScreen title="الخامات المرافقة" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="إضافة خامة مرافقة">
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
          اربطها بالمنتج لاحقاً، وسيتم اختيار لونها تلقائياً حسب لون الخامة الأساسية وإدخال النسبة فقط عند الطلب.
        </Text>
        <Field label="اسم الخامة" value={name} onChange={setName} placeholder="مثال: بطانة أو خيط" />
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <Field label="سعر الجملة" value={wholesalePrice} onChange={setWholesalePrice} keyboardType="decimal-pad" />
          </View>
          <Field
            label="الحد الأقصى للنسبة %"
            value={maxPercentageValue}
            onChange={setMaxPercentageValue}
            keyboardType="decimal-pad"
            placeholder="100"
          />
          <View style={{ flex: 1 }}>
            <Field label="سعر البيع" value={retailPrice} onChange={setRetailPrice} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {(["meter", "kilo"] as ProductUnit[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => setUnit(option)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: unit === option ? colors.gold : colors.border,
                backgroundColor: unit === option ? colors.gold + "18" : colors.input,
              }}
            >
              <Text style={{ textAlign: "center", color: unit === option ? colors.gold : colors.foreground, fontFamily: "Inter_500Medium" }}>
                {unitLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
        <GoldButton label="إضافة الخامة" onPress={addMaterial} size="sm" disabled={!name.trim()} />
      </Card>

      <Card title={`الخامات الحالية (${materials.length})`}>
        {materials.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "right", fontFamily: "Inter_400Regular" }}>لا توجد خامات مرافقة بعد</Text>
        ) : materials.map((material) => (
          <View key={material.id} style={[styles.entryBox, { borderColor: colors.border }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => deleteMaterial(material.id)} style={styles.deleteBtn}>
                <Icon name="trash-2" size={16} color={colors.destructive} />
              </Pressable>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "right" }}>{material.name}</Text>
              <Pressable
                onPress={() => updateMaterial(material.id, { inStock: !material.inStock })}
                style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: material.inStock ? "#27AE6018" : colors.destructive + "18" }}
              >
                <Text style={{ color: material.inStock ? "#27AE60" : colors.destructive, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                  {material.inStock ? "متاحة" : "متوقفة"}
                </Text>
              </Pressable>
            </View>
            <Field label="اسم الخامة" value={material.name} onChange={(value) => updateMaterial(material.id, { name: value })} />
            <View style={styles.statsRow}>
              <View style={{ flex: 1 }}>
                <Field label="سعر الجملة" value={String(material.wholesalePrice)} onChange={(value) => updateMaterial(material.id, { wholesalePrice: price(value) })} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="سعر البيع" value={String(material.retailPrice)} onChange={(value) => updateMaterial(material.id, { retailPrice: price(value) })} keyboardType="decimal-pad" />
              </View>
            </View>
            <Field
              label="الحد الأقصى للنسبة %"
              value={String(material.maxPercentage ?? 100)}
              onChange={(value) => updateMaterial(material.id, { maxPercentage: maxPercentage(value) })}
              keyboardType="decimal-pad"
            />
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {(["meter", "kilo"] as ProductUnit[]).map((option) => (
                <Pressable key={option} onPress={() => updateMaterial(material.id, { unit: option })} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: material.unit === option ? colors.gold : colors.border }}>
                  <Text style={{ textAlign: "center", color: material.unit === option ? colors.gold : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{unitLabel(option)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </Card>
    </SettingsScreen>
  );
}