import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import LoadingScreen from "./LoadingScreen";

export default function SplashScreenComponent({ onFinish }: { onFinish: () => void }) {
  const { language } = useApp();
  const finished = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        onFinish();
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LoadingScreen
      showTagline
      taglineText={
        language === "ar" ? "تعانق الجودة كل خيط" : "Quality embraces every thread"
      }
      taglineFontFamily={language === "ar" ? "Amiri_700Bold" : "Inter_700Bold"}
      logoSize={240}
    />
  );
}
