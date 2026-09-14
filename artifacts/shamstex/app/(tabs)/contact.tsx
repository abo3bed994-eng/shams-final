import React from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow } from "@/constants/shadows";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/lib/i18n";

export default function ContactScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, language } = useApp();
  const { t } = useTranslation();
  const CONTACTS = settings.contacts;
  const SOCIAL = settings.social;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number.replace(/\s+/g, "")}`);
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
          {t("contactUs")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={[styles.brandName, { color: colors.gold, fontFamily: language === "ar" ? "Amiri_700Bold" : "Inter_700Bold" }]}>
            {t("tagline")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("contactUs")}
          </Text>
          {CONTACTS.map((contact) => (
            <Pressable
              key={contact.id}
              onPress={() => callNumber(contact.number)}
              style={({ pressed }) => [
                styles.contactCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                },
                cardShadow(colors.isDark, "soft"),
              ]}
            >
              <Icon name="phone-call" size={18} color={colors.gold} />
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {contact.label}
                </Text>
                <Text style={[styles.contactNumber, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {contact.number}
                </Text>
              </View>
              <View style={[styles.contactIcon, { backgroundColor: colors.gold + "22" }]}>
                <Icon name={contact.icon as any} size={20} color={colors.gold} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("followUs")}
          </Text>
          <View style={styles.socialRow}>
            {SOCIAL.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => Linking.openURL(s.url)}
                style={({ pressed }) => [
                  styles.socialBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                  cardShadow(colors.isDark, "soft"),
                ]}
              >
                <Icon name={s.icon as any} size={22} color={colors.gold} />
                <Text
                  style={[styles.socialLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.aboutCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.gold + "33",
              borderRadius: colors.radius,
            },
            cardShadow(colors.isDark, "soft"),
          ]}
        >
          <Text style={[styles.aboutTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
            {settings.aboutTitle}
          </Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {settings.aboutText}
          </Text>
          <View style={styles.aboutStats}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                {settings.stats?.clients ?? "+500"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {settings.statLabels?.clients ?? t("clients")}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                {settings.stats?.products ?? "+50"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {settings.statLabels?.products ?? t("productsCount")}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                {settings.stats?.years ?? "15+"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {settings.statLabels?.years ?? t("yearsExperience")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22 },
  content: {
    padding: 16,
    gap: 24,
  },
  logoSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  logoImg: {
    width: 180,
    height: 180,
  },
  brandName: {
    fontSize: 24,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 1,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: "right",
  },
  contactCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
    alignItems: "flex-end",
  },
  contactLabel: {
    fontSize: 13,
  },
  contactNumber: {
    fontSize: 16,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  socialRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
  },
  socialLabel: {
    fontSize: 12,
  },
  aboutCard: {
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  aboutTitle: {
    fontSize: 18,
    textAlign: "right",
  },
  aboutText: {
    fontSize: 13,
    textAlign: "right",
    lineHeight: 22,
  },
  aboutStats: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
});
