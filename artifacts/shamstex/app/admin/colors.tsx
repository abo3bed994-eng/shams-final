import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, ColorOption } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";

export default function AdminColorsScreen() {
  useAdminGuard("manage_settings");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSettings } = useApp();

  const makeColorId = (color: ColorOption, index: number) =>
    color.id ?? `color-${index}-${color.name.replace(/\s+/g, "-")}`;
  const [colorList, setColorList] = useState<ColorOption[]>(() =>
    settings.globalColors.map((color, index) => ({ ...color, id: makeColorId(color, index) }))
  );
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#");
  const [saving, setSaving] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, Platform.OS === "android" ? 56 : 16);

  const handleAdd = () => {
    const trimmedName = newName.trim();
    const trimmedHex = newHex.trim();
    if (!trimmedName || !trimmedHex.match(/^#([0-9A-Fa-f]{6})$/)) {
      Alert.alert("خطأ", "أدخل اسماً صحيحاً ورمز HEX صحيح (مثال: #FF5733)");
      return;
    }
    if (colorList.some((c) => c.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      Alert.alert("تنبيه", "هذا الاسم موجود بالفعل");
      return;
    }
    setColorList((prev) => [{ id: `color-${Date.now()}`, name: trimmedName, hex: trimmedHex, quantity: 50 }, ...prev]);
    setNewName("");
    setNewHex("#");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("حذف اللون", `هل تريد حذف اللون "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
           setColorList((prev) => prev.filter((c) => c.id !== id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const handleUpdateHex = (id: string, hex: string) => {
    setColorList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, hex } : c))
    );
  };

  const handleUpdateName = (id: string, newNameVal: string) => {
    setColorList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newNameVal } : c))
    );
  };

  const handleSave = async () => {
    const normalized = colorList.map((color) => ({ ...color, name: color.name.trim() }));
    const names = normalized.map((color) => color.name.toLocaleLowerCase()).filter(Boolean);
    if (names.length !== new Set(names).size || normalized.some((color) => !color.name)) {
      Alert.alert("تنبيه", "يجب أن تكون أسماء الألوان موجودة وغير مكررة");
      return;
    }
    setSaving(true);
    await setSettings({ ...settings, globalColors: normalized });
    setColorList(normalized);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    Alert.alert("تم", "تم حفظ الألوان بنجاح");
  };

  const renderItem = useCallback(
    ({ item: color, drag, isActive }: RenderItemParams<ColorOption>) => {
      const hexValid = color.hex.match(/^#[0-9A-Fa-f]{6}$/);
      return (
        <ScaleDecorator>
          <View
            style={[
              styles.colorRow,
              {
                backgroundColor: isActive ? colors.gold + "11" : colors.card,
                borderColor: isActive ? colors.gold + "55" : colors.border,
                borderRadius: colors.radius - 4,
                marginBottom: 8,
              },
            ]}
          >
            <Pressable
               onPress={() => handleDelete(color.id!, color.name)}
              style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="trash-2" size={15} color={colors.destructive} />
            </Pressable>

            <View style={styles.colorFields}>
              <TextInput
                style={[styles.smallInput, {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  fontFamily: "Inter_400Regular",
                }]}
                value={color.name}
                 onChangeText={(v) => handleUpdateName(color.id!, v)}
                textAlign="right"
                placeholder="اسم اللون"
                placeholderTextColor={colors.mutedForeground}
              />
              <View style={styles.hexEditRow}>
                <View style={[styles.colorSwatchSm, { backgroundColor: hexValid ? color.hex : "#444" }]} />
                <TextInput
                  style={[styles.hexSmall, {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    fontFamily: "Inter_400Regular",
                  }]}
                  value={color.hex}
                   onChangeText={(v) => handleUpdateHex(color.id!, v)}
                  autoCapitalize="characters"
                  maxLength={7}
                  textAlign="right"
                  placeholder="#RRGGBB"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={[styles.bigSwatch, { backgroundColor: hexValid ? color.hex : "#333", borderColor: colors.border }]} />

            <Pressable
              onLongPress={drag}
              delayLongPress={150}
              style={[
                styles.dragHandle,
                {
                  backgroundColor: isActive ? colors.gold + "22" : colors.surface,
                  borderColor: isActive ? colors.gold + "44" : colors.border,
                },
              ]}
            >
              <Icon name="grip-vertical" size={18} color={isActive ? colors.gold : colors.mutedForeground} />
            </Pressable>
          </View>
        </ScaleDecorator>
      );
    },
    [colors, colorList]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title="لوحة الألوان"
        subtitle={`${colorList.length} لون — اسحب لإعادة الترتيب`}
        onBack={() => router.back()}
      />

      <DraggableFlatList
        data={colorList}
        keyExtractor={(item, index) => item.id ?? `color-${index}`}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setColorList(data);
        }}
        onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View
              style={[styles.addCard, {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginBottom: 14,
              }]}
            >
              <Text style={[styles.cardTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                إضافة لون جديد
              </Text>
              <View style={styles.hexRow}>
                <View style={[styles.colorPreview, { backgroundColor: newHex.match(/^#[0-9A-Fa-f]{6}$/) ? newHex : "#444" }]} />
                <TextInput
                  style={[styles.hexInput, { flex: 1, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  value={newHex}
                  onChangeText={setNewHex}
                  placeholder="#FFFFFF"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  maxLength={7}
                  textAlign="right"
                />
                <TextInput
                  style={[styles.hexInput, { flex: 2, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="اسم اللون (مثال: أبيض)"
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                />
              </View>
              <GoldButton
                label="إضافة اللون"
                onPress={handleAdd}
                variant="outline"
                size="sm"
                style={{ alignSelf: "flex-end" }}
                disabled={!newName.trim() || !newHex.match(/^#[0-9A-Fa-f]{6}$/)}
              />
            </View>
            <Text style={[styles.listHeader, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
              الألوان الحالية ({colorList.length})
            </Text>
          </View>
        }
      />

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad, position: "absolute", bottom: 0, left: 0, right: 0 }]}>
        <GoldButton label="حفظ الألوان" onPress={handleSave} loading={saving} style={{ flex: 1 }} size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, textAlign: "right" },
  hexRow: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  colorPreview: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#444" },
  hexInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingTop: 14 },
  listHeader: { fontSize: 14, textAlign: "right", marginBottom: 10 },
  colorRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
  },
  deleteBtn: { padding: 6 },
  colorFields: { flex: 1, gap: 6 },
  smallInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  hexEditRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  colorSwatchSm: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: "#444" },
  hexSmall: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  bigSwatch: { width: 46, height: 46, borderRadius: 10, borderWidth: 1 },
  dragHandle: {
    width: 32,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
