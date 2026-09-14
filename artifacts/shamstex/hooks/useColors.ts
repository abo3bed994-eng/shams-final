import { useColorScheme } from "react-native";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

export function useColors() {
  const { theme } = useApp();
  const systemScheme = useColorScheme();
  const resolved: "dark" | "light" =
    theme === "system" ? (systemScheme === "light" ? "light" : "dark") : theme;
  const palette = resolved === "light" ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius, isDark: resolved === "dark" };
}
