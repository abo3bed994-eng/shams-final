import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";
import { router, useLocalSearchParams } from "expo-router";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Order, CartItem, PaymentMethod, PAYMENT_METHOD_ICONS, FulfillmentType, SHIPPING_PROVIDER_DEFAULTS, SavedAddress, formatAddress } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import GovernoratePicker from "@/components/GovernoratePicker";
import CityPicker from "@/components/CityPicker";
import { isWithinWorkingHours, nextWorkingTime, formatNextOpenTime } from "@/lib/workingHours";
import { finalizeEditedItem, computeItemsTotal } from "@/lib/editOrder";
import { companionAmount, companionLineTotal, companionTotal } from "@/lib/companion";

const ALL_PAYMENT_METHODS: { key: PaymentMethod; short: string; desc: string }[] = [
  { key: "cash", short: "كاش", desc: "الدفع عند استلام البضاعة" },
  { key: "bank_transfer", short: "تحويل بنكي", desc: "تحويل على الحساب البنكي" },
  { key: "ewallet", short: "محفظة", desc: "فودافون كاش / أورنج / اتصالات" },
  { key: "instapay", short: "انستاباي", desc: "تحويل فوري بدون رسوم" },
];

const formatQuantity = (value: number) => Math.round(value * 100) / 100;

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cart, removeFromCart, updateCartItem, clearCart, user, addOrder, orders, updateOrderItems, setCart, settings, editingOrderId, setEditingOrderId, updateCartWeight, updateCartActualWeight, products, addAddress, cancelOrder } = useApp();
  const [weightTexts, setWeightTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedShippingProviderId, setSelectedShippingProviderId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrDistrict, setNewAddrDistrict] = useState("");
  const [newAddrStreet, setNewAddrStreet] = useState("");
  const [newAddrBuilding, setNewAddrBuilding] = useState("");
  const [newAddrLandmark, setNewAddrLandmark] = useState("");
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const userAddresses: SavedAddress[] = user?.addresses ?? [];

  // Auto-select default (or first) address when switching to shipping
  useEffect(() => {
    if (fulfillmentType !== "shipping") return;
    if (selectedAddressId && userAddresses.some((a) => a.id === selectedAddressId)) return;
    if (userAddresses.length === 0) {
      setSelectedAddressId(null);
      setShowAddAddressForm(true);
      return;
    }
    const def = userAddresses.find((a) => a.isDefault) ?? userAddresses[0];
    setSelectedAddressId(def?.id ?? null);
    setShowAddAddressForm(false);
  }, [fulfillmentType, userAddresses.length]);

  const handleSaveNewAddress = async (): Promise<SavedAddress | null> => {
    if (!newAddrCity.trim() || !newAddrDistrict.trim() || !newAddrStreet.trim()) {
      Alert.alert("بيانات ناقصة", "المدينة والحي والشارع حقول إجبارية.");
      return null;
    }
    setSavingAddress(true);
    try {
      const created = await addAddress({
        label: newAddrLabel.trim() || undefined,
        city: newAddrCity.trim(),
        district: newAddrDistrict.trim(),
        street: newAddrStreet.trim(),
        building: newAddrBuilding.trim() || undefined,
        landmark: newAddrLandmark.trim() || undefined,
      });
      if (created) {
        setSelectedAddressId(created.id);
        setShowAddAddressForm(false);
        setNewAddrCity(""); setNewAddrDistrict(""); setNewAddrStreet("");
        setNewAddrBuilding(""); setNewAddrLandmark(""); setNewAddrLabel("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return created;
    } finally {
      setSavingAddress(false);
    }
  };
  const params = useLocalSearchParams<{ editOrderId?: string }>();
  const paramEditId = params.editOrderId;
  const editOrderId = paramEditId || editingOrderId;

  const editLoadedRef = useRef(false);
  // Point 2: guards the auto-exit effect from firing on the customer's own
  // confirm / cancel / back. mountedAtRef gives a brief grace window so we don't
  // exit before the realtime orders list has had a chance to sync on first mount.
  const exitingEditRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  useEffect(() => {
    if (paramEditId && !editLoadedRef.current) {
      editLoadedRef.current = true;
      setEditingOrderId(paramEditId);
      const order = orders.find((o) => o.id === paramEditId);
      if (order) {
        // Carry items (matches beginOrderEdit): drop only fully-unavailable items,
        // keep partial items with stockStatus/availableQuantity intact so the cart
        // steppers can cap quantities at the available amount.
        const reconciled = order.items.reduce<typeof order.items>((acc, it) => {
          if (it.stockStatus === "unavailable") return acc;
          acc.push({ ...it });
          return acc;
        }, []);
        setCart(reconciled);
        if (order.notes) setNotes(order.notes);
        if (order.fulfillmentType) setFulfillmentType(order.fulfillmentType);
        if (order.branchId) setSelectedBranchId(order.branchId);
      }
    }
  }, [paramEditId]);

  // Products-first edit flow: cart items were already pre-filled in context by
  // beginOrderEdit, so here we only load notes/fulfillment from the order (never
  // the items — that would wipe alternatives the customer just added).
  const metaLoadedRef = useRef(false);
  useEffect(() => {
    if (!editingOrderId || paramEditId || metaLoadedRef.current) return;
    metaLoadedRef.current = true;
    const order = orders.find((o) => o.id === editingOrderId);
    if (order) {
      if (order.notes) setNotes(order.notes);
      if (order.fulfillmentType) setFulfillmentType(order.fulfillmentType);
      if (order.branchId) setSelectedBranchId(order.branchId);
    }
  }, [editingOrderId, paramEditId]);

  // On entering edit mode, clamp any item that already exceeds the staff-marked
  // availability cap down to it, so the displayed count/weight never shows more
  // than what's available (pieces clamp to whole bolts, each bolt = perBolt).
  useEffect(() => {
    if (!editOrderId) return;
    for (const it of cart) {
      const cap = it.stockStatus === "partial" && it.availableQuantity != null ? it.availableQuantity : it.editMaxQty;
      if (cap == null) continue;
      const perBolt = it.unit === "meter" ? 100 : 20;
      if (it.orderType === "weight") {
        if ((it.weight ?? 0) > cap) updateCartWeight(it.productId, it.colorName, cap);
      } else {
        // Pieces: keep at least 1 bolt (a partial last bolt like 9kg is still
        // sellable — never auto-delete), and pin the weight to the available
        // amount so a sub-bolt remnant shows its real weight (e.g. 9 كغ).
        const maxBolts = Math.max(1, Math.min(it.quantity, Math.ceil(cap / perBolt)));
        const q = Math.min(it.quantity, maxBolts);
        if (q !== it.quantity) updateCartItem(it.productId, it.colorName, q);
        const w = Math.min(q * perBolt, cap);
        if ((it.actualWeight ?? q * perBolt) !== w) updateCartActualWeight(it.productId, it.colorName, w);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderId, cart.length]);

  // Point 2: re-check the edit window frequently so an expiry — or a sync that
  // arrives just after the grace window — is caught even without a Firestore push.
  const [editWatchTick, setEditWatchTick] = useState(0);
  useEffect(() => {
    if (!editOrderId) return;
    // Reset the sync-grace window per edit session in case the cart stays
    // mounted across flows (so a fresh edit gets its own grace, not a stale one).
    mountedAtRef.current = Date.now();
    exitingEditRef.current = false;
    const id = setInterval(() => setEditWatchTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [editOrderId]);

  // Point 2: if staff close the edit window (or it expires, or the order is
  // cancelled) while the customer is editing in the cart, lock and exit
  // automatically with a clear message.
  useEffect(() => {
    if (!editOrderId || exitingEditRef.current) return;
    const order = orders.find((o) => o.id === editOrderId);
    const expired = order?.editableExpiresAt
      ? new Date(order.editableExpiresAt).getTime() <= Date.now()
      : false;
    const stillEditable = !!order && order.editable && order.status !== "cancelled" && !expired;
    if (stillEditable) return;
    // The order is missing or no longer editable. If it's simply not in the
    // synced list yet, wait out a short grace window before treating it as
    // removed — this avoids a false exit on first mount before orders sync.
    if (!order && Date.now() - mountedAtRef.current < 2500) return;
    exitingEditRef.current = true;
    const oid = editOrderId;
    const msg =
      !order || order.status === "cancelled"
        ? "تم إلغاء هذا الطلب."
        : expired
          ? "انتهت مهلة تعديل الطلب."
          : "تم إغلاق صلاحية التعديل من قِبل فريق العمل.";
    setEditingOrderId(null);
    clearCart();
    editLoadedRef.current = false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("تعذّر متابعة التعديل", msg);
    router.replace(`/order/${oid}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderId, orders, editWatchTick]);

  const handleBack = () => {
    if (editingOrderId) {
      exitingEditRef.current = true;
      setEditingOrderId(null);
      clearCart();
      editLoadedRef.current = false;
    }
    router.back();
  };

  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, Platform.OS === "android" ? 24 : 0);

  const totalPieces = cart.reduce((a, b) => a + b.quantity, 0);
  const weightTotal = cart
    .filter((i) => i.orderType === "weight")
    .reduce((a, b) => a + b.unitPrice * (b.weight ?? 1), 0);
  const piecesEstTotal = cart
    .filter((i) => i.orderType === "pieces")
    .reduce((a, b) => {
      const pb = b.unit === "meter" ? 100 : 20;
      const cap = b.stockStatus === "partial" && b.availableQuantity != null ? b.availableQuantity : b.editMaxQty;
      const raw = b.actualWeight ?? (b.quantity * pb);
      const eff = cap != null ? Math.min(raw, cap) : raw;
      return a + eff * b.unitPrice;
    }, 0);
  const companionEstTotal = cart.reduce((sum, item) => sum + companionTotal(item), 0);
  const totalPrice = weightTotal + piecesEstTotal + companionEstTotal;

  const hasPiecesOrder = cart.some((i) => i.orderType === "pieces");

  const paymentSettings = settings.payment;
  const ewalletFee = paymentSettings?.ewalletFeePercent ?? 1;
  const branchesList = settings.branches ?? [];
  const shippingProvidersList = (settings.shippingProviders && settings.shippingProviders.length > 0)
    ? settings.shippingProviders
    : SHIPPING_PROVIDER_DEFAULTS;
  const hasEnabledShippingProvider = shippingProvidersList.some((p) => p.enabled !== false);
  const methodGloballyEnabled = (key: PaymentMethod): boolean => {
    const p = paymentSettings;
    if (!p) return true;
    if (key === "cash") return p.cashEnabled !== false;
    if (key === "bank_transfer") return p.bankTransferEnabled !== false;
    if (key === "ewallet") return p.ewalletEnabled !== false;
    if (key === "instapay") return p.instapayEnabled !== false;
    return true;
  };
  const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter((pm) => {
    if (!methodGloballyEnabled(pm.key)) return false;
    if (fulfillmentType === "branch" && selectedBranchId) {
      const b = branchesList.find((x) => x.id === selectedBranchId);
      const allowed = b?.allowedPayments;
      if (allowed && allowed.length > 0 && !allowed.includes(pm.key)) return false;
    }
    if (fulfillmentType === "shipping") {
      const shippingAllowed = settings.shippingAllowedPayments;
      if (shippingAllowed && shippingAllowed.length > 0 && !shippingAllowed.includes(pm.key)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (selectedPayment && !PAYMENT_METHODS.some((p) => p.key === selectedPayment)) {
      setSelectedPayment(null);
    }
  }, [fulfillmentType, selectedPayment, selectedBranchId]);
  const feeAmount = selectedPayment === "ewallet" ? Math.ceil(totalPrice * ewalletFee / 100) : 0;
  const totalWithFee = totalPrice + feeAmount;

  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(label);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCheckout = async () => {
    if (isStaff) {
      Alert.alert("غير مسموح", "أعضاء فريق العمل لا يمكنهم تقديم طلبات شراء.");
      return;
    }
    if (!user?.id) {
      Alert.alert("تسجيل الدخول مطلوب", "يرجى تسجيل الدخول قبل إتمام الطلب.", [
        { text: "إلغاء", style: "cancel" },
        { text: "تسجيل الدخول", onPress: () => router.push("/auth/login" as any) },
      ]);
      return;
    }
    if (cart.length === 0) return;

    if (!editOrderId && !selectedPayment) {
      Alert.alert("طريقة الدفع", "يرجى اختيار طريقة الدفع قبل إتمام الطلب.");
      return;
    }

    if (!editOrderId && !fulfillmentType) {
      Alert.alert("طريقة الاستلام", "يرجى اختيار طريقة الاستلام (محل / فرع / شحن).");
      return;
    }

    if (!editOrderId && fulfillmentType === "branch" && !selectedBranchId) {
      Alert.alert("اختر الفرع", "يرجى اختيار الفرع للاستلام منه.");
      return;
    }

    if (!editOrderId && fulfillmentType === "shipping" && !selectedShippingProviderId) {
      Alert.alert("اختر شركة الشحن", "يرجى اختيار شركة الشحن.");
      return;
    }

    if (!editOrderId && fulfillmentType === "shipping") {
      if (userAddresses.length === 0) {
        Alert.alert("عنوان الشحن مطلوب", "يرجى إضافة عنوان شحن قبل إتمام الطلب.");
        return;
      }
      if (!selectedAddressId || !userAddresses.some((a) => a.id === selectedAddressId)) {
        Alert.alert("اختر العنوان", "يرجى اختيار عنوان الشحن من العناوين المحفوظة.");
        return;
      }
    }

    const weightItems = cart.filter((i) => i.orderType === "weight");
    for (const item of weightItems) {
      // Items capped by a staff "partial availability" edit may legitimately fall
      // below the normal minimum, so skip the minimum check for them.
      if (item.editMaxQty != null || item.stockStatus === "partial") continue;
      const prod = products.find((p) => p.id === item.productId);
      const minW = prod?.minimumOrderQuantity ?? (prod?.unit === "meter" ? 100 : 20);
      const unitName = prod?.unit === "meter" ? "متر" : "كغ";
      if ((item.weight ?? 0) < minW) {
        Alert.alert("الحد الأدنى", `الحد الأدنى هو ${minW} ${unitName} لكل لون\n(${item.productName} — ${item.colorName}: ${item.weight ?? 0} ${unitName})`);
        return;
      }
    }

    await placeOrder();
  };

  const placeOrder = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setShowPaymentModal(false);
    await new Promise((r) => setTimeout(r, 800));

    try {
      if (editOrderId) {
        exitingEditRef.current = true;
        // Finalize the edit directly: clamp each item to its availability cap, strip
        // the staff-availability metadata, recompute the total, and save with
        // staffEdit=false so the order is marked edited, closed for editing, and the
        // staff are notified — no second confirmation step.
        const finalItems = [...cart].map(finalizeEditedItem);
        await updateOrderItems(editOrderId, finalItems, computeItemsTotal(finalItems), false, notes, {
          fulfillmentType: fulfillmentType ?? undefined,
          branchId: fulfillmentType === "branch" ? selectedBranchId ?? undefined : undefined,
          branchName: fulfillmentType === "branch"
            ? branchesList.find((b) => b.id === selectedBranchId)?.name
            : undefined,
        });
        clearCart();
        setEditingOrderId(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "تم تأكيد التعديل",
          "تم حفظ تعديلاتك على الطلب وإبلاغ فريق العمل.",
          [{ text: "عرض الطلب", onPress: () => router.replace(`/order/${editOrderId}`) }]
        );
      } else {
        const suspendEnabled = settings?.suspendOrdersOutsideHours !== false;
        const inHours = isWithinWorkingHours(settings?.workingHours);
        const willSchedule = suspendEnabled && !inHours;
        const nextOpen = willSchedule ? nextWorkingTime(settings?.workingHours) : null;
        const order: Order = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          userId: user?.id ?? "guest",
          userName: user?.name ?? "عميل",
          userPhone: user?.phone ?? "",
          items: [...cart],
          total: totalPrice,
          status: willSchedule ? "scheduled" : "pending",
          createdAt: new Date().toISOString(),
          notes,
          paymentMethod: selectedPayment ?? "cash",
          paymentFee: feeAmount,
          totalWithFee: totalWithFee,
          scheduledFor: willSchedule && nextOpen ? nextOpen.toISOString() : undefined,
          fulfillmentType: fulfillmentType ?? "branch",
          ...(fulfillmentType === "branch" && selectedBranchId
            ? {
                branchId: selectedBranchId,
                branchName: branchesList.find((b) => b.id === selectedBranchId)?.name,
              }
            : {}),
          ...(fulfillmentType === "shipping" && selectedShippingProviderId
            ? {
                shippingProviderId: selectedShippingProviderId,
                shippingProviderName: shippingProvidersList.find((p) => p.id === selectedShippingProviderId)?.name,
                ...(selectedAddressId
                  ? (() => {
                      const a = userAddresses.find((x) => x.id === selectedAddressId);
                      return a
                        ? { shippingAddressId: a.id, shippingAddress: formatAddress(a) }
                        : {};
                    })()
                  : {}),
              }
            : {}),
        };
        await addOrder(order);
        clearCart();
        setSelectedPayment(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (willSchedule) {
          const when = formatNextOpenTime(nextOpen);
          Alert.alert(
            "تم استلام طلبك ✓",
            `طلبك خارج أوقات العمل، تم تعليقه وسيصل تلقائياً لفريق العمل عند بدء الدوام (${when}).\n\nسيصلك إشعار فور بدء العمل عليه.`,
            [
              { text: "استمرار التسوق", style: "cancel", onPress: () => router.replace("/(tabs)") },
              { text: "عرض الطلب", onPress: () => router.replace(`/order/${order.id}`) },
            ]
          );
        } else {
          Alert.alert("تم إرسال الطلب!", "سيتواصل معك فريق المبيعات قريباً.", [
            { text: "استمرار التسوق", style: "cancel", onPress: () => router.replace("/(tabs)") },
            { text: "عرض الطلب", onPress: () => router.replace(`/order/${order.id}`) },
          ]);
        }
      }
    } catch {
      Alert.alert("خطأ", "تعذّر إرسال الطلب. يُرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const renderCopyRow = (label: string, value: string, fieldKey: string) => (
    <Pressable
      key={fieldKey}
      onPress={() => copyToClipboard(value, fieldKey)}
      style={[styles.copyRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 4 }]}
    >
      <View style={styles.copyRowContent}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
          {label}
        </Text>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "right", letterSpacing: 0.5 }}>
          {value}
        </Text>
      </View>
      <View style={[styles.copyBtn, { backgroundColor: copiedField === fieldKey ? "#27AE60" + "22" : colors.gold + "11" }]}>
        <Icon
          name={copiedField === fieldKey ? "check" : "copy"}
          size={16}
          color={copiedField === fieldKey ? "#27AE60" : colors.gold}
        />
      </View>
    </Pressable>
  );

  const renderPaymentModal = () => {
    if (!selectedPayment || selectedPayment === "cash") return null;

    const pm = paymentSettings;

    return (
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setShowPaymentModal(false)} style={styles.modalCloseBtn}>
                <Icon name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, flex: 1, textAlign: "right" }}>
                {selectedPayment === "bank_transfer" && "بيانات التحويل البنكي"}
                {selectedPayment === "ewallet" && "بيانات المحفظة الإلكترونية"}
                {selectedPayment === "instapay" && "بيانات الانستاباي"}
              </Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedPayment === "bank_transfer" && pm && (
                <View style={styles.paymentInfoSection}>
                  <View style={[styles.paymentInfoBanner, { backgroundColor: colors.gold + "11", borderColor: colors.gold + "33", borderRadius: colors.radius - 4 }]}>
                    <Icon name="credit-card" size={20} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: "right" }}>
                      قم بالتحويل ثم اضغط "تأكيد الطلب"
                    </Text>
                  </View>
                  {renderCopyRow("اسم البنك", pm.bankName, "bank")}
                  {renderCopyRow("اسم الحساب", pm.bankAccountName, "accName")}
                  {renderCopyRow("رقم الحساب", pm.bankAccountNumber, "accNum")}
                  {renderCopyRow("IBAN", pm.bankIBAN, "iban")}

                  <View style={[styles.amountBox, { backgroundColor: colors.gold + "11", borderColor: colors.gold + "44", borderRadius: colors.radius - 4 }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>المبلغ المطلوب</Text>
                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 24 }}>{totalPrice.toLocaleString("ar-EG")} ج.م</Text>
                  </View>
                </View>
              )}

              {selectedPayment === "ewallet" && pm && (() => {
                const wallets = (pm.ewallets && pm.ewallets.length > 0)
                  ? pm.ewallets
                  : (pm.ewalletNumber ? [{ id: "_legacy", number: pm.ewalletNumber, name: pm.ewalletName ?? "", provider: undefined }] : []);
                return (
                <View style={styles.paymentInfoSection}>
                  <View style={[styles.paymentInfoBanner, { backgroundColor: "#9B59B6" + "15", borderColor: "#9B59B6" + "33", borderRadius: colors.radius - 4 }]}>
                    <Icon name="smartphone" size={20} color="#9B59B6" />
                    <Text style={{ color: "#9B59B6", fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: "right" }}>
                      اختر رقم المحفظة وحوّل عليه ثم اضغط "تأكيد الطلب"
                    </Text>
                  </View>
                  {wallets.length === 0 && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", padding: 16 }}>
                      لم يضِف المدير أي رقم محفظة بعد
                    </Text>
                  )}
                  {wallets.map((w, idx) => (
                    <View key={w.id} style={{ gap: 6, marginBottom: 10, padding: 10, borderWidth: 1, borderColor: "#9B59B6" + "33", backgroundColor: "#9B59B6" + "08", borderRadius: colors.radius - 4 }}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#9B59B6" + "22", borderRadius: 6 }}>
                          <Text style={{ color: "#9B59B6", fontFamily: "Inter_700Bold", fontSize: 11 }}>{idx + 1}</Text>
                        </View>
                        {w.provider ? (
                          <Text style={{ color: "#9B59B6", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{w.provider}</Text>
                        ) : null}
                      </View>
                      {renderCopyRow("رقم المحفظة", w.number, `wallet_${w.id}`)}
                      {w.name ? renderCopyRow("الاسم", w.name, `walletName_${w.id}`) : null}
                    </View>
                  ))}

                  <View style={[styles.amountBox, { backgroundColor: "#9B59B6" + "11", borderColor: "#9B59B6" + "33", borderRadius: colors.radius - 4 }]}>
                    <View style={styles.feeBreakdown}>
                      <View style={styles.feeRow}>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{totalPrice.toLocaleString("ar-EG")} ج.م</Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>سعر الطلب</Text>
                      </View>
                      <View style={styles.feeRow}>
                        <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>+{feeAmount.toLocaleString("ar-EG")} ج.م</Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>رسوم المحفظة ({ewalletFee}%)</Text>
                      </View>
                      <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.feeRow}>
                        <Text style={{ color: "#9B59B6", fontFamily: "Inter_700Bold", fontSize: 22 }}>{totalWithFee.toLocaleString("ar-EG")} ج.م</Text>
                        <Text style={{ color: "#9B59B6", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>الإجمالي</Text>
                      </View>
                    </View>
                  </View>
                </View>
                );
              })()}

              {selectedPayment === "instapay" && pm && (() => {
                const instapays = (pm.instapays && pm.instapays.length > 0)
                  ? pm.instapays
                  : (pm.instapayNumber ? [{ id: "_legacy", handle: pm.instapayNumber, name: pm.instapayName ?? "" }] : []);
                return (
                <View style={styles.paymentInfoSection}>
                  <View style={[styles.paymentInfoBanner, { backgroundColor: "#2ECC71" + "15", borderColor: "#2ECC71" + "33", borderRadius: colors.radius - 4 }]}>
                    <Icon name="zap" size={20} color="#2ECC71" />
                    <Text style={{ color: "#2ECC71", fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: "right" }}>
                      اختر حساب انستاباي وحوّل عليه ثم اضغط "تأكيد الطلب"
                    </Text>
                  </View>
                  {instapays.length === 0 && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", padding: 16 }}>
                      لم يضِف المدير أي حساب انستاباي بعد
                    </Text>
                  )}
                  {instapays.map((ip, idx) => (
                    <View key={ip.id} style={{ gap: 6, marginBottom: 10, padding: 10, borderWidth: 1, borderColor: "#2ECC71" + "33", backgroundColor: "#2ECC71" + "08", borderRadius: colors.radius - 4 }}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#2ECC71" + "22", borderRadius: 6 }}>
                          <Text style={{ color: "#2ECC71", fontFamily: "Inter_700Bold", fontSize: 11 }}>{idx + 1}</Text>
                        </View>
                      </View>
                      {renderCopyRow("الانستاباي", ip.handle, `instapay_${ip.id}`)}
                      {ip.name ? renderCopyRow("الاسم", ip.name, `instapayName_${ip.id}`) : null}
                    </View>
                  ))}

                  <View style={[styles.amountBox, { backgroundColor: "#2ECC71" + "11", borderColor: "#2ECC71" + "33", borderRadius: colors.radius - 4 }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>المبلغ المطلوب</Text>
                    <Text style={{ color: "#2ECC71", fontFamily: "Inter_700Bold", fontSize: 24 }}>{totalPrice.toLocaleString("ar-EG")} ج.م</Text>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                      <Icon name="check-circle" size={14} color="#2ECC71" />
                      <Text style={{ color: "#2ECC71", fontFamily: "Inter_500Medium", fontSize: 12 }}>بدون رسوم إضافية</Text>
                    </View>
                  </View>
                </View>
                );
              })()}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
              <GoldButton
                label="تأكيد الطلب"
                onPress={placeOrder}
                loading={loading}
                style={{ width: "100%" }}
                size="lg"
              />
              <Pressable onPress={() => setShowPaymentModal(false)} style={styles.modalCancelBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>رجوع</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const handleDeleteItem = (item: CartItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Outside the edit flow, deleting is a simple, instant removal.
    if (!editOrderId) {
      removeFromCart(item.productId, item.colorName);
      return;
    }
    // Removing the last item while editing an order cancels the whole order.
    if (cart.length === 1) {
      Alert.alert(
        "إلغاء الطلب",
        "هذا آخر صنف في طلبك. حذفه سيؤدي إلى إلغاء الطلب بالكامل. هل تريد المتابعة؟",
        [
          { text: "تراجع", style: "cancel" },
          {
            text: "نعم، ألغِ الطلب",
            style: "destructive",
            onPress: async () => {
              try {
                exitingEditRef.current = true;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                await cancelOrder(editOrderId, { notifyStaff: true });
                clearCart();
                setEditingOrderId(null);
                Alert.alert("تم", "تم إلغاء طلبك.");
                router.replace(`/order/${editOrderId}`);
              } catch {
                Alert.alert("خطأ", "تعذّر إلغاء الطلب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
              }
            },
          },
        ]
      );
      return;
    }
    Alert.alert(
      "حذف الصنف",
      `حذف ${item.productName} — ${item.colorName} من الطلب؟`,
      [
        { text: "تراجع", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => removeFromCart(item.productId, item.colorName) },
      ]
    );
  };

  const PAYMENT_COLORS: Record<PaymentMethod, string> = {
    cash: "#27AE60",
    bank_transfer: colors.gold,
    ewallet: "#9B59B6",
    instapay: "#2ECC71",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title={editOrderId ? "تعديل الطلب" : "سلة الطلبات"}
        subtitle={editOrderId ? `تعديل طلب #${editOrderId.slice(0, 12)}` : `${totalPieces} ثوب`}
        onBack={handleBack}
      />

      {cart.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="shopping-cart" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            السلة فارغة
          </Text>
          <GoldButton
            label="تصفح المنتجات"
            onPress={() => router.push("/(tabs)/products")}
            variant="outline"
          />
        </View>
      ) : (
        <>
          <KeyboardAwareScroll
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 220 }]}
          >
            {cart.map((item, index) => (
              <View
                key={`${item.productId}-${item.colorName}-${index}`}
                style={[
                  styles.cartItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: item.stockStatus ? "#C0392B" : colors.border,
                    borderWidth: item.stockStatus ? 1.5 : 1,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  <Pressable
                    onPress={() => handleDeleteItem(item)}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Icon name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {item.productName}
                    </Text>
                    <View style={styles.colorInfo}>
                      <Text style={[styles.colorLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {item.colorName}
                      </Text>
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: item.colorHex,
                            borderColor: colors.border,
                            borderWidth: item.colorHex === "#FFFFFF" ? 1 : 0,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {item.companions?.length ? (
                  <View style={[styles.companionList, { backgroundColor: colors.gold + "0D", borderColor: colors.gold + "33" }]}>
                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "right" }}>الخامات المرافقة</Text>
                    {item.companions.map((companion, index) => (
                      <View key={`${companion.materialId}-${index}`} style={styles.companionLine}>
                        <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          {formatQuantity(companionLineTotal(companion))} ج.م
                        </Text>
                        <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                          {companion.materialName} — {companion.colorName} · {companion.percentage}% · {formatQuantity(companionAmount(companion))} {companion.unit === "meter" ? "متر" : "كغ"}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {item.orderType === "weight" ? (() => {
                  const prod = products.find((p) => p.id === item.productId);
                  const unitName = prod?.unit === "meter" ? "متر" : "كغ";
                  const perBolt = prod?.unit === "meter" ? 100 : 20;
                  const minW = prod?.minimumOrderQuantity ?? perBolt;
                  const bolts = Math.floor((item.weight ?? 0) / perBolt);
                  const cap = item.stockStatus === "partial" && item.availableQuantity != null ? item.availableQuantity : item.editMaxQty;
                  const clampCap = (n: number) => (cap != null ? Math.min(n, cap) : n);
                  const wKey = `${item.productId}_${item.colorName}`;
                  const bKey = `bolt_${item.productId}_${item.colorName}`;
                  const fmt = (n: number) => Math.round(n * 100) / 100;
                  return (
                    <View style={{ gap: 10 }}>
                      <View style={styles.itemFooter}>
                        <Text style={[styles.itemPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                          {fmt(item.unitPrice * (item.weight ?? 1))} ج.م
                        </Text>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
                          {fmt(item.weight ?? 1)} {unitName}
                        </Text>
                      </View>

                      {cap != null && (
                        <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "right", paddingHorizontal: 4 }}>
                          الحد الأقصى المتوفر: {fmt(cap)} {unitName}
                        </Text>
                      )}

                      <View style={styles.editRow}>
                        <Text style={[styles.editRowLabel, { color: colors.mutedForeground }]}>عدد الأثواب</Text>
                        <View style={styles.stepperGroup}>
                          <Pressable
                            onPress={() => updateCartWeight(item.productId, item.colorName, Math.max(perBolt, (item.weight ?? 0) - perBolt))}
                            style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          >
                            <Icon name="minus" size={14} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={[styles.stepperInput, { color: colors.gold, borderBottomColor: colors.border }]}
                            value={weightTexts[bKey] !== undefined ? weightTexts[bKey] : String(bolts)}
                            keyboardType="number-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [bKey]: txt }));
                              const val = parseInt(txt, 10);
                              if (isNaN(val) || val <= 0) return;
                              updateCartWeight(item.productId, item.colorName, clampCap(Math.max(perBolt, val * perBolt)));
                            }}
                            onBlur={() => setWeightTexts(p => { const n = { ...p }; delete n[bKey]; return n; })}
                          />
                          <Text style={[styles.stepperUnit, { color: colors.mutedForeground }]}>ثوب</Text>
                          <Pressable
                            onPress={() => updateCartWeight(item.productId, item.colorName, clampCap((item.weight ?? 0) + perBolt))}
                            style={[styles.qtyBtn, { backgroundColor: colors.gold }]}
                          >
                            <Icon name="plus" size={14} color={colors.background} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.editRow}>
                        <Text style={[styles.editRowLabel, { color: colors.mutedForeground }]}>
                          {prod?.unit === "meter" ? "الأمتار (متر)" : "الوزن (كغ)"}
                        </Text>
                        <View style={styles.stepperGroup}>
                          <Pressable
                            onPress={() => updateCartWeight(item.productId, item.colorName, (item.weight ?? 1) - 1)}
                            style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          >
                            <Icon name="minus" size={14} color={colors.gold} />
                          </Pressable>
                          <TextInput
                            style={[styles.stepperInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                            value={weightTexts[wKey] !== undefined ? weightTexts[wKey] : String(item.weight ?? 1)}
                            keyboardType="decimal-pad"
                            onChangeText={(txt) => {
                              if (!/^\d*\.?\d*$/.test(txt)) return;
                              setWeightTexts(p => ({ ...p, [wKey]: txt }));
                              if (!txt || txt === "0") return;
                              const val = parseFloat(txt);
                              if (!isNaN(val) && val > 0) updateCartWeight(item.productId, item.colorName, clampCap(val));
                            }}
                            onBlur={() => { setWeightTexts(p => { const n = {...p}; delete n[wKey]; return n; }); }}
                          />
                          <Text style={[styles.stepperUnit, { color: colors.mutedForeground }]}>{unitName}</Text>
                          <Pressable
                            onPress={() => updateCartWeight(item.productId, item.colorName, clampCap((item.weight ?? 1) + 1))}
                            style={[styles.qtyBtn, { backgroundColor: colors.gold }]}
                          >
                            <Icon name="plus" size={14} color={colors.background} />
                          </Pressable>
                        </View>
                      </View>

                      {cap == null && (item.weight ?? 0) < minW && (
                        <Text style={{ color: "#C0392B", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", paddingHorizontal: 4 }}>
                          الحد الأدنى {minW} {unitName} لكل لون
                        </Text>
                      )}
                    </View>
                  );
                })() : (() => {
                  const unitName = item.unit === "meter" ? "متر" : "كغ";
                  const perBolt = item.unit === "meter" ? 100 : 20;
                  const isEdit = !!editOrderId;
                  const cap = item.stockStatus === "partial" && item.availableQuantity != null ? item.availableQuantity : item.editMaxQty;
                  const maxBolts = cap != null ? Math.max(1, Math.ceil(cap / perBolt)) : null;
                  const clampBolts = (n: number) => (maxBolts != null ? Math.min(Math.max(1, n), maxBolts) : Math.max(1, n));
                  const rawAw = item.actualWeight ?? (item.quantity * perBolt);
                  const aw = cap != null ? Math.min(rawAw, cap) : rawAw;
                  const qKey = `qty_${item.productId}_${item.colorName}`;
                  const awKey = `aw_${item.productId}_${item.colorName}`;
                  const fmt = (n: number) => Math.round(n * 100) / 100;
                  return (
                  <View style={{ gap: 10 }}>
                  <View style={styles.itemFooter}>
                    <View style={{ gap: 2, alignItems: "flex-end" }}>
                      {isEdit ? (
                        <>
                          <Text style={[styles.itemPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                            {fmt(aw * item.unitPrice)} ج.م
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                            {fmt(aw)} {unitName}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.itemPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                            ≈ {item.quantity * perBolt * item.unitPrice} ج.م
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                            تقديري ({item.quantity} × {item.unit === "meter" ? "100م" : "20كغ"} × {item.unitPrice})
                          </Text>
                        </>
                      )}
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                      {item.quantity} ثوب
                    </Text>
                  </View>

                  {isEdit && maxBolts != null && cap != null && (
                    <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "right", paddingHorizontal: 4 }}>
                      الحد الأقصى المتوفر: {maxBolts} ثوب ({fmt(Math.min(maxBolts * perBolt, cap))} {unitName})
                    </Text>
                  )}

                  <View style={styles.editRow}>
                    <Text style={[styles.editRowLabel, { color: colors.mutedForeground }]}>عدد الأثواب</Text>
                    <View style={styles.stepperGroup}>
                      <Pressable
                        onPress={() => {
                          const newQ = Math.max(1, item.quantity - 1);
                          updateCartItem(item.productId, item.colorName, newQ);
                           if (isEdit) updateCartActualWeight(item.productId, item.colorName, cap != null ? Math.min(newQ * perBolt, cap) : newQ * perBolt);
                        }}
                        style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Icon name="minus" size={14} color={colors.gold} />
                      </Pressable>
                      <TextInput
                        style={[styles.stepperInput, { color: colors.gold, borderBottomColor: colors.border }]}
                        value={weightTexts[qKey] !== undefined ? weightTexts[qKey] : String(item.quantity)}
                        keyboardType="number-pad"
                        onChangeText={(txt) => {
                          if (!/^\d*$/.test(txt)) return;
                          setWeightTexts(p => ({ ...p, [qKey]: txt }));
                          const val = parseInt(txt, 10);
                          if (isNaN(val) || val <= 0) return;
                          const q = clampBolts(val);
                          updateCartItem(item.productId, item.colorName, q);
                           if (isEdit) updateCartActualWeight(item.productId, item.colorName, cap != null ? Math.min(q * perBolt, cap) : q * perBolt);
                        }}
                        onBlur={() => setWeightTexts(p => { const n = { ...p }; delete n[qKey]; return n; })}
                      />
                      <Text style={[styles.stepperUnit, { color: colors.mutedForeground }]}>ثوب</Text>
                      <Pressable
                        onPress={() => {
                          const newQ = clampBolts(item.quantity + 1);
                          updateCartItem(item.productId, item.colorName, newQ);
                           if (isEdit) updateCartActualWeight(item.productId, item.colorName, cap != null ? Math.min(newQ * perBolt, cap) : newQ * perBolt);
                        }}
                        style={[styles.qtyBtn, { backgroundColor: colors.gold }]}
                      >
                        <Icon name="plus" size={14} color={colors.background} />
                      </Pressable>
                    </View>
                  </View>

                  {isEdit && (
                    <View style={styles.editRow}>
                      <Text style={[styles.editRowLabel, { color: colors.mutedForeground }]}>
                        {cap != null
                          ? (item.unit === "meter" ? "الأمتار المتوفرة" : "الوزن المتوفر")
                          : (item.unit === "meter" ? "الأمتار التقديرية" : "الوزن التقديري")}
                      </Text>
                      <View style={styles.stepperGroup}>
                        <Pressable
                          onPress={() => updateCartActualWeight(item.productId, item.colorName, Math.max(1, fmt(aw - 1)))}
                          style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <Icon name="minus" size={14} color={colors.gold} />
                        </Pressable>
                        <TextInput
                          style={[styles.stepperInput, { color: colors.gold, borderBottomColor: colors.border, fontSize: 16 }]}
                          value={weightTexts[awKey] !== undefined ? weightTexts[awKey] : String(fmt(aw))}
                          keyboardType="decimal-pad"
                          onChangeText={(txt) => {
                            if (!/^\d*\.?\d*$/.test(txt)) return;
                            setWeightTexts(p => ({ ...p, [awKey]: txt }));
                            if (!txt || txt === "0") return;
                            const val = parseFloat(txt);
                            if (!isNaN(val) && val > 0) updateCartActualWeight(item.productId, item.colorName, val);
                          }}
                          onBlur={() => setWeightTexts(p => { const n = { ...p }; delete n[awKey]; return n; })}
                        />
                        <Text style={[styles.stepperUnit, { color: colors.mutedForeground }]}>{unitName}</Text>
                        <Pressable
                          onPress={() => updateCartActualWeight(item.productId, item.colorName, fmt(aw + 1))}
                          style={[styles.qtyBtn, { backgroundColor: colors.gold }]}
                        >
                          <Icon name="plus" size={14} color={colors.background} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                  </View>
                  );
                })()}
              </View>
            ))}

            <View style={[styles.notesSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.notesLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                ملاحظات
              </Text>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    borderRadius: colors.radius - 4,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder="أي تفاصيل أو متطلبات خاصة..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                textAlign="right"
              />
            </View>

            {editOrderId && (
              <Pressable
                onPress={() => router.push("/(tabs)/products")}
                style={[styles.browseBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 4 }]}
              >
                <Icon name="package-plus" size={16} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  اختيار منتجات بديلة
                </Text>
              </Pressable>
            )}

            {hasPiecesOrder && !editOrderId && (
              <View style={[styles.salesNote, { backgroundColor: colors.gold + "11", borderColor: colors.gold + "33", borderRadius: colors.radius }]}>
                <View style={styles.salesNoteInfoRow}>
                  <Icon name="info" size={16} color={colors.gold} />
                  <Text style={[styles.salesNoteText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    الوزن/الأمتار التقديرية لكل ثوب
                  </Text>
                </View>
                {cart.filter(i => i.orderType === "pieces").map((item, idx) => (
                  <View key={idx} style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingVertical: 2 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", flex: 1 }}>
                      {item.productName} ({item.colorName}) × {item.quantity}
                    </Text>
                    <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      ≈ {item.quantity * (item.unit === "meter" ? 100 : 20) * item.unitPrice} ج.م
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!editOrderId && (
              <View style={[styles.paymentSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.paymentHeader}>
                  <Icon name="truck" size={18} color={colors.gold} />
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "right" }}>
                    طريقة الاستلام
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {(["branch", "shipping"] as FulfillmentType[]).map((ft) => {
                    if (ft === "branch" && branchesList.length === 0) return null;
                    if (ft === "shipping" && !hasEnabledShippingProvider) return null;
                    const isSel = fulfillmentType === ft;
                    const label = ft === "branch" ? "الاستلام من فروعنا" : "شحن / توصيل";
                    const desc = ft === "branch" ? "اختر الفرع المناسب لك" : "توصيل عبر شركة شحن (السعر غير شامل ثمن الشحن)";
                    const icn = ft === "branch" ? "map-pin" : "truck";
                    return (
                      <React.Fragment key={ft}>
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setFulfillmentType(ft);
                            if (ft !== "branch") setSelectedBranchId(null);
                            if (ft !== "shipping") setSelectedShippingProviderId(null);
                          }}
                          style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12, borderRadius: colors.radius - 4, borderWidth: isSel ? 1.5 : 1, borderColor: isSel ? colors.gold : colors.border, backgroundColor: isSel ? colors.gold + "12" : colors.surface }}
                        >
                          <Icon name={icn as any} size={18} color={isSel ? colors.gold : colors.mutedForeground} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: isSel ? colors.gold : colors.foreground, fontFamily: isSel ? "Inter_700Bold" : "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>{label}</Text>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 2 }}>{desc}</Text>
                          </View>
                          {isSel && (
                            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
                              <Icon name="check" size={11} color={colors.background} />
                            </View>
                          )}
                        </Pressable>

                        {/* Branches list appears directly under the pickup-from-branch button when selected */}
                        {ft === "branch" && isSel && branchesList.length > 0 && (
                          <View style={{ gap: 6, marginRight: 12, marginLeft: 4 }}>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "right" }}>اختر الفرع</Text>
                            {branchesList.map((b) => {
                              const sel = selectedBranchId === b.id;
                              return (
                                <Pressable
                                  key={b.id}
                                  onPress={() => setSelectedBranchId(b.id)}
                                  style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: sel ? colors.gold : colors.border, backgroundColor: sel ? colors.gold + "12" : colors.surface, gap: 4 }}
                                >
                                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                                    <Icon name={sel ? "check-circle" : "circle"} size={14} color={sel ? colors.gold : colors.mutedForeground} />
                                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, flex: 1, textAlign: "right" }}>{b.name}</Text>
                                  </View>
                                  {b.address ? (
                                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>{b.address}</Text>
                                  ) : null}
                                  {b.mapsUrl ? (
                                    <Pressable onPress={() => Linking.openURL(b.mapsUrl!).catch(() => {})} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                                      <Icon name="map" size={11} color="#3498DB" />
                                      <Text style={{ color: "#3498DB", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>موقع الفرع</Text>
                                    </Pressable>
                                  ) : null}
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>

                {fulfillmentType === "shipping" && (
                  <>
                    <View style={{ gap: 6, marginTop: 4 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "right" }}>اختر شركة الشحن</Text>
                      {shippingProvidersList.filter((p) => p.enabled !== false).map((p) => {
                        const sel = selectedShippingProviderId === p.id;
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => setSelectedShippingProviderId(p.id)}
                            style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: sel ? colors.gold : colors.border, backgroundColor: sel ? colors.gold + "12" : colors.surface, flexDirection: "row-reverse", alignItems: "center", gap: 8 }}
                          >
                            <Icon name={sel ? "check-circle" : "circle"} size={14} color={sel ? colors.gold : colors.mutedForeground} />
                            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, flex: 1, textAlign: "right" }}>{p.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "right" }}>
                          عنوان الشحن <Text style={{ color: "#E74C3C" }}>*</Text>
                        </Text>
                        {userAddresses.length > 0 && (
                          <Pressable
                            onPress={() => router.push("/profile/addresses" as any)}
                            hitSlop={8}
                          >
                            <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>إدارة العناوين</Text>
                          </Pressable>
                        )}
                      </View>

                      {userAddresses.length === 0 && !showAddAddressForm && (
                        <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E74C3C44", backgroundColor: "#E74C3C10", gap: 8 }}>
                          <Text style={{ color: "#C0392B", fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "right" }}>
                            لا توجد لديك عناوين شحن محفوظة
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", lineHeight: 18 }}>
                            يرجى إضافة عنوان شحن لمتابعة الطلب.
                          </Text>
                          <Pressable
                            onPress={() => setShowAddAddressForm(true)}
                            style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 })}
                          >
                            <Icon name="plus" size={14} color="#000" />
                            <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>إضافة عنوان شحن</Text>
                          </Pressable>
                        </View>
                      )}

                      {userAddresses.length > 0 && userAddresses.map((a) => {
                        const sel = selectedAddressId === a.id;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAddressId(a.id); }}
                            style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: sel ? colors.gold : colors.border, backgroundColor: sel ? colors.gold + "12" : colors.surface, flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 }}
                          >
                            <Icon name={sel ? "check-circle" : "circle"} size={14} color={sel ? colors.gold : colors.mutedForeground} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                {a.label ? (
                                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "right" }}>{a.label}</Text>
                                ) : (
                                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "right" }}>{a.city}</Text>
                                )}
                                {a.isDefault && (
                                  <View style={{ backgroundColor: colors.gold + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 9 }}>افتراضي</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", lineHeight: 16 }}>
                                {formatAddress(a)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}

                      {userAddresses.length > 0 && !showAddAddressForm && (
                        <Pressable
                          onPress={() => setShowAddAddressForm(true)}
                          style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.gold + "55", borderStyle: "dashed", opacity: pressed ? 0.7 : 1 })}
                        >
                          <Icon name="plus" size={13} color={colors.gold} />
                          <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 12 }}>إضافة عنوان جديد</Text>
                        </Pressable>
                      )}

                      {showAddAddressForm && (
                        <View style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.gold + "55", backgroundColor: colors.surface, gap: 8 }}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "right" }}>عنوان جديد</Text>
                          <TextInput
                            value={newAddrLabel}
                            onChangeText={setNewAddrLabel}
                            placeholder="اسم مختصر (مثل: المنزل، الشغل) — اختياري"
                            placeholderTextColor={colors.mutedForeground}
                            style={{
                              backgroundColor: colors.input,
                              borderWidth: 1,
                              borderColor: colors.gold + "44",
                              borderRadius: 8,
                              padding: 10,
                              color: colors.foreground,
                              textAlign: "right",
                              fontFamily: "Inter_400Regular",
                              fontSize: 13,
                            }}
                          />
                          <GovernoratePicker
                            value={newAddrCity}
                            onChange={(v) => { setNewAddrCity(v); setNewAddrDistrict(""); }}
                            invalid={!newAddrCity.trim()}
                            placeholder="المحافظة *"
                          />
                          <CityPicker
                            governorate={newAddrCity}
                            value={newAddrDistrict}
                            onChange={setNewAddrDistrict}
                            invalid={!newAddrDistrict.trim()}
                            placeholder="المدينة / المركز *"
                          />
                          {[
                            { ph: "الشارع *", val: newAddrStreet, set: setNewAddrStreet, req: true },
                            { ph: "المبنى / رقم العقار (اختياري)", val: newAddrBuilding, set: setNewAddrBuilding, req: false },
                            { ph: "علامة مميزة (اختياري)", val: newAddrLandmark, set: setNewAddrLandmark, req: false },
                          ].map((f) => (
                            <TextInput
                              key={f.ph}
                              value={f.val}
                              onChangeText={f.set}
                              placeholder={f.ph}
                              placeholderTextColor={colors.mutedForeground}
                              style={{
                                backgroundColor: colors.input,
                                borderWidth: 1,
                                borderColor: f.req && !f.val.trim() ? colors.border : colors.gold + "44",
                                borderRadius: 8,
                                padding: 10,
                                color: colors.foreground,
                                textAlign: "right",
                                fontFamily: "Inter_400Regular",
                                fontSize: 13,
                              }}
                            />
                          ))}
                          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                            <Pressable
                              onPress={handleSaveNewAddress}
                              disabled={savingAddress}
                              style={({ pressed }) => ({ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.gold, opacity: (pressed || savingAddress) ? 0.7 : 1 })}
                            >
                              <Icon name="check" size={14} color="#000" />
                              <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                                {savingAddress ? "جاري الحفظ..." : "حفظ العنوان"}
                              </Text>
                            </Pressable>
                            {userAddresses.length > 0 && (
                              <Pressable
                                onPress={() => setShowAddAddressForm(false)}
                                style={({ pressed }) => ({ paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}
                              >
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>إلغاء</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                    {!isStaff && (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#F5A62315", borderColor: "#F5A62344", borderWidth: 1, borderRadius: colors.radius - 6, marginTop: 4 }}>
                      <Icon name="alert-triangle" size={14} color="#F5A623" />
                      <Text style={{ color: "#B5790E", fontFamily: "Inter_700Bold", fontSize: 12, flex: 1, textAlign: "right" }}>
                        السعر غير شامل ثمن الشحن
                      </Text>
                    </View>
                    )}
                  </>
                )}
              </View>
            )}

            {!editOrderId && (
              <View style={[styles.paymentSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.paymentHeader}>
                  <Icon name="wallet" size={18} color={colors.gold} />
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "right" }}>
                    طريقة الدفع
                  </Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", lineHeight: 18 }}>
                  يرجى سداد قيمة الفاتورة بإحدى الطرق التالية
                </Text>

                <View style={styles.paymentGrid}>
                  {PAYMENT_METHODS.map((pm) => {
                    const isSelected = selectedPayment === pm.key;
                    const pmColor = PAYMENT_COLORS[pm.key];
                    return (
                      <Pressable
                        key={pm.key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedPayment(pm.key);
                        }}
                        style={[
                          styles.paymentOption,
                          {
                            backgroundColor: isSelected ? pmColor + "15" : colors.surface,
                            borderColor: isSelected ? pmColor : colors.border,
                            borderRadius: colors.radius - 4,
                            borderWidth: isSelected ? 1.5 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.paymentOptionIcon, { backgroundColor: isSelected ? pmColor + "22" : colors.border + "44" }]}>
                          <Icon name={PAYMENT_METHOD_ICONS[pm.key]} size={18} color={isSelected ? pmColor : colors.mutedForeground} />
                        </View>
                        <Text style={{
                          color: isSelected ? pmColor : colors.foreground,
                          fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                          fontSize: 13,
                        }}>
                          {pm.short}
                        </Text>
                        <Text style={{
                          color: colors.mutedForeground + (isSelected ? "" : "99"),
                          fontFamily: "Inter_400Regular",
                          fontSize: 10,
                        }}>
                          {pm.desc}
                        </Text>
                        {isSelected && (
                          <View style={[styles.paymentCheck, { backgroundColor: pmColor }]}>
                            <Icon name="check" size={10} color="#FFF" />
                          </View>
                        )}
                        {pm.key === "instapay" && isSelected && (
                          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 3, marginTop: 2 }}>
                            <Icon name="check-circle" size={10} color="#2ECC71" />
                            <Text style={{ color: "#2ECC71", fontFamily: "Inter_400Regular", fontSize: 9 }}>بدون رسوم</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </KeyboardAwareScroll>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: bottomPad,
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
              },
            ]}
          >
            <View style={{ gap: 4 }}>
              {totalPrice > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {hasPiecesOrder ? "الإجمالي التقديري" : "المجموع الكلي"}
                  </Text>
                  <View style={{ alignItems: "flex-start" }}>
                    {selectedPayment === "ewallet" && feeAmount > 0 ? (
                      <>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textDecorationLine: "line-through" }}>
                          {hasPiecesOrder ? "≈ " : ""}{totalPrice.toLocaleString("ar-EG")} ج.م
                        </Text>
                        <Text style={[styles.totalPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                          {hasPiecesOrder ? "≈ " : ""}{totalWithFee.toLocaleString("ar-EG")} ج.م
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.totalPrice, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                        {hasPiecesOrder ? "≈ " : ""}{totalPrice.toLocaleString("ar-EG")} ج.م
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
            {selectedPayment && !editOrderId && (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 2 }}>
                <Icon name={PAYMENT_METHOD_ICONS[selectedPayment]} size={14} color={PAYMENT_COLORS[selectedPayment]} />
                <Text style={{ color: PAYMENT_COLORS[selectedPayment], fontFamily: "Inter_500Medium", fontSize: 12 }}>
                  {PAYMENT_METHODS.find(p => p.key === selectedPayment)?.short}
                </Text>
              </View>
            )}
            <GoldButton
              label={editOrderId ? "تأكيد التعديل" : "إرسال الطلب"}
              onPress={handleCheckout}
              loading={loading}
              style={{ width: "100%" }}
              size="lg"
            />
          </View>

          {renderPaymentModal()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  emptyText: { fontSize: 18 },
  list: { padding: 16, gap: 12 },
  cartItem: { borderWidth: 1, padding: 14, gap: 12 },
  itemHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  companionList: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  companionLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  itemInfo: { flex: 1, gap: 4, alignItems: "flex-end" },
  itemName: { fontSize: 15, textAlign: "right" },
  colorInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  colorLabel: { fontSize: 13 },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  itemFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemPrice: { fontSize: 15 },
  contactSales: { fontSize: 12, flex: 1, textAlign: "right" },
  qtyControls: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  qty: { fontSize: 16, minWidth: 24, textAlign: "center" },
  editRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  editRowLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "right" },
  stepperGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  stepperInput: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    minWidth: 50,
    textAlign: "center",
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  stepperUnit: { fontFamily: "Inter_400Regular", fontSize: 12, minWidth: 30, textAlign: "center" },
  notesSection: { borderWidth: 1, padding: 14, gap: 10 },
  notesLabel: { fontSize: 15, textAlign: "right" },
  notesInput: {
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
  },
  browseBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
  salesNote: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  salesNoteInfoRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  salesNoteText: { flex: 1, fontSize: 13, textAlign: "right", lineHeight: 20 },
  callSalesBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  paymentSection: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  paymentHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  paymentGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentOption: {
    width: "48%" as any,
    flexBasis: "47%",
    flexGrow: 1,
    padding: 12,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  paymentOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCheck: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 14 },
  totalPrice: { fontSize: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
    alignItems: "center",
  },
  modalCancelBtn: {
    paddingVertical: 8,
  },
  paymentInfoSection: {
    gap: 12,
  },
  paymentInfoBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  copyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  copyRowContent: {
    flex: 1,
    gap: 3,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  amountBox: {
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  feeBreakdown: {
    width: "100%",
    gap: 8,
  },
  feeRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feeDivider: {
    height: 1,
    width: "100%",
    marginVertical: 4,
  },
});
