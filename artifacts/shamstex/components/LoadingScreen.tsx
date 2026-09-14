import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  message?: string;
  showTagline?: boolean;
  taglineText?: string;
  taglineFontFamily?: string;
  logoSize?: number;
  fullscreen?: boolean;
};

function BouncingDot({
  delay,
  color,
  size = 10,
}: {
  delay: number;
  color: string;
  size?: number;
}) {
  const translate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translate, {
            toValue: -12,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translate, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(420),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY: translate }],
      }}
    />
  );
}

export default function LoadingScreen({
  message,
  showTagline,
  taglineText,
  taglineFontFamily,
  logoSize = 200,
  fullscreen = true,
}: Props) {
  const colors = useColors();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View
      style={[
        fullscreen ? styles.containerFull : styles.containerInline,
        { backgroundColor: colors.background },
      ]}
    >
      <Animated.View style={{ opacity: fadeIn, alignItems: "center" }}>
        <Image
          source={require("../assets/images/loading-logo.png")}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />

        <View style={styles.dotsRow}>
          <BouncingDot delay={0} color={colors.gold} />
          <BouncingDot delay={160} color={colors.gold} />
          <BouncingDot delay={320} color={colors.gold} />
        </View>

        {showTagline && taglineText ? (
          <View style={styles.tagBlock}>
            <Text
              style={[
                styles.tagline,
                {
                  color: colors.gold,
                  fontFamily: taglineFontFamily ?? "Inter_700Bold",
                },
              ]}
            >
              {taglineText}
            </Text>
            <View style={[styles.tagLine, { backgroundColor: colors.gold }]} />
          </View>
        ) : null}

        {message ? (
          <Text style={[styles.message, { color: colors.text, opacity: 0.7 }]}>
            {message}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerFull: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  containerInline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 24,
    height: 24,
  },
  tagBlock: {
    alignItems: "center",
    marginTop: 24,
    gap: 10,
  },
  tagline: {
    fontSize: 22,
    letterSpacing: 1.5,
    textAlign: "center",
    lineHeight: 34,
  },
  tagLine: {
    height: 1.5,
    width: 110,
    opacity: 0.7,
  },
  message: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
