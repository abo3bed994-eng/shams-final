import React, { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { useApp, Product } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";

const UNIT_LABELS: Record<string, string> = {
  meter: "م",
  kilo: "كغ",
};

export default function AdminProductsScreen() {
  useAdminGuard("view_products");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, setProducts, deleteProductOne, updateProductOne } = useApp();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const deleteProduct = (id: string, name: string) => {
    Alert.alert("حذف المنتج", `هل تريد حذف "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteProductOne(id);
        },
      },
    ]);
  };

  const toggleStock = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = products.find((p) => p.id === id);
    if (target) await updateProductOne({ ...target, inStock: !target.inStock });
  };

  const renderItem = useCallback(
    ({ item: product, drag, isActive }: RenderItemParams<Product>) => {
      const isOutOfStock = !product.inStock;
      return (
        <ScaleDecorator>
          <View
            style={[
              styles.productCard,
              {
                backgroundColor: isActive
                  ? colors.surface
                  : isOutOfStock
                  ? "#C0392B0A"
                  : colors.card,
                borderColor: isOutOfStock
                  ? "#C0392B66"
                  : isActive
                  ? colors.gold + "66"
                  : colors.border,
                borderRadius: colors.radius,
                marginBottom: 12,
                shadowColor: isActive ? colors.gold : "transparent",
                shadowOpacity: isActive ? 0.3 : 0,
                shadowRadius: isActive ? 10 : 0,
                elevation: isActive ? 8 : 0,
              },
            ]}
          >
            <View style={styles.productHeader}>
              <View style={styles.productActions}>
                <Pressable
                  onPress={() => deleteProduct(product.id, product.name)}
                  style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/admin/edit-product/${product.id}` as any)}
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.gold + "22", borderRadius: 8, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="edit-2" size={16} color={colors.gold} />
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/product/${product.id}`)}
                  style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="eye" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={styles.productInfo}>
                <View style={styles.nameRow}>
                  {isOutOfStock && (
                    <View style={styles.outOfStockBadge}>
                      <Text style={[styles.outOfStockBadgeText, { fontFamily: "Inter_700Bold" }]}>
                        غير متوفر
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.productName,
                      {
                        color: isOutOfStock ? "#C0392B" : colors.foreground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {product.name}
                  </Text>
                </View>
                <View style={styles.productBadges}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.gold + "22" }]}>
                    <Text style={[styles.categoryText, { color: colors.gold, fontFamily: "Inter_500Medium" }]}>
                      {product.category}
                      {product.subcategory ? ` / ${product.subcategory}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.unitBadge, {
                    backgroundColor: product.unit === "kilo" ? "#2980B922" : "#27AE6022",
                    borderColor: product.unit === "kilo" ? "#2980B944" : "#27AE6044",
                  }]}>
                    <Text style={[styles.unitText, {
                      color: product.unit === "kilo" ? "#2980B9" : "#27AE60",
                      fontFamily: "Inter_600SemiBold",
                    }]}>
                      {UNIT_LABELS[product.unit ?? "meter"]}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.rightSide}>
                <Pressable
                  onLongPress={drag}
                  delayLongPress={150}
                  style={[
                    styles.dragHandle,
                    {
                      backgroundColor: isActive ? colors.gold + "22" : colors.surface,
                      borderColor: isActive ? colors.gold + "55" : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name="grip-vertical"
                    size={20}
                    color={isActive ? colors.gold : colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            <View style={[styles.productDetails, { borderTopColor: colors.border }]}>
              <View style={styles.priceItem}>
                <Text style={[styles.priceValue, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                  {product.wholesalePrice} ج.م
                </Text>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  سعر التاجر
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.priceItem}>
                <Text style={[styles.priceValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {product.retailPrice} ج.م
                </Text>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  سعر الزبون
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.priceItem}>
                <Text style={[styles.priceValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {product.colors.length}
                </Text>
                <Text style={[styles.priceLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  الألوان
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => toggleStock(product.id)}
              style={({ pressed }) => [
                styles.stockBtn,
                {
                  backgroundColor: product.inStock ? "#27AE6015" : "#C0392B22",
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon
                name={product.inStock ? "check-circle" : "x-circle"}
                size={14}
                color={product.inStock ? "#27AE60" : "#C0392B"}
              />
              <Text
                style={[
                  styles.stockText,
                  {
                    color: product.inStock ? "#27AE60" : "#C0392B",
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {product.inStock ? "متوفر — اضغط للتغيير" : "غير متوفر — اضغط للتغيير"}
              </Text>
            </Pressable>
          </View>
        </ScaleDecorator>
      );
    },
    [colors, products]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title="إدارة المنتجات"
        subtitle={`${products.length} منتج — اسحب لإعادة الترتيب`}
        onBack={() => router.back()}
        rightElement={
          <Pressable
            onPress={() => router.push("/admin/add-product")}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.gold, borderRadius: 8, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Icon name="plus" size={18} color={colors.background} />
          </Pressable>
        }
      />

      {products.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="layers" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            لا توجد منتجات
          </Text>
          <GoldButton
            label="إضافة منتج"
            onPress={() => router.push("/admin/add-product")}
            variant="outline"
          />
        </View>
      ) : (
        <DraggableFlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setProducts(data);
          }}
          onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomPad + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  addBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  productCard: { borderWidth: 1, overflow: "hidden" },
  productHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  rightSide: { alignItems: "center" },
  dragHandle: {
    width: 36,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1, gap: 6, alignItems: "flex-end" },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" },
  productName: { fontSize: 14, textAlign: "right" },
  outOfStockBadge: {
    backgroundColor: "#C0392B",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outOfStockBadgeText: { color: "#FFFFFF", fontSize: 10 },
  productBadges: { flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryText: { fontSize: 11 },
  unitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  unitText: { fontSize: 11 },
  productActions: {
    flexDirection: "row-reverse",
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  productDetails: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  priceItem: { flex: 1, alignItems: "center", gap: 3 },
  priceValue: { fontSize: 15 },
  priceLabel: { fontSize: 10 },
  divider: { width: 1, height: 40 },
  stockBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderTopWidth: 1,
  },
  stockText: { fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 16 },
});
