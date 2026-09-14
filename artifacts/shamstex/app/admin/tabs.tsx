import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Tab } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";

const TAB_TYPES: { value: Tab["type"]; label: string }[] = [
  { value: "home", label: "الرئيسية" },
  { value: "products", label: "المنتجات" },
  { value: "orders", label: "الطلبات" },
  { value: "contact", label: "التواصل" },
  { value: "about", label: "من نحن" },
];

const TAB_ICONS = ["home", "grid", "package", "phone", "info", "star", "heart", "settings"];

export default function AdminTabsScreen() {
  useAdminGuard("manage_settings");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tabs, setTabs } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<Tab["type"]>("home");
  const [showAddForm, setShowAddForm] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const sorted = [...tabs].sort((a, b) => a.order - b.order);

  const toggleVisible = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setTabs(tabs.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)));
  };

  const moveUp = async (id: string) => {
    const index = sorted.findIndex((t) => t.id === id);
    if (index <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = [...sorted];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    await setTabs(updated.map((t, i) => ({ ...t, order: i })));
  };

  const moveDown = async (id: string) => {
    const index = sorted.findIndex((t) => t.id === id);
    if (index >= sorted.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = [...sorted];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    await setTabs(updated.map((t, i) => ({ ...t, order: i })));
  };

  const startEdit = (tab: Tab) => {
    setEditingId(tab.id);
    setEditLabel(tab.label);
    setEditIcon(tab.icon);
  };

  const saveEdit = async () => {
    if (!editLabel) return;
    await setTabs(
      tabs.map((t) =>
        t.id === editingId ? { ...t, label: editLabel, icon: editIcon } : t
      )
    );
    setEditingId(null);
  };

  const deleteTab = (id: string) => {
    Alert.alert("حذف", "هل تريد حذف هذا التبويب؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          await setTabs(tabs.filter((t) => t.id !== id).map((t, i) => ({ ...t, order: i })));
        },
      },
    ]);
  };

  const addTab = async () => {
    if (!newLabel) return;
    const newTab: Tab = {
      id: Date.now().toString(),
      label: newLabel,
      icon: "star",
      type: newType,
      visible: true,
      order: tabs.length,
    };
    await setTabs([...tabs, newTab]);
    setNewLabel("");
    setShowAddForm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="إدارة التبويبات" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          يمكنك إضافة وحذف وترتيب وإخفاء التبويبات في شريط التنقل
        </Text>

        {sorted.map((tab, index) => (
          <View
            key={tab.id}
            style={[
              styles.tabCard,
              {
                backgroundColor: colors.card,
                borderColor: tab.visible ? colors.border : colors.border + "44",
                borderRadius: colors.radius,
                opacity: tab.visible ? 1 : 0.6,
              },
            ]}
          >
            {editingId === tab.id ? (
              <View style={styles.editForm}>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      borderRadius: 8,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder="اسم التبويب"
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                />
                <View style={styles.editActions}>
                  <GoldButton label="إلغاء" onPress={() => setEditingId(null)} variant="ghost" size="sm" style={{ flex: 1 }} />
                  <GoldButton label="حفظ" onPress={saveEdit} size="sm" style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <View style={styles.tabRow}>
                <View style={styles.tabActions}>
                  <Pressable onPress={() => moveUp(tab.id)} style={({ pressed }) => [styles.arrowBtn, { opacity: pressed ? 0.5 : index === 0 ? 0.2 : 1 }]}>
                    <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable onPress={() => moveDown(tab.id)} style={({ pressed }) => [styles.arrowBtn, { opacity: pressed ? 0.5 : index === sorted.length - 1 ? 0.2 : 1 }]}>
                    <Icon name="chevron-left" size={16} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable onPress={() => startEdit(tab)} style={({ pressed }) => [styles.arrowBtn, { opacity: pressed ? 0.5 : 1 }]}>
                    <Icon name="edit-2" size={14} color={colors.gold} />
                  </Pressable>
                  <Pressable onPress={() => deleteTab(tab.id)} style={({ pressed }) => [styles.arrowBtn, { opacity: pressed ? 0.5 : 1 }]}>
                    <Icon name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>

                <View style={styles.tabInfo}>
                  <Text style={[styles.tabLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {tab.label}
                  </Text>
                  <Text style={[styles.tabType, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {TAB_TYPES.find((t) => t.value === tab.type)?.label ?? tab.type}
                  </Text>
                </View>

                <View style={styles.tabLeft}>
                  <Switch
                    value={tab.visible}
                    onValueChange={() => toggleVisible(tab.id)}
                    trackColor={{ false: colors.border, true: colors.gold + "66" }}
                    thumbColor={tab.visible ? colors.gold : colors.mutedForeground}
                  />
                  <View style={[styles.tabIconBadge, { backgroundColor: colors.gold + "22" }]}>
                    <Icon name={tab.icon as any} size={16} color={colors.gold} />
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}

        {showAddForm ? (
          <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.gold + "44", borderRadius: colors.radius }]}>
            <Text style={[styles.addTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
              تبويب جديد
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  borderRadius: 8,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="اسم التبويب"
              placeholderTextColor={colors.mutedForeground}
              textAlign="right"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {TAB_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setNewType(t.value)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: newType === t.value ? colors.gold : colors.surface,
                      borderColor: newType === t.value ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Text style={[{ color: newType === t.value ? colors.background : colors.foreground, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.addActions}>
              <GoldButton label="إلغاء" onPress={() => setShowAddForm(false)} variant="ghost" size="sm" style={{ flex: 1 }} />
              <GoldButton label="إضافة" onPress={addTab} size="sm" style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <GoldButton
            label="إضافة تبويب جديد"
            onPress={() => setShowAddForm(true)}
            variant="outline"
            style={{ width: "100%" }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  hint: { fontSize: 13, textAlign: "right", lineHeight: 20, paddingBottom: 4 },
  tabCard: { borderWidth: 1, padding: 12 },
  tabRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  tabLeft: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  tabInfo: { flex: 1, gap: 2, alignItems: "flex-end" },
  tabLabel: { fontSize: 14 },
  tabType: { fontSize: 11 },
  tabActions: { flexDirection: "row-reverse", gap: 2 },
  arrowBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  tabIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  editForm: { gap: 10 },
  editInput: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  editActions: { flexDirection: "row-reverse", gap: 10 },
  addForm: { borderWidth: 1, padding: 16, gap: 12 },
  addTitle: { fontSize: 15, textAlign: "right" },
  typeRow: { gap: 8, flexDirection: "row-reverse" },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  addActions: { flexDirection: "row-reverse", gap: 10 },
});
