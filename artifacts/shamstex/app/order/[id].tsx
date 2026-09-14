import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";
import { useLocalSearchParams, router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow } from "@/constants/shadows";
import { useColors } from "@/hooks/useColors";
import { useApp, OrderStatus, PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, SHIPPING_PROVIDER_DEFAULTS, ShippingProviderId, CartItem } from "@/context/AppContext";
import { Linking } from "react-native";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { persistImageUri, UploadFailedError } from "@/utils/persistImage";
import { saveImageToDevice, shareImage } from "@/utils/imageActions";
import { buildInvoiceHtml } from "@/utils/invoiceHtml";
import { buildPackingSlipHtml } from "@/utils/packingSlipHtml";
import { EDIT_WINDOW_MS, acceptStaffAvailability, computeItemsTotal } from "@/lib/editOrder";
import { companionAmount, companionLineTotal, companionTotal } from "@/lib/companion";
import { WebView } from "react-native-webview";

const PICKUP_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "pending", label: "بانتظار الاستلام", icon: "clock" },
  { key: "received", label: "تم الاستلام", icon: "inbox" },
  { key: "preparing", label: "جاري التجهيز", icon: "package" },
  { key: "ready", label: "الطلب جاهز", icon: "gift" },
  { key: "delivered", label: "تم التسليم", icon: "check-circle" },
];

const SHIPPING_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "pending", label: "بانتظار الاستلام", icon: "clock" },
  { key: "received", label: "تم الاستلام", icon: "inbox" },
  { key: "preparing", label: "جاري التجهيز", icon: "package" },
  { key: "ready_to_ship", label: "جاهز للشحن", icon: "package" },
  { key: "shipped", label: "تم الشحن", icon: "truck" },
];

function getStatusSteps(fulfillmentType?: string) {
  return fulfillmentType === "shipping" ? SHIPPING_STEPS : PICKUP_STEPS;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  scheduled: "#D4A017",
  pending: "#9B59B6",
  received: "#3498DB",
  preparing: "#F39C12",
  ready: "#27AE60",
  ready_to_ship: "#16A085",
  shipped: "#1ABC9C",
  delivered: "#2ECC71",
  cancelled: "#E74C3C",
};

const blt = (u?: string) => (u === "meter" ? 100 : 20);
const ulbl = (u?: string) => (u === "meter" ? "متر" : "كغ");

function getNextAction(status: OrderStatus, fulfillmentType?: string): { next: OrderStatus; label: string } | undefined {
  const isShipping = fulfillmentType === "shipping";
  const map: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = isShipping
    ? {
        scheduled: { next: "received", label: "استلام مبكر (خارج الدوام)" },
        pending: { next: "received", label: "استلام الطلب" },
        received: { next: "preparing", label: "بدء التجهيز" },
        preparing: { next: "ready_to_ship", label: "جاهز للشحن" },
        ready_to_ship: { next: "shipped", label: "تأكيد الشحن" },
      }
    : {
        scheduled: { next: "received", label: "استلام مبكر (خارج الدوام)" },
        pending: { next: "received", label: "استلام الطلب" },
        received: { next: "preparing", label: "بدء التجهيز" },
        preparing: { next: "ready", label: "تأكيد الجاهزية" },
        ready: { next: "delivered", label: "تأكيد التسليم" },
      };
  return map[status];
}

function getPrevAction(status: OrderStatus, fulfillmentType?: string): { prev: OrderStatus; label: string } | undefined {
  const isShipping = fulfillmentType === "shipping";
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
  return map[status];
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function pickImage(scopeId: string): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "اختر مصدر الصورة",
      "من أين تريد رفع الصورة؟",
      [
        {
          text: "الكاميرا",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert("خطأ", "يرجى السماح بالوصول للكاميرا");
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.7,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              const uploaded = await persistImageUri(result.assets[0].uri, "private", scopeId);
              resolve(uploaded);
            } else {
              resolve(null);
            }
          },
        },
        {
          text: "المعرض",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.7,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              const uploaded = await persistImageUri(result.assets[0].uri, "private", scopeId);
              resolve(uploaded);
            } else {
              resolve(null);
            }
          },
        },
        { text: "إلغاء", style: "cancel", onPress: () => resolve(null) },
      ]
    );
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { orders, user, updateOrderStatus, deleteOrder, sendOrderMessage, setOrderEditable, setOrderEditExpiry, beginOrderEdit, updateOrderItems, returnRequests, addReturnRequest, updateReturnStatus, setEditingOrderId, settings, products, cancelOrder, setOrderTransferProof, setOrderPaymentMethod, setOrderPaymentOverride, setOrderShipping } = useApp();
  const unitOf = (it: { productId: string; unit?: string }) => products.find(p => p.id === it.productId)?.unit ?? it.unit;
  const boltsOf = (weight: number | undefined, it: { productId: string; unit?: string }) => Math.floor((weight ?? 0) / blt(unitOf(it)));
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSelectedItems, setReturnSelectedItems] = useState<Record<number, boolean>>({});
  const [returnItemWeights, setReturnItemWeights] = useState<Record<number, number>>({});
  const [returnItemBolts, setReturnItemBolts] = useState<Record<number, number>>({});
  const [weightTexts, setWeightTexts] = useState<Record<string, string>>({});
  const [returnWeightTexts, setReturnWeightTexts] = useState<Record<number, string>>({});
  const [returnBoltTexts, setReturnBoltTexts] = useState<Record<number, string>>({});
  const [printingInvoice, setPrintingInvoice] = useState(false);
  const [printingPackingSlip, setPrintingPackingSlip] = useState(false);
  const [returnProblemImage, setReturnProblemImage] = useState<string | null>(null);
  const [uploadingReturnProblem, setUploadingReturnProblem] = useState(false);
  const [uploadingTransferProof, setUploadingTransferProof] = useState(false);
  const [showTransferProof, setShowTransferProof] = useState(false);
  const [showChangeMethodModal, setShowChangeMethodModal] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [overrideHandle, setOverrideHandle] = useState("");
  const [overrideName, setOverrideName] = useState("");
  const [showWaybillModal, setShowWaybillModal] = useState(false);
  const [waybillNumberInput, setWaybillNumberInput] = useState("");
  const [waybillProviderInput, setWaybillProviderInput] = useState<ShippingProviderId | null>(null);
  const [waybillImageInput, setWaybillImageInput] = useState<string | null>(null);
  const [uploadingWaybill, setUploadingWaybill] = useState(false);
  const [showWaybillPreview, setShowWaybillPreview] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [editSectionY, setEditSectionY] = useState<number | null>(null);
  const didScrollToEditRef = useRef(false);
  const [availModalIndex, setAvailModalIndex] = useState<number | null>(null);
  const [availInput, setAvailInput] = useState("");
  const [confirmingEdit, setConfirmingEdit] = useState(false);

  const order = orders.find((o) => o.id === id);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";
  const isAdmin = user?.role === "admin";
  const canDeleteOrders = isAdmin || (isStaff && (user?.permissions ?? []).includes("delete_orders"));
  const isCustomer = user?.role === "customer" || user?.role === "merchant";
  const isAssignedToMe = order?.assignedTo === user?.id;
  const isLockedByOther = order?.assignedTo && !isAssignedToMe && !isAdmin;

  const saveCompanionWeight = (itemIndex: number, companionIndex: number, rawValue: string) => {
    if (!order) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const newItems = order.items.map((item, index) => {
      if (index !== itemIndex) return item;
      const companions = (item.companions ?? []).map((companion, index2) =>
        index2 === companionIndex
          ? { ...companion, actualWeight: value, weight: undefined, manualWeight: true }
          : companion
      );
      return { ...item, companions };
    });
    updateOrderItems(order.id, newItems, computeItemsTotal(newItems), true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isCancelled = order?.status === "cancelled";
  const isScheduled = order?.status === "scheduled";
  const STATUS_STEPS = getStatusSteps(order?.fulfillmentType);
  const currentStep = isCancelled || isScheduled ? 0 : STATUS_STEPS.findIndex((s) => s.key === order?.status);

  const hasAffectedItems = !!order && order.items.some((it) => it.stockStatus);

  useEffect(() => {
    if (didScrollToEditRef.current) return;
    if (!order || !isCustomer || !order.editable || !hasAffectedItems) return;
    if (editSectionY == null) return;
    didScrollToEditRef.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, editSectionY - 20), animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [order, isCustomer, hasAffectedItems, editSectionY]);

  // Fallback: the edit countdown is normally armed by staff the moment they make
  // the order editable. This only kicks in for legacy editable orders that were
  // saved before that change and still lack a deadline. The deadline lives on
  // the order so the global countdown bar shows on every screen; on expiry
  // editing auto-closes.
  useEffect(() => {
    if (!order || !isCustomer) return;
    if (!order.editable || order.status === "cancelled") return;
    if (order.editableExpiresAt) return;
    setOrderEditExpiry(order.id, new Date(Date.now() + EDIT_WINDOW_MS).toISOString());
  }, [order?.id, order?.editable, order?.editableExpiresAt, order?.status, isCustomer]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GoldHeader title="تفاصيل الطلب" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={{ color: colors.mutedForeground }}>الطلب غير موجود</Text>
        </View>
      </View>
    );
  }

  const date = new Date(order.createdAt).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const activeColor = STATUS_COLORS[order.status];

  const handleCustomerCancelOrder = () => {
    if (!order) return;
    Alert.alert(
      "إلغاء الطلب",
      "هل أنت متأكد من إلغاء هذا الطلب؟ لن يمكنك التراجع.",
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "نعم، ألغِ الطلب",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await cancelOrder(order.id, { notifyStaff: true });
              Alert.alert("تم", "تم إلغاء الطلب.");
              router.back();
            } catch {
              Alert.alert("خطأ", "تعذّر إلغاء الطلب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
            }
          },
        },
      ]
    );
  };

  const handleConfirmEdit = async () => {
    if (!order) return;
    // Accept the staff's availability directly: drop unavailable items, cap
    // partially-available items to the available quantity. No per-item approval.
    const finalItems = acceptStaffAvailability(order.items);

    if (finalItems.length === 0) {
      Alert.alert(
        "لا يمكن تأكيد التعديل",
        "جميع الأصناف غير متوفرة. يمكنك اختيار منتجات بديلة أو إلغاء الطلب.",
        [
          { text: "اختيار بديل", style: "cancel" },
          { text: "إلغاء الطلب", style: "destructive", onPress: handleCustomerCancelOrder },
        ]
      );
      return;
    }

    const doConfirm = async () => {
      try {
        setConfirmingEdit(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await updateOrderItems(order.id, finalItems, computeItemsTotal(finalItems));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("تم", "تم تأكيد التعديل بنجاح وإبلاغ فريق العمل.");
      } catch {
        Alert.alert("خطأ", "تعذّر حفظ التعديل. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
      } finally {
        setConfirmingEdit(false);
      }
    };

    Alert.alert(
      "تأكيد التعديل",
      "سيتم قبول الكميات المتوفرة وحذف الأصناف غير المتوفرة. هل تريد المتابعة؟",
      [
        { text: "تراجع", style: "cancel" },
        { text: "نعم، أكّد التعديل", onPress: doConfirm },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title="تفاصيل الطلب"
        subtitle={`#${order.id.slice(0, 12)}`}
        onBack={() => router.back()}
      />

      <KeyboardAwareScroll
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <View style={[styles.statusCard, { backgroundColor: activeColor + "11", borderColor: activeColor + "44", borderRadius: colors.radius }, cardShadow(colors.isDark, "soft")]}>
          <Icon name={isCancelled ? "x-circle" : isScheduled ? "moon" : STATUS_STEPS[currentStep].icon as any} size={28} color={activeColor} />
          <Text style={[styles.statusLabel, { color: activeColor, fontFamily: "Inter_700Bold" }]}>
            {isCancelled ? "تم إلغاء الطلب" : isScheduled ? "معلّق — خارج أوقات العمل" : STATUS_STEPS[currentStep].label}
          </Text>
          <Text style={[styles.orderDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {date}
          </Text>
          {isScheduled && order.scheduledFor && (
            <Text style={{ color: activeColor, fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 8, textAlign: "center" }}>
              سيصل الطلب {new Date(order.scheduledFor).toLocaleString("ar-EG", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>

        {(() => {
          const orderReturns = returnRequests.filter((r) => r.orderId === order.id && r.status !== "cancelled");
          if (orderReturns.length === 0) return null;
          const latest = orderReturns[0];
          return (
            <Pressable
              onPress={() => router.push(`/return/${latest.id}`)}
              style={({ pressed }) => [{
                backgroundColor: "#C0392B15",
                borderColor: "#C0392B",
                borderWidth: 1.5,
                borderRadius: colors.radius,
                padding: 14,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 10,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Icon name="rotate-ccw" size={20} color="#C0392B" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#C0392B", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                  هذا الطلب عليه طلب استرجاع
                </Text>
                <Text style={{ color: "#C0392B99", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                  اضغط لعرض تفاصيل الاسترجاع{orderReturns.length > 1 ? ` (${orderReturns.length} طلبات)` : ""}
                </Text>
              </View>
              <Icon name="chevron-left" size={18} color="#C0392B" />
            </Pressable>
          );
        })()}

        {order.edited && isStaff && (
          <View style={[{ backgroundColor: "#F39C1215", borderColor: "#F39C1244", borderWidth: 1, borderRadius: colors.radius, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }]}>
            <Icon name="edit-3" size={18} color="#F39C12" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#F39C12", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                تم تعديل الطلب من قبل العميل
              </Text>
              {order.editedAt && (
                <Text style={{ color: "#F39C1299", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                  {new Date(order.editedAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })} — {new Date(order.editedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={[styles.stagesCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }, cardShadow(colors.isDark, "soft")]}>
          <View style={styles.stepsRow}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStep;
            const stepColor = isCompleted ? activeColor : colors.border;
            return (
              <React.Fragment key={step.key}>
                <View style={styles.step}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: isCompleted ? stepColor : colors.surface,
                        borderColor: stepColor,
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
                {index < STATUS_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: index < currentStep ? activeColor : colors.border },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
          </View>
          {isStaff && !!order.assignedToName && (
            <View style={[styles.assignedInline, { borderTopColor: colors.border }]}>
              <Icon name="user-check" size={15} color={colors.gold} />
              <Text style={[styles.assignedText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                استلمه: {order.assignedToName}
              </Text>
            </View>
          )}
        </View>

        {(() => {
          // Legacy/undefined and old "store" orders are now treated as branch pickup.
          const ft = order.fulfillmentType === "shipping" ? "shipping" : "branch";
          const branches = settings.branches ?? [];
          const branch = order.branchId ? branches.find((b) => b.id === order.branchId) : null;
          const providers = (settings.shippingProviders && settings.shippingProviders.length > 0)
            ? settings.shippingProviders
            : SHIPPING_PROVIDER_DEFAULTS;
          const providerName = order.shippingProviderName
            || providers.find((p) => p.id === order.shippingProviderId)?.name
            || "";
          const fulfillmentTitle = ft === "shipping" ? "الشحن / التوصيل" : "الاستلام من فروعنا";
          const fulfillmentIcon = ft === "shipping" ? "truck" : "map-pin";
          const fulfillmentColor = ft === "shipping" ? "#1ABC9C" : "#3498DB";
          const canEditWaybill = isStaff && !isLockedByOther && (order.status === "ready_to_ship" || order.status === "shipped" || order.status === "preparing");
          return (
            <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 14, gap: 10 }]}>
              {isStaff && (
                <>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "right" }}>
                    معلومات العميل
                  </Text>
                  <View style={styles.infoRow}>
                    <Icon name="user" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {order.userName}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Icon name="phone" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {order.userPhone}
                    </Text>
                  </View>
                  {order.userPhone && (
                    <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "اتصال بالعميل",
                            `هل تريد الاتصال بـ ${order.userName}؟\n${order.userPhone}`,
                            [
                              { text: "إلغاء", style: "cancel" },
                              { text: "اتصال", onPress: () => {
                                import("expo-linking").then((Linking) => Linking.openURL(`tel:${order.userPhone.replace(/\s/g, "")}`)).catch(() => {});
                              }},
                            ]
                          );
                        }}
                        style={({ pressed }) => [{
                          flex: 1,
                          flexDirection: "row-reverse",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingVertical: 10,
                          backgroundColor: colors.gold + "15",
                          borderColor: colors.gold + "44",
                          borderWidth: 1,
                          borderRadius: colors.radius - 4,
                          opacity: pressed ? 0.7 : 1,
                        }]}
                      >
                        <Icon name="phone" size={16} color={colors.gold} />
                        <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                          اتصال بالعميل
                        </Text>
                      </Pressable>
                      {order.status !== "cancelled" && !isLockedByOther && (
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMsgInput((v) => !v); }}
                          style={({ pressed }) => [{
                            flex: 1,
                            flexDirection: "row-reverse",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            paddingVertical: 10,
                            backgroundColor: showMsgInput ? colors.gold : colors.gold + "15",
                            borderColor: colors.gold + "44",
                            borderWidth: 1,
                            borderRadius: colors.radius - 4,
                            opacity: pressed ? 0.7 : 1,
                          }]}
                        >
                          <Icon name="message-circle" size={16} color={showMsgInput ? colors.background : colors.gold} />
                          <Text style={{ color: showMsgInput ? colors.background : colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                            رسالة للعميل
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  {showMsgInput && order.status !== "cancelled" && !isLockedByOther && (
                    <View style={{ gap: 8, marginTop: 2 }}>
                      <TextInput
                        style={[styles.msgInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", borderRadius: colors.radius - 4 }]}
                        placeholder="مثال: الصنف غير متوفر حالياً..."
                        placeholderTextColor={colors.mutedForeground}
                        value={msgText}
                        onChangeText={setMsgText}
                        multiline
                        textAlign="right"
                      />
                      <View style={styles.msgBtnRow}>
                        <Pressable
                          onPress={() => { setShowMsgInput(false); setMsgText(""); }}
                          style={[styles.msgCancelBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
                        >
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>إلغاء</Text>
                        </Pressable>
                        <Pressable
                          onPress={async () => {
                            if (!msgText.trim()) return;
                            setSendingMsg(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            await sendOrderMessage(order.id, msgText.trim());
                            setSendingMsg(false);
                            setShowMsgInput(false);
                            setMsgText("");
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert("تم", "تم إرسال الرسالة والإشعار للعميل بنجاح");
                          }}
                          disabled={sendingMsg || !msgText.trim()}
                          style={[styles.msgSendBtn, { backgroundColor: colors.gold, borderRadius: colors.radius - 4, opacity: sendingMsg || !msgText.trim() ? 0.5 : 1 }]}
                        >
                          <Icon name="send" size={14} color={colors.background} />
                          <Text style={{ color: colors.background, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                            {sendingMsg ? "جاري الإرسال..." : "إرسال"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />
                </>
              )}
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Icon name={fulfillmentIcon as any} size={18} color={fulfillmentColor} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, textAlign: "right" }}>
                  طريقة الاستلام: {fulfillmentTitle}
                </Text>
              </View>

              {ft === "shipping" && !isStaff && (
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#F5A62315", borderColor: "#F5A62344", borderWidth: 1, borderRadius: colors.radius - 6 }}>
                  <Icon name="alert-triangle" size={16} color="#F5A623" />
                  <Text style={{ color: "#B5790E", fontFamily: "Inter_700Bold", fontSize: 12, flex: 1, textAlign: "right" }}>
                    السعر غير شامل ثمن الشحن
                  </Text>
                </View>
              )}

              {ft === "branch" && branch && (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>{branch.name}</Text>
                  {branch.address ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>{branch.address}</Text>
                  ) : null}
                  {isStaff && branch.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${branch.phone!.replace(/\s/g, "")}`)}
                      style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="phone" size={13} color={colors.gold} />
                      <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{branch.phone}</Text>
                    </Pressable>
                  ) : null}
                  {branch.mapsUrl && !isStaff ? (
                    <Pressable
                      onPress={() => Linking.openURL(branch.mapsUrl!).catch(() => Alert.alert("خطأ", "تعذّر فتح الخريطة"))}
                      style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, backgroundColor: "#3498DB15", borderColor: "#3498DB44", borderWidth: 1, borderRadius: colors.radius - 6, marginTop: 4 }}
                    >
                      <Icon name="map" size={15} color="#3498DB" />
                      <Text style={{ color: "#3498DB", fontFamily: "Inter_700Bold", fontSize: 13 }}>فتح اللوكيشن في الخرائط</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              {ft === "branch" && !branch && order.branchName && (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "right" }}>{order.branchName}</Text>
              )}

              {ft === "shipping" && (
                <View style={{ gap: 8 }}>
                  {providerName ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                      <Icon name="package" size={14} color={colors.mutedForeground} />
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        شركة الشحن: {providerName}
                      </Text>
                    </View>
                  ) : null}
                  {order.shippingAddress ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, padding: 10, backgroundColor: colors.gold + "11", borderColor: colors.gold + "33", borderWidth: 1, borderRadius: colors.radius - 6 }}>
                      <Icon name="map-pin" size={14} color={colors.gold} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "right" }}>عنوان الشحن</Text>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "right", lineHeight: 20 }}>
                          {order.shippingAddress}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {order.shippingWaybillNumber ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                      <Icon name="hash" size={14} color={colors.mutedForeground} />
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, letterSpacing: 0.5 }}>
                        رقم البوليصة: {order.shippingWaybillNumber}
                      </Text>
                    </View>
                  ) : null}
                  {order.shippingWaybillImage ? (
                    <Pressable onPress={() => setShowWaybillPreview(true)}>
                      <Image source={{ uri: order.shippingWaybillImage }} style={{ width: "100%", height: 180, borderRadius: colors.radius - 6, backgroundColor: colors.surface }} resizeMode="cover" />
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center", marginTop: 4, fontFamily: "Inter_400Regular" }}>
                        صورة بوليصة الشحن — اضغط للعرض
                      </Text>
                    </Pressable>
                  ) : null}
                  {canEditWaybill && (
                    <Pressable
                      onPress={() => {
                        setWaybillNumberInput(order.shippingWaybillNumber ?? "");
                        setWaybillProviderInput(order.shippingProviderId ?? null);
                        setWaybillImageInput(order.shippingWaybillImage ?? null);
                        setShowWaybillModal(true);
                      }}
                      style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: colors.radius - 6, backgroundColor: colors.gold + "15", borderWidth: 1, borderColor: colors.gold + "44" }}
                    >
                      <Icon name={order.shippingWaybillImage ? "edit-3" : "upload"} size={16} color={colors.gold} />
                      <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        {order.shippingWaybillImage ? "تعديل بيانات الشحن" : "رفع بوليصة الشحن"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })()}


        {/* Invoice view button moved BELOW payment instructions */}

        {order.paymentMethod && (() => {
          const pm = order.paymentMethod as PaymentMethod;
          const pmColors: Record<PaymentMethod, string> = {
            cash: "#27AE60",
            bank_transfer: colors.gold,
            ewallet: "#9B59B6",
            instapay: "#2ECC71",
          };
          const pmShort: Record<PaymentMethod, string> = {
            cash: "كاش (الدفع عند الاستلام)",
            bank_transfer: "تحويل بنكي",
            ewallet: "محفظة إلكترونية",
            instapay: "انستاباي",
          };
          const pmColor = pmColors[pm] ?? colors.gold;
          const detailsVisible = pm !== "cash" && order.status !== "cancelled" && (isStaff || order.status === "ready" || order.status === "ready_to_ship" || (order.status === "delivered" && !!order.transferProofImage) || (order.status === "shipped" && !!order.transferProofImage));
          const ps = settings.payment;
          const wallets = ps?.ewallets ?? (ps?.ewalletNumber ? [{ id: "_l", number: ps.ewalletNumber, name: ps.ewalletName ?? "", provider: "" }] : []);
          const ipays = ps?.instapays ?? (ps?.instapayNumber ? [{ id: "_l", handle: ps.instapayNumber, name: ps.instapayName ?? "" }] : []);
          const overrideHandleVal = order.paymentOverrideHandle;
          const overrideNameVal = order.paymentOverrideName;
          const copyText = async (text: string) => {
            try {
              const Clipboard = await import("expo-clipboard");
              await Clipboard.setStringAsync(text);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("تم النسخ", text);
            } catch {}
          };
          const Row = ({ label, value }: { label: string; value: string }) => (
            <Pressable onPress={() => copyText(value)} style={({ pressed }) => [{
              flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
              padding: 10, borderRadius: colors.radius - 6, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1, gap: 8,
            }]}>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>{label}</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }} numberOfLines={1}>{value}</Text>
              </View>
              <Icon name="copy" size={16} color={colors.gold} />
            </Pressable>
          );
          return (
            <View style={[styles.paymentMethodCard, { backgroundColor: pmColor + "11", borderColor: pmColor + "33", borderRadius: colors.radius }]}>
              <View style={styles.paymentMethodRow}>
                <View style={[styles.paymentMethodIcon, { backgroundColor: pmColor + "22" }]}>
                  <Icon name={PAYMENT_METHOD_ICONS[pm] ?? "credit-card"} size={18} color={pmColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>طريقة الدفع</Text>
                  <Text style={{ color: pmColor, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                    {pmShort[pm] ?? pm}
                  </Text>
                </View>
              </View>
              {detailsVisible && (
                <>
                  <View style={{ height: 1, backgroundColor: pmColor + "33", marginVertical: 4 }} />
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                    <Icon name="credit-card" size={18} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14, flex: 1, textAlign: "right" }}>
                      بيانات السداد
                    </Text>
                  </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                يرجى سداد قيمة الفاتورة على الحساب التالي ثم رفع صورة الإيصال:
              </Text>
              {overrideHandleVal ? (
                <Row label={overrideNameVal ? `${overrideNameVal}` : "رقم السداد"} value={overrideHandleVal} />
              ) : pm === "bank_transfer" ? (
                <View style={{ gap: 6 }}>
                  {ps?.bankName ? <Row label="البنك" value={ps.bankName} /> : null}
                  {ps?.bankAccountName ? <Row label="اسم صاحب الحساب" value={ps.bankAccountName} /> : null}
                  {ps?.bankAccountNumber ? <Row label="رقم الحساب" value={ps.bankAccountNumber} /> : null}
                  {ps?.bankIBAN ? <Row label="IBAN" value={ps.bankIBAN} /> : null}
                </View>
              ) : pm === "ewallet" ? (
                <View style={{ gap: 6 }}>
                  {wallets.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "right" }}>لم تُضف محافظ بعد</Text>}
                  {wallets.map((w) => (
                    <Row key={w.id} label={`${w.provider || "محفظة"}${w.name ? " — " + w.name : ""}`} value={w.number} />
                  ))}
                </View>
              ) : pm === "instapay" ? (
                <View style={{ gap: 6 }}>
                  {ipays.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "right" }}>لم تُضف حسابات انستاباي بعد</Text>}
                  {ipays.map((ip) => (
                    <Row key={ip.id} label={ip.name || "انستاباي"} value={ip.handle} />
                  ))}
                </View>
              ) : null}

              {isStaff && !isLockedByOther && order.status !== "delivered" && order.status !== "shipped" && (
                <View style={{ marginTop: 4, gap: 6 }}>
                  {!showOverrideInput ? (
                    <Pressable
                      onPress={() => {
                        setOverrideHandle(order.paymentOverrideHandle ?? "");
                        setOverrideName(order.paymentOverrideName ?? "");
                        setShowOverrideInput(true);
                      }}
                      style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: colors.radius - 6, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Icon name="edit-2" size={14} color={colors.gold} />
                      <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        {order.paymentOverrideHandle ? "تعديل رقم السداد المخصص" : "إضافة رقم سداد مخصص لهذا الطلب"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: 6, padding: 10, borderRadius: colors.radius - 6, borderWidth: 1, borderColor: colors.gold + "55", backgroundColor: colors.gold + "08" }}>
                      <TextInput
                        value={overrideHandle}
                        onChangeText={setOverrideHandle}
                        placeholder="رقم/حساب السداد"
                        placeholderTextColor={colors.mutedForeground}
                        style={{ backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, color: colors.foreground, textAlign: "right", fontFamily: "Inter_400Regular" }}
                      />
                      <TextInput
                        value={overrideName}
                        onChangeText={setOverrideName}
                        placeholder="اسم صاحب الحساب (اختياري)"
                        placeholderTextColor={colors.mutedForeground}
                        style={{ backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, color: colors.foreground, textAlign: "right", fontFamily: "Inter_400Regular" }}
                      />
                      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                        <Pressable
                          onPress={async () => {
                            const h = overrideHandle.trim();
                            try {
                              await setOrderPaymentOverride(order.id, h ? h : null, overrideName.trim() || null);
                              setShowOverrideInput(false);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch {
                              Alert.alert("خطأ", "تعذّر حفظ بيانات الدفع");
                            }
                          }}
                          style={{ flex: 1, padding: 10, backgroundColor: colors.gold, borderRadius: 8, alignItems: "center" }}
                        >
                          <Text style={{ color: colors.background, fontFamily: "Inter_700Bold" }}>حفظ</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setShowOverrideInput(false)}
                          style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>إلغاء</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Transfer proof image: visible to BOTH customer and staff so the
                  team can verify the transfer. Customer also gets an upload/replace
                  button below. */}
              {order.transferProofImage ? (
                <Pressable onPress={() => setShowTransferProof(true)} style={{ marginTop: 4 }}>
                  <Image source={{ uri: order.transferProofImage }} style={{ width: "100%", height: 180, borderRadius: colors.radius - 6, backgroundColor: colors.surface }} resizeMode="cover" />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center", marginTop: 4, fontFamily: "Inter_400Regular" }}>
                    {isStaff ? "إيصال التحويل من العميل — اضغط للعرض" : "صورة إيصال التحويل — اضغط للعرض"}
                  </Text>
                </Pressable>
              ) : null}

              {isCustomer && order.status !== "delivered" && order.status !== "shipped" && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={async () => {
                      try {
                        setUploadingTransferProof(true);
                        const uri = await pickImage(order.id);
                        if (uri) {
                          await setOrderTransferProof(order.id, uri);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert("تم", "تم رفع إيصال التحويل وإشعار الفريق");
                        }
                      } catch (err) {
                        // UploadFailedError already showed a detailed alert.
                        if (!(err instanceof UploadFailedError)) {
                          Alert.alert("خطأ", "تعذّر حفظ الصورة على الطلب");
                        }
                      } finally {
                        setUploadingTransferProof(false);
                      }
                    }}
                    style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: colors.radius - 6, backgroundColor: colors.gold + "15", borderWidth: 1, borderColor: colors.gold + "44" }}
                  >
                    <Icon name={order.transferProofImage ? "refresh-cw" : "upload"} size={16} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                      {uploadingTransferProof ? "جاري الرفع..." : order.transferProofImage ? "تغيير صورة الإيصال" : "رفع صورة إيصال التحويل"}
                    </Text>
                  </Pressable>

                  {order.status === "pending" && (
                    <Pressable
                      onPress={() => setShowChangeMethodModal(true)}
                      style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: colors.radius - 6, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Icon name="repeat" size={14} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        تغيير طريقة الدفع
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
                </>
              )}
            </View>
          );
        })()}
        <View style={[styles.itemsSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }, cardShadow(colors.isDark, "soft")]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            المنتجات المطلوبة
          </Text>
          {order.items.map((item, index) => (
            <View
              key={index}
              style={[styles.orderItem, { borderBottomColor: colors.border }]}
            >
              <View style={styles.orderItemRight}>
                <View style={[styles.colorSwatch, { backgroundColor: item.colorHex, borderColor: colors.border }]} />
                <View style={styles.orderItemInfo}>
                  <Text style={[styles.orderItemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.orderItemColor, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {item.colorName}
                  </Text>
                  <Text style={{ color: colors.gold + "99", fontFamily: "Inter_500Medium", fontSize: 11 }}>
                    {item.unitPrice} ج.م/{ulbl(unitOf(item))}
                  </Text>
                  {isStaff && order.status === "preparing" && !isLockedByOther && (
                    <Pressable
                      onPress={() => {
                        if (order.editable) {
                          Alert.alert(
                            "التعديل قيد التنفيذ",
                            "لا يمكن تعديل المتوفر بينما العميل يعدّل طلبه. أغلق صلاحية التعديل أولًا أو انتظر حتى يؤكّد العميل الطلب."
                          );
                          return;
                        }
                        setAvailModalIndex(index);
                        setAvailInput(item.stockStatus === "partial" && item.availableQuantity != null ? String(item.availableQuantity) : "");
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        marginTop: 6,
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: colors.radius - 6,
                        borderWidth: 1,
                        borderColor: item.stockStatus === "unavailable" ? "#E74C3C" : item.stockStatus === "partial" ? "#F39C12" : colors.border,
                        backgroundColor: item.stockStatus === "unavailable" ? "#E74C3C18" : item.stockStatus === "partial" ? "#F39C1218" : colors.surface,
                      }}
                    >
                      <Icon
                        name={item.stockStatus ? "alert-triangle" : "package"}
                        size={12}
                        color={item.stockStatus === "unavailable" ? "#E74C3C" : item.stockStatus === "partial" ? "#F39C12" : colors.mutedForeground}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontFamily: "Inter_600SemiBold",
                        color: item.stockStatus === "unavailable" ? "#E74C3C" : item.stockStatus === "partial" ? "#F39C12" : colors.mutedForeground,
                      }}>
                        {item.stockStatus === "unavailable"
                          ? "غير متوفر"
                          : item.stockStatus === "partial"
                            ? `متوفر فقط: ${item.availableQuantity} ${ulbl(unitOf(item))}`
                            : "تحديد المتوفر"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {item.companions?.length ? (
                <View style={[styles.companionList, { backgroundColor: colors.gold + "0D", borderColor: colors.gold + "33" }]}>
                  <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 11, textAlign: "right" }}>الخامات المرافقة</Text>
                  {item.companions.map((companion, companionIndex) => (
                    <View key={`${companion.materialId}-${companionIndex}`} style={{ gap: 5 }}>
                      <View style={styles.companionLine}>
                        <Text style={[styles.companionPrice, { color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 11 }]}>{Math.round(companionLineTotal(companion) * 100) / 100} ج.م</Text>
                        <Text style={[styles.companionText, { color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 11 }]}>
                          {companion.materialName} — {companion.colorName} · {companion.percentage}% · {Math.round(companionAmount(companion) * 100) / 100} {companion.unit === "meter" ? "متر" : "كغ"}
                        </Text>
                      </View>
                      {isStaff && order.status === "preparing" && !isLockedByOther && (
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                            الوزن الفعلي:
                          </Text>
                          <TextInput
                            value={weightTexts[`c_${index}_${companionIndex}`] ?? String(companionAmount(companion))}
                            onChangeText={(value) => {
                              if (/^\d*\.?\d*$/.test(value)) {
                                setWeightTexts((current) => ({ ...current, [`c_${index}_${companionIndex}`]: value }));
                              }
                            }}
                            onBlur={() => {
                              const key = `c_${index}_${companionIndex}`;
                              saveCompanionWeight(index, companionIndex, weightTexts[key] ?? String(companionAmount(companion)));
                            }}
                            onSubmitEditing={() => {
                              const key = `c_${index}_${companionIndex}`;
                              saveCompanionWeight(index, companionIndex, weightTexts[key] ?? String(companionAmount(companion)));
                            }}
                            keyboardType="decimal-pad"
                            textAlign="center"
                            style={{ width: 82, paddingVertical: 5, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.input, color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}
                          />
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                            {companion.unit === "meter" ? "متر" : "كغ"}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={[styles.orderItemLeft, { gap: 10 }]}>
                {item.orderType === "weight" ? (
                  <View style={{ alignItems: "flex-start", gap: 4 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                      {item.weight ?? 1} {ulbl(unitOf(item))}
                    </Text>
                    <Text style={[styles.orderItemPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                      {item.unitPrice * (item.weight ?? 1)} ج.م
                    </Text>
                    {companionTotal(item) > 0 && (
                      <View style={{ alignItems: "flex-start", gap: 2, marginTop: 2 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          الخامات المرافقة: {Math.round(companionTotal(item) * 100) / 100} ج.م
                        </Text>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          إجمالي الصنف: {Math.round(((item.unitPrice * (item.weight ?? 1)) + companionTotal(item)) * 100) / 100} ج.م
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                      ≈ {boltsOf(item.weight, item)} ثوب (الثوب {blt(unitOf(item))} {ulbl(unitOf(item))})
                    </Text>
                    {isStaff && order.status === "preparing" && !isLockedByOther && (
                      <View style={{ gap: 4, marginTop: 2 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          عدد الأثواب:
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => {
                              const pb = blt(unitOf(item));
                              const newWeight = Math.max(pb, (item.weight ?? 0) - pb);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newWeight } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="minus" size={12} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 }}
                            value={weightTexts[`b_${index}`] !== undefined ? weightTexts[`b_${index}`] : String(boltsOf(item.weight, item))}
                            keyboardType="number-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [`b_${index}`]: txt }));
                              const val = parseInt(txt, 10);
                              if (isNaN(val) || val <= 0) return;
                              const pb = blt(unitOf(item));
                              const newWeight = Math.max(pb, val * pb);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newWeight } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                            }}
                            onBlur={() => setWeightTexts(p => { const n = { ...p }; delete n[`b_${index}`]; return n; })}
                          />
                          <Pressable
                            onPress={() => {
                              const pb = blt(unitOf(item));
                              const newWeight = (item.weight ?? 0) + pb;
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newWeight } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="plus" size={12} color={colors.background} />
                          </Pressable>
                        </View>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          {unitOf(item) === "meter" ? "الأمتار الفعلية (متر):" : "الوزن الفعلي (كغ):"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => {
                              const newWeight = Math.max(1, (item.weight ?? 1) - 1);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newWeight } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="minus" size={12} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 }}
                            value={weightTexts[`w_${index}`] !== undefined ? weightTexts[`w_${index}`] : String(item.weight ?? 1)}
                            keyboardType="decimal-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*\.?\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [`w_${index}`]: txt }));
                              const val = parseFloat(txt);
                              if (isNaN(val) || val <= 0) return;
                              const newW = Math.max(0.1, val);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newW } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                            }}
                            onBlur={() => setWeightTexts(p => { const n={...p}; delete n[`w_${index}`]; return n; })}
                          />
                          <Pressable
                            onPress={() => {
                              const newWeight = (item.weight ?? 1) + 1;
                              const newItems = order.items.map((it, i) => i === index ? { ...it, weight: newWeight } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="plus" size={12} color={colors.background} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ alignItems: "flex-start", gap: 4 }}>
                    <Text style={[styles.orderItemQty, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      x{item.quantity} ثوب
                    </Text>
                    {item.actualWeight ? (
                      <View style={{ gap: 2 }}>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                          {item.actualWeight} {ulbl(unitOf(item))}
                        </Text>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          {item.actualWeight * item.unitPrice} ج.م
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 2 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                          ≈ {item.quantity * blt(unitOf(item))} {ulbl(unitOf(item))} (تقديري)
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                          ≈ {item.quantity * blt(unitOf(item)) * item.unitPrice} ج.م (تقديري)
                        </Text>
                      </View>
                    )}
                    {companionTotal(item) > 0 && (
                      <View style={{ alignItems: "flex-start", gap: 2, marginTop: 2 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          الخامات المرافقة: {Math.round(companionTotal(item) * 100) / 100} ج.م
                        </Text>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          إجمالي الصنف: {Math.round(((item.actualWeight ?? (item.quantity * blt(unitOf(item)))) * item.unitPrice + companionTotal(item)) * 100) / 100} ج.م
                        </Text>
                      </View>
                    )}
                    {isStaff && order.status === "preparing" && !isLockedByOther && (
                      <View style={{ gap: 4, marginTop: 2 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          عدد الأثواب:
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => {
                              const newQ = Math.max(1, item.quantity - 1);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, quantity: newQ, actualWeight: newQ * blt(unitOf(item)) } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="minus" size={12} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 }}
                            value={weightTexts[`q_${index}`] !== undefined ? weightTexts[`q_${index}`] : String(item.quantity)}
                            keyboardType="number-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [`q_${index}`]: txt }));
                              const val = parseInt(txt, 10);
                              if (isNaN(val) || val <= 0) return;
                              const newQ = Math.max(1, val);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, quantity: newQ, actualWeight: newQ * blt(unitOf(item)) } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                            }}
                            onBlur={() => setWeightTexts(p => { const n = { ...p }; delete n[`q_${index}`]; return n; })}
                          />
                          <Pressable
                            onPress={() => {
                              const newQ = item.quantity + 1;
                              const newItems = order.items.map((it, i) => i === index ? { ...it, quantity: newQ, actualWeight: newQ * blt(unitOf(item)) } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="plus" size={12} color={colors.background} />
                          </Pressable>
                        </View>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          {unitOf(item) === "meter" ? "الأمتار الفعلية (متر):" : "الوزن الفعلي (كغ):"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => {
                              const curW = item.actualWeight ?? (item.quantity * blt(unitOf(item)));
                              const newW = Math.max(1, curW - 1);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, actualWeight: newW } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="minus" size={12} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 }}
                            value={weightTexts[`a_${index}`] !== undefined ? weightTexts[`a_${index}`] : String(item.actualWeight ?? (item.quantity * blt(unitOf(item))))}
                            keyboardType="decimal-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*\.?\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [`a_${index}`]: txt }));
                              const val = parseFloat(txt);
                              if (isNaN(val) || val <= 0) return;
                              const newW = Math.max(0.1, val);
                              const newItems = order.items.map((it, i) => i === index ? { ...it, actualWeight: newW } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                            }}
                          />
                          <Pressable
                            onPress={() => {
                              const curW = item.actualWeight ?? (item.quantity * blt(unitOf(item)));
                              const newW = curW + 1;
                              const newItems = order.items.map((it, i) => i === index ? { ...it, actualWeight: newW } : it);
                              const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                              const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                              updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="plus" size={12} color={colors.background} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                )}
                {isStaff && order.editable && order.items.length > 1 && (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "حذف الصنف",
                        `هل تريد حذف "${item.productName} — ${item.colorName}" من الطلب؟`,
                        [
                          { text: "إلغاء", style: "cancel" },
                          { text: "حذف", style: "destructive", onPress: () => {
                            const newItems = order.items.filter((_, i) => i !== index);
                            const weightTotal = newItems.filter(i => i.orderType === "weight").reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                            const piecesTotal = newItems.filter(i => i.orderType === "pieces").reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                            updateOrderItems(order.id, newItems, weightTotal + piecesTotal);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }},
                        ]
                      );
                    }}
                    hitSlop={8}
                  >
                    <Icon name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ padding: 16 }}>
          {(() => {
            const fmt = (n: number) => Math.round(n * 100) / 100;
            // Group every item by its measuring unit (kg vs meter). Each group sums
            // both the quantity and the price so we can show "qty — price" on one line.
            const groupsMap: Record<string, { qty: number; price: number; estimated: boolean }> = {};
            for (const it of order.items) {
              const u = unitOf(it) === "meter" ? "meter" : "kg";
              const g = groupsMap[u] ?? { qty: 0, price: 0, estimated: false };
              if (it.orderType === "weight") {
                const q = it.weight ?? 1;
                g.qty += q;
                g.price += it.unitPrice * q;
              } else if (it.actualWeight) {
                g.qty += it.actualWeight;
                g.price += it.actualWeight * it.unitPrice;
              } else {
                const q = it.quantity * blt(u);
                g.qty += q;
                g.price += q * it.unitPrice;
                g.estimated = true;
              }
              groupsMap[u] = g;
            }
            const unitGroups = (["kg", "meter"] as const)
              .filter((u) => groupsMap[u])
              .map((u) => ({ unit: u as string, ...groupsMap[u] }));
             const grand = unitGroups.reduce((a, g) => a + g.price, 0);
             const companionsGrand = order.items.reduce((sum, item) => sum + companionTotal(item), 0);
            const fee = order.paymentMethod === "ewallet" ? (order.paymentFee ?? 0) : 0;
            const hasFee = fee > 0;
             const finalTotal = grand + companionsGrand + fee;
            const anyEstimated = unitGroups.some((g) => g.estimated);
             const showFinal = unitGroups.length > 1 || hasFee || companionsGrand > 0;
            const Badge = ({ estimated }: { estimated: boolean }) => (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: estimated ? "#F39C1222" : "#27AE6022" }}>
                <Text style={{ color: estimated ? "#F39C12" : "#27AE60", fontFamily: "Inter_700Bold", fontSize: 10 }}>
                  {estimated ? "تقديري" : "فعلي"}
                </Text>
              </View>
            );
            return (
              <View style={{ gap: 10 }}>
                {unitGroups.map((g, i) => (
                  <View key={i} style={styles.totalRow}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, flexShrink: 1 }}>
                      <Badge estimated={g.estimated} />
                      <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        minimumFontScale={0.5}
                        style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 16, flexShrink: 1, textAlign: "left" }}
                      >
                        {g.estimated ? "≈ " : ""}{fmt(g.qty)} {ulbl(g.unit)} — {fmt(g.price)} ج.م
                      </Text>
                    </View>
                    <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                      {g.unit === "meter" ? "مجموع الأمتار" : "إجمالي الوزن"}
                    </Text>
                  </View>
                ))}
                 {companionsGrand > 0 && (
                   <View style={styles.totalRow}>
                     <Text style={[styles.totalPrice, { color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }]}>
                       +{fmt(companionsGrand)} ج.م
                     </Text>
                     <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                       إجمالي الخامات المرافقة
                     </Text>
                   </View>
                 )}
                {hasFee && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalPrice, { color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                      +{fee} ج.م
                    </Text>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>
                      رسوم المحفظة الإلكترونية
                    </Text>
                  </View>
                )}
                {showFinal && (
                  <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                    <Text style={[styles.totalPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                      {anyEstimated ? "≈ " : ""}{fmt(finalTotal)} ج.م
                    </Text>
                    <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {anyEstimated ? "الإجمالي التقديري" : "الإجمالي النهائي"}
                    </Text>
                  </View>
                )}
                {anyEstimated && (
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
                    تقدير تقريبي لكل ثوب (يُحدَّد الوزن/الأمتار عند التجهيز)
                  </Text>
                )}
              </View>
            );
          })()}
          </View>
        </View>

        {order.notes && (
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }, cardShadow(colors.isDark, "soft")]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              ملاحظات
            </Text>
            <Text style={[styles.notesText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {order.notes}
            </Text>
          </View>
        )}

        {(() => {
          // Staff: only show invoice button at the second-to-last stage onwards
          // (pickup: ready/delivered, shipping: shipped/delivered).
          // Customers: from the shipped stage onwards.
          const isFinalOrNear =
            order.status === "ready" ||
            order.status === "ready_to_ship" ||
            order.status === "delivered" ||
            order.status === "shipped";
          // Customers see the invoice from the shipped stage onwards.
          const isCustomerVisible =
            order.status === "shipped" || order.status === "delivered";
          const visible = isStaff ? isFinalOrNear : isCustomerVisible;
          if (!visible) return null;
          return (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowInvoiceModal(true);
            }}
            style={({ pressed }) => [{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              backgroundColor: colors.gold + "15",
              borderColor: colors.gold + "55",
              borderWidth: 1.5,
              borderRadius: colors.radius - 4,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Icon name="file-text" size={18} color={colors.gold} />
            <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              عرض الفاتورة
            </Text>
          </Pressable>
          );
        })()}

        {isStaff && order.status === "preparing" && !isLockedByOther && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPackingSlipModal(true);
            }}
            style={({ pressed }) => [{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              backgroundColor: "#F39C1215",
              borderColor: "#F39C1266",
              borderWidth: 1.5,
              borderRadius: colors.radius - 4,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Icon name="printer" size={18} color="#D88700" />
            <Text style={{ color: "#D88700", fontFamily: "Inter_700Bold", fontSize: 14 }}>
              طباعة ورقة التجهيز
            </Text>
          </Pressable>
        )}


        {isStaff && order.status !== "cancelled" && (() => {
          const nextAction = getNextAction(order.status, order.fulfillmentType);
          const prevAction = getPrevAction(order.status, order.fulfillmentType);
          // Final stage (shipping → "shipped", pickup → "delivered") revert is gated:
          // admin always; other staff only with the "revert_final" permission.
          // Earlier (non-final) stages stay revertable by any staff.
          const isFinalStage = order.status === "shipped" || order.status === "delivered";
          const canStaffRevert = isFinalStage
            ? (isAdmin || (isStaff && (user?.permissions ?? []).includes("revert_final")))
            : isStaff;
          return (
            <View style={styles.actionRow}>
              {canStaffRevert && prevAction && !isLockedByOther && (
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "تأكيد الرجوع للمرحلة السابقة",
                      `هل تريد بالتأكيد "${prevAction.label}"؟ سيتم إعلام العميل بتغير حالة الطلب.`,
                      [
                        { text: "إلغاء", style: "cancel" },
                        { text: "نعم، ارجع", style: "destructive", onPress: () => updateOrderStatus(order.id, prevAction.prev) },
                      ]
                    );
                  }}
                  style={[styles.prevBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 4 }]}
                >
                  <Icon name="chevron-right" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.prevBtnText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {prevAction.label}
                  </Text>
                </Pressable>
              )}
              {nextAction && !isLockedByOther && (
                <GoldButton
                  label={nextAction.label}
                  onPress={() => {
                    if (nextAction.next === "shipped" && !order.shippingWaybillImage && !order.shippingWaybillNumber) {
                      Alert.alert("بوليصة الشحن مطلوبة", "يجب رفع صورة بوليصة الشحن أو إدخال رقم البوليصة قبل تأكيد الشحن.", [
                        { text: "حسناً", style: "cancel" },
                        { text: "رفع البوليصة", onPress: () => {
                          setWaybillNumberInput(order.shippingWaybillNumber ?? "");
                          setWaybillProviderInput(order.shippingProviderId ?? null);
                          setWaybillImageInput(order.shippingWaybillImage ?? null);
                          setShowWaybillModal(true);
                        }},
                      ]);
                      return;
                    }
                    const doAdvance = async () => {
                      if (nextAction.next === "ready" || nextAction.next === "ready_to_ship") {
                        const hasPiecesWithoutWeight = order.items.some(
                          (i) => i.orderType === "pieces" && !i.actualWeight
                        );
                        if (hasPiecesWithoutWeight) {
                          const newItems = order.items.map((i) => {
                            if (i.orderType === "pieces" && !i.actualWeight) {
                              return { ...i, actualWeight: i.quantity * blt(unitOf(i)) };
                            }
                            return i;
                          });
                          const weightTotal = newItems
                            .filter((i) => i.orderType === "weight")
                            .reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
                          const piecesTotal = newItems
                            .filter((i) => i.orderType === "pieces")
                            .reduce((a, b) => a + (b.actualWeight ?? (b.quantity * blt(unitOf(b)))) * b.unitPrice, 0);
                          try { await updateOrderItems(order.id, newItems, weightTotal + piecesTotal, true); } catch {}
                        }
                      }
                      if (nextAction.next === "received" && user?.role !== "admin") {
                        updateOrderStatus(order.id, nextAction.next, user?.id, user?.name);
                      } else {
                        updateOrderStatus(order.id, nextAction.next);
                      }
                    };
                    Alert.alert(
                      "تأكيد الانتقال للمرحلة التالية",
                      `هل تريد بالتأكيد "${nextAction.label}"؟ سيتم إعلام العميل بتغير حالة الطلب.`,
                      [
                        { text: "إلغاء", style: "cancel" },
                        { text: "نعم، تابع", style: "default", onPress: doAdvance },
                      ]
                    );
                  }}
                  style={{ flex: 1 }}
                />
              )}
              {nextAction && isLockedByOther && (
                <View style={[styles.lockedMsg, { backgroundColor: colors.surface, borderRadius: colors.radius - 4 }]}>
                  <Icon name="lock" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "right" }}>
                    هذا الطلب مستلم من {order.assignedToName ?? "موظف آخر"}
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {isStaff && order.editable && order.status !== "cancelled" && !isLockedByOther && (
          <Pressable
            onPress={() => {
              Alert.alert(
                "إغلاق تعديل العميل",
                "هل تريد إغلاق صلاحية التعديل؟ لن يستطيع العميل تعديل الطلب بعد ذلك.",
                [
                  { text: "تراجع", style: "cancel" },
                  {
                    text: "نعم، أغلق التعديل",
                    style: "destructive",
                    onPress: () => {
                      setOrderEditable(order.id, false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    },
                  },
                ]
              );
            }}
            style={[styles.editableBtn, {
              backgroundColor: "#F39C1222",
              borderColor: "#F39C12",
              borderRadius: colors.radius - 4,
            }]}
          >
            <Icon name="x-circle" size={14} color="#F39C12" />
            <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              إغلاق تعديل العميل
            </Text>
          </Pressable>
        )}

        {isStaff && order.status === "preparing" && !order.editable && hasAffectedItems && !isLockedByOther && (
          <Pressable
            onPress={() => {
              Alert.alert(
                "فتح التعديل للعميل",
                "سيتم إعلام العميل ليعدّل طلبه خلال المهلة المحددة. لن تتمكن من تعديل المتوفر حتى ينهي العميل تعديله أو تُغلق التعديل. هل تريد المتابعة؟",
                [
                  { text: "تراجع", style: "cancel" },
                  {
                    text: "نعم، افتح التعديل",
                    onPress: () => {
                      setOrderEditable(order.id, true);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                  },
                ]
              );
            }}
            style={[styles.editableBtn, {
              backgroundColor: "#27AE6018",
              borderColor: "#27AE60",
              borderRadius: colors.radius - 4,
            }]}
          >
            <Icon name="edit-3" size={14} color="#27AE60" />
            <Text style={{ color: "#27AE60", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              فتح التعديل للعميل
            </Text>
          </Pressable>
        )}


        {/* Fix 2: customer can cancel within 5 minutes from order detail page */}
        {isCustomer && (order.status === "scheduled" || (order.status === "pending" && (Date.now() - new Date(order.createdAt).getTime() < FIVE_MINUTES_MS))) && (() => {
          const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
          const remainingMin = order.status === "scheduled"
            ? -1
            : Math.max(0, Math.ceil((FIVE_MINUTES_MS - elapsedMs) / 60000));
          return (
            <Pressable
              onPress={() => {
                Alert.alert(
                  "إلغاء الطلب",
                  "هل أنت متأكد من إلغاء هذا الطلب؟ لن يمكنك التراجع.",
                  [
                    { text: "تراجع", style: "cancel" },
                    {
                      text: "نعم، ألغِ الطلب",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          await cancelOrder(order.id);
                          router.back();
                        } catch {
                          Alert.alert("خطأ", "تعذّر إلغاء الطلب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
                        }
                      },
                    },
                  ]
                );
              }}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: "#E74C3C66",
                backgroundColor: "#E74C3C14",
              }}
            >
              <Icon name="x-circle" size={18} color="#E74C3C" />
              <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {remainingMin < 0
                  ? "إلغاء الطلب المعلّق"
                  : `إلغاء الطلب (متبقي ~${remainingMin} ${remainingMin === 1 ? "دقيقة" : "دقائق"})`}
              </Text>
            </Pressable>
          );
        })()}

        {isCustomer && order.editable && order.status !== "cancelled" && (
          <View
            onLayout={(e) => { const y = e.nativeEvent.layout.y; setEditSectionY((prev) => (prev === y ? prev : y)); }}
            style={[styles.editableCustomerCard, { backgroundColor: "#F39C1218", borderColor: "#F39C12", borderRadius: colors.radius }]}
          >
            <View style={styles.editableCustomerHeader}>
              <Icon name="alert-triangle" size={16} color="#F39C12" />
              <Text style={{ color: "#F39C12", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right", flex: 1 }}>
                خامة غير متوفرة — يمكنك تعديل طلبك
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right", lineHeight: 20 }}>
              {hasAffectedItems
                ? "حدّد فريق العمل الكميات المتوفرة من الأصناف التالية. أكّد التعديل لقبولها، أو عدّل طلبك لاختيار بديل."
                : "تم إعلامك بأن أحد الأصناف غير متوفر. يمكنك الآن تعديل الطلب واختيار بديل أو تعديل الكميات."}
            </Text>

            {order.items.map((item, index) => {
              if (!item.stockStatus) return null;
              const isUnavailable = item.stockStatus === "unavailable";
              return (
                <View
                  key={`aff_${index}`}
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: isUnavailable ? "#E74C3C55" : "#F39C1255",
                    borderRadius: colors.radius - 4,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                    <View style={[styles.colorSwatch, { backgroundColor: item.colorHex, borderColor: colors.border }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>
                        {item.productName} — {item.colorName}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 2 }}>
                        الكمية المطلوبة: {item.orderType === "weight" ? `${item.weight ?? 1} ${ulbl(unitOf(item))}` : `${item.quantity} ثوب`}
                      </Text>
                    </View>
                  </View>

                  {isUnavailable ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#E74C3C18", borderRadius: colors.radius - 6, padding: 8 }}>
                      <Icon name="x-circle" size={14} color="#E74C3C" />
                      <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 12, flex: 1, textAlign: "right" }}>
                        غير متوفر — سيُحذف عند تأكيد التعديل
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#F39C1218", borderRadius: colors.radius - 6, padding: 8 }}>
                      <Icon name="alert-triangle" size={14} color="#F39C12" />
                      <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 12, flex: 1, textAlign: "right" }}>
                        متوفر فقط: {item.availableQuantity} {ulbl(unitOf(item))} — سيتم تعديل الكمية للمتوفر عند التأكيد
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {order.editable && (
                <Pressable
                  onPress={handleConfirmEdit}
                  disabled={confirmingEdit}
                  style={{
                    flex: 1,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: "#27AE60",
                    backgroundColor: "#27AE60",
                    opacity: confirmingEdit ? 0.6 : 1,
                  }}
                >
                  <Icon name="check-circle" size={18} color={colors.background} />
                  <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    {confirmingEdit ? "جاري الحفظ..." : "تأكيد التعديل"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  beginOrderEdit(order.id);
                  router.push("/cart" as any);
                }}
                style={{
                  flex: 1,
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: colors.radius,
                  backgroundColor: "#E74C3C",
                }}
              >
                <Icon name="edit-3" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  تعديل الطلب
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleCustomerCancelOrder}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 14,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: "#E74C3C66",
                backgroundColor: "#E74C3C14",
              }}
            >
              <Icon name="x-circle" size={18} color="#E74C3C" />
              <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                إلغاء الطلب
              </Text>
            </Pressable>
          </View>
        )}

        {null /* Sales/wholesale contact card removed per request — keep customer-facing screens free of contact phone numbers. */}

        {(() => {
          const orderReturn = returnRequests.find((r) => r.orderId === order.id && r.status !== "cancelled");
          const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
          const hoursSinceDelivery = deliveredAt ? (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60) : 0;
          const canReturn = isCustomer && order.status === "delivered" && order.deliveredAt && !orderReturn && hoursSinceDelivery >= 1;
          const daysSinceDelivery = deliveredAt ? Math.floor((Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)) : 999;
          const withinReturnWindow = daysSinceDelivery <= 15;

          return (
            <>
              {orderReturn && (
                <Pressable
                  onPress={() => router.push(`/return/${orderReturn.id}`)}
                  style={({ pressed }) => [styles.returnStatusCard, {
                    backgroundColor: "#C0392B11",
                    borderColor: "#C0392B44",
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Icon name="rotate-ccw" size={18} color="#C0392B" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#C0392B", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" }}>
                        يوجد طلب استرجاع لهذا الطلب
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                        {orderReturn.status === "settled" ? "تمت المخالصة" : orderReturn.status === "returned" ? "تم الاسترجاع — بانتظار المخالصة" : "قيد المراجعة"}
                      </Text>
                    </View>
                    <Icon name="chevron-left" size={16} color="#C0392B" />
                  </View>
                </Pressable>
              )}

              {canReturn && withinReturnWindow && !showReturnForm && (
                <Pressable
                  onPress={() => setShowReturnForm(true)}
                  style={[styles.returnBtn, { backgroundColor: "#C0392B18", borderColor: "#C0392B", borderRadius: colors.radius }]}
                >
                  <Icon name="rotate-ccw" size={16} color="#C0392B" />
                  <Text style={{ color: "#C0392B", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    طلب استرجاع
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    متاح خلال {15 - daysSinceDelivery} يوم
                  </Text>
                </Pressable>
              )}

              {canReturn && !withinReturnWindow && (
                <View style={[styles.returnExpired, { backgroundColor: colors.surface, borderRadius: colors.radius }]}>
                  <Icon name="clock" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    انتهت مهلة الاسترجاع (15 يوم من التسليم)
                  </Text>
                </View>
              )}

              {showReturnForm && (
                <View style={[styles.returnFormCard, { backgroundColor: colors.card, borderColor: "#C0392B", borderRadius: colors.radius }]}>
                  <Text style={{ color: "#C0392B", fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "right" }}>
                    طلب استرجاع
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", marginTop: 4 }}>
                    اختر الأصناف التي تريد استرجاعها واكتب السبب
                  </Text>

                  <View style={{ gap: 6, marginTop: 8 }}>
                    <Pressable
                      onPress={() => {
                        const allSelected = order.items.every((_, i) => returnSelectedItems[i]);
                        const newState: Record<number, boolean> = {};
                        order.items.forEach((_, i) => { newState[i] = !allSelected; });
                        setReturnSelectedItems(newState);
                      }}
                      style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 6 }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                        borderColor: order.items.every((_, i) => returnSelectedItems[i]) ? "#C0392B" : colors.border,
                        backgroundColor: order.items.every((_, i) => returnSelectedItems[i]) ? "#C0392B" : "transparent",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        {order.items.every((_, i) => returnSelectedItems[i]) && <Icon name="check" size={12} color="#fff" />}
                      </View>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>تحديد الكل</Text>
                    </Pressable>

                    {order.items.map((item, index) => {
                      const isWeight = item.orderType === "weight";
                      const unitIsMeter = (item as any).unit === "meter" || products.find(p => p.id === item.productId)?.unit === "meter";
                      const measureLabel = unitIsMeter ? "متر" : "كغ";
                      const perBolt = unitIsMeter ? 100 : 20;
                      const maxBolts = item.quantity > 0 ? item.quantity : Math.max(1, Math.ceil((item.weight ?? perBolt) / perBolt));
                      const maxWeight = isWeight ? (item.weight ?? 1) : (item.actualWeight ?? item.quantity * perBolt);
                      const curBolts = returnItemBolts[index] ?? maxBolts;
                      const curWeight = returnItemWeights[index] ?? maxWeight;
                      return (
                        <View key={index} style={{ gap: 4 }}>
                          <Pressable
                            onPress={() => {
                              setReturnSelectedItems((prev) => ({ ...prev, [index]: !prev[index] }));
                              if (!returnItemWeights[index]) {
                                setReturnItemWeights((prev) => ({ ...prev, [index]: maxWeight }));
                              }
                              if (!returnItemBolts[index]) {
                                setReturnItemBolts((prev) => ({ ...prev, [index]: maxBolts }));
                              }
                            }}
                            style={[{
                              flexDirection: "row-reverse",
                              alignItems: "center",
                              gap: 10,
                              paddingVertical: 8,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              backgroundColor: returnSelectedItems[index] ? "#C0392B11" : colors.surface,
                              borderWidth: 1,
                              borderColor: returnSelectedItems[index] ? "#C0392B44" : colors.border,
                            }]}
                          >
                            <View style={{
                              width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                              borderColor: returnSelectedItems[index] ? "#C0392B" : colors.border,
                              backgroundColor: returnSelectedItems[index] ? "#C0392B" : "transparent",
                              alignItems: "center", justifyContent: "center",
                            }}>
                              {returnSelectedItems[index] && <Icon name="check" size={12} color="#fff" />}
                            </View>
                            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.colorHex, borderWidth: 1, borderColor: colors.border }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "right" }}>
                                {item.productName}
                              </Text>
                              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                                {item.colorName} — {item.quantity} ثوب · {maxWeight} {measureLabel}
                              </Text>
                            </View>
                          </Pressable>
                          {returnSelectedItems[index] && (
                            <View style={{ gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, width: 90, textAlign: "right" }}>
                                  عدد الأثواب:
                                </Text>
                                <Pressable
                                  onPress={() => setReturnItemBolts((prev) => ({ ...prev, [index]: Math.max(1, curBolts - 1) }))}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                                >
                                  <Icon name="minus" size={10} color="#C0392B" />
                                </Pressable>
                                <TextInput
                                  style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12, minWidth: 36, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 1 }}
                                  value={returnBoltTexts[index] !== undefined ? returnBoltTexts[index] : String(curBolts)}
                                  keyboardType="number-pad"
                                  onChangeText={(txt) => {
                                    if (!/^\d*$/.test(txt)) return;
                                    setReturnBoltTexts(p => ({ ...p, [index]: txt }));
                                    const val = parseInt(txt, 10);
                                    if (isNaN(val) || val <= 0 || val > maxBolts) return;
                                    setReturnItemBolts((prev) => ({ ...prev, [index]: val }));
                                  }}
                                  onBlur={() => setReturnBoltTexts(p => { const n={...p}; delete n[index]; return n; })}
                                />
                                <Pressable
                                  onPress={() => setReturnItemBolts((prev) => ({ ...prev, [index]: Math.min(maxBolts, curBolts + 1) }))}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#C0392B", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Icon name="plus" size={10} color="#fff" />
                                </Pressable>
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                                  (من {maxBolts})
                                </Text>
                              </View>
                              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, width: 90, textAlign: "right" }}>
                                  {unitIsMeter ? "الطول (متر):" : "الوزن (كغ):"}
                                </Text>
                                <Pressable
                                  onPress={() => setReturnItemWeights((prev) => ({ ...prev, [index]: Math.max(1, curWeight - 1) }))}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                                >
                                  <Icon name="minus" size={10} color="#C0392B" />
                                </Pressable>
                                <TextInput
                                  style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12, minWidth: 36, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 1 }}
                                  value={returnWeightTexts[index] !== undefined ? returnWeightTexts[index] : String(curWeight)}
                                  keyboardType="decimal-pad"
                                  onChangeText={(txt) => {
                                    if (!/^\d*\.?\d*$/.test(txt)) return;
                                    setReturnWeightTexts(p => ({ ...p, [index]: txt }));
                                    const val = parseFloat(txt);
                                    if (isNaN(val) || val <= 0 || val > maxWeight) return;
                                    setReturnItemWeights((prev) => ({ ...prev, [index]: val }));
                                  }}
                                  onBlur={() => setReturnWeightTexts(p => { const n={...p}; delete n[index]; return n; })}
                                />
                                <Pressable
                                  onPress={() => setReturnItemWeights((prev) => ({ ...prev, [index]: Math.min(maxWeight, curWeight + 1) }))}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#C0392B", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Icon name="plus" size={10} color="#fff" />
                                </Pressable>
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                                  {measureLabel} (من {maxWeight})
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  <TextInput
                    style={[styles.returnInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", borderRadius: colors.radius - 4 }]}
                    placeholder="سبب الاسترجاع..."
                    placeholderTextColor={colors.mutedForeground}
                    value={returnReason}
                    onChangeText={setReturnReason}
                    multiline
                    textAlign="right"
                  />

                  <View style={{ marginTop: 10, gap: 8 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>
                      صورة المشكلة (اختياري)
                    </Text>
                    <Pressable
                      onPress={async () => {
                        try {
                          setUploadingReturnProblem(true);
                          const uri = await pickImage(order.id);
                          if (uri) {
                            setReturnProblemImage(uri);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                        } catch (err) {
                          if (!(err instanceof UploadFailedError)) {
                            Alert.alert("خطأ", "تعذّر رفع الصورة");
                          }
                        } finally {
                          setUploadingReturnProblem(false);
                        }
                      }}
                      style={({ pressed }) => [{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 10,
                        backgroundColor: returnProblemImage ? "#C0392B11" : colors.surface,
                        borderColor: returnProblemImage ? "#C0392B44" : colors.border,
                        borderWidth: 1,
                        borderRadius: colors.radius - 4,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Icon name={returnProblemImage ? "check-circle" : "camera"} size={16} color={returnProblemImage ? "#C0392B" : colors.mutedForeground} />
                      <Text style={{ color: returnProblemImage ? "#C0392B" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        {uploadingReturnProblem ? "جاري الرفع..." : returnProblemImage ? "تم رفع صورة المشكلة — تغيير" : "رفع صورة المشكلة"}
                      </Text>
                    </Pressable>
                    {returnProblemImage && (
                      <Image
                        source={{ uri: returnProblemImage }}
                        style={{ width: "100%", height: 120, borderRadius: colors.radius - 4, backgroundColor: colors.surface }}
                        resizeMode="cover"
                      />
                    )}
                  </View>

                  <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 8 }}>
                    <GoldButton
                      label={submittingReturn ? "جاري الإرسال..." : "إرسال طلب الاسترجاع"}
                      onPress={async () => {
                        const selectedItems = order.items
                          .map((item, i) => {
                            if (!returnSelectedItems[i]) return null;
                            const isW = item.orderType === "weight";
                            const unitIsMeter = (item as any).unit === "meter" || products.find(p => p.id === item.productId)?.unit === "meter";
                            const perBolt = unitIsMeter ? 100 : 20;
                            const maxBolts = item.quantity > 0 ? item.quantity : Math.max(1, Math.ceil((item.weight ?? perBolt) / perBolt));
                            const maxWeight = isW ? (item.weight ?? 1) : (item.actualWeight ?? item.quantity * perBolt);
                            const retBolts = returnItemBolts[i] ?? maxBolts;
                            const retWeight = returnItemWeights[i] ?? maxWeight;
                            return {
                              ...item,
                              quantity: retBolts,
                              ...(isW ? { weight: retWeight } : { actualWeight: retWeight }),
                            };
                          })
                          .filter(Boolean) as typeof order.items;
                        if (selectedItems.length === 0) {
                          Alert.alert("خطأ", "يرجى اختيار صنف واحد على الأقل");
                          return;
                        }
                        if (!returnReason.trim()) {
                          Alert.alert("خطأ", "يرجى كتابة سبب الاسترجاع");
                          return;
                        }
                        setSubmittingReturn(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await addReturnRequest({
                          id: `ret_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                          orderId: order.id,
                          userId: user?.id ?? "",
                          userName: user?.name ?? "",
                          userPhone: user?.phone ?? "",
                          items: selectedItems,
                          reason: returnReason.trim(),
                          status: "pending",
                          createdAt: new Date().toISOString(),
                          ...(returnProblemImage ? { problemImage: returnProblemImage } : {}),
                        });
                        setSubmittingReturn(false);
                        setShowReturnForm(false);
                        setReturnReason("");
                        setReturnSelectedItems({});
                        setReturnItemWeights({});
                        setReturnItemBolts({});
                        setReturnProblemImage(null);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert("تم", "تم إرسال طلب الاسترجاع وسيتم مراجعته");
                      }}
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      onPress={() => { setShowReturnForm(false); setReturnReason(""); setReturnSelectedItems({}); setReturnItemWeights({}); setReturnItemBolts({}); setReturnProblemImage(null); }}
                      style={[styles.msgCancelBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
                    >
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>إلغاء</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          );
        })()}

        {canDeleteOrders && (
          <Pressable
            onPress={() =>
              Alert.alert(
                "حذف نهائي",
                `هل أنت متأكد من حذف الطلب #${order.id.slice(0, 12)} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
                [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "حذف نهائياً",
                    style: "destructive",
                    onPress: () => {
                      deleteOrder(order.id);
                      router.back();
                    },
                  },
                ]
              )
            }
            style={[styles.deleteBtn, { borderColor: "#C0392B44", backgroundColor: "#C0392B11" }]}
          >
            <Icon name="trash-2" size={14} color="#C0392B" />
            <Text style={[styles.deleteBtnText, { color: "#C0392B", fontFamily: "Inter_500Medium" }]}>
              حذف الطلب نهائياً
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScroll>

      {order.transferProofImage && (
        <Modal visible={showTransferProof} transparent animationType="fade" onRequestClose={() => setShowTransferProof(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" }}>
            <Pressable
              onPress={() => setShowTransferProof(false)}
              style={{ position: "absolute", top: insets.top + 16, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="x" size={22} color="#fff" />
            </Pressable>
            <Image source={{ uri: order.transferProofImage }} style={{ width: "92%", height: "65%", borderRadius: 12 }} resizeMode="contain" />
            <View style={{ position: "absolute", bottom: insets.bottom + 24, left: 16, right: 16, flexDirection: "row-reverse", gap: 10 }}>
              <Pressable
                onPress={() => order.transferProofImage && saveImageToDevice(order.transferProofImage, `transfer_${order.id.slice(0, 12)}`)}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="download" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>حفظ في الجهاز</Text>
              </Pressable>
              <Pressable
                onPress={() => order.transferProofImage && shareImage(order.transferProofImage, `transfer_${order.id.slice(0, 12)}`)}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="share-2" size={18} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>مشاركة</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showPackingSlipModal} transparent animationType="slide" onRequestClose={() => setShowPackingSlipModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}>
          <View style={{ flex: 1, marginTop: insets.top + 40, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12, backgroundColor: colors.background }}>
              <Icon name="printer" size={20} color="#D88700" />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "right" }}>
                معاينة ورقة التجهيز #{order.id.slice(0, 12)}
              </Text>
              <Pressable onPress={() => setShowPackingSlipModal(false)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
                <Icon name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <WebView
              originWhitelist={["*"]}
              source={{ html: buildPackingSlipHtml(order, products) }}
              style={{ flex: 1, backgroundColor: "#fff" }}
              scalesPageToFit
              javaScriptEnabled={false}
              showsVerticalScrollIndicator
            />

            <View style={{ flexDirection: "row-reverse", gap: 10, padding: 14, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
              <Pressable
                onPress={async () => {
                  try {
                    setPrintingPackingSlip(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await Print.printAsync({ html: buildPackingSlipHtml(order, products) });
                  } catch (e: any) {
                    if (!/cancel/i.test(String(e?.message ?? ""))) {
                      Alert.alert("خطأ", "تعذّر فتح نافذة الطباعة");
                    }
                  } finally {
                    setPrintingPackingSlip(false);
                  }
                }}
                disabled={printingPackingSlip}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius - 4, backgroundColor: "#D8B45A", opacity: (pressed || printingPackingSlip) ? 0.7 : 1 })}
              >
                <Icon name="printer" size={18} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 14 }}>
                  {printingPackingSlip ? "جاري التحضير..." : "طباعة"}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    setPrintingPackingSlip(true);
                    const html = buildPackingSlipHtml(order, products);
                    const { uri } = await Print.printToFileAsync({ html, base64: false });
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(uri, {
                        mimeType: "application/pdf",
                        dialogTitle: `ورقة تجهيز #${order.id.slice(0, 12)}`,
                        UTI: "com.adobe.pdf",
                      });
                    } else {
                      Alert.alert("تم الإنشاء", "تم إنشاء ملف ورقة التجهيز.");
                    }
                  } catch (e: any) {
                    Alert.alert("خطأ", `تعذّر إنشاء ملف ورقة التجهيز\n${String(e?.message ?? e ?? "")}`);
                  } finally {
                    setPrintingPackingSlip(false);
                  }
                }}
                disabled={printingPackingSlip}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius - 4, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "#D8B45A88", opacity: (pressed || printingPackingSlip) ? 0.7 : 1 })}
              >
                <Icon name="file-down" size={18} color="#D88700" />
                <Text style={{ color: "#D88700", fontFamily: "Inter_700Bold", fontSize: 14 }}>PDF</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showInvoiceModal} transparent animationType="slide" onRequestClose={() => setShowInvoiceModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}>
          <View style={{ flex: 1, marginTop: insets.top + 40, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12, backgroundColor: colors.background }}>
              <Icon name="file-text" size={20} color={colors.gold} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "right" }}>
                معاينة الفاتورة #{order.id.slice(0, 12)}
              </Text>
              <Pressable onPress={() => setShowInvoiceModal(false)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
                <Icon name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <WebView
              originWhitelist={["*"]}
              source={{ html: buildInvoiceHtml(order, settings) }}
              style={{ flex: 1, backgroundColor: "#fff" }}
              scalesPageToFit
              javaScriptEnabled={false}
              showsVerticalScrollIndicator
            />


            <View style={{ flexDirection: "row-reverse", gap: 10, padding: 14, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
              <Pressable
                onPress={async () => {
                  try {
                    setPrintingInvoice(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const html = buildInvoiceHtml(order, settings);
                    await Print.printAsync({ html });
                  } catch (e: any) {
                    if (!/cancel/i.test(String(e?.message ?? ""))) {
                      Alert.alert("خطأ", "تعذّر فتح نافذة الطباعة");
                    }
                  } finally {
                    setPrintingInvoice(false);
                  }
                }}
                disabled={printingInvoice}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius - 4, backgroundColor: colors.gold, opacity: (pressed || printingInvoice) ? 0.7 : 1 })}
              >
                <Icon name="printer" size={18} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 14 }}>
                  {printingInvoice ? "جاري التحضير..." : "طباعة"}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    setPrintingInvoice(true);
                    const html = buildInvoiceHtml(order, settings);
                    const { uri } = await Print.printToFileAsync({ html, base64: false });
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(uri, {
                        mimeType: "application/pdf",
                        dialogTitle: `فاتورة #${order.id.slice(0, 12)}`,
                        UTI: "com.adobe.pdf",
                      });
                    } else {
                      Alert.alert("تم الإنشاء", "تم إنشاء ملف الفاتورة.");
                    }
                  } catch (e: any) {
                    Alert.alert("خطأ", `تعذّر إنشاء ملف الفاتورة\n${String(e?.message ?? e ?? "")}`);
                  } finally {
                    setPrintingInvoice(false);
                  }
                }}
                disabled={printingInvoice}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: colors.radius - 4, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.gold + "55", opacity: (pressed || printingInvoice) ? 0.7 : 1 })}
              >
                <Icon name="file-down" size={18} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 14 }}>PDF</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {order.shippingWaybillImage && (
        <Modal visible={showWaybillPreview} transparent animationType="fade" onRequestClose={() => setShowWaybillPreview(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" }}>
            <Pressable
              onPress={() => setShowWaybillPreview(false)}
              style={{ position: "absolute", top: insets.top + 16, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="x" size={22} color="#fff" />
            </Pressable>
            <Image source={{ uri: order.shippingWaybillImage }} style={{ width: "92%", height: "65%", borderRadius: 12 }} resizeMode="contain" />
            <View style={{ position: "absolute", bottom: insets.bottom + 24, left: 16, right: 16, flexDirection: "row-reverse", gap: 10 }}>
              <Pressable
                onPress={() => order.shippingWaybillImage && saveImageToDevice(order.shippingWaybillImage, `waybill_${order.id.slice(0, 12)}`)}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="download" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>حفظ في الجهاز</Text>
              </Pressable>
              <Pressable
                onPress={() => order.shippingWaybillImage && shareImage(order.shippingWaybillImage, `waybill_${order.id.slice(0, 12)}`)}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="share-2" size={18} color="#000" />
                <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>مشاركة</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showWaybillModal} transparent animationType="fade" onRequestClose={() => setShowWaybillModal(false)}>
        <Pressable onPress={() => setShowWaybillModal(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "right" }}>بيانات الشحن</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "right" }}>اختر شركة الشحن</Text>
            <View style={{ gap: 6 }}>
              {((settings.shippingProviders && settings.shippingProviders.length > 0) ? settings.shippingProviders : SHIPPING_PROVIDER_DEFAULTS)
                .filter((p) => p.enabled !== false)
                .map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setWaybillProviderInput(p.id)}
                    style={{ flexDirection: "row-reverse", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: waybillProviderInput === p.id ? colors.gold : colors.border, backgroundColor: waybillProviderInput === p.id ? colors.gold + "15" : colors.surface }}
                  >
                    <Icon name={waybillProviderInput === p.id ? "check-circle" : "circle"} size={16} color={waybillProviderInput === p.id ? colors.gold : colors.mutedForeground} />
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: "right", marginRight: 8 }}>{p.name}</Text>
                  </Pressable>
                ))}
            </View>
            <TextInput
              value={waybillNumberInput}
              onChangeText={setWaybillNumberInput}
              placeholder="رقم البوليصة"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, color: colors.foreground, textAlign: "right", fontFamily: "Inter_500Medium" }}
            />
            <Pressable
              onPress={async () => {
                if (!waybillProviderInput) {
                  Alert.alert("تنبيه", "اختر شركة الشحن أولاً");
                  return;
                }
                const providers = (settings.shippingProviders && settings.shippingProviders.length > 0) ? settings.shippingProviders : SHIPPING_PROVIDER_DEFAULTS;
                const providerName = providers.find((p) => p.id === waybillProviderInput)?.name ?? "";
                if (waybillImageInput) {
                  Alert.alert(
                    "حذف الصورة",
                    "هل تريد حذف صورة البوليصة؟ سيبقى رقم البوليصة كما هو.",
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "حذف الصورة",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            setUploadingWaybill(true);
                            await setOrderShipping(order.id, {
                              providerId: waybillProviderInput,
                              providerName,
                              waybillImage: null,
                              waybillNumber: waybillNumberInput.trim() || null,
                            });
                            setWaybillImageInput(null);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          } catch {
                            Alert.alert("خطأ", "تعذّر حذف الصورة");
                          } finally {
                            setUploadingWaybill(false);
                          }
                        },
                      },
                    ]
                  );
                  return;
                }
                try {
                  setUploadingWaybill(true);
                  const uri = await pickImage(order.id);
                  if (!uri) {
                    setUploadingWaybill(false);
                    return;
                  }
                  await setOrderShipping(order.id, {
                    providerId: waybillProviderInput,
                    providerName,
                    waybillImage: uri,
                    waybillNumber: waybillNumberInput.trim() || null,
                  });
                  setWaybillImageInput(uri);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (err) {
                  if (!(err instanceof UploadFailedError)) {
                    Alert.alert("خطأ", "تعذّر رفع الصورة");
                  }
                } finally {
                  setUploadingWaybill(false);
                }
              }}
              style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 8, borderWidth: 1, borderColor: (waybillImageInput ? colors.destructive : colors.gold) + "55", backgroundColor: (waybillImageInput ? colors.destructive : colors.gold) + "12" }}
            >
              <Icon name={waybillImageInput ? "trash-2" : "upload"} size={15} color={waybillImageInput ? colors.destructive : colors.gold} />
              <Text style={{ color: waybillImageInput ? colors.destructive : colors.gold, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {uploadingWaybill ? "جاري المعالجة..." : waybillImageInput ? "حذف الصورة" : "رفع الصورة"}
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!waybillProviderInput) {
                  Alert.alert("تنبيه", "اختر شركة الشحن أولاً");
                  return;
                }
                if (!waybillNumberInput.trim() && !waybillImageInput) {
                  Alert.alert("تنبيه", "أدخل رقم البوليصة أو ارفع صورة");
                  return;
                }
                try {
                  setUploadingWaybill(true);
                  const providers = (settings.shippingProviders && settings.shippingProviders.length > 0) ? settings.shippingProviders : SHIPPING_PROVIDER_DEFAULTS;
                  const providerName = providers.find((p) => p.id === waybillProviderInput)?.name ?? "";
                  await setOrderShipping(order.id, {
                    providerId: waybillProviderInput,
                    providerName,
                    waybillImage: waybillImageInput ?? null,
                    waybillNumber: waybillNumberInput.trim() || null,
                  });
                  setShowWaybillModal(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {
                  Alert.alert("خطأ", "تعذّر الحفظ");
                } finally {
                  setUploadingWaybill(false);
                }
              }}
              style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: colors.gold }}
            >
              <Icon name="check" size={16} color={colors.background} />
              <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {uploadingWaybill ? "جاري الحفظ..." : "حفظ"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setShowWaybillModal(false)} style={{ padding: 10, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>إلغاء</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showChangeMethodModal} transparent animationType="fade" onRequestClose={() => setShowChangeMethodModal(false)}>
        <Pressable onPress={() => setShowChangeMethodModal(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "right" }}>تغيير طريقة الدفع</Text>
            {(() => {
              const ps = settings.payment;
              const opts: { key: PaymentMethod; label: string }[] = ([
                { key: "cash" as PaymentMethod, label: PAYMENT_METHOD_LABELS.cash },
                { key: "bank_transfer" as PaymentMethod, label: PAYMENT_METHOD_LABELS.bank_transfer },
                { key: "ewallet" as PaymentMethod, label: PAYMENT_METHOD_LABELS.ewallet },
                { key: "instapay" as PaymentMethod, label: PAYMENT_METHOD_LABELS.instapay },
              ]).filter((m) => {
                if (m.key === "cash") return ps?.cashEnabled !== false;
                if (m.key === "bank_transfer") return ps?.bankTransferEnabled !== false;
                if (m.key === "ewallet") return ps?.ewalletEnabled !== false;
                if (m.key === "instapay") return ps?.instapayEnabled !== false;
                return true;
              });
              return opts.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={async () => {
                    try {
                      await setOrderPaymentMethod(order.id, m.key);
                      setShowChangeMethodModal(false);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch {
                      Alert.alert("خطأ", "تعذّر تغيير طريقة الدفع");
                    }
                  }}
                  style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: order.paymentMethod === m.key ? colors.gold : colors.border, backgroundColor: order.paymentMethod === m.key ? colors.gold + "15" : colors.surface }}
                >
                  <Icon name={PAYMENT_METHOD_ICONS[m.key] ?? "credit-card"} size={18} color={order.paymentMethod === m.key ? colors.gold : colors.mutedForeground} />
                  <Text style={{ color: order.paymentMethod === m.key ? colors.gold : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: "right", marginRight: 10 }}>{m.label}</Text>
                </Pressable>
              ));
            })()}
            <Pressable onPress={() => setShowChangeMethodModal(false)} style={{ padding: 10, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>إلغاء</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={availModalIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAvailModalIndex(null)}
      >
        <Pressable onPress={() => setAvailModalIndex(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 }}>
            {(() => {
              const item = availModalIndex !== null ? order.items[availModalIndex] : null;
              if (!item) return null;
              const u = unitOf(item);
              // Availability is ALWAYS entered by weight (kilo/meter), regardless of
              // whether the order was placed by weight or by bolt count (ثوب).
              const orderedQty = item.orderType === "weight"
                ? (item.weight ?? 1)
                : (item.actualWeight ?? (item.quantity * blt(u)));
              return (
                <>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                    <Icon name="package" size={18} color={colors.gold} />
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "right" }}>
                      تحديد المتوفر
                    </Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right", lineHeight: 20 }}>
                    {item.productName} — {item.colorName}{"\n"}
                    الكمية المطلوبة: {orderedQty} {ulbl(u)}
                  </Text>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>
                    متوفر فقط ({u === "meter" ? "بالمتر" : "بالكيلو"}):
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius - 4, color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, textAlign: "right" }}
                    placeholder="اتركه فارغًا إذا كان غير متوفر نهائيًا"
                    placeholderTextColor={colors.mutedForeground}
                    value={availInput}
                    keyboardType="decimal-pad"
                    onChangeText={(txt) => { if (/^\d*\.?\d*$/.test(txt)) setAvailInput(txt); }}
                  />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                    إذا تركت الخانة فارغة سيظهر الصنف للعميل كـ «غير متوفر» وسيُحذف عند تأكيد التعديل.
                  </Text>

                  <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        if (availModalIndex === null) return;
                        const idx = availModalIndex;
                        const val = parseFloat(availInput);
                        const hasVal = availInput.trim() !== "" && !isNaN(val) && val > 0;
                        const summary = !hasVal
                          ? "سيتم تحديد هذا الصنف كـ «غير متوفر» وحذفه عند تأكيد العميل."
                          : val < orderedQty
                            ? `سيتم تحديد المتوفر بـ ${val} ${ulbl(u)} من أصل ${orderedQty} ${ulbl(u)}.`
                            : "سيتم تحديد الصنف كمتوفر بالكامل.";
                        const doSave = async () => {
                          if (order.editable) {
                            setAvailModalIndex(null);
                            Alert.alert("التعديل قيد التنفيذ", "لا يمكن تعديل المتوفر بينما العميل يعدّل طلبه. أغلق صلاحية التعديل أولًا أو انتظر حتى يؤكّد العميل الطلب.");
                            return;
                          }
                          const newItems = order.items.map((it, i) => {
                            if (i !== idx) return it;
                            const next = { ...it, customerDecision: undefined as CartItem["customerDecision"] };
                            if (hasVal && val < orderedQty) {
                              next.stockStatus = "partial";
                              next.availableQuantity = val;
                            } else if (hasVal && val >= orderedQty) {
                              delete next.stockStatus;
                              delete next.availableQuantity;
                            } else {
                              next.stockStatus = "unavailable";
                              delete next.availableQuantity;
                            }
                            return next;
                          });
                          setAvailModalIndex(null);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          try {
                            await updateOrderItems(order.id, newItems, order.total, true);
                          } catch {
                            Alert.alert("خطأ", "تعذّر حفظ التغيير. حاول مرة أخرى.");
                          }
                        };
                        Alert.alert("تأكيد الحفظ", `${summary} هل تريد المتابعة؟`, [
                          { text: "إلغاء", style: "cancel" },
                          { text: "نعم، احفظ", onPress: doSave },
                        ]);
                      }}
                      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: colors.radius - 4, backgroundColor: colors.gold }}
                    >
                      <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 14 }}>حفظ</Text>
                    </Pressable>
                    {item.stockStatus && (
                      <Pressable
                        onPress={async () => {
                          if (availModalIndex === null) return;
                          if (order.editable) {
                            setAvailModalIndex(null);
                            Alert.alert("التعديل قيد التنفيذ", "لا يمكن تعديل المتوفر بينما العميل يعدّل طلبه. أغلق صلاحية التعديل أولًا أو انتظر حتى يؤكّد العميل الطلب.");
                            return;
                          }
                          const idx = availModalIndex;
                          const newItems = order.items.map((it, i) => {
                            if (i !== idx) return it;
                            const next = { ...it };
                            delete next.stockStatus;
                            delete next.availableQuantity;
                            delete next.customerDecision;
                            return next;
                          });
                          setAvailModalIndex(null);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          try {
                            await updateOrderItems(order.id, newItems, order.total, true);
                          } catch {
                            Alert.alert("خطأ", "تعذّر حفظ التغيير. حاول مرة أخرى.");
                          }
                        }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: colors.radius - 4, borderWidth: 1, borderColor: "#27AE60", backgroundColor: "#27AE6018" }}
                      >
                        <Text style={{ color: "#27AE60", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>متاح بالكامل</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setAvailModalIndex(null)}
                      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: colors.radius - 4, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>إلغاء</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16 },
  statusCard: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  statusLabel: { fontSize: 18 },
  orderDate: { fontSize: 13 },
  stepsRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },
  step: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
  stepLine: {
    height: 2,
    flex: 1,
    marginTop: 11,
    marginHorizontal: -4,
  },
  customerInfo: { padding: 16, gap: 10, borderWidth: 1 },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  infoText: { fontSize: 14 },
  itemsSection: { borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 15, padding: 14, textAlign: "right" },
  orderItem: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orderItemRight: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    width: "100%",
  },
  companionList: { width: "100%", borderWidth: 1, borderRadius: 10, padding: 8, gap: 6, marginTop: 10, marginBottom: 2 },
  companionLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 20 },
  companionText: { flex: 1, minWidth: 0, textAlign: "right", lineHeight: 17 },
  companionPrice: { flexShrink: 0 },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  orderItemInfo: { gap: 2 },
  orderItemName: { fontSize: 14 },
  orderItemColor: { fontSize: 13 },
  orderItemLeft: { alignItems: "flex-end", alignSelf: "flex-end", marginTop: 10 },
  orderItemPrice: { fontSize: 15 },
  orderItemQty: { fontSize: 15 },
  notesCard: { borderWidth: 1, padding: 16, gap: 8 },
  notesText: { fontSize: 13, textAlign: "right", lineHeight: 20 },
  totalCard: { borderWidth: 1, padding: 16 },
  invoiceCard: { borderWidth: 1, padding: 16, gap: 4 },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 16 },
  totalPrice: { fontSize: 24 },
  salesContact: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  contactCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  paymentMethodCard: {
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  paymentMethodRow: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  paymentMethodIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  assignedCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
  },
  stagesCard: {
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 14,
  },
  assignedInline: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 12,
    marginHorizontal: 4,
    borderTopWidth: 1,
  },
  assignedText: { fontSize: 14 },
  lockedMsg: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flex: 1,
  },
  editableBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  editableCustomerCard: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  editableCustomerHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  browseAlternativeBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionRow: {
    flexDirection: "row-reverse",
    gap: 10,
    alignItems: "center",
  },
  prevBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  prevBtnText: { fontSize: 13 },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
  },
  deleteBtnText: { fontSize: 13 },
  msgSection: { borderWidth: 1, padding: 14 },
  msgToggleBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  msgToggleBtnText: { fontSize: 14 },
  msgInputContainer: { gap: 10 },
  msgLabel: { fontSize: 14, textAlign: "right" },
  msgInput: {
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  msgBtnRow: { flexDirection: "row-reverse", gap: 10 },
  msgCancelBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  msgSendBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: "center",
  },
  returnStatusCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderWidth: 1,
  },
  returnBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
  returnExpired: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  returnFormCard: {
    borderWidth: 1,
    padding: 16,
  },
  returnInput: {
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 12,
  },
});
