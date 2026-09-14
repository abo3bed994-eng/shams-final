import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { EGYPT_GOVERNORATES } from "@/constants/governorates";

type Props = {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
};

export default function GovernoratePicker({ value, onChange, invalid, placeholder }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.input,
          borderWidth: 1,
          borderColor: invalid ? colors.border : colors.gold + "44",
          borderRadius: 8,
          padding: 11,
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
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
          {value || placeholder || "اختر المحافظة *"}
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
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>اختر المحافظة</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Icon name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              {EGYPT_GOVERNORATES.map((g) => {
                const selected = g === value;
                return (
                  <Pressable
                    key={g}
                    onPress={() => {
                      onChange(g);
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
                      {g}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
