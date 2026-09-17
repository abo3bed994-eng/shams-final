import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Product } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";

export default function AdminPricesScreen() {
  useAdminGuard("edit_products");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, updateProductOne } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [editTexts, setEditTexts] = useState<{ retail: string; wholesale: string }>({ retail: "", wholesale: "" });
  const [priceTrend, setPriceTrend] = useState<Product["priceTrend"]>(undefined);
  const [priceMenuNew, setPriceMenuNew] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const startEdit = (product: Product) => {
    setEditing(product.id);
    setEditValues({ name: product.name });
    setEditTexts({
      retail: String(product.retailPrice),
      wholesale: String(product.wholesalePrice),
    });
    setPriceTrend(product.priceTrend);
    setPriceMenuNew(!!product.priceMenuNew);
  };

  const saveEdit = async (id: string) => {
    const retail = parseFloat(editTexts.retail);
    const wholesale = parseFloat(editTexts.wholesale);
    if (!editValues.name || isNaN(retail) || isNaN(wholesale)) {
      Alert.alert("خطأ", "الرجاء إدخال جميع الحقول");
      return;
    }
    const target = products.find((p) => p.id === id);
    if (!target) return;
    try {
      await updateProductOne({
        ...target,
        name: editValues.name!,
        retailPrice: retail,
        wholesalePrice: wholesale,
        priceTrend,
        priceMenuNew,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(null);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("تعذّر الحفظ", "تأكد من اتصال الإنترنت ثم حاول مجدداً");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="إدارة الأسعار" onBack={() => router.back()} />

      <KeyboardAwareScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", flex: 1 }]}>
            سعر التاجر
          </Text>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", flex: 1 }]}>
            سعر الزبون
          </Text>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", flex: 2 }]}>
            اسم الخامة
          </Text>
        </View>

        {products.map((product) => (
          <View key={product.id}>
            <Pressable
              onPress={() => startEdit(product)}
              style={({ pressed }) => [
                styles.priceRow,
                {
                  backgroundColor: editing === product.id ? colors.surface : colors.card,
                  borderColor: editing === product.id ? colors.gold + "44" : colors.border,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {editing !== product.id ? (
                <>
                  <Text style={[styles.priceCell, { color: colors.gold, fontFamily: "Inter_700Bold", flex: 1 }]}>
                    {product.wholesalePrice} ج.م
                  </Text>
                  <Text style={[styles.priceCell, { color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1 }]}>
                    {product.retailPrice} ج.م
                  </Text>
                   <View style={{ flex: 2, flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                     {product.priceMenuNew && (
                       <View style={[styles.newBadge, { backgroundColor: colors.gold }]}>
                         <Text style={[styles.newBadgeText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>NEW</Text>
                       </View>
                     )}
                     {product.priceTrend === "up" && <Icon name="chevron-up" size={17} color="#27AE60" />}
                     {product.priceTrend === "down" && <Icon name="chevron-down" size={17} color="#E74C3C" />}
                    <Text style={[styles.nameCell, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {product.name}
                    </Text>
                  </View>
                  <Icon name="edit-2" size={14} color={colors.mutedForeground} />
                </>
              ) : (
                <View style={{ flex: 1, gap: 10 }}>
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
                    value={editValues.name}
                    onChangeText={(v) => setEditValues((p) => ({ ...p, name: v }))}
                    placeholder="اسم الخامة"
                    placeholderTextColor={colors.mutedForeground}
                    textAlign="right"
                  />
                  <View style={styles.priceInputsRow}>
                    <View style={styles.priceInputWrapper}>
                      <Text style={[styles.priceInputLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        سعر التاجر
                      </Text>
                      <TextInput
                        style={[
                          styles.editInput,
                          {
                            color: colors.gold,
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                            borderRadius: 8,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                        value={editTexts.wholesale}
                        onChangeText={(v) => { if (/^\d*\.?\d*$/.test(v)) setEditTexts(p => ({ ...p, wholesale: v })); }}
                        keyboardType="decimal-pad"
                        textAlign="right"
                      />
                    </View>
                    <View style={styles.priceInputWrapper}>
                      <Text style={[styles.priceInputLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        سعر الزبون
                      </Text>
                      <TextInput
                        style={[
                          styles.editInput,
                          {
                            color: colors.foreground,
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                            borderRadius: 8,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                        value={editTexts.retail}
                        onChangeText={(v) => { if (/^\d*\.?\d*$/.test(v)) setEditTexts(p => ({ ...p, retail: v })); }}
                        keyboardType="decimal-pad"
                        textAlign="right"
                      />
                    </View>
                  </View>
                   <View style={styles.markerRow}>
                     <Pressable
                       onPress={() => setPriceMenuNew((value) => !value)}
                       style={[styles.markerBtn, { backgroundColor: priceMenuNew ? colors.gold + "22" : colors.surface, borderColor: priceMenuNew ? colors.gold : colors.border }]}
                     >
                       <View style={[styles.newBadge, { backgroundColor: priceMenuNew ? colors.gold : colors.mutedForeground }]}>
                         <Text style={[styles.newBadgeText, { color: priceMenuNew ? colors.background : colors.card, fontFamily: "Inter_700Bold" }]}>NEW</Text>
                       </View>
                       <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>شارة خامة جديدة</Text>
                     </Pressable>
                     <View style={styles.trendGroup}>
                       <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>إشارة السعر</Text>
                       <View style={styles.trendButtons}>
                         {([
                           { value: undefined, label: "بدون", icon: "minus" },
                           { value: "up", label: "↑", icon: "chevron-up" },
                           { value: "down", label: "↓", icon: "chevron-down" },
                         ] as const).map((item) => (
                           <Pressable
                             key={item.label}
                             onPress={() => setPriceTrend(item.value)}
                             style={[styles.trendBtn, { backgroundColor: priceTrend === item.value ? colors.gold + "22" : colors.surface, borderColor: priceTrend === item.value ? colors.gold : colors.border }]}
                           >
                             <Icon name={item.icon} size={14} color={priceTrend === item.value ? colors.gold : colors.mutedForeground} />
                             <Text style={{ color: priceTrend === item.value ? colors.gold : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>{item.label}</Text>
                           </Pressable>
                         ))}
                       </View>
                     </View>
                   </View>
                  <View style={styles.editActions}>
                    <GoldButton
                      label="إلغاء"
                      onPress={() => setEditing(null)}
                      variant="ghost"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <GoldButton
                      label="حفظ"
                      onPress={() => saveEdit(product.id)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        ))}
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  headerRow: {
    flexDirection: "row-reverse",
    paddingBottom: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  colHeader: { fontSize: 12, textAlign: "center" },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  priceCell: { fontSize: 14, textAlign: "center" },
  nameCell: { fontSize: 14 },
  editInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  priceInputsRow: { flexDirection: "row-reverse", gap: 10 },
  priceInputWrapper: { flex: 1, gap: 4 },
  priceInputLabel: { fontSize: 11, textAlign: "right" },
  editActions: { flexDirection: "row-reverse", gap: 10 },
  markerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  markerBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  newBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  newBadgeText: { fontSize: 9 },
  trendGroup: { flex: 1, alignItems: "flex-end", gap: 4 },
  trendButtons: { flexDirection: "row-reverse", gap: 4 },
  trendBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 2, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 },
});
