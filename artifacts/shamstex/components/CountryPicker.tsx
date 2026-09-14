import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { COUNTRIES, Country } from "@/lib/countries";
import Icon from "@/components/Icon";

type Props = {
  visible: boolean;
  selected: Country;
  onClose: () => void;
  onSelect: (c: Country) => void;
};

export default function CountryPicker({ visible, selected, onClose, onSelect }: Props) {
  const colors = useColors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.nameAr.includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dial.includes(q)
    );
  }, [search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>اختر الدولة</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              textAlign="right"
            />
          </View>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => {
              const active = c.iso === selected.iso;
              return (
                <Pressable
                  key={c.iso}
                  style={[
                    styles.row,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.gold + "15" },
                  ]}
                  onPress={() => {
                    onSelect(c);
                    onClose();
                  }}
                >
                  <Text style={styles.flag}>{c.flag}</Text>
                  <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {c.nameAr}
                  </Text>
                  <Text style={[styles.dial, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                    {c.dial}
                  </Text>
                </Pressable>
              );
            })}
            {filtered.length === 0 && (
              <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 20 }}>
                لا توجد نتائج
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18 },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 15, textAlign: "right" },
  dial: { fontSize: 14 },
});
