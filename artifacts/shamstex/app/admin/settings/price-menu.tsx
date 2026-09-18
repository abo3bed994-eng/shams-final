import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { persistImageUri } from "@/utils/persistImage";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, Field, useSettingsDraft, styles } from "./_shared";
import GoldButton from "@/components/GoldButton";
import GoldHeader from "@/components/GoldHeader";
import { useApp, type Product, type PriceMenuSettings } from "@/context/AppContext";

const EMPTY_MENU: PriceMenuSettings = {
  backgroundOpacity: 0.12,
  categories: [],
  productOrder: [],
  productCategories: {},
};

function getMenu(draft: { priceMenu?: PriceMenuSettings }): PriceMenuSettings {
  return {
    ...EMPTY_MENU,
    ...(draft.priceMenu ?? {}),
    backgroundOpacity: draft.priceMenu?.backgroundOpacity ?? EMPTY_MENU.backgroundOpacity,
    categories: draft.priceMenu?.categories ?? EMPTY_MENU.categories,
    productOrder: draft.priceMenu?.productOrder ?? EMPTY_MENU.productOrder,
    productCategories: draft.priceMenu?.productCategories ?? EMPTY_MENU.productCategories,
  };
}

export default function PriceMenuSettingsScreen() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const [newCategory, setNewCategory] = useState("");
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [openCategoryProductId, setOpenCategoryProductId] = useState<string | null>(null);
  const { products } = useApp();
  const menu = getMenu(draft);

  const orderedProducts = useMemo(() => {
    const rank = new Map(menu.productOrder.map((id, index) => [id, index]));
    return [...products].sort((a, b) => {
      const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.name.localeCompare(b.name, "ar");
    });
  }, [menu.productOrder, products]);

  const groupedProductSections = useMemo(() => {
    const categoryRank = new Map(menu.categories.map((name, index) => [name, index]));
    const grouped = new Map<string, Product[]>();
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

  const groupedProducts = useMemo(
    () => groupedProductSections.flatMap(([, sectionProducts]) => sectionProducts),
    [groupedProductSections],
  );

  const productGroupMeta = useMemo(() => {
    const meta = new Map<string, { category: string; count: number; isFirst: boolean; isLast: boolean }>();
    groupedProductSections.forEach(([category, sectionProducts]) => {
      sectionProducts.forEach((product, index) => {
        meta.set(product.id, {
          category,
          count: sectionProducts.length,
          isFirst: index === 0,
          isLast: index === sectionProducts.length - 1,
        });
      });
    });
    return meta;
  }, [groupedProductSections]);

  const updateMenu = (patch: Partial<PriceMenuSettings>) => {
    setDraft((current) => ({
      ...current,
      priceMenu: { ...getMenu(current), ...patch },
    }));
  };

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value || menu.categories.includes(value)) return;
    updateMenu({ categories: [...menu.categories, value] });
    setNewCategory("");
  };

  const removeCategory = (category: string) => {
    const nextCategories = menu.categories.filter((item) => item !== category);
    const nextAssignments = { ...menu.productCategories };
    Object.keys(nextAssignments).forEach((id) => {
      if (nextAssignments[id] === category) delete nextAssignments[id];
    });
    updateMenu({ categories: nextCategories, productCategories: nextAssignments });
  };

  const moveCategory = (index: number, direction: -1 | 1) => {
    const next = [...menu.categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateMenu({ categories: next });
  };

  const pickBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول إلى المعرض");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setBackgroundLoading(true);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      updateMenu({ backgroundImageUri: uri });
    } finally {
      setBackgroundLoading(false);
    }
  };

  const opacityPercent = Math.round(Math.max(0, Math.min(1, menu.backgroundOpacity ?? 0.12)) * 100);

  const renderProduct = useCallback(
    ({ item: product, drag, isActive }: RenderItemParams<Product>) => (
      <ScaleDecorator>
        <View
          style={[
            styles.entryBox,
            (() => {
              const group = productGroupMeta.get(product.id);
              const isFirst = group?.isFirst ?? true;
              const isLast = group?.isLast ?? true;
              return {
                borderColor: isActive ? colors.gold : colors.border,
                backgroundColor: isActive ? colors.gold + "11" : colors.surface,
                borderTopLeftRadius: isFirst ? 10 : 0,
                borderTopRightRadius: isFirst ? 10 : 0,
                borderBottomLeftRadius: isLast ? 10 : 0,
                borderBottomRightRadius: isLast ? 10 : 0,
                borderTopWidth: isFirst ? 1 : 0,
                borderBottomWidth: isLast ? 1 : 0,
                marginBottom: isLast ? 10 : 0,
                shadowColor: isActive ? colors.gold : "transparent",
                shadowOpacity: isActive ? 0.25 : 0,
                shadowRadius: isActive ? 8 : 0,
                elevation: isActive ? 6 : 0,
              };
            })(),
          ]}
        >
          {productGroupMeta.get(product.id)?.isFirst && (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.gold + "44" }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 7 }}>
                <Icon name="layers" size={16} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {productGroupMeta.get(product.id)?.category}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                {productGroupMeta.get(product.id)?.count} خامة
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            <Pressable
              onLongPress={drag}
              delayLongPress={150}
              accessibilityLabel={`سحب ${product.name} لإعادة الترتيب`}
              style={[
                {
                  width: 36,
                  height: 48,
                  borderRadius: 8,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                },
                {
                  backgroundColor: isActive ? colors.gold + "22" : colors.surface,
                  borderColor: isActive ? colors.gold + "55" : colors.border,
                },
              ]}
            >
              <Icon name="grip-vertical" size={20} color={isActive ? colors.gold : colors.mutedForeground} />
            </Pressable>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "right" }}>
                {product.name}
              </Text>
              <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "right" }}>
                {product.wholesalePrice} ج.م
              </Text>
            </View>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
              قسم القائمة
            </Text>
            <Pressable
              onPress={() => setOpenCategoryProductId((current) => current === product.id ? null : product.id)}
              style={{
                minHeight: 42,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: openCategoryProductId === product.id ? colors.gold : colors.border,
                borderRadius: 8,
                backgroundColor: colors.input,
              }}
            >
              <Text style={{ color: menu.productCategories[product.id] ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                {menu.productCategories[product.id] || product.category || "بدون قسم"}
              </Text>
              <Icon name={openCategoryProductId === product.id ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </Pressable>
            {openCategoryProductId === product.id && (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surface }}>
                <Pressable
                  onPress={() => {
                    const nextAssignments = { ...menu.productCategories };
                    delete nextAssignments[product.id];
                    updateMenu({ productCategories: nextAssignments });
                    setOpenCategoryProductId(null);
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right" }}>
                    القسم الأصلي: {product.category || "بدون قسم"}
                  </Text>
                </Pressable>
                {menu.categories.map((category) => {
                  const selected = menu.productCategories[product.id] === category;
                  return (
                    <Pressable
                      key={category}
                      onPress={() => {
                        updateMenu({ productCategories: { ...menu.productCategories, [product.id]: category } });
                        setOpenCategoryProductId(null);
                      }}
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: selected ? colors.gold + "18" : colors.surface,
                      }}
                    >
                      <Text style={{ color: selected ? colors.gold : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13, textAlign: "right" }}>
                        {category}
                      </Text>
                      {selected && <Icon name="check" size={15} color={colors.gold} />}
                    </Pressable>
                  );
                })}
                {menu.categories.length === 0 && (
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", padding: 12 }}>
                    أضف قسمًا أولًا من قسم «أقسام القائمة»
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScaleDecorator>
    ),
    [colors, menu.categories, menu.productCategories, openCategoryProductId, productGroupMeta]
  );

  const listHeader = (
    <>
      <Card title="خلفية قائمة الأسعار">
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
          اختر صورة خلفية للقائمة وحدد درجة ظهورها. الخلفية لا تغيّر الأسعار أو بيانات المنتجات.
        </Text>
        {menu.backgroundImageUri && (
          <View style={{ height: 130, borderRadius: 10, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: colors.border }}>
            <Image source={{ uri: menu.backgroundImageUri }} style={{ width: "100%", height: "100%", opacity: menu.backgroundOpacity ?? 0.12 }} resizeMode="cover" />
            <Pressable
              onPress={() => updateMenu({ backgroundImageUri: undefined })}
              style={[styles.clearBannerBtn, { backgroundColor: colors.destructive }]}
            >
              <Icon name="x" size={14} color="#FFF" />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: "row-reverse", gap: 10 }}>
          <Pressable
            onPress={pickBackground}
            disabled={backgroundLoading}
            style={[styles.bannerBtn, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, opacity: backgroundLoading ? 0.6 : 1 }]}
          >
            {backgroundLoading ? <ActivityIndicator size="small" color={colors.foreground} /> : <Icon name="image" size={18} color={colors.foreground} />}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {backgroundLoading ? "جاري الرفع..." : menu.backgroundImageUri ? "تغيير الصورة" : "إضافة صورة"}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field
              label={`شفافية الخلفية (%) — ${opacityPercent}%`}
              value={String(opacityPercent)}
              keyboardType="number-pad"
              onChange={(value) => {
                const numeric = Number(value.replace(/[^\d]/g, ""));
                if (Number.isFinite(numeric)) updateMenu({ backgroundOpacity: Math.max(0, Math.min(100, numeric)) / 100 });
              }}
            />
          </View>
        </View>
      </Card>

      <Card title="أقسام القائمة">
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
          أضف الأقسام ورتبها. يمكنك بعد ذلك كتابة اسم القسم بجانب كل خامة.
        </Text>
        {menu.categories.map((category, index) => (
          <View key={category} style={[styles.catListRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.catRowArrows}>
              <Pressable onPress={() => moveCategory(index, -1)} style={styles.arrowBtn}>
                <Icon name="chevron-up" size={16} color={index === 0 ? colors.border : colors.foreground} />
              </Pressable>
              <Pressable onPress={() => moveCategory(index, 1)} style={styles.arrowBtn}>
                <Icon name="chevron-down" size={16} color={index === menu.categories.length - 1 ? colors.border : colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.catListName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{category}</Text>
            <Pressable onPress={() => removeCategory(category)} style={styles.deleteCatBtn}>
              <Icon name="trash-2" size={15} color={colors.destructive} />
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <Pressable onPress={addCategory} style={[styles.arrowBtn, { backgroundColor: colors.gold, borderRadius: 8 }]}>
            <Icon name="plus" size={18} color={colors.background} />
          </Pressable>
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="اسم قسم جديد"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            style={[styles.addInput, { flex: 1, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
          />
        </View>
      </Card>

      <Text style={[styles.cardTitle, { color: colors.gold, fontFamily: "Inter_700Bold", textAlign: "right", marginTop: 2 }]}>
        ترتيب الخامات وتقسيمها
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginBottom: 10 }}>
        الخامات مجمعة داخل بطاقة حسب قسم قائمة الأسعار. اضغط مطولاً على مقبض السحب لإعادة ترتيب الخامات داخل البطاقة.
      </Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="قائمة أسعار التجار" onBack={() => router.back()} />
      <DraggableFlatList
        data={groupedProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        ListHeaderComponent={listHeader}
        onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        onDragEnd={({ data }) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          updateMenu({ productOrder: data.map((product) => product.id) });
        }}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 180 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad, position: "absolute", bottom: 0, left: 0, right: 0 }]}>
        <GoldButton label="حفظ الإعدادات" onPress={save} loading={saving} style={{ flex: 1 }} size="lg" />
      </View>
    </View>
  );
}