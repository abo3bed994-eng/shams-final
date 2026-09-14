import React, { useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Order, OrderStatus } from "@/context/AppContext";
import { useCartPulse } from "@/hooks/useCartPulse";
import { useTranslation } from "@/lib/i18n";
import OrderCard from "@/components/OrderCard";

type FilterType = "all" | "scheduled" | "pending" | "received" | "preparing" | "ready" | "ready_to_ship" | "ready_combined" | "shipped" | "delivered" | "cancelled" | "returns";


export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, orders, updateOrderStatus, deleteOrder, cancelOrder, cart, returnRequests, updateReturnStatus, deleteReturnRequest } = useApp();
  const cartCount = cart.length;
  const cartPulse = useCartPulse(cartCount);
  const { t, isRTL } = useTranslation();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";
  const canEditStatus = user?.role === "admin" || user?.role === "supervisor" || user?.role === "employee";
  const canDeleteOrders = user?.role === "admin" || (isStaff && (user?.permissions ?? []).includes("delete_orders"));

  const myOrders = useMemo(() => isStaff ? orders : orders.filter((o) => o.userId === user?.id), [isStaff, orders, user?.id]);
  const myReturns = useMemo(() => isStaff ? returnRequests : returnRequests.filter((r) => r.userId === user?.id), [isStaff, returnRequests, user?.id]);

  const stats = useMemo(() => {
    const pending = myOrders.filter((o) => o.status === "pending").length;
    const preparing = myOrders.filter((o) => o.status === "preparing" || o.status === "received").length;
    const delivered = myOrders.filter((o) => o.status === "delivered").length;
    const totalRevenue = myOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0);
    return { pending, preparing, delivered, totalRevenue };
  }, [myOrders]);

  const statusFiltered = useMemo(() =>
    filter === "all"
      ? myOrders
      : filter === "returns"
      ? []
      : filter === "ready_combined"
      ? myOrders.filter((o) => o.status === "ready" || o.status === "ready_to_ship")
      : myOrders.filter((o) => o.status === filter),
    [filter, myOrders]
  );

  const filteredUnsorted = useMemo(() => isStaff && search.trim()
    ? statusFiltered.filter((o) =>
        o.userName.toLowerCase().includes(search.trim().toLowerCase()) ||
        o.userPhone.includes(search.trim()) ||
        o.id.toLowerCase().startsWith(search.trim().toLowerCase())
      )
    : statusFiltered, [isStaff, search, statusFiltered]);

  const filtered = useMemo(() => [...filteredUnsorted].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ), [filteredUnsorted]);

  const filteredReturns = useMemo(() => filter === "returns"
    ? (isStaff && search.trim()
        ? myReturns.filter((r) =>
            r.userName.toLowerCase().includes(search.trim().toLowerCase()) ||
            r.userPhone.includes(search.trim()) ||
            r.orderId.toLowerCase().startsWith(search.trim().toLowerCase())
          )
        : myReturns)
    : [], [filter, isStaff, search, myReturns]);

  const canCancelOrder = (order: Order) => {
    if (order.status === "scheduled") return true;
    const created = new Date(order.createdAt).getTime();
    return Date.now() - created < 5 * 60 * 1000;
  };

  const pendingReturnsCount = useMemo(() => myReturns.filter((r) => r.status === "pending").length, [myReturns]);

  const FILTERS: { key: FilterType; label: string; count?: number }[] = useMemo(() => [
    { key: "all", label: t("all"), count: myOrders.length },
    { key: "scheduled", label: "معلّق", count: myOrders.filter((o) => o.status === "scheduled").length },
    { key: "pending", label: t("newOrder"), count: myOrders.filter((o) => o.status === "pending").length },
    { key: "received", label: t("received"), count: myOrders.filter((o) => o.status === "received").length },
    { key: "preparing", label: t("preparing"), count: myOrders.filter((o) => o.status === "preparing").length },
    { key: "ready_combined", label: "جاهز للاستلام/الشحن", count: myOrders.filter((o) => o.status === "ready" || o.status === "ready_to_ship").length },
    { key: "shipped", label: t("shipped"), count: myOrders.filter((o) => o.status === "shipped").length },
    { key: "delivered", label: t("delivered"), count: myOrders.filter((o) => o.status === "delivered").length },
    { key: "cancelled", label: t("cancelled"), count: myOrders.filter((o) => o.status === "cancelled").length },
    { key: "returns", label: t("returns"), count: pendingReturnsCount },
  ], [t, myOrders, pendingReturnsCount]);

  const handleCancelOrder = (order: Order) => {
    Alert.alert(
      t("cancelOrder"),
      t("cancelOrderConfirm"),
      [
        { text: t("no"), style: "cancel" },
        {
          text: t("yesCancel"),
          style: "destructive",
          onPress: async () => {
            try {
              await cancelOrder(order.id);
            } catch {
              Alert.alert("خطأ", "تعذّر إلغاء الطلب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
            }
          },
        },
      ]
    );
  };

  const RETURN_STEPS = [
    { key: "pending", label: t("returnStep1") },
    { key: "returned", label: t("returnStep2") },
    { key: "settled", label: t("returnStep3") },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {isStaff ? t("manageOrders") : t("myOrders")}
          </Text>
          {!isStaff && myOrders.length > 0 && (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {myOrders.length} {t("orders")}
            </Text>
          )}
        </View>
        {!isStaff && (
          <Pressable
            onPress={() => router.push("/cart")}
            style={({ pressed }) => [styles.cartBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Animated.View style={[styles.cartHeaderIconWrap, { transform: [{ scale: cartPulse }] }]}>
              <Icon name="shopping-cart" size={22} color={colors.foreground} />
              {cartCount > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: "#E74C3C" }]}>
                  <Text style={[styles.cartBadgeText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
      {user?.role === "admin" && myOrders.length > 0 && (
        <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.statBox, { backgroundColor: "#9B59B611", borderColor: "#9B59B633" }]}>
            <Text style={{ color: "#9B59B6", fontFamily: "Inter_700Bold", fontSize: 18 }}>{stats.pending}</Text>
            <Text style={{ color: "#9B59B6", fontFamily: "Inter_500Medium", fontSize: 10 }}>{t("newOrder")}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#F39C1211", borderColor: "#F39C1233" }]}>
            <Text style={{ color: "#F39C12", fontFamily: "Inter_700Bold", fontSize: 18 }}>{stats.preparing}</Text>
            <Text style={{ color: "#F39C12", fontFamily: "Inter_500Medium", fontSize: 10 }}>{t("inPreparation")}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#27AE6011", borderColor: "#27AE6033" }]}>
            <Text style={{ color: "#27AE60", fontFamily: "Inter_700Bold", fontSize: 18 }}>{stats.delivered}</Text>
            <Text style={{ color: "#27AE60", fontFamily: "Inter_500Medium", fontSize: 10 }}>{t("delivered")}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.gold + "11", borderColor: colors.gold + "33" }]}>
            <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>{stats.totalRevenue > 0 ? `${(stats.totalRevenue / 1000).toFixed(1)}k` : "0"}</Text>
            <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 10 }}>{t("revenue")}</Text>
          </View>
        </View>
      )}

      {isStaff && (
        <View style={[styles.searchRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 2 }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("searchOrders")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular", textAlign: "right" }]}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Icon name="x" size={15} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isStaff && (
      <View style={[styles.filterGrid, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {FILTERS.map(({ key, label, count }) => {
          const isReturns = key === "returns";
          const isActive = filter === key;
          const activeColor = isReturns ? "#C0392B" : colors.gold;
          const hasCount = (count ?? 0) > 0;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? activeColor + "18" : colors.surface,
                  borderColor: isActive ? activeColor : colors.border,
                  borderWidth: isActive ? 1.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: isActive ? activeColor : colors.mutedForeground,
                  fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
              {hasCount && (
                <View style={{
                  backgroundColor: isActive ? activeColor + "33" : colors.border + "88",
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{
                    color: isActive ? activeColor : colors.mutedForeground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 9,
                  }}>
                    {count}
                  </Text>
                </View>
              )}
              {isReturns && pendingReturnsCount > 0 && !isActive && (
                <View style={{ backgroundColor: "#C0392B", width: 5, height: 5, borderRadius: 3, position: "absolute", top: 2, left: 2 }} />
              )}
            </Pressable>
          );
        })}
      </View>
      )}

      <View style={styles.list}>
        {filter === "returns" ? (
          filteredReturns.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: "#C0392B11" }]}>
                <Icon name="rotate-ccw" size={32} color="#C0392B44" />
              </View>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("noReturns")}
              </Text>
            </View>
          ) : (
            [...filteredReturns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ret) => {
              const isCancelled = ret.status === "cancelled";
              const returnStep = isCancelled ? -1 : RETURN_STEPS.findIndex((s) => s.key === ret.status);
              return (
                <Pressable
                  key={ret.id}
                  onPress={() => router.push(`/return/${ret.id}`)}
                  style={({ pressed }) => [
                    styles.returnCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isCancelled ? "#E74C3C33" : "#C0392B33",
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.returnCardHeader}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={[styles.returnIcon, { backgroundColor: isCancelled ? "#E74C3C22" : "#C0392B22" }]}>
                        <Icon name={isCancelled ? "x-circle" : "rotate-ccw"} size={16} color={isCancelled ? "#E74C3C" : "#C0392B"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                          {t("returnRequestLabel")}
                        </Text>
                        {isStaff && (
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                            {ret.userName} — {ret.userPhone}
                          </Text>
                        )}
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                          {t("orderNum")} #{ret.orderId.slice(0, 12)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.returnStatusBadge, {
                      backgroundColor: isCancelled ? "#E74C3C22" : ret.status === "settled" ? "#27AE6022" : ret.status === "returned" ? "#F39C1222" : "#C0392B22",
                    }]}>
                      <Text style={{
                        color: isCancelled ? "#E74C3C" : ret.status === "settled" ? "#27AE60" : ret.status === "returned" ? "#F39C12" : "#C0392B",
                        fontFamily: "Inter_600SemiBold", fontSize: 10,
                      }}>
                        {isCancelled ? t("cancelled") : ret.status === "settled" ? t("settled") : ret.status === "returned" ? t("returned") : t("pendingReview")}
                      </Text>
                    </View>
                  </View>

                  {!isCancelled && (
                    <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", paddingHorizontal: 4, marginTop: 8 }}>
                      {RETURN_STEPS.map((step, index) => {
                        const isCompleted = index <= returnStep;
                        const sColor = isCompleted ? "#C0392B" : colors.border;
                        return (
                          <React.Fragment key={step.key}>
                            <View style={{ alignItems: "center", gap: 3, flex: 1 }}>
                              <View style={{
                                width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                                backgroundColor: isCompleted ? sColor : colors.surface,
                                borderColor: sColor,
                                alignItems: "center", justifyContent: "center",
                              }}>
                                {isCompleted && <Icon name="check" size={8} color="#fff" />}
                              </View>
                              <Text style={{
                                fontSize: 9, textAlign: "center", lineHeight: 12,
                                color: isCompleted ? "#C0392B" : colors.mutedForeground,
                                fontFamily: isCompleted ? "Inter_600SemiBold" : "Inter_400Regular",
                              }} numberOfLines={2}>
                                {step.label}
                              </Text>
                            </View>
                            {index < RETURN_STEPS.length - 1 && (
                              <View style={{ height: 2, flex: 1, marginTop: 8, marginHorizontal: -2, backgroundColor: index < returnStep ? "#C0392B" : colors.border }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </View>
                  )}

                  {isCancelled && (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: "#E74C3C11", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                      <Icon name="info" size={12} color="#E74C3C" />
                      <Text style={{ color: "#E74C3C", fontFamily: "Inter_400Regular", fontSize: 11, flex: 1, textAlign: "right" }}>
                        {t("returnCancelled")}
                      </Text>
                    </View>
                  )}

                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", marginTop: 6 }}>
                    {t("reason")}: {ret.reason}
                  </Text>

                  {ret.items && ret.items.length > 0 && (
                    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {ret.items.slice(0, 4).map((item, idx) => (
                        <View key={idx} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.colorHex, borderWidth: 1, borderColor: colors.border }} />
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                            {item.colorName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                      {new Date(ret.createdAt).toLocaleDateString("ar-EG")}
                    </Text>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 11 }}>{t("details")}</Text>
                      <Icon name="chevron-left" size={12} color={colors.gold} />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.gold + "11" }]}>
              <Icon name="package" size={32} color={colors.gold + "44"} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {search.trim() ? t("noMatchingOrders") : isStaff ? t("noOrders") : t("noOrdersYet")}
            </Text>
            {!isStaff && !search.trim() && (
              <Pressable
                onPress={() => router.push("/(tabs)/products")}
                style={({ pressed }) => [
                  styles.shopBtn,
                  { backgroundColor: colors.gold, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Icon name="shopping-bag" size={16} color={colors.background} />
                <Text style={[styles.shopBtnText, { color: colors.background, fontFamily: "Inter_600SemiBold" }]}>
                  {t("browseProducts")}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map((order) => {
            const userCanControlThisOrder =
              user?.role === "admin"
              || (canEditStatus && (!order.assignedTo || order.assignedTo === user?.id));

            return (
            <View key={order.id}>
              <OrderCard
                order={order}
                isAdmin={canEditStatus}
                canControl={userCanControlThisOrder}
                hasReturn={returnRequests.some((r) => r.orderId === order.id && r.status !== "cancelled")}
                onPress={() => router.push(`/order/${order.id}`)}
                onStatusChange={
                  canEditStatus && order.status !== "cancelled" && userCanControlThisOrder
                    ? (status: OrderStatus) => {
                        if (status === "received" && user?.role !== "admin") {
                          updateOrderStatus(order.id, status, user?.id, user?.name);
                        } else {
                          updateOrderStatus(order.id, status);
                        }
                      }
                    : undefined
                }
                onPrevStatus={
                  user?.role === "admin" && order.status !== "cancelled" && userCanControlThisOrder
                    ? (status: OrderStatus) => updateOrderStatus(order.id, status)
                    : undefined
                }
              />
              {canDeleteOrders && (
                <Pressable
                  onPress={() =>
                    Alert.alert("حذف نهائي", "هل تريد حذف هذا الطلب نهائياً؟", [
                      { text: "إلغاء", style: "cancel" },
                      { text: "حذف", style: "destructive", onPress: () => deleteOrder(order.id) },
                    ])
                  }
                  style={[
                    styles.deleteOrderBtn,
                    { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11" },
                  ]}
                >
                  <Icon name="trash-2" size={14} color="#E74C3C" />
                  <Text style={[{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 13 }]}>
                    حذف الطلب نهائياً
                  </Text>
                </Pressable>
              )}
            </View>
            );
          })
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22 },
  cartBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center", position: "relative" as const },
  cartHeaderIconWrap: { position: "relative" as const, width: 24, height: 24, overflow: "visible" as const },
  cartBadge: {
    position: "absolute" as const,
    top: -10,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10 },
  statsRow: {
    flexDirection: "row-reverse" as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  statBox: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filterGrid: {
    flexDirection: "row-reverse" as const,
    flexWrap: "wrap" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  filterChip: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    position: "relative" as const,
  },
  list: { padding: 16, gap: 4 },
  empty: { alignItems: "center" as const, paddingTop: 80, gap: 16 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  emptyText: { fontSize: 16 },
  shopBtn: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  shopBtnText: { fontSize: 15 },
  deleteOrderBtn: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  returnCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  returnCardHeader: {
    flexDirection: "row-reverse" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  },
  returnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  returnStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
