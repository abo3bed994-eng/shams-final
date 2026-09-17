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
            {
              borderColor: isActive ? colors.gold : colors.border,
              backgroundColor: isActive ? colors.gold + "11" : colors.surface,
              marginBottom: 10,
              shadowColor: isActive ? colors.gold : "transparent",
              shadowOpacity: isActive ? 0.25 : 0,
              shadowRadius: isActive ? 8 : 0,
              elevation: isActive ? 6 : 0,
            },
          ]}
        >
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
          <Field
            label="قسم القائمة"
            value={menu.productCategories[product.id] ?? ""}
            placeholder={product.category || "مثال: المجموعة الأولى"}
            onChange={(value) => updateMenu({ productCategories: { ...menu.productCategories, [product.id]: value } })}
          />
        </View>
      </ScaleDecorator>
    ),
    [colors, menu.productCategories]
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
        اضغط مطولاً على مقبض السحب ثم ضع الخامة في أي مكان. اسم القسم اختياري؛ الخامة غير المصنفة تظهر في قسمها الأصلي.
      </Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="قائمة أسعار التجار" onBack={() => router.back()} />
      <DraggableFlatList
        data={orderedProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        ListHeaderComponent={listHeader}
        onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        onDragEnd={({ data }) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          updateMenu({ productOrder: data.map((product) => product.id) });
        }}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad, position: "absolute", bottom: 0, left: 0, right: 0 }]}>
        <GoldButton label="حفظ الإعدادات" onPress={save} loading={saving} style={{ flex: 1 }} size="lg" />
      </View>
    </View>
  );
}