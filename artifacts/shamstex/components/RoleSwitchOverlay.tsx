import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { useApp } from "@/context/AppContext";

export default function RoleSwitchOverlay() {
  const { roleSwitching } = useApp();
  const visible = !!roleSwitching;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.title}>{roleSwitching ?? ""}</Text>
          <Text style={styles.sub}>يتم إعادة تحميل التطبيق…</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#0F0F0F",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4AF37",
    minWidth: 260,
  },
  title: {
    color: "#D4AF37",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 18,
    textAlign: "center",
  },
  sub: {
    color: "#999",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
});
