import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GoldButtonProps {
  onPress: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export default function GoldButton({
  onPress,
  label,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  size = "md",
}: GoldButtonProps) {
  const colors = useColors();

  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";

  const height = size === "sm" ? 40 : size === "lg" ? 58 : 50;
  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          borderRadius: colors.radius,
          opacity: pressed || disabled ? 0.7 : 1,
          backgroundColor: isPrimary
            ? colors.gold
            : isOutline
            ? "transparent"
            : "transparent",
          borderWidth: isOutline ? 1.5 : 0,
          borderColor: isOutline ? colors.gold : "transparent",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.background : colors.gold} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            {
              fontSize,
              color: isPrimary ? colors.background : colors.gold,
              fontFamily: "Inter_600SemiBold",
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    letterSpacing: 0.5,
  },
});
