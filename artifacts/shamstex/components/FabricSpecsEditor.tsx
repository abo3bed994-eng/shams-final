import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { CompositionEntry, compositionPercentTotal } from "@/lib/fabric";

interface Props {
  width: string;
  setWidth: (v: string) => void;
  gsm: string;
  setGsm: (v: string) => void;
  composition: CompositionEntry[];
  setComposition: (c: CompositionEntry[]) => void;
  yarnTypes: string[];
}

export default function FabricSpecsEditor({
  width,
  setWidth,
  gsm,
  setGsm,
  composition,
  setComposition,
  yarnTypes,
}: Props) {
  const colors = useColors();
  const single = composition.length === 1;
  const total = compositionPercentTotal(composition);

  const addEntry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const firstYarn = yarnTypes[0] ?? "";
    setComposition([...composition, { yarn: firstYarn, percent: 0 }]);
  };
  const removeEntry = (idx: number) => {
    setComposition(composition.filter((_, i) => i !== idx));
  };
  const setYarn = (idx: number, yarn: string) => {
    setComposition(composition.map((e, i) => (i === idx ? { ...e, yarn } : e)));
  };
  const setPercent = (idx: number, percent: number) => {
    setComposition(composition.map((e, i) => (i === idx ? { ...e, percent } : e)));
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        مواصفات القماش
      </Text>

      <View style={styles.specRow}>
        <View style={styles.specField}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            العرض (سم)
          </Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4, fontFamily: "Inter_600SemiBold" }]}
            value={width}
            onChangeText={setWidth}
            keyboardType="decimal-pad"
            placeholder="مثال: 150"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
          />
        </View>
        <View style={styles.specField}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            المقطع / GSM (جم/م²)
          </Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4, fontFamily: "Inter_600SemiBold" }]}
            value={gsm}
            onChangeText={setGsm}
            keyboardType="decimal-pad"
            placeholder="مثال: 200"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            التركيب
          </Text>
          {composition.length > 1 && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: total === 100 ? colors.gold : "#C0392B" }}>
              المجموع {total}%
            </Text>
          )}
        </View>

        {yarnTypes.length === 0 && (
          <Text style={{ color: "#C0392B", fontSize: 12, textAlign: "right", fontFamily: "Inter_400Regular" }}>
            أضف أنواع الفتلة من إعدادات التطبيق أولاً
          </Text>
        )}

        {composition.map((entry, idx) => (
          <View key={idx} style={[styles.entryBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                {single ? (
                  <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                    100%
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                    <TextInput
                      style={[styles.percentInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4, fontFamily: "Inter_700Bold" }]}
                      value={entry.percent ? String(entry.percent) : ""}
                      onChangeText={(v) => setPercent(idx, Number(v.replace(/[^0-9]/g, "")) || 0)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      textAlign="center"
                      maxLength={3}
                    />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>%</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => removeEntry(idx)} hitSlop={6} style={styles.removeBtn}>
                <Icon name="x" size={14} color={colors.destructive} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yarnsRow}>
              {yarnTypes.map((yarn) => {
                const selected = entry.yarn === yarn;
                return (
                  <Pressable
                    key={yarn}
                    onPress={() => setYarn(idx, yarn)}
                    style={[styles.yarnChip, { backgroundColor: selected ? colors.gold + "22" : colors.card, borderColor: selected ? colors.gold : colors.border }]}
                  >
                    <Text style={{ color: selected ? colors.gold : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13 }}>
                      {yarn}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <Pressable
          onPress={addEntry}
          disabled={yarnTypes.length === 0}
          style={[styles.addEntryBtn, { borderColor: colors.gold + "66", opacity: yarnTypes.length === 0 ? 0.4 : 1 }]}
        >
          <Icon name="plus" size={16} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>إضافة فتلة</Text>
        </Pressable>
        {single && (
          <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right", fontFamily: "Inter_400Regular" }}>
            عند وجود فتلة واحدة فقط تُحتسب 100% تلقائياً
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, borderWidth: 1, gap: 14 },
  sectionTitle: { fontSize: 15, textAlign: "right" },
  specRow: { flexDirection: "row-reverse", gap: 12 },
  specField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, textAlign: "right" },
  textInput: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  entryBox: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 10 },
  percentInput: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, width: 60 },
  removeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  yarnsRow: { gap: 8, flexDirection: "row-reverse" },
  yarnChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  addEntryBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed" },
});
