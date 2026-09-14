import React, { useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";

const RETURN_STEPS = [
  { key: "pending", label: "قيد المراجعة", icon: "clock" },
  { key: "returned", label: "تم الاسترجاع", icon: "package" },
  { key: "settled", label: "تمت المخالصة", icon: "check-circle" },
];

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { returnRequests, orders, user, updateReturnStatus, cancelReturnRequest, deleteReturnRequest, products } = useApp();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const ret = returnRequests.find((r) => r.id === id);
  const order = ret ? orders.find((o) => o.id === ret.orderId) : null;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const isCustomer = !isStaff;
  const canCancelReturn = isAdmin || (isSupervisor && (user?.permissions ?? []).includes("cancel_returns"));

  if (!ret) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GoldHeader title="تفاصيل الاسترجاع" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={{ color: colors.mutedForeground }}>طلب الاسترجاع غير موجود</Text>
        </View>
      </View>
    );
  }

  const isCancelled = ret.status === "cancelled";
  const retStep = isCancelled ? -1 : RETURN_STEPS.findIndex((s) => s.key === ret.status);
  const stepColor = isCancelled ? "#E74C3C" : "#C0392B";

  const date = new Date(ret.createdAt).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleCustomerDelete = () => {
    Alert.alert(
      "حذف طلب الاسترجاع",
      "هل أنت متأكد من حذف طلب الاسترجاع؟ لن يمكنك التراجع عن هذا.",
      [
        { text: "لا، ابقِه", style: "cancel" },
        {
          text: "نعم، احذفه",
          style: "destructive",
          onPress: () => {
            deleteReturnRequest(ret.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleStaffCancel = () => {
    if (!cancelReason.trim()) {
      Alert.alert("مطلوب", "يرجى كتابة سبب الإلغاء");
      return;
    }
    Alert.alert(
      "إلغاء طلب الاسترجاع",
      `سيتم إلغاء طلب الاسترجاع وإبلاغ العميل.\n\nالسبب: ${cancelReason.trim()}`,
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "تأكيد الإلغاء",
          style: "destructive",
          onPress: () => {
            cancelReturnRequest(ret.id, cancelReason.trim());
            setShowCancelForm(false);
            setCancelReason("");
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title="تفاصيل الاسترجاع"
        subtitle={`طلب #${ret.orderId.slice(0, 12)}`}
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <View style={[styles.statusCard, {
          backgroundColor: isCancelled ? "#E74C3C11" : stepColor + "11",
          borderColor: isCancelled ? "#E74C3C44" : stepColor + "44",
          borderRadius: colors.radius,
        }]}>
          <Icon name={isCancelled ? "x-circle" : "rotate-ccw"} size={28} color={isCancelled ? "#E74C3C" : stepColor} />
          <Text style={[styles.statusLabel, { color: isCancelled ? "#E74C3C" : stepColor, fontFamily: "Inter_700Bold" }]}>
            {isCancelled ? "تم إلغاء الاسترجاع" : RETURN_STEPS[retStep]?.label}
          </Text>
          <Text style={[styles.orderDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {date}
          </Text>
        </View>

        {!isCancelled && (
          <View style={styles.stepsRow}>
            {RETURN_STEPS.map((step, index) => {
              const isCompleted = index <= retStep;
              const dotColor = isCompleted ? stepColor : colors.border;
              return (
                <React.Fragment key={step.key}>
                  <View style={styles.step}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isCompleted ? dotColor : colors.surface,
                          borderColor: dotColor,
                        },
                      ]}
                    >
                      {isCompleted && <Icon name="check" size={10} color="#fff" />}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        {
                          color: isCompleted ? colors.foreground : colors.mutedForeground,
                          fontFamily: isCompleted ? "Inter_600SemiBold" : "Inter_400Regular",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {index < RETURN_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: index < retStep ? stepColor : colors.border },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}

        {isStaff && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              معلومات العميل
            </Text>
            <View style={styles.infoRow}>
              <Icon name="user" size={15} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {ret.userName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="phone" size={15} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {ret.userPhone}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            سبب الاسترجاع
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "right", lineHeight: 22 }}>
            {ret.reason}
          </Text>
        </View>

        {ret.problemImage && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              صورة المشكلة
            </Text>
            <Image
              source={{ uri: ret.problemImage }}
              style={{ width: "100%", height: 220, borderRadius: colors.radius - 4, backgroundColor: colors.surface }}
              resizeMode="cover"
            />
          </View>
        )}

        {isCancelled && ret.cancelReason && (
          <View style={[styles.infoCard, {
            backgroundColor: "#E74C3C11",
            borderColor: "#E74C3C44",
            borderRadius: colors.radius,
          }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Icon name="x-circle" size={16} color="#E74C3C" />
              <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "right" }}>
                سبب إلغاء طلب الاسترجاع
              </Text>
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "right", lineHeight: 22 }}>
              {ret.cancelReason}
            </Text>
            {ret.cancelledByName && (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                بواسطة: {ret.cancelledByName}
                {ret.cancelledAt
                  ? ` — ${new Date(ret.cancelledAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}`
                  : ""}
              </Text>
            )}
          </View>
        )}

        {ret.items && ret.items.length > 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              الأصناف المسترجعة
            </Text>
            {ret.items.map((item, index) => (
              <View
                key={index}
                style={[styles.itemRow, index < ret.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: item.colorHex, borderWidth: 1, borderColor: colors.border }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>
                      {item.productName}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                      {item.colorName} — {item.quantity} ثوب{(() => {
                        const measure = item.orderType === "weight" ? item.weight : (item.actualWeight ?? item.weight);
                        const unitLabel = (item as any).unit === "meter" || products.find(p => p.id === item.productId)?.unit === "meter" ? "متر" : "كغ";
                        return measure ? ` · ${measure} ${unitLabel}` : "";
                      })()}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {(() => {
                    const amount = item.orderType === "weight" ? (item.weight ?? item.quantity) : (item.actualWeight ?? item.weight ?? item.quantity);
                    return item.unitPrice > 0 ? `${(item.unitPrice * amount).toFixed(0)} ج.م` : "";
                  })()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {order && (
          <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            style={({ pressed }) => [styles.viewOrderBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon name="file-text" size={16} color={colors.gold} />
            <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              عرض الطلب الأصلي
            </Text>
            <Icon name="chevron-left" size={16} color={colors.gold} />
          </Pressable>
        )}

        {isStaff && ret.status !== "settled" && ret.status !== "cancelled" && (
          <Pressable
            onPress={() => {
              if (ret.status === "pending") {
                Alert.alert("تأكيد", "هل تم استرجاع البضاعة؟", [
                  { text: "إلغاء", style: "cancel" },
                  { text: "تأكيد", onPress: () => updateReturnStatus(ret.id, "returned") },
                ]);
              } else if (ret.status === "returned") {
                Alert.alert("تأكيد", "هل تمت المخالصة المالية؟", [
                  { text: "إلغاء", style: "cancel" },
                  { text: "تأكيد", onPress: () => updateReturnStatus(ret.id, "settled") },
                ]);
              }
            }}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.gold, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon name={ret.status === "pending" ? "package" : "check-circle"} size={18} color={colors.background} />
            <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 15 }}>
              {ret.status === "pending" ? "تأكيد الاسترجاع" : "تأكيد المخالصة"}
            </Text>
          </Pressable>
        )}

        {isCustomer && ret.status === "pending" && ret.userId === user?.id && (
          <Pressable
            onPress={handleCustomerDelete}
            style={[styles.cancelBtn, { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11", borderRadius: colors.radius }]}
          >
            <Icon name="trash-2" size={16} color="#E74C3C" />
            <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              حذف طلب الاسترجاع
            </Text>
          </Pressable>
        )}

        {canCancelReturn && ret.status !== "settled" && ret.status !== "cancelled" && (
          <>
            {!showCancelForm ? (
              <Pressable
                onPress={() => setShowCancelForm(true)}
                style={[styles.cancelBtn, { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11", borderRadius: colors.radius }]}
              >
                <Icon name="x-circle" size={16} color="#E74C3C" />
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  إلغاء طلب الاسترجاع
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.cancelFormCard, { backgroundColor: colors.card, borderColor: "#E74C3C44", borderRadius: colors.radius }]}>
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "right" }}>
                  إلغاء طلب الاسترجاع
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                  سيتم إبلاغ العميل بالإلغاء مع السبب
                </Text>
                <TextInput
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="سبب الإلغاء..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: colors.radius - 2,
                    padding: 12,
                    minHeight: 80,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    textAlign: "right",
                    textAlignVertical: "top",
                    backgroundColor: colors.surface,
                    marginTop: 4,
                  }}
                />
                <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={handleStaffCancel}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: "#E74C3C",
                      paddingVertical: 12,
                      borderRadius: colors.radius - 2,
                      alignItems: "center",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      تأكيد الإلغاء
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowCancelForm(false); setCancelReason(""); }}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: colors.surface,
                      paddingVertical: 12,
                      borderRadius: colors.radius - 2,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                      تراجع
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}

        {isAdmin && (
          <Pressable
            onPress={() =>
              Alert.alert(
                "حذف طلب الاسترجاع",
                "هل أنت متأكد من حذف طلب الاسترجاع نهائياً؟",
                [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "حذف",
                    style: "destructive",
                    onPress: () => {
                      deleteReturnRequest(ret.id);
                      router.back();
                    },
                  },
                ]
              )
            }
            style={[styles.deleteBtn, { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11" }]}
          >
            <Icon name="trash-2" size={14} color="#E74C3C" />
            <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 14 }}>
              حذف طلب الاسترجاع نهائياً
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16 },
  statusCard: {
    alignItems: "center",
    padding: 20,
    borderWidth: 1,
    gap: 8,
  },
  statusLabel: { fontSize: 18 },
  orderDate: { fontSize: 13 },
  stepsRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },
  step: { alignItems: "center", gap: 6, flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  stepLine: { height: 2, flex: 1, marginTop: 11, marginHorizontal: -4 },
  infoCard: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, textAlign: "right" },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  infoText: { fontSize: 14 },
  itemRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 8,
  },
  viewOrderBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  cancelBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
  },
  cancelFormCard: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
});
