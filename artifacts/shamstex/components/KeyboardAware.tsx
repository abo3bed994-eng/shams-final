import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Keyboard handling is broken on Android under Expo SDK 54 edge-to-edge:
 * the OS no longer honours `adjustResize`, so inputs near the bottom get
 * covered by the keyboard. The robust fix is react-native-keyboard-controller,
 * which auto-scrolls the focused field above the keyboard.
 *
 * That library ships a native module that is NOT bundled in Expo Go (and does
 * not exist on web), so it would crash there. We therefore only load it in a
 * real build (dev build / standalone APK) via a lazy require, and fall back to
 * the built-in KeyboardAvoidingView elsewhere. Never convert this to a
 * top-level `import` — that would evaluate the native module on launch and
 * crash Expo Go.
 */
const KC_ENABLED =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let KC: any = null;
if (KC_ENABLED) {
  try {
    KC = require("react-native-keyboard-controller");
  } catch {
    KC = null;
  }
}

type KeyboardAwareScrollProps = React.ComponentProps<typeof ScrollView> & {
  bottomOffset?: number;
  /**
   * Android `behavior` for the built-in KeyboardAvoidingView fallback used in
   * Expo Go / web (where keyboard-controller is not loaded). Defaults to
   * undefined to match most screens; pass "height" to preserve the prior
   * behavior of form screens that relied on it.
   */
  androidBehavior?: "height" | "position" | "padding";
};

export const KeyboardAwareScroll = React.forwardRef<ScrollView, KeyboardAwareScrollProps>(
  function KeyboardAwareScroll(
    { children, bottomOffset = 24, androidBehavior, style, ...props },
    ref
  ) {
    if (KC?.KeyboardAwareScrollView) {
      const KAScroll = KC.KeyboardAwareScrollView;
      return (
        <KAScroll
          ref={ref as any}
          bottomOffset={bottomOffset}
          style={[{ flex: 1 }, style]}
          {...props}
        >
          {children}
        </KAScroll>
      );
    }
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : androidBehavior}
      >
        <ScrollView ref={ref} style={style} {...props}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
);

export function KeyboardProviderSafe({ children }: { children: React.ReactNode }) {
  if (KC?.KeyboardProvider) {
    const Provider = KC.KeyboardProvider;
    return <Provider>{children}</Provider>;
  }
  return <>{children}</>;
}
