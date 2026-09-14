import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, ReturnRequest } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";

const RETURN_STEPS = [
  { key: "pending", label: "طلب استرجاع", icon: "rotate-ccw" },
  { key: "returned", label: "تم الاسترجاع", icon: "package" },
  { key: "settled", label: "تمت المخالصة", icon: "check-circle" },
];

function ReturnCard({ ret, isStaff, colors, onUpdateStatus }: {
  ret: ReturnRequest;
  isStaff: boolean;
  colors: any;
  onUpdateStatus: (id: string, status: "returned" | "settled") => void;
}) {
  const returnStep = RETURN_STEPS.findIndex((s) => s.key === ret.status);

  return (
    <Pressable
      onPress={() => router.push(`/order/${ret.orderId}`)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: "#C0392B33", borderRadius: colors.radius }]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, flex: 1 }}>
          <View style={[styles.iconCircle, { backgroundColor: "#C0392B22" }]}>
            <Icon name="rotate-ccw" size={18} color="#C0392B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
              طلب استرجاع
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
              طلب #{ret.orderId.slice(0, 12)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: ret.status === "settled" ? "#27AE6022" : ret.status === "returned" ? "#F39C1222" : "#C0392B22",
        }]}>
          <Text style={{
            color: ret.status === "settled" ? "#27AE60" : ret.status === "returned" ? "#F39C12" : "#C0392B",
            fontFamily: "Inter_600SemiBold",
            fontSize: 11,
          }}>
            {ret.status === "settled" ? "تمت المخالصة" : ret.status === "returned" ? "تم الاسترجاع" : "قيد المراجعة"}
          </Text>
        </View>
      </View>

      {isStaff && (
        <View style={styles.customerInfo}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
            العميل: {ret.userName} ({ret.userPhone})
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", paddingHorizontal: 4, marginTop: 8 }}>
        {RETURN_STEPS.map((step, index) => {
          const isCompleted = index <= returnStep;
          const stepColor = isCompleted ? "#C0392B" : colors.border;
          return (
            <React.Fragment key={step.key}>
              <View style={{ alignItems: "center", gap: 4, flex: 1 }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                  backgroundColor: isCompleted ? stepColor : colors.surface,
                  borderColor: stepColor,
                  alignItems: "center", justifyContent: "center",
                }}>
                  {isCompleted && <Icon name="check" size={9} color="#fff" />}
                </View>
                <Text style={{
                  fontSize: 9, textAlign: "center", lineHeight: 13,
                  color: isCompleted ? "#C0392B" : colors.mutedForeground,
                  fontFamily: isCompleted ? "Inter_600SemiBold" : "Inter_400Regular",
                }} numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
              {index < RETURN_STEPS.length - 1 && (
                <View style={{ height: 2, flex: 1, marginTop: 10, marginHorizontal: -2, backgroundColor: index < returnStep ? "#C0392B" : colors.border }} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", marginTop: 8 }}>
        السبب: {ret.reason}
      </Text>

      {ret.items && ret.items.length > 0 && (
        <View style={{ marginTop: 6, gap: 3 }}>
          {ret.items.slice(0, 3).map((item, idx) => (
            <View key={idx} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.colorHex, borderWidth: 1, borderColor: colors.border }} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, flex: 1, textAlign: "right" }}>
                {item.productName} — {item.colorName}
              </Text>
            </View>
          ))}
          {ret.items.length > 3 && (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "right" }}>
              +{ret.items.length - 3} أصناف أخرى
            </Text>
          )}
        </View>
      )}

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "right", marginTop: 6 }}>
        {new Date(ret.createdAt).toLocaleDateString("ar-EG")}
      </Text>

      {isStaff && ret.status !== "settled" && (
        <View style={{ marginTop: 10 }}>
          {ret.status === "pending" && (
            <GoldButton
              label="تأكيد الاسترجاع"
              size="sm"
              onPress={() => {
                Alert.alert("تأكيد", "هل تم استرجاع البضاعة؟", [
                  { text: "إلغاء", style: "cancel" },
                  { text: "تأكيد", onPress: () => onUpdateStatus(ret.id, "returned") },
                ]);
              }}
              style={{ width: "100%" }}
            />
          )}
          {ret.status === "returned" && (
            <GoldButton
              label="تأكيد المخالصة"
              size="sm"
              onPress={() => {
                Alert.alert("تأكيد", "هل تمت المخالصة المالية؟", [
                  { text: "إلغاء", style: "cancel" },
                  { text: "تأكيد", onPress: () => onUpdateStatus(ret.id, "settled") },
                ]);
              }}
              style={{ width: "100%" }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function ReturnsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, returnRequests, updateReturnStatus } = useApp();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";

  const myReturns = isStaff
    ? returnRequests
    : returnRequests.filter((r) => r.userId === user?.id);

  const sorted = [...myReturns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title={isStaff ? "إدارة طلبات الاسترجاع" : "طلبات الاسترجاع"} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="rotate-ccw" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              لا توجد طلبات استرجاع
            </Text>
          </View>
        ) : (
          sorted.map((ret) => (
            <ReturnCard
              key={ret.id}
              ret={ret}
              isStaff={isStaff}
              colors={colors}
              onUpdateStatus={updateReturnStatus}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16 },
  card: {
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  customerInfo: {
    marginTop: 4,
  },
});
