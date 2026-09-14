import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { cardShadow } from "@/constants/shadows";
import { useColors } from "@/hooks/useColors";
import { Order, OrderStatus } from "@/context/AppContext";

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  isAdmin?: boolean;
  onStatusChange?: (status: OrderStatus) => void;
  onPrevStatus?: (status: OrderStatus) => void;
  canControl?: boolean; // whether this user can change this specific order
  hasReturn?: boolean; // order has an active (non-cancelled) return request
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  scheduled: { label: "معلّق — خارج الدوام", color: "#D4A017", icon: "moon" },
  pending: { label: "بانتظار الاستلام", color: "#9B59B6", icon: "clock" },
  received: { label: "تم استلام الطلب", color: "#3498DB", icon: "inbox" },
  preparing: { label: "جاري التجهيز", color: "#F39C12", icon: "package" },
  ready: { label: "جاهز للاستلام", color: "#27AE60", icon: "check-circle" },
  ready_to_ship: { label: "جاهز للشحن", color: "#16A085", icon: "package" },
  shipped: { label: "تم الشحن", color: "#1ABC9C", icon: "truck" },
  delivered: { label: "تم التسليم", color: "#2ECC71", icon: "check-circle" },
  cancelled: { label: "ملغي من الزبون", color: "#E74C3C", icon: "x-circle" },
};

function nextStatusFor(order: Order): { next: OrderStatus; label: string } | undefined {
  const isShipping = order.fulfillmentType === "shipping";
  const map: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = isShipping
    ? {
        pending: { next: "received", label: "استلام" },
        received: { next: "preparing", label: "تجهيز" },
        preparing: { next: "ready_to_ship", label: "جاهز للشحن" },
        ready_to_ship: { next: "shipped", label: "تم الشحن" },
      }
    : {
        pending: { next: "received", label: "استلام" },
        received: { next: "preparing", label: "تجهيز" },
        preparing: { next: "ready", label: "جاهز" },
        ready: { next: "delivered", label: "تسليم" },
      };
  return map[order.status];
}

function prevStatusFor(order: Order): { prev: OrderStatus; label: string } | undefined {
  const isShipping = order.fulfillmentType === "shipping";
  const map: Partial<Record<OrderStatus, { prev: OrderStatus; label: string }>> = isShipping
    ? {
        received: { prev: "pending", label: "إلغاء الاستلام" },
        preparing: { prev: "received", label: "رجوع لاستلام" },
        ready_to_ship: { prev: "preparing", label: "رجوع لتجهيز" },
        shipped: { prev: "ready_to_ship", label: "رجوع لجاهز للشحن" },
      }
    : {
        received: { prev: "pending", label: "إلغاء الاستلام" },
        preparing: { prev: "received", label: "رجوع لاستلام" },
        ready: { prev: "preparing", label: "رجوع لتجهيز" },
        delivered: { prev: "ready", label: "رجوع لجاهز" },
      };
  return map[order.status];
}

export default function OrderCard({ order, onPress, isAdmin, onStatusChange, onPrevStatus, canControl, hasReturn }: OrderCardProps) {
  const colors = useColors();
  const statusInfo = STATUS_CONFIG[order.status];
  const nextAction = nextStatusFor(order);
  const prevAction = prevStatusFor(order);

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const invoiceTotal = order.totalWithFee ?? order.total;
  const date = new Date(order.createdAt).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Show "locked by" info when order is assigned to someone else
  const showAssigned = isAdmin && order.assignedTo && order.assignedToName;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: hasReturn ? "#C0392B" : order.status === "pending" ? "#9B59B644" : colors.border,
          borderWidth: hasReturn ? 1.5 : 1,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
        cardShadow(colors.isDark, "soft"),
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "22" }]}>
          <Icon name={statusInfo.icon as any} size={12} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color, fontFamily: "Inter_600SemiBold" }]}>
            {statusInfo.label}
          </Text>
        </View>
        <Text style={[styles.orderId, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          #{order.id.slice(0, 12)}
        </Text>
      </View>

      {isAdmin && (
        <Text style={[styles.customerName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {order.userName} - {order.userPhone}
        </Text>
      )}

      {hasReturn && (
        <View style={[styles.assignedRow, { backgroundColor: "#C0392B11", borderColor: "#C0392B44" }]}>
          <Icon name="rotate-ccw" size={12} color="#C0392B" />
          <Text style={{ color: "#C0392B", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
            هذا الطلب عليه طلب استرجاع
          </Text>
        </View>
      )}

      {order.edited && (
        <View style={[styles.assignedRow, { backgroundColor: "#F39C1211", borderColor: "#F39C1233" }]}>
          <Icon name="edit-3" size={12} color="#F39C12" />
          <Text style={{ color: "#F39C12", fontFamily: "Inter_500Medium", fontSize: 12 }}>
            تم تعديل الطلب من قبل العميل
          </Text>
        </View>
      )}

      {/* Assigned employee info */}
      {showAssigned && (
        <View style={[styles.assignedRow, { backgroundColor: "#3498DB11", borderColor: "#3498DB33" }]}>
          <Icon name="user" size={12} color="#3498DB" />
          <Text style={{ color: "#3498DB", fontFamily: "Inter_500Medium", fontSize: 12 }}>
            مُستلَم بواسطة: {order.assignedToName}
          </Text>
        </View>
      )}

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Icon name="shopping-bag" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {totalItems} ثوب
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="calendar" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {date}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.totalWrap}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            قيمة الفاتورة النهائية
          </Text>
          <Text style={[styles.total, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
            {invoiceTotal > 0 ? `${invoiceTotal.toLocaleString("ar-EG")} ج.م` : "بانتظار التسعير"}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          {/* Back button — shown to admin or assigned employee */}
          {isAdmin && prevAction && onPrevStatus && canControl && (
            <Pressable
              onPress={() => onPrevStatus(prevAction.prev)}
              style={({ pressed }) => [
                styles.prevBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon name="chevron-right" size={12} color={colors.mutedForeground} />
              <Text style={[styles.prevText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {prevAction.label}
              </Text>
            </Pressable>
          )}

          {/* Next status button */}
          {isAdmin && nextAction && onStatusChange && canControl && (
            <Pressable
              onPress={() => onStatusChange(nextAction.next)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.gold,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.actionText, { color: colors.background, fontFamily: "Inter_600SemiBold" }]}>
                {nextAction.label}
              </Text>
            </Pressable>
          )}

          {/* Locked — assigned to someone else */}
          {isAdmin && order.assignedTo && !canControl && order.status !== "cancelled" && nextAction && (
            <View style={[styles.lockedBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="lock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.prevText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                مُقفَل
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 12 },
  orderId: { fontSize: 12 },
  customerName: { fontSize: 14, textAlign: "right" },
  assignedRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  details: { flexDirection: "row-reverse", gap: 16 },
  detailItem: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  detailText: { fontSize: 13 },
  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  totalWrap: { flex: 1, gap: 2 },
  totalLabel: { fontSize: 10, textAlign: "right" },
  total: { fontSize: 16, textAlign: "right" },
  actionGroup: { flexDirection: "row-reverse", gap: 6, alignItems: "center" },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  actionText: { fontSize: 13 },
  prevBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  prevText: { fontSize: 12 },
  lockedBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
});
