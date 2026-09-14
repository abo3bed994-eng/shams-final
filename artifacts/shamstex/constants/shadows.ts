import { ViewStyle } from "react-native";

export function cardShadow(
  isDark: boolean,
  intensity: "soft" | "strong" = "strong",
): ViewStyle {
  const strong = intensity === "strong";
  return {
    shadowColor: isDark ? "#000000" : "#2A2008",
    shadowOffset: { width: 0, height: strong ? 8 : 5 },
    shadowOpacity: isDark ? (strong ? 0.5 : 0.38) : (strong ? 0.22 : 0.14),
    shadowRadius: strong ? 16 : 10,
    elevation: strong ? 8 : 4,
  };
}
