import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ScrollView as ScrollViewType } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useCartPulse } from "@/hooks/useCartPulse";
import { useTranslation } from "@/lib/i18n";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/context/AppContext";

const OUT_OF_STOCK_LABEL = "غير متوفر";

export default function ProductsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, user, cart, settings, pricingView, setPricingView, canTogglePricing, effectivePriceMode, favorites } = useApp();
  const cartCount = cart.length;
  const cartPulse = useCartPulse(cartCount);
  const { t, isRTL } = useTranslation();
  const CATEGORIES = settings.categories.length > 0 ? settings.categories : [isRTL ? "الكل" : "All"];
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(isRTL ? "الكل" : "All");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const catScrollRef = useRef<ScrollViewType>(null);
  const subCatScrollRef = useRef<ScrollViewType>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const subcategoriesForActive: string[] = useMemo(
    () => activeCategory !== "الكل" && activeCategory !== OUT_OF_STOCK_LABEL
      ? (settings.subcategories ?? {})[activeCategory] ?? []
      : [],
    [activeCategory, settings.subcategories]
  );

  const filtered = useMemo(() => products.filter((p) => {
      if (activeCategory === OUT_OF_STOCK_LABEL) {
        if (p.inStock) return false;
      } else {
        const matchCategory = activeCategory === "الكل" || p.category === activeCategory;
        if (!matchCategory) return false;
        if (activeSubcategory && p.subcategory !== activeSubcategory) return false;
      }
      const matchSearch = !search || p.name.includes(search) || p.category.includes(search);
      return matchSearch;
    }), [products, activeCategory, activeSubcategory, search]);

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/product/${productId}`);
  }, []);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={() => handleProductPress(item.id)}
    />
  ), [handleProductPress]);

  const handleCategoryPress = (cat: string) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
        >
          {t("products")}
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          {/* Cart button for customers/merchants */}
          {(user?.role === "customer" || user?.role === "merchant") && (
            <Pressable
              onPress={() => router.push("/cart")}
              style={({ pressed }) => [styles.cartHeaderBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Animated.View style={[styles.cartHeaderIconWrap, { transform: [{ scale: cartPulse }] }]}>
                <Icon name="shopping-cart" size={22} color={colors.foreground} />
                {cartCount > 0 && (
                  <View style={[styles.cartBadge, { backgroundColor: "#E74C3C" }]}>
                    <Text style={[styles.cartBadgeText, { color: "#fff" }]}>
                      {cartCount > 99 ? "99+" : cartCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </Pressable>
          )}
          {/* Favorites button for customers/merchants */}
          {(user?.role === "customer" || user?.role === "merchant") && (
            <Pressable
              onPress={() => router.push("/favorites")}
              style={({ pressed }) => [styles.cartHeaderBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="heart" size={22} color={colors.foreground} />
              {favorites.length > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.cartBadgeText, { color: colors.background }]}>
                    {favorites.length}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          {/* Add product button for admin/employee */}
          {(user?.role === "admin" || user?.role === "employee") && (
            <Pressable
              onPress={() => router.push("/admin/add-product")}
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: colors.gold,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon name="plus" size={18} color={colors.background} />
            </Pressable>
          )}
        </View>
      </View>

      <View
        style={[
          styles.searchWrapper,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {canTogglePricing && (
          <View style={{ flexDirection: "row-reverse", gap: 6, paddingHorizontal: 16, paddingTop: 10, alignItems: "center" }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
              عرض الأسعار:
            </Text>
            {([
              { v: "wholesale", l: "تجار" },
              { v: "retail", l: "عملاء" },
            ] as const).map((opt) => {
              const active = effectivePriceMode === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => setPricingView(opt.v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 14,
                    borderWidth: 1,
                    backgroundColor: active ? colors.gold + "33" : "transparent",
                    borderColor: active ? colors.gold : colors.border,
                  }}
                >
                  <Text style={{
                    color: active ? colors.gold : colors.mutedForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 12,
                  }}>
                    {opt.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder={t("searchProducts")}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
        </View>

        <ScrollView
          ref={catScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
          onContentSizeChange={() => catScrollRef.current?.scrollToEnd({ animated: false })}
        >
          {[...CATEGORIES, OUT_OF_STOCK_LABEL].reverse().map((cat) => (
            <Pressable
              key={cat}
              onPress={() => handleCategoryPress(cat)}
              style={({ pressed }) => [
                styles.catChip,
                {
                  backgroundColor:
                    activeCategory === cat
                      ? cat === OUT_OF_STOCK_LABEL
                        ? "#E74C3C"
                        : colors.gold
                      : colors.surface,
                  borderColor:
                    activeCategory === cat
                      ? cat === OUT_OF_STOCK_LABEL
                        ? "#E74C3C"
                        : colors.gold
                      : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.catText,
                  {
                    color:
                      activeCategory === cat ? colors.background : colors.foreground,
                    fontFamily:
                      activeCategory === cat ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {subcategoriesForActive.length > 0 && (
          <ScrollView
            ref={subCatScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subCatScroll}
            onContentSizeChange={() => subCatScrollRef.current?.scrollToEnd({ animated: false })}
          >
            {[...subcategoriesForActive].reverse().map((sub) => (
              <Pressable
                key={sub}
                onPress={() => setActiveSubcategory(sub)}
                style={({ pressed }) => [
                  styles.subCatChip,
                  {
                    backgroundColor: activeSubcategory === sub ? colors.gold + "33" : "transparent",
                    borderColor: activeSubcategory === sub ? colors.gold : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.subCatText, {
                  color: activeSubcategory === sub ? colors.gold : colors.mutedForeground,
                  fontFamily: activeSubcategory === sub ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>
                  {sub}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setActiveSubcategory(null)}
              style={({ pressed }) => [
                styles.subCatChip,
                {
                  backgroundColor: !activeSubcategory ? colors.gold + "33" : "transparent",
                  borderColor: !activeSubcategory ? colors.gold : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.subCatText, {
                color: !activeSubcategory ? colors.gold : colors.mutedForeground,
                fontFamily: !activeSubcategory ? "Inter_600SemiBold" : "Inter_400Regular",
              }]}>
                {t("allCategories")}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={40}
        removeClippedSubviews={Platform.OS !== "web"}
        getItemLayout={(_, index) => ({ length: 246, offset: 246 * index, index })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="layers" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("noProducts")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cartHeaderBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartHeaderIconWrap: { position: "relative", width: 24, height: 24, overflow: "visible" },
  cartBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  catScroll: {
    gap: 8,
    flexDirection: "row",
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catText: {
    fontSize: 13,
  },
  subCatScroll: {
    gap: 8,
    flexDirection: "row",
  },
  subCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  subCatText: {
    fontSize: 11,
  },
  list: {
    padding: 16,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
