import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import GoldHeader from "@/components/GoldHeader";
import { useColors } from "@/hooks/useColors";
import { useAdminGuard } from "@/hooks/useAdminGuard";

const ITEMS: { key: string; title: string; icon: string; route: string }[] = [
  { key: "about", title: "النبذة التعريفية", icon: "info", route: "/admin/settings/about" },
  { key: "stats", title: "الإحصائيات", icon: "bar-chart-2", route: "/admin/settings/stats" },
  { key: "contacts", title: "أرقام التواصل", icon: "phone", route: "/admin/settings/contacts" },
  { key: "socials", title: "روابط التواصل الاجتماعي", icon: "globe", route: "/admin/settings/socials" },
  { key: "ads", title: "المحتوى الإعلاني", icon: "image", route: "/admin/settings/ads" },
  { key: "categories", title: "فئات المنتجات والفئات الفرعية", icon: "grid", route: "/admin/settings/categories" },
  { key: "yarns", title: "أنواع الفتلة", icon: "layers", route: "/admin/settings/yarns" },
  { key: "companions", title: "الخامات المرافقة", icon: "link", route: "/admin/settings/companion-materials" },
  { key: "hours", title: "مواعيد العمل", icon: "clock", route: "/admin/settings/hours" },
  { key: "branches", title: "الفروع ووسائل الدفع لكل فرع", icon: "map-pin", route: "/admin/settings/branches" },
  { key: "shipping", title: "شركات الشحن", icon: "truck", route: "/admin/settings/shipping" },
  { key: "payment", title: "إعدادات الدفع", icon: "wallet", route: "/admin/settings/payment" },
  { key: "update", title: "التحديث الإجباري", icon: "download", route: "/admin/settings/update" },
];

export default function SettingsHub() {
  useAdminGuard("manage_settings");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 24 : Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GoldHeader title="إعدادات التطبيق" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 10 }}>
        {ITEMS.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => router.push(it.route as any)}
            style={({ pressed }) => [
              {
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.gold + "22", alignItems: "center", justifyContent: "center" }}>
              <Icon name={it.icon} size={18} color={colors.gold} />
            </View>
            <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>{it.title}</Text>
            <Icon name="chevron-left" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
