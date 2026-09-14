import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { persistImageUri } from "@/utils/persistImage";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Card, Field, SettingsScreen, useSettingsDraft, styles } from "./_shared";

const MAX_BANNER_IMAGES = 7;

export default function AdsSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const [imageLoading, setImageLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);

  // Migrate the legacy single bannerImageUri into the images array for display.
  const bannerImages: string[] = (draft.bannerImageUris && draft.bannerImageUris.length > 0)
    ? draft.bannerImageUris
    : (draft.bannerImageUri ? [draft.bannerImageUri] : []);

  const pickBannerImage = async () => {
    if (bannerImages.length >= MAX_BANNER_IMAGES) { Alert.alert("الحد الأقصى", `يمكن إضافة ${MAX_BANNER_IMAGES} صور كحد أقصى`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول إلى المعرض"); return; }
    const remaining = MAX_BANNER_IMAGES - bannerImages.length;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsMultipleSelection: true, selectionLimit: remaining });
    if (!result.canceled && result.assets.length > 0) {
      setImageLoading(true);
      try {
        const uris = await Promise.all(result.assets.slice(0, remaining).map((a) => persistImageUri(a.uri)));
        setDraft((d) => {
          const existing = (d.bannerImageUris && d.bannerImageUris.length > 0) ? d.bannerImageUris : (d.bannerImageUri ? [d.bannerImageUri] : []);
          return { ...d, bannerImageUris: [...existing, ...uris].slice(0, MAX_BANNER_IMAGES), bannerImageUri: undefined };
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } finally {
        setImageLoading(false);
      }
    }
  };
  const removeImage = (idx: number) => setDraft((d) => {
    const existing = (d.bannerImageUris && d.bannerImageUris.length > 0) ? d.bannerImageUris : (d.bannerImageUri ? [d.bannerImageUri] : []);
    return { ...d, bannerImageUris: existing.filter((_, i) => i !== idx), bannerImageUri: undefined };
  });

  const pickBannerVideo = async () => {
    const current = draft.bannerVideoUris ?? [];
    if (current.length >= 3) { Alert.alert("الحد الأقصى", "يمكن إضافة 3 فيديوهات كحد أقصى"); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول إلى المعرض"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setVideoLoading(true);
      try {
        const uri = await persistImageUri(result.assets[0].uri);
        setDraft((d) => ({ ...d, bannerVideoUris: [...(d.bannerVideoUris ?? []), uri] }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } finally {
        setVideoLoading(false);
      }
    }
  };
  const removeVideo = (idx: number) => setDraft((d) => ({ ...d, bannerVideoUris: (d.bannerVideoUris ?? []).filter((_, i) => i !== idx) }));

  const busy = imageLoading || videoLoading;

  return (
    <SettingsScreen title="المحتوى الإعلاني" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="المحتوى الإعلاني">
        {bannerImages.length > 0 && (
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
            {bannerImages.map((uri, idx) => (
              <View key={`${uri}_${idx}`} style={[styles.bannerPreview, { backgroundColor: colors.surface, borderColor: colors.border, width: "48%", marginBottom: 0 }]}>
                <Image source={{ uri }} style={styles.bannerPreviewImg} resizeMode="cover" />
                <Pressable onPress={() => removeImage(idx)} style={[styles.clearBannerBtn, { backgroundColor: colors.destructive }]}>
                  <Icon name="x" size={14} color="#FFF" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {(draft.bannerVideoUris ?? []).length > 0 && (
          <View style={{ gap: 8 }}>
            {(draft.bannerVideoUris ?? []).map((uri, idx) => (
              <View key={uri} style={[styles.videoBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
                <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Icon name="film" size={20} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 12, flex: 1, textAlign: "right" }} numberOfLines={1}>فيديو {idx + 1}</Text>
                </View>
                <Pressable onPress={() => removeVideo(idx)} style={[styles.clearBannerBtn, { backgroundColor: colors.destructive, position: "relative", top: 0, right: 0 }]}>
                  <Icon name="x" size={14} color="#FFF" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.bannerBtns}>
          <Pressable
            onPress={pickBannerVideo}
            disabled={busy || (draft.bannerVideoUris ?? []).length >= 3}
            style={({ pressed }) => [styles.bannerBtn, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44", opacity: (pressed || busy || (draft.bannerVideoUris ?? []).length >= 3) ? 0.5 : 1 }]}
          >
            {videoLoading ? <ActivityIndicator size="small" color={colors.gold} /> : <Icon name="film" size={18} color={colors.gold} />}
            <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {videoLoading ? "جاري الرفع..." : (draft.bannerVideoUris ?? []).length >= 3 ? "اكتملت الفيديوهات" : `رفع فيديو (${(draft.bannerVideoUris ?? []).length}/3)`}
            </Text>
          </Pressable>
          <Pressable
            onPress={pickBannerImage}
            disabled={busy || bannerImages.length >= MAX_BANNER_IMAGES}
            style={({ pressed }) => [styles.bannerBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: (pressed || busy || bannerImages.length >= MAX_BANNER_IMAGES) ? 0.5 : 1 }]}
          >
            {imageLoading ? <ActivityIndicator size="small" color={colors.foreground} /> : <Icon name="image" size={18} color={colors.foreground} />}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {imageLoading ? "جاري الرفع..." : bannerImages.length >= MAX_BANNER_IMAGES ? "اكتملت الصور" : `رفع صورة (${bannerImages.length}/${MAX_BANNER_IMAGES})`}
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right", fontFamily: "Inter_400Regular" }}>
          يمكن رفع حتى 3 فيديوهات وحتى {MAX_BANNER_IMAGES} صور في البانر الرئيسي. تظهر الصور كشرائح متتابعة عندما لا يوجد فيديو.
        </Text>
      </Card>
      <Card title="جملة ترحيبية">
        <Field
          label="الجملة الظاهرة تحت اسم العميل"
          value={draft.bannerCaption ?? ""}
          onChange={(text) => setDraft((d) => ({ ...d, bannerCaption: text }))}
          placeholder="مثال: تعانق الجودة كل خيط"
        />
        <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right", fontFamily: "Inter_400Regular" }}>
          تظهر هذه الجملة في الصفحة الرئيسية أسفل اسم العميل مباشرة. اتركها فارغة لإخفائها.
        </Text>
      </Card>
    </SettingsScreen>
  );
}
