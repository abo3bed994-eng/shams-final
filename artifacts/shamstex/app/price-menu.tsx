import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { PriceMenuSettings, useApp } from "@/context/AppContext";
import { displayPriceFor } from "@/lib/pricing";
import { buildPriceMenuHtml } from "@/utils/priceMenuHtml";

const EMPTY_MENU: PriceMenuSettings = {
  backgroundOpacity: 0.12,
  categories: [],
  productOrder: [],
  productCategories: {},
};

function getMenu(settings: { priceMenu?: Partial<PriceMenuSettings> }): PriceMenuSettings {
  return {
    ...EMPTY_MENU,
    ...(settings.priceMenu ?? {}),
    categories: settings.priceMenu?.categories ?? EMPTY_MENU.categories,
    productOrder: settings.priceMenu?.productOrder ?? EMPTY_MENU.productOrder,
    productCategories: settings.priceMenu?.productCategories ?? EMPTY_MENU.productCategories,
  };
}

export default function PriceMenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, products, settings, canViewPriceMenu, effectivePriceMode } = useApp();
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const menu = getMenu(settings);
  const isMerchant = user?.role === "merchant";
  const priceLabel = effectivePriceMode === "wholesale" ? "أسعار التجار" : "أسعار العملاء";

  useEffect(() => {
    if (user && !canViewPriceMenu) router.replace("/(tabs)" as any);
  }, [canViewPriceMenu, user]);

  const orderedProducts = useMemo(() => {
    const rank = new Map(menu.productOrder.map((id, index) => [id, index]));
    return [...products].sort((a, b) => {
      const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.name.localeCompare(b.name, "ar");
    });
  }, [menu.productOrder, products]);

  const groups = useMemo(() => {
    const categoryRank = new Map(menu.categories.map((name, index) => [name, index]));
    const grouped = new Map<string, typeof orderedProducts>();
    orderedProducts.forEach((product) => {
      const category = menu.productCategories[product.id] || product.category || "خامات";
      const list = grouped.get(category);
      if (list) list.push(product);
      else grouped.set(category, [product]);
    });
    return [...grouped.entries()].sort(([a], [b]) => {
      const aRank = categoryRank.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bRank = categoryRank.get(b) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.localeCompare(b, "ar");
    });
  }, [menu.categories, menu.productCategories, orderedProducts]);

  const html = useMemo(() => buildPriceMenuHtml(products, menu, effectivePriceMode), [effectivePriceMode, menu, products]);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const print = async () => {
    setBusy("print");
    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert("تعذّرت الطباعة", "حاول مرة أخرى من جهاز يدعم الطباعة.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: "قائمة أسعار شمس تكس", text: "قائمة أسعار التجار" });
        } else {
          Alert.alert("المشاركة", "المشاركة متاحة من الهاتف أو بعد طباعة القائمة كملف PDF.");
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "مشاركة قائمة الأسعار" });
        } else {
          await Share.share({ message: "قائمة أسعار شمس تكس" });
        }
      }
    } catch {
      // Closing the native share sheet is not an error worth showing.
    } finally {
      setBusy(null);
    }
  };

  if (!user || !canViewPriceMenu) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Icon name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>قائمة الأسعار</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{priceLabel}</Text>
        </View>
        {!isMerchant && (
          <View style={styles.headerActions}>
            <Pressable
              onPress={print}
              disabled={!!busy}
              accessibilityLabel="طباعة قائمة الأسعار"
              testID="price-menu-print"
              style={styles.headerBtn}
            >
              {busy === "print" ? <ActivityIndicator size="small" color={colors.gold} /> : <Icon name="printer" size={20} color={colors.gold} />}
            </Pressable>
            <Pressable
              onPress={share}
              disabled={!!busy}
              accessibilityLabel="مشاركة قائمة الأسعار"
              testID="price-menu-share"
              style={styles.headerBtn}
            >
              {busy === "share" ? <ActivityIndicator size="small" color={colors.gold} /> : <Icon name="share-2" size={20} color={colors.gold} />}
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 30 }]}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.gold + "55" }]}>
          {menu.backgroundImageUri && (
            <Image
              source={{ uri: menu.backgroundImageUri }}
              style={[StyleSheet.absoluteFillObject, { opacity: menu.backgroundOpacity ?? 0.12 }]}
              resizeMode="cover"
            />
          )}
          <View style={styles.heroOverlay}>
            <Icon name="file-text" size={28} color={colors.gold} />
            <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>قائمة أسعار شمس تكس</Text>
            <Text style={[styles.heroCaption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {priceLabel}
            </Text>
          </View>
        </View>

        {groups.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>لا توجد خامات في القائمة</Text>
        ) : groups.map(([category, items]) => (
          <View key={category} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sectionTitleRow, { borderBottomColor: colors.gold + "66" }]}>
              <Icon name="layers" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>{category}</Text>
            </View>
            {items.map((product) => (
              <View key={product.id} style={[styles.priceRow, { borderBottomColor: colors.border }]}>
                <View style={styles.nameWrap}>
                  <Text style={[styles.productName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{product.name}</Text>
                  {product.priceMenuNew && (
                    <View style={[styles.newBadge, { backgroundColor: colors.gold }]}>
                      <Text style={[styles.newBadgeText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>NEW</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceWrap}>
                  {product.priceTrend === "up" && <Icon name="chevron-up" size={18} color="#27AE60" />}
                  {product.priceTrend === "down" && <Icon name="chevron-down" size={18} color="#E74C3C" />}
                  <Text style={[styles.price, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>{displayPriceFor(product, effectivePriceMode)} ج.م</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { flex: 1, alignItems: "center", gap: 2 },
  title: { fontSize: 18 },
  subtitle: { fontSize: 11 },
  headerActions: { flexDirection: "row-reverse" },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14 },
  hero: { minHeight: 116, borderRadius: 16, borderWidth: 1, overflow: "hidden", justifyContent: "center" },
  heroOverlay: { alignItems: "center", gap: 5, padding: 18 },
  heroTitle: { fontSize: 20 },
  heroCaption: { fontSize: 12 },
  section: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  sectionTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: 2 },
  sectionTitle: { fontSize: 16 },
  priceRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  nameWrap: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  productName: { fontSize: 14, textAlign: "right" },
  newBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  newBadgeText: { fontSize: 9 },
  priceWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  price: { fontSize: 15, minWidth: 80, textAlign: "left" },
  empty: { textAlign: "center", paddingVertical: 40, fontSize: 15 },
});