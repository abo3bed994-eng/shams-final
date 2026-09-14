import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface GoldHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  subtitle?: string;
}

export default function GoldHeader({ title, onBack, rightElement, subtitle }: GoldHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: topPad + 8,
        },
      ]}
    >
      <View style={styles.inner}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="arrow-right" size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightContainer}>
          {rightElement || <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  inner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 40,
  },
  rightContainer: {
    minWidth: 40,
    alignItems: "flex-end",
  },
});
