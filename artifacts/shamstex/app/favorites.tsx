import { router } from "expo-router";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GoldHeader from "@/components/GoldHeader";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, favorites } = useApp();

  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 16);

  // Preserve favorite order (most-recently added first) and skip any product
  // that no longer exists in the catalog.
  const favProducts = useMemo(() => {
    return favorites
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [favorites, products]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="المفضّلة" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 40 }]}
      >
        {favProducts.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="heart" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              لا توجد منتجات في المفضّلة
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              اضغط على القلب في أي منتج لإضافته هنا
            </Text>
          </View>
        ) : (
          favProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => router.push(`/product/${product.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
  },
});
