import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { CITIES_BY_GOVERNORATE } from "@/constants/governorates";

type Props = {
  governorate: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
};

export default function CityPicker({ governorate, value, onChange, invalid, placeholder }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const cities = useMemo(() => CITIES_BY_GOVERNORATE[governorate] ?? [], [governorate]);
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return cities;
    return cities.filter((c) => c.includes(q));
  }, [cities, search]);

  const disabled = !governorate.trim();

  return (
    <>
      <Pressable
        onPress={() => { if (!disabled) { setSearch(""); setOpen(true); } }}
        style={{
          backgroundColor: colors.input,
          borderWidth: 1,
          borderColor: invalid ? colors.border : colors.gold + "44",
          borderRadius: 8,
          padding: 11,
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text
          style={{
            color: value ? colors.foreground : colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            textAlign: "right",
            flex: 1,
          }}
        >
          {value || (disabled ? "اختر المحافظة أولاً" : placeholder || "اختر المدينة / المركز *")}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, maxHeight: "75%", overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>اختر المدينة / المركز</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Icon name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="بحث..."
                placeholderTextColor={colors.mutedForeground}
                style={{
                  backgroundColor: colors.input,
                  borderWidth: 1,
                  borderColor: colors.gold + "44",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  color: colors.foreground,
                  textAlign: "right",
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                }}
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: 8 }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>
                  لا توجد نتائج
                </Text>
              ) : (
                filtered.map((c) => {
                  const selected = c === value;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: selected ? colors.gold + "18" : "transparent",
                      }}
                    >
                      <Icon name={selected ? "check-circle" : "circle"} size={16} color={selected ? colors.gold : colors.mutedForeground} />
                      <Text style={{ color: colors.foreground, fontFamily: selected ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14, flex: 1, textAlign: "right" }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
