import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, SettingsScreen, useSettingsDraft, styles } from "./_shared";

export default function CategoriesSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const [newCategory, setNewCategory] = useState("");
  const [newSubMap, setNewSubMap] = useState<Record<string, string>>({});

  const addCategory = () => {
    const t = newCategory.trim();
    if (!t || draft.categories.includes(t)) return;
    setDraft((d) => ({ ...d, categories: [...d.categories, t] }));
    setNewCategory("");
  };
  const deleteCategory = (cat: string) => {
    if (cat === "الكل") return;
    setDraft((d) => ({
      ...d,
      categories: d.categories.filter((c) => c !== cat),
      subcategories: Object.fromEntries(Object.entries(d.subcategories ?? {}).filter(([k]) => k !== cat)),
    }));
  };
  const moveCategoryUp = (idx: number) => {
    if (idx <= 1) return;
    setDraft((d) => { const cats = [...d.categories]; [cats[idx], cats[idx - 1]] = [cats[idx - 1], cats[idx]]; return { ...d, categories: cats }; });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const moveCategoryDown = (idx: number) => {
    if (idx === 0) return;
    setDraft((d) => { if (idx >= d.categories.length - 1) return d; const cats = [...d.categories]; [cats[idx], cats[idx + 1]] = [cats[idx + 1], cats[idx]]; return { ...d, categories: cats }; });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const addSubcategory = (cat: string) => {
    const t = (newSubMap[cat] ?? "").trim();
    if (!t) return;
    const existing = (draft.subcategories ?? {})[cat] ?? [];
    if (existing.includes(t)) return;
    setDraft((d) => ({ ...d, subcategories: { ...(d.subcategories ?? {}), [cat]: [...existing, t] } }));
    setNewSubMap((p) => ({ ...p, [cat]: "" }));
  };
  const deleteSubcategory = (cat: string, sub: string) => {
    setDraft((d) => ({ ...d, subcategories: { ...(d.subcategories ?? {}), [cat]: ((d.subcategories ?? {})[cat] ?? []).filter((s) => s !== sub) } }));
  };
  const editableCategories = draft.categories.filter((c) => c !== "الكل");

  return (
    <SettingsScreen title="فئات المنتجات" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="فئات المنتجات">
        <View style={[styles.catFixedRow, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
          <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>الكل</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>ثابت</Text>
        </View>
        {editableCategories.map((cat) => {
          const realIdx = draft.categories.indexOf(cat);
          const isFirst = realIdx === 1;
          const isLast = realIdx === draft.categories.length - 1;
          return (
            <View key={cat} style={[styles.catListRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.catRowArrows}>
                <Pressable onPress={() => moveCategoryUp(realIdx)} disabled={isFirst} style={[styles.arrowBtn, { opacity: isFirst ? 0.3 : 1 }]}>
                  <Icon name="chevron-up" size={16} color={colors.gold} />
                </Pressable>
                <Pressable onPress={() => moveCategoryDown(realIdx)} disabled={isLast} style={[styles.arrowBtn, { opacity: isLast ? 0.3 : 1 }]}>
                  <Icon name="chevron-down" size={16} color={colors.gold} />
                </Pressable>
              </View>
              <Text style={[styles.catListName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{cat}</Text>
              <Pressable onPress={() => deleteCategory(cat)} style={[styles.deleteCatBtn, { alignSelf: "center" }]}>
                <Icon name="x" size={14} color={colors.destructive} />
              </Pressable>
            </View>
          );
        })}
        <View style={styles.addRow}>
          <GoldButton label="إضافة" onPress={addCategory} size="sm" style={{ minWidth: 80 }} disabled={!newCategory.trim()} />
          <TextInput
            style={[styles.addInput, { flex: 1, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="اسم الفئة الجديدة"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            onSubmitEditing={addCategory}
            returnKeyType="done"
          />
        </View>
      </Card>

      <Card title="الفئات الفرعية">
        {editableCategories.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "right", fontSize: 13, fontFamily: "Inter_400Regular" }}>أضف فئات رئيسية أولاً</Text>
        ) : (
          editableCategories.map((cat) => {
            const subs = (draft.subcategories ?? {})[cat] ?? [];
            return (
              <View key={cat} style={[styles.subCatGroup, { borderColor: colors.border }]}>
                <Text style={[styles.subCatGroupTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{cat}</Text>
                {subs.length > 0 && (
                  <View style={styles.subTagsWrap}>
                    {subs.map((sub) => (
                      <View key={sub} style={[styles.subTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Pressable onPress={() => deleteSubcategory(cat, sub)} style={{ padding: 2 }}>
                          <Icon name="x" size={12} color={colors.mutedForeground} />
                        </Pressable>
                        <Text style={[styles.subTagText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.addRow}>
                  <GoldButton label="إضافة" onPress={() => addSubcategory(cat)} size="sm" style={{ minWidth: 80 }} disabled={!(newSubMap[cat] ?? "").trim()} />
                  <TextInput
                    style={[styles.addInput, { flex: 1, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                    value={newSubMap[cat] ?? ""}
                    onChangeText={(v) => setNewSubMap((p) => ({ ...p, [cat]: v }))}
                    placeholder={`فئة فرعية من ${cat}`}
                    placeholderTextColor={colors.mutedForeground}
                    textAlign="right"
                    onSubmitEditing={() => addSubcategory(cat)}
                    returnKeyType="done"
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </SettingsScreen>
  );
}
