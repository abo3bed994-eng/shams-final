import { useEffect, useRef } from "react";
import { Animated } from "react-native";

// Returns an animated scale value that pulses (a quick "flash") whenever the
// cart count increases. Use it on cart icons so adding an item visibly draws
// the user's eye toward the cart to complete the order.
export function useCartPulse(count: number) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      scale.stopAnimation();
      scale.setValue(1);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
        Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
      ]).start();
    }
    prev.current = count;
  }, [count]);

  return scale;
}
