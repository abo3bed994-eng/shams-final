nst targetCanon = canonicalPhone(updatedUser.phone);
    setRegisteredCustomersState((prev) => {
      // Match by canonical phone. If a duplicate exists under another format,
      // collapse them into one record (the updated one).
      const matches = prev.filter((c) => samePhone(c.phone, updatedUser.phone));
      let updated: User[];
      if (matches.length === 0) {
        updated = [...prev, updatedUser];
      } else {
        // Drop ALL existing matches, then add the single merged updated record.
        const merged: User = matches.reduce((acc, m) => ({ ...m, ...acc }), updatedUser as User);
        updated = prev.filter((c) => !samePhone(c.phone, updatedUser.phone)).concat(merged);
        // If the existing matches included docs with different phone strings,
        // schedule cleanup of the orphan Firestore docs.
        for (const m of matches) {
          if (m.phone && m.phone !== updatedUser.phone) {
            FS.deleteCustomer(m.phone).catch(() => {});
          }
        }
      }
      AsyncStorage.setItem("registered_customers", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    const currentUser = userRef.current;
    if (currentUser && samePhone(currentUser.phone, updatedUser.phone)) {
      const synced = { ...currentUser, ...updatedUser };
      setUserState(synced);
      persistUserSafe(synced).catch(() => {});
    }
    FS.saveCustomer(updatedUser).catch(() => {});
    // Touch tag for canonical map consumers
    void targetCanon;
  }, []);

  const addAddress = useCallback(
    async (data: Omit<SavedAddress, "id" | "createdAt">): Promise<SavedAddress | null> => {
      const u = userRef.current;
      if (!u) return null;
      const newAddr: SavedAddress = {
        ...data,
        id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      const existing = u.addresses ?? [];
      // Auto-default if this is the first address, or if explicitly requested
      const shouldBeDefault = newAddr.isDefault || existing.length === 0;
      const next = (shouldBeDefault ? existing.map((a) => ({ ...a, isDefault: false })) : existing).concat({
        ...newAddr,
        isDefault: shouldBeDefault,
      });
      updateRegisteredCustomer({ ...u, addresses: next });
      return { ...newAddr, isDefault: shouldBeDefault };
    },
    [updateRegisteredCustomer]
  );

  const updateAddress = useCallback(
    async (addressId: string, patch: Partial<Omit<SavedAddress, "id">>) => {
      const u = userRef.current;
      if (!u || !u.addresses) return;
      let next = u.addresses.map((a) => (a.id === addressId ? { ...a, ...patch, id: a.id } : a));
      // If patch promotes to default, demote others
      if (patch.isDefault === true) {
        next = next.map((a) => (a.id === addressId ? { ...a, isDefault: true } : { ...a, isDefault: false }));
      }
      updateRegisteredCustomer({ ...u, addresses: next });
    },
    [updateRegisteredCustomer]
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      const u = userRef.current;
      if (!u || !u.addresses) return;
      const wasDefault = u.addresses.find((a) => a.id === addressId)?.isDefault;
      let next = u.addresses.filter((a) => a.id !== addressId);
      // Promote first remaining address to default if we removed the default one
      if (wasDefault && next.length > 0) {
        next = next.map((a, i) => ({ ...a, isDefault: i === 0 }));
      }
      updateRegisteredCustomer({ ...u, addresses: next });
    },
    [updateRegisteredCustomer]
  );

  const setDefaultAddress = useCallback(
    async (addressId: string) => {
      const u = userRef.current;
      if (!u || !u.addresses) return;
      const next = u.addresses.map((a) => ({ ...a, isDefault: a.id === addressId }));
      updateRegisteredCustomer({ ...u, addresses: next });
    },
    [updateRegisteredCustomer]
  );

  const favorites = user?.favorites ?? [];

  const isFavorite = useCallback(
    (productId: string) => (userRef.current?.favorites ?? []).includes(productId),
    []
  );

  const toggleFavorite = useCallback(
    (productId: string) => {
      const u = userRef.current;
      if (!u) return;
      const existing = u.favorites ?? [];
      const next = existing.includes(productId)
        ? existing.filter((id) => id !== productId)
        : [productId, ...existing];
      updateRegisteredCustomer({ ...u, favorites: next });
    },
    [updateRegisteredCustomer]
  );

  const deleteRegisteredCustomer = useCallback((phone: string) => {
    setRegisteredCustomersState((prev) => {
      // Delete ALL records that match canonically (handles legacy/E.164 twins).
      const toDelete = prev.filter((c) => samePhone(c.phone, phone));
      const updated = prev.filter((c) => !samePhone(c.phone, phone));
      AsyncStorage.setItem("registered_customers", JSON.stringify(updated)).catch(() => {});
      // Delete every distinct Firestore phone-key found.
      const seenKeys = new Set<string>();
      for (const t of toDelete) {
        if (t.phone && !seenKeys.has(t.phone)) {
          seenKeys.add(t.phone);
          FS.deleteCustomer(t.phone).catch(() => {});
        }
      }
      // Always also try the literal phone the caller passed (in case it isn't in local state).
      if (!seenKeys.has(phone)) {
        FS.deleteCustomer(phone).catch(() => {});
      }
      return updated;
    });
  }, []);

  const setProducts = useCallback(async (prods: Product[]) => {
    // Stamp each product with its new array index so the Firestore subscription
    // (which sorts by `a.order - b.order`) preserves the drag-reordered sequence.
    const withOrder = prods.map((p, i) => ({ ...p, order: i }));
    setProductsState(withOrder);
    await AsyncStorage.setItem("products", JSON.stringify(withOrder));
    withOrder.forEach((p) => FS.saveProduct(p).catch(() => {}));
  }, []);

  // Single-product helpers — avoid re-writing the entire collection on
  // every add/edit/delete. Faster local UX and faster real-time propagation
  // to other clients via the products subscription.
  const addProductOne = useCallback(async (product: Product) => {
    setProductsState((prev) => {
      const next = [product, ...prev];
      AsyncStorage.setItem("products", JSON.stringify(next)).catch(() => {});
      return next;
    });
    await FS.saveProduct(product);
  }, []);

  const updateProductOne = useCallback(async (product: Product) => {
    setProductsState((prev) => {
      const next = prev.map((p) => (p.id === product.id ? product : p));
      AsyncStorage.setItem("products", JSON.stringify(next)).catch(() => {});
      return next;
    });
    await FS.saveProduct(product);
  }, []);

  const deleteProductOne = useCallback(async (productId: string) => {
    setProductsState((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      AsyncStorage.setItem("products", JSON.stringify(next)).catch(() => {});
      return next;
    });
    await FS.deleteProduct(productId);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.productId === item.productId && c.colorName === item.colorName && c.orderType === item.orderType
      );
      if (existing) {
        return prev.map((c) =>
          c.productId === item.productId && c.colorName === item.colorName && c.orderType === item.orderType
            ? withRecalculatedCompanions({ ...c, quantity: c.quantity + item.quantity })
            : c
        );
      }
      return [...prev, withRecalculatedCompanions(item)];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, colorName: string) => {
    setCart((prev) =>
      prev.filter((c) => !(c.productId === productId && c.colorName === colorName))
    );
  }, []);

  const updateCartItem = useCallback(
    (productId: string, colorName: string, quantity: number) => {
      setCart((prev) =>
        quantity === 0
          ? prev.filter((c) => !(c.productId === productId && c.colorName === colorName))
          : prev.map((c) =>
              c.productId === productId && c.colorName === colorName
                ? withRecalculatedCompanions({ ...c, quantity })
                : c
            )
      );
    },
    []
  );

  const clearCart = useCallback(() => setCart([]), []);

  const setOrders = useCallback(async (ords: Order[]) => {
    setOrdersState(ords);
    await AsyncStorage.setItem("orders", JSON.stringify(ords));
  }, []);

  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  const saveOrderReliable = async (order: Order): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await FS.saveOrder(order);
        return true;
      } catch (err) {
        console.warn(`saveOrder attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    try {
      const pendingRaw = await AsyncStorage.getItem("pendingOrderSaves");
      const pending: Order[] = pendingRaw ? JSON.parse(pendingRaw) : [];
      const filtered = pending.filter((o) => o.id !== order.id);
      filtered.push(order);
      await AsyncStorage.setItem("pendingOrderSaves", JSON.stringify(filtered));
    } catch {}
    return false;
  };

  useEffect(() => {
    const flushPending = async () => {
      try {
        const pendingRaw = await AsyncStorage.getItem("pendingOrderSaves");
        if (!pendingRaw) return;
        const pending: Order[] = JSON.parse(pendingRaw);
        if (!pending.length) return;
        const remaining: Order[] = [];
        for (const o of pending) {
          try { await FS.saveOrder(o); } catch { remaining.push(o); }
        }
        await AsyncStorage.setItem("pendingOrderSaves", JSON.stringify(remaining));
      } catch {}
    };
    flushPending();
    const id = setInterval(flushPending, 30000);
    return () => clearInterval(id);
  }, []);

  // Auto-release scheduled orders when working hours start.
  // Runs every 60 seconds; idempotent — safe to run on multiple devices.
  useEffect(() => {
    const releaseDueScheduled = async () => {
      try {
        const wh = settings.workingHours;
        if (!wh || wh.length === 0) return;
        if (!isWithinWorkingHours(wh)) return;
        const due = ordersRef.current.filter((o) => o.status === "scheduled");
        if (due.length === 0) return;
        const nowIso = new Date().toISOString();
        const released: Order[] = due.map((o) => ({
          ...o,
          status: "pending" as OrderStatus,
          releasedAt: nowIso,
        }));
        const updated = ordersRef.current.map((o) => {
          const r = released.find((x) => x.id === o.id);
          return r ?? o;
        });
        setOrdersState(updated);
        ordersRef.current = updated;
        await AsyncStorage.setItem("orders", JSON.stringify(updated));
        for (const order of released) {
          // Persist the new status to Firestore so all devices converge.
          FS.saveOrder(order).catch(() => {});
          // Notify staff (push + in-app).
          const staffNotif: Notification = {
            id: `notif_order_released_${order.id}`,
            title: "🛍️ طلب جديد (مجدول)",
            body: `طلب من ${order.userName} (${order.userPhone}) — كان مجدولاً والآن جاهز`,
            createdAt: nowIso,
            read: false,
            targetRole: "staff",
            sourceUserId: order.userId,
            linkedOrderId: order.id,
          };
          FS.saveNotification(staffNotif).catch(() => {});
          notifyStaffNewOrder(order.id, order.userName).catch(() => {});
          // Notify customer that work has begun on their order.
          const recipientPhone = resolveRecipientPhone(order.userId, order.userPhone);
          const custNotif: Notification = {
            id: `notif_release_cust_${order.id}`,
            title: "✅ بدأ العمل على طلبك",
            body: `طلبك #${order.id.slice(0, 12)} وصل إلى فريق العمل وجارٍ مراجعته الآن`,
            createdAt: nowIso,
            read: false,
            targetUserId: order.userId,
            targetUserPhone: recipientPhone,
            linkedOrderId: order.id,
          };
          FS.saveNotification(custNotif).catch(() => {});
          if (recipientPhone) {
            notifyUserByPhone(
              recipientPhone,
              "✅ بدأ العمل على طلبك",
              `طلبك #${order.id.slice(0, 12)} وصل إلى فريق العمل`,
              { type: "order_released", orderId: order.id }
            ).catch(() => {});
          }
        }
      } catch {}
    };
    releaseDueScheduled();
    const id = setInterval(releaseDueScheduled, 60000);
    return () => clearInterval(id);
  }, [settings.workingHours]);

  const addOrder = useCallback(
    async (order: Order) => {
      const updated = [...ordersRef.current, order];
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      const saved = await saveOrderReliable(order);
      if (!saved) {
        Alert.alert(
          "تنبيه",
          "تم استلام طلبك محلياً، لكن لم يصل للسيرفر بعد. سنحاول إعادة الإرسال تلقائياً عند توفّر الإنترنت."
        );
      }
      // Suppress staff notification for scheduled orders — they'll be notified at release time.
      if (order.status === "scheduled") {
        return;
      }
      const staffNotif: Notification = {
        id: `notif_order_new_${order.id}`,
        title: "🛍️ طلب جديد",
        body: `وصل طلب جديد من ${order.userName} (${order.userPhone})`,
        createdAt: new Date().toISOString(),
        read: false,
        targetRole: "staff",
        sourceUserId: order.userId,
        linkedOrderId: order.id,
      };
      FS.saveNotification(staffNotif).catch(() => {});
      notifyStaffNewOrder(order.id, order.userName).catch(() => {});
    },
    []
  );

  // Best-effort save with retry/backoff. Keeps optimistic UI authoritative
  // for the in-flight window; if all retries fail, surfaces a toast so the
  // user knows the change might not be persisted server-side.
  const saveOrderWithRetry = useCallback((order: Order, orderId: string) => {
    let attempt = 0;
    const tryOnce = () => {
      FS.saveOrder(order)
        .then(() => {
          setTimeout(() => pendingOrderUpdatesRef.current.delete(orderId), 2000);
        })
        .catch(() => {
          attempt += 1;
          if (attempt < 3) {
            setTimeout(tryOnce, 500 * attempt);
          } else {
            pendingOrderUpdatesRef.current.delete(orderId);
            showToast("تعذّر مزامنة حالة الطلب — تحقق من الاتصال", "error");
          }
        });
    };
    tryOnce();
  }, [showToast]);

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, assignedToId?: string, assignedToName?: string) => {
      const prevOrder = ordersRef.current.find((o) => o.id === orderId);
      if (!prevOrder) return;
      // Idempotency: same status, same staff → no-op (prevents double-tap glitches)
      if (
        prevOrder.status === status &&
        (status !== "received" || !assignedToId || prevOrder.assignedTo === assignedToId)
      ) {
        return;
      }

      const patch: Partial<Order> = { status };
      const claimerPhone = userRef.current?.id === assignedToId ? userRef.current?.phone : undefined;
      if (status === "received" && assignedToId) {
        patch.assignedTo = assignedToId;
        patch.assignedToName = assignedToName;
        if (claimerPhone) patch.assignedToPhone = claimerPhone;
      }
      if (status === "pending") {
        patch.assignedTo = "";
        patch.assignedToName = "";
        patch.assignedToPhone = "";
      }
      if (status === "delivered") {
        patch.deliveredAt = new Date().toISOString();
      }
      // Once an order becomes ready / ready-to-ship, customer editing is closed
      // automatically (staff no longer needs the customer to adjust quantities).
      if (status === "ready_to_ship" || status === "ready") {
        patch.editable = false;
        // Finalize estimated weights: any pieces item that never got an actual
        // weight recorded during preparing has its per-bolt estimate locked in
        // as the actual weight, so the order stops showing "تقديري" once ready.
        const needsFinalize = prevOrder.items.some(
          (it) => it.orderType === "pieces" && !it.actualWeight
        );
        if (needsFinalize) {
          const finalizedItems = prevOrder.items.map((it) =>
            it.orderType === "pieces" && !it.actualWeight
              ? { ...it, actualWeight: it.quantity * (it.unit === "meter" ? 100 : 20) }
              : it
          );
          patch.items = finalizedItems;
          patch.total = computeItemsTotal(finalizedItems);
        }
      }
      // Shipping invariant: cannot advance to "shipped" without waybill image + provider
      if (status === "shipped" && (prevOrder.fulfillmentType ?? "branch") === "shipping") {
        if (!prevOrder.shippingWaybillNumber && !prevOrder.shippingWaybillImage) {
          Alert.alert("بوليصة الشحن مطلوبة", "يجب إدخال رقم بوليصة الشحن قبل تأكيد الشحن.");
          return;
        }
        patch.shippedAt = new Date().toISOString();
      }

      // Invoice retention: a saved invoice is kept only once the order reaches
      // its FINAL stage (shipping → "shipped", otherwise → "delivered"). Any
      // status change to a non-final stage clears a previously saved invoice so
      // stale invoices never carry across stages.
      const finalStage: OrderStatus =
        (prevOrder.fulfillmentType ?? "branch") === "shipping" ? "shipped" : "delivered";
      const clearInvoice = status !== finalStage;
      const invoiceCleared = clearInvoice && prevOrder.invoiceImage !== undefined;

      // INSTANT optimistic UI update FIRST — never wait for Firestore.
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        const merged = { ...o, ...patch };
        if (clearInvoice && merged.invoiceImage !== undefined) {
          const { invoiceImage, ...rest } = merged;
          return rest as typeof o;
        }
        return merged;
      });
      const updatedOrder = updated.find((o) => o.id === orderId)!;
      setOrdersState(updated);
      ordersRef.current = updated;
      // Mark this order as "in-flight" so the orders subscription won't
      // briefly revert it if a stale snapshot arrives before our write commits.
      pendingOrderUpdatesRef.current.set(orderId, Date.now());
      AsyncStorage.setItem("orders", JSON.stringify(updated)).catch(() => {});

      // Send the customer status notification. For "received" this is only
      // called AFTER a successful atomic claim, so a staff member who lost the
      // race never notifies the customer (prevents duplicate "تم استلام طلبك").
      const sendStatusNotif = () => {
        const statusLabels: Record<string, string> = {
          received: "تم استلام طلبك",
          preparing: "طلبك قيد التجهيز",
          ready: "طلبك جاهز للاستلام",
          ready_to_ship: "طلبك جاهز للشحن",
          shipped: "تم شحن طلبك",
          delivered: "تم تسليم طلبك بنجاح",
          pending: "تم إلغاء استلام طلبك — سيتم مراجعته مجدداً",
        };
        if (!statusLabels[status]) return;
        const recipientPhone = resolveRecipientPhone(updatedOrder.userId, updatedOrder.userPhone);
        const custNotif: Notification = {
          id: `notif_status_${orderId}_${status}_${Date.now()}`,
          title: statusLabels[status],
          body: `تم تحديث حالة طلبك #${orderId.slice(0, 12)}`,
          createdAt: new Date().toISOString(),
          read: false,
          targetUserId: updatedOrder.userId,
          targetUserPhone: recipientPhone,
          linkedOrderId: orderId,
        };
        FS.saveNotification(custNotif).catch((error) => {
          console.warn("[order-status-notification] Firestore save failed:", error);
        });
        if (recipientPhone) {
          notifyUserByPhone(
            recipientPhone,
            statusLabels[status],
            `طلبك #${orderId.slice(0, 12)} — ${statusLabels[status]}`,
            { type: "order_status", orderId, status }
          ).catch(() => {});
        }
      };

      // Atomic claim runs in BACKGROUND for "received" — UI already moved.
      // If another staff already claimed it, reflect the winner + alert.
      if (status === "received" && assignedToId) {
        FS.claimOrder(orderId, assignedToId, assignedToName ?? "موظف", claimerPhone).then((claim) => {
          if (!claim.ok && claim.reason === "already_taken") {
            // Someone else got it first → show the order as received by the
            // winner so OUR receive button hides immediately (and we do NOT
            // notify the customer — we never actually claimed it).
            const takenOrder: Order = {
              ...prevOrder,
              status: "received",
              assignedTo: claim.takenById ?? prevOrder.assignedTo,
              assignedToName: claim.takenBy ?? prevOrder.assignedToName,
              assignedToPhone: claim.takenByPhone ?? prevOrder.assignedToPhone,
            };
            const reverted = ordersRef.current.map((o) => (o.id === orderId ? takenOrder : o));
            ordersRef.current = reverted;
            setOrdersState(reverted);
            AsyncStorage.setItem("orders", JSON.stringify(reverted)).catch(() => {});
            pendingOrderUpdatesRef.current.delete(orderId);
            Alert.alert("الطلب محجوز", `استلم هذا الطلب الموظف ${claim.takenBy ?? ""} قبل قليل.`);
          } else if (!claim.ok) {
            // Transaction failed (network) — retry via saveOrder as a fallback
            saveOrderWithRetry(updatedOrder, orderId);
            sendStatusNotif();
          } else {
            // Claim succeeded — the claim transaction only writes status/assignment
            // fields, so if we cleared a stale invoice, persist the full order
            // (setDoc full overwrite) to actually drop invoiceImage in Firestore.
            if (invoiceCleared) saveOrderWithRetry(updatedOrder, orderId);
            // Clear pending flag after a short grace window
            setTimeout(() => pendingOrderUpdatesRef.current.delete(orderId), 3000);
            sendStatusNotif();
          }
        }).catch(() => {
          saveOrderWithRetry(updatedOrder, orderId);
          sendStatusNotif();
        });
      } else {
        saveOrderWithRetry(updatedOrder, orderId);
        sendStatusNotif();
      }
    },
    []
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      const target = ordersRef.current.find((o) => o.id === orderId);
      const updated = ordersRef.current.filter((o) => o.id !== orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      FS.deleteOrder(orderId).catch(() => {});
      const me = userRef.current;
      if (me) {
        FS.appendAuditLog({
          actorId: me.id,
          actorName: me.name ?? "—",
          actorRole: me.role,
          action: "order.delete",
          targetId: orderId,
          targetType: "order",
          details: target ? { customerName: target.userName, total: target.total } : {},
        }).catch(() => {});
      }
    },
    []
  );

  const cancelOrder = useCallback(
    async (orderId: string, opts?: { notifyStaff?: boolean }) => {
      const updated = ordersRef.current.map((o) =>
        o.id === orderId
          ? { ...o, status: "cancelled" as OrderStatus, editable: false, editableExpiresAt: undefined }
          : o
      );
      const cancelled = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      // Use patchOrder (targeted field update) so only the `status` field changes
      // in Firestore — the customer cancel rule uses affectedKeys().hasOnly(['status']).
      // A full setDoc via saveOrder would also write `editable: false` which is
      // outside the allowed set and causes a permission-denied error.
      if (cancelled) await FS.patchOrder(orderId, { status: "cancelled", editable: false });
      // Notify the staff member who received the order (or the staff role at large)
      // that the customer cancelled it — used when a customer empties their order
      // while editing, or when the edit window auto-cancels an all-unavailable order.
      if (cancelled && opts?.notifyStaff) {
        const assignedStaffId = cancelled.assignedTo;
        const assignedStaffPhone = cancelled.assignedToPhone;
        const staffNotif: Notification = {
          id: `notif_cancelled_${orderId}_${Date.now()}`,
          title: "تم إلغاء الطلب ❌",
          body: `ألغى العميل ${cancelled.userName} طلبه #${orderId.slice(0, 12)} أثناء التعديل`,
          createdAt: new Date().toISOString(),
          read: false,
          sourceUserId: cancelled.userId,
          ...(assignedStaffId
            ? { targetUserId: assignedStaffId, ...(assignedStaffPhone ? { targetUserPhone: assignedStaffPhone } : {}) }
            : { targetRole: "staff" as any }),
          linkedOrderId: orderId,
        };
        const updatedNotifs = [staffNotif, ...notificationsRef.current];
        setNotifications(updatedNotifs);
        await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
        FS.saveNotification(staffNotif).catch(() => {});
        if (assignedStaffId) {
          const staffRecord = registeredCustomersRef.current.find((c) => c.id === assignedStaffId);
          if (staffRecord?.phone) {
            notifyUserByPhone(
              staffRecord.phone,
              "تم إلغاء الطلب ❌",
              `ألغى العميل ${cancelled.userName} طلبه #${orderId.slice(0, 12)}`,
              { type: "order_cancelled", orderId }
            ).catch(() => {});
          }
        }
      }
    },
    []
  );

  const sendOrderMessage = useCallback(
    async (orderId: string, message: string) => {
      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order) return;
      const recipientPhone = resolveRecipientPhone(order.userId, order.userPhone);
      const notif: Notification = {
        id: `notif_msg_${orderId}_${Date.now()}`,
        title: `رسالة بخصوص طلبك #${orderId.slice(0, 12)}`,
        body: message,
        createdAt: new Date().toISOString(),
        read: false,
        targetUserId: order.userId,
        targetUserPhone: recipientPhone,
      };
      const updated = [notif, ...notificationsRef.current];
      setNotifications(updated);
      await AsyncStorage.setItem("notifications", JSON.stringify(updated));
      FS.saveNotification(notif).catch(() => {});
      if (recipientPhone) {
        notifyUserByPhone(
          recipientPhone,
          notif.title,
          message,
          { type: "order_message", orderId }
        ).catch(() => {});
      }
    },
    []
  );

  const setOrderEditable = useCallback(
    async (orderId: string, editable: boolean) => {
      // Toggling editability resets the edit countdown: enabling arms a fresh
      // window immediately (the moment staff request the customer's
      // confirmation), so the countdown bar runs even before the customer opens
      // the order; disabling clears it.
      const expiresAt = editable
        ? new Date(Date.now() + EDIT_WINDOW_MS).toISOString()
        : undefined;
      const updated = ordersRef.current.map((o) =>
        o.id === orderId ? { ...o, editable, editableExpiresAt: expiresAt } : o
      );
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) {
        FS.saveOrder(updatedOrder).catch(() => {});
        if (editable) {
          const recipientPhone = resolveRecipientPhone(updatedOrder.userId, updatedOrder.userPhone);
          const notif: Notification = {
            id: `notif_editable_${orderId}_${Date.now()}`,
            title: "يمكنك تعديل طلبك",
            body: `الخامة غير متوفرة — يمكنك تعديل طلبك #${orderId.slice(0, 12)} واختيار بديل`,
            createdAt: new Date().toISOString(),
            read: false,
            targetUserId: updatedOrder.userId,
            targetUserPhone: recipientPhone,
            linkedOrderId: orderId,
          };
          const updatedNotifs = [notif, ...notificationsRef.current];
          setNotifications(updatedNotifs);
          await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
          FS.saveNotification(notif).catch(() => {});
          if (recipientPhone) {
            notifyUserByPhone(
              recipientPhone,
              notif.title,
              notif.body,
              { type: "order_editable", orderId }
            ).catch(() => {});
          }
        }
      }
    },
    []
  );

  // Sets/clears the edit countdown deadline on an order. The deadline is normally
  // armed by setOrderEditable when staff enable editing; this is used for the
  // legacy-order fallback and to clear the deadline when editing ends or expires.
  const setOrderEditExpiry = useCallback(
    async (orderId: string, expiresAt: string | null) => {
      const updated = ordersRef.current.map((o) =>
        o.id === orderId ? { ...o, editableExpiresAt: expiresAt ?? undefined } : o
      );
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) {
        FS.saveOrder(updatedOrder).catch(() => {});
      }
    },
    []
  );

  // Pre-fills the cart with the order's still-available items (reconciled against
  // staff "mark available" decisions) and enters edit mode, so the customer can
  // browse products directly and pick alternatives without passing through cart.
  const beginOrderEdit = useCallback((orderId: string) => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order) return;
    // Carry items into the cart, dropping only the fully-unavailable ones. Partial
    // items keep their stockStatus/availableQuantity so the cart steppers can cap
    // them at the available amount; the customer edits quantities directly.
    const carried = order.items.reduce<CartItem[]>((acc, it) => {
      if (it.stockStatus === "unavailable") return acc;
      acc.push({ ...it });
      return acc;
    }, []);
    setCart(carried);
    setEditingOrderId(orderId);
  }, []);

  const setOrderInvoiceImage = useCallback(
    async (orderId: string, imageUri: string | null) => {
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        if (imageUri === null) {
          const { invoiceImage, ...rest } = o;
          return rest as typeof o;
        }
        return { ...o, invoiceImage: imageUri };
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) {
        FS.saveOrder(updatedOrder).catch(() => {});
        if (imageUri) {
          const recipientPhone = resolveRecipientPhone(updatedOrder.userId, updatedOrder.userPhone);
          const notif: Notification = {
            id: `notif_invoice_${orderId}_${Date.now()}`,
            title: "تم رفع فاتورة طلبك 🧾",
          body: `تم إرفاق فاتورة طلبك #${orderId.slice(0, 12)} — يمكنك عرضها من صفحة الطلب`,
            createdAt: new Date().toISOString(),
            read: false,
            targetUserId: updatedOrder.userId,
            targetUserPhone: recipientPhone,
            linkedOrderId: orderId,
          };
          const updatedNotifs = [notif, ...notificationsRef.current];
          setNotifications(updatedNotifs);
          AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs)).catch(() => {});
          FS.saveNotification(notif).catch(() => {});
          if (recipientPhone) {
            notifyUserByPhone(
              recipientPhone,
              notif.title,
              notif.body,
              { type: "invoice_uploaded", orderId }
            ).catch(() => {});
          }
        }
      }
    },
    []
  );

  const setOrderTransferProof = useCallback(
    async (orderId: string, imageUri: string | null) => {
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        if (imageUri === null) {
          const { transferProofImage, ...rest } = o;
          return rest as typeof o;
        }
        return { ...o, transferProofImage: imageUri };
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) {
        // Targeted patch (NOT full-doc save): the customer rule only allows
        // changing transferProofImage, so writing the whole doc gets rejected
        // whenever the local copy drifts from the server in any other field.
        await FS.patchOrder(orderId, { transferProofImage: imageUri });
        if (imageUri) {
          const notif: Notification = {
            id: `notif_proof_${orderId}_${Date.now()}`,
            title: "📸 العميل أرسل إثبات تحويل",
          body: `العميل ${updatedOrder.userName} أرفق صورة التحويل للطلب #${orderId.slice(0, 12)}`,
            createdAt: new Date().toISOString(),
            read: false,
            targetRole: "staff" as any,
            sourceUserId: updatedOrder.userId,
            linkedOrderId: orderId,
          };
          const updatedNotifs = [notif, ...notificationsRef.current];
          setNotifications(updatedNotifs);
          AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs)).catch(() => {});
          FS.saveNotification(notif).catch(() => {});
        }
      }
    },
    []
  );

  const setOrderShipping = useCallback(
    async (orderId: string, data: { providerId?: ShippingProviderId | null; providerName?: string | null; waybillImage?: string | null; waybillNumber?: string | null }) => {
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        const next = { ...o };
        if (data.providerId !== undefined) {
          if (data.providerId === null) delete next.shippingProviderId;
          else next.shippingProviderId = data.providerId;
        }
        if (data.providerName !== undefined) {
          if (data.providerName === null) delete next.shippingProviderName;
          else next.shippingProviderName = data.providerName;
        }
        if (data.waybillImage !== undefined) {
          if (data.waybillImage === null) delete next.shippingWaybillImage;
          else next.shippingWaybillImage = data.waybillImage;
        }
        if (data.waybillNumber !== undefined) {
          if (!data.waybillNumber) delete next.shippingWaybillNumber;
          else next.shippingWaybillNumber = data.waybillNumber;
        }
        return next;
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) await FS.saveOrder(updatedOrder);
    },
    []
  );

  const setOrderPaymentMethod = useCallback(
    async (orderId: string, method: PaymentMethod) => {
      const ewalletPct = settings.payment?.ewalletFeePercent ?? 1;
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        const fee = method === "ewallet" ? Math.ceil(o.total * ewalletPct / 100) : 0;
        return { ...o, paymentMethod: method, paymentFee: fee, totalWithFee: o.total + fee };
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) await FS.saveOrder(updatedOrder);
    },
    [settings]
  );

  const setOrderPaymentOverride = useCallback(
    async (orderId: string, handle: string | null, name?: string | null) => {
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        if (handle === null) {
          const { paymentOverrideHandle, paymentOverrideName, ...rest } = o;
          return rest as typeof o;
        }
        return { ...o, paymentOverrideHandle: handle, paymentOverrideName: name || "" };
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) await FS.saveOrder(updatedOrder);
    },
    []
  );

  const hashPin = (pin: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < pin.length; i++) {
      h ^= pin.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return "p_" + h.toString(16);
  };

  const setCustomerPin = useCallback(
    async (phone: string, pin: string) => {
      const hashed = hashPin(pin);
      const existing = registeredCustomersRef.current.find((c) => samePhone(c.phone, phone));
      if (existing) {
        const updated = { ...existing, pin: hashed };
        updateRegisteredCustomer(updated);
      }
      const cur = userRef.current;
      if (cur && samePhone(cur.phone, phone)) {
        const synced = { ...cur, pin: hashed };
        setUserState(synced);
        await persistUserSafe(synced);
      }
    },
    [updateRegisteredCustomer]
  );

  const verifyCustomerPin = useCallback(
    (phone: string, pin: string): boolean => {
      const c = registeredCustomersRef.current.find((x) => samePhone(x.phone, phone));
      if (!c?.pin) return false;
      return c.pin === hashPin(pin);
    },
    []
  );

  const updateOrderItems = useCallback(
    async (orderId: string, items: CartItem[], total: number, staffEdit?: boolean, notes?: string, fulfillment?: { fulfillmentType?: FulfillmentType; branchId?: string; branchName?: string }) => {
      const normalizedItems = items.map(withRecalculatedCompanions);
      const normalizedTotal = computeItemsTotal(normalizedItems);
      const updated = ordersRef.current.map((o) => {
        if (o.id !== orderId) return o;
        const ewalletPct = settings.payment?.ewalletFeePercent ?? 1;
        const fee = o.paymentMethod === "ewallet" ? Math.ceil(normalizedTotal * ewalletPct / 100) : 0;
        return {
          ...o,
          items: normalizedItems,
          total: normalizedTotal,
          paymentFee: fee,
          totalWithFee: normalizedTotal + fee,
          ...(notes !== undefined ? { notes } : {}),
          ...(fulfillment?.fulfillmentType !== undefined ? { fulfillmentType: fulfillment.fulfillmentType } : {}),
          ...(fulfillment?.branchId !== undefined ? { branchId: fulfillment.branchId } : {}),
          ...(fulfillment?.branchName !== undefined ? { branchName: fulfillment.branchName } : {}),
          ...(staffEdit ? {} : { editable: false, editableExpiresAt: undefined, edited: true, editedAt: new Date().toISOString() }),
        };
      });
      const updatedOrder = updated.find((o) => o.id === orderId);
      setOrdersState(updated);
      ordersRef.current = updated;
      await AsyncStorage.setItem("orders", JSON.stringify(updated));
      if (updatedOrder) {
        const ok = await saveOrderReliable(updatedOrder);
        if (!ok) {
          // Firestore is unreachable right now. saveOrderReliable has already
          // updated local state and queued this order in pendingOrderSaves for
          // automatic retry, so the edit is NOT lost. Mirror the create-order
          // path (FS.saveOrder(...).catch) which tolerates offline saves instead
          // of surfacing a hard "تعذّر حفظ التعديل" error to the customer.
          console.warn("updateOrderItems: order queued for offline retry:", orderId);
        }
        if (!staffEdit) {
          const assignedStaffId = updatedOrder.assignedTo;
          const assignedStaffPhone = updatedOrder.assignedToPhone;
          const staffNotif: Notification = {
            id: `notif_edited_${orderId}_${Date.now()}`,
            title: "تم تعديل الطلب من قبل العميل ✏️",
            body: `العميل ${updatedOrder.userName} عدّل طلبه #${orderId.slice(0, 12)} — يرجى مراجعة التعديلات ومتابعة التجهيز`,
            createdAt: new Date().toISOString(),
            read: false,
            sourceUserId: updatedOrder.userId,
            ...(assignedStaffId
              ? { targetUserId: assignedStaffId, ...(assignedStaffPhone ? { targetUserPhone: assignedStaffPhone } : {}) }
              : { targetRole: "staff" as any }),
            linkedOrderId: orderId,
          };
          const updatedNotifs = [staffNotif, ...notificationsRef.current];
          setNotifications(updatedNotifs);
          await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
          FS.saveNotification(staffNotif).catch(() => {});
          if (assignedStaffId) {
            const staffRecord = registeredCustomersRef.current.find((c) => c.id === assignedStaffId);
            if (staffRecord?.phone) {
              notifyUserByPhone(
                staffRecord.phone,
                "تم تعديل الطلب ✏️",
                `العميل ${updatedOrder.userName} عدّل طلبه #${orderId.slice(0, 12)} — راجع التعديلات`,
                { type: "order_edited", orderId }
              ).catch(() => {});
            }
          }
        }
      }
    },
    [settings]
  );

  // Auto-accept the staff's edits when the customer's edit window expires:
  // applies the staff availability exactly as if the customer had pressed
  // «تأكيد التعديل», then closes editing. If every item turned out unavailable
  // the order is cancelled (and staff notified). Runs only on the order owner's
  // device — or an admin's, as a fallback when the customer is offline — to limit
  // duplicate writes; a per-order in-flight guard stops repeated firing.
  const autoAcceptInFlightRef = useRef<Set<string>>(new Set());
  const autoAcceptExpiredEdits = useCallback(async () => {
    const now = Date.now();
    const u = userRef.current;
    const due = ordersRef.current.filter(
      (o) =>
        o.editable &&
        o.editableExpiresAt &&
        o.status !== "cancelled" &&
        new Date(o.editableExpiresAt).getTime() <= now &&
        !autoAcceptInFlightRef.current.has(o.id) &&
        (!u || u.id === o.userId || u.role === "admin")
    );
    for (const o of due) {
      autoAcceptInFlightRef.current.add(o.id);
      try {
        const finalItems = acceptStaffAvailability(o.items);
        if (finalItems.length === 0) {
          await cancelOrder(o.id, { notifyStaff: true });
        } else {
          await updateOrderItems(o.id, finalItems, computeItemsTotal(finalItems), false);
        }
      } catch {
        // swallow — the periodic sweep will retry on the next pass
      } finally {
        // Always release the per-order guard: once finalized/cancelled the order is
        // no longer editable so the `due` filter won't re-pick it, and clearing here
        // keeps the in-flight set from growing without bound.
        autoAcceptInFlightRef.current.delete(o.id);
      }
    }
  }, [cancelOrder, updateOrderItems]);

  useEffect(() => {
    autoAcceptExpiredEdits();
    const now = Date.now();
    const upcoming = orders
      .filter((o) => o.editable && o.editableExpiresAt && o.status !== "cancelled")
      .map((o) => new Date(o.editableExpiresAt!).getTime())
      .filter((t) => t > now);
    // Precise wake-up at the soonest expiry so the close happens immediately,
    // plus a periodic safety sweep in case the device was asleep.
    const exact =
      upcoming.length > 0
        ? setTimeout(() => autoAcceptExpiredEdits(), Math.min(...upcoming) - now + 250)
        : null;
    const sweep = setInterval(() => autoAcceptExpiredEdits(), 30000);
    return () => {
      if (exact) clearTimeout(exact);
      clearInterval(sweep);
    };
  }, [orders, autoAcceptExpiredEdits]);

  const addReturnRequest = useCallback(
    async (req: ReturnRequest) => {
      const updated = [req, ...returnRequests];
      setReturnRequests(updated);
      await AsyncStorage.setItem("returnRequests", JSON.stringify(updated));
      FS.saveReturnRequest(req).catch(() => {});
      const staffNotif: Notification = {
        id: `notif_return_${req.orderId}_${Date.now()}`,
        title: "طلب استرجاع جديد",
        body: `العميل ${req.userName} يطلب استرجاع من الطلب #${req.orderId.slice(0, 12)}`,
        createdAt: new Date().toISOString(),
        read: false,
        targetRole: "employee" as any,
        linkedOrderId: req.orderId,
        linkedReturnId: req.id,
      };
      const updatedNotifs = [staffNotif, ...notificationsRef.current];
      setNotifications(updatedNotifs);
      await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
      FS.saveNotification(staffNotif).catch(() => {});
    },
    [returnRequests]
  );

  const updateReturnStatus = useCallback(
    async (reqId: string, status: ReturnStatus) => {
      const updated = returnRequests.map((r) => (r.id === reqId ? { ...r, status } : r));
      setReturnRequests(updated);
      await AsyncStorage.setItem("returnRequests", JSON.stringify(updated));
      const req = updated.find((r) => r.id === reqId);
      if (req) {
        FS.saveReturnRequest(req).catch(() => {});
        const recipientPhone = resolveRecipientPhone(req.userId, req.userPhone);
        const custNotif: Notification = {
          id: `notif_return_${reqId}_${status}_${Date.now()}`,
          title: status === "returned" ? "تم استرجاع الطلب" : status === "settled" ? "تمت المخالصة" : "طلب الاسترجاع قيد المراجعة",
          body: `طلب الاسترجاع للطلب #${req.orderId.slice(0, 12)} — ${status === "returned" ? "تم الاسترجاع" : "تمت المخالصة"}`,
          createdAt: new Date().toISOString(),
          read: false,
          targetUserId: req.userId,
          targetUserPhone: recipientPhone,
          linkedOrderId: req.orderId,
          linkedReturnId: req.id,
        };
        const updatedNotifs = [custNotif, ...notificationsRef.current];
        setNotifications(updatedNotifs);
        await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
        FS.saveNotification(custNotif).catch(() => {});
        if (recipientPhone) {
          notifyUserByPhone(
            recipientPhone,
            custNotif.title,
            custNotif.body,
            { type: "return_status", orderId: req.orderId, status }
          ).catch(() => {});
        }
      }
    },
    [returnRequests]
  );

  const cancelReturnRequest = useCallback(
    async (reqId: string, reason?: string) => {
      const nowIso = new Date().toISOString();
      const updated = returnRequests.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: "cancelled" as ReturnStatus,
              cancelReason: reason || "",
              cancelledAt: nowIso,
              cancelledByName: userRef.current?.name || "موظف",
            }
          : r
      );
      setReturnRequests(updated);
      await AsyncStorage.setItem("returnRequests", JSON.stringify(updated));
      const req = updated.find((r) => r.id === reqId);
      if (req) {
        FS.saveReturnRequest(req).catch(() => {});
        const recipientPhone = resolveRecipientPhone(req.userId, req.userPhone);
        const custNotif: Notification = {
          id: `notif_return_cancel_${reqId}_${Date.now()}`,
          title: "تم إلغاء طلب الاسترجاع",
          body: reason
            ? `تم إلغاء طلب الاسترجاع للطلب #${req.orderId.slice(0, 12)} — السبب: ${reason}`
            : `تم إلغاء طلب الاسترجاع للطلب #${req.orderId.slice(0, 12)}`,
          createdAt: new Date().toISOString(),
          read: false,
          targetUserId: req.userId,
          targetUserPhone: recipientPhone,
          linkedOrderId: req.orderId,
          linkedReturnId: req.id,
        };
        const updatedNotifs = [custNotif, ...notificationsRef.current];
        setNotifications(updatedNotifs);
        await AsyncStorage.setItem("notifications", JSON.stringify(updatedNotifs));
        FS.saveNotification(custNotif).catch(() => {});
        if (recipientPhone) {
          notifyUserByPhone(
            recipientPhone,
            "تم إلغاء طلب الاسترجاع ❌",
            reason
              ? `تم إلغاء طلب استرجاعك للطلب #${req.orderId.slice(0, 12)} — السبب: ${reason}`
              : `تم إلغاء طلب استرجاعك للطلب #${req.orderId.slice(0, 12)}`,
            { type: "return_cancelled", orderId: req.orderId }
          ).catch(() => {});
        }
      }
    },
    [returnRequests]
  );

  const deleteReturnRequest = useCallback(
    async (reqId: string) => {
      const updated = returnRequests.filter((r) => r.id !== reqId);
      setReturnRequests(updated);
      await AsyncStorage.setItem("returnRequests", JSON.stringify(updated));
    },
    [returnRequests]
  );

  const setTabs = useCallback(async (t: Tab[]) => {
    setTabsState(t);
    await AsyncStorage.setItem("tabs", JSON.stringify(t));
  }, []);

  const notificationsRef = useRef<Notification[]>([]);
  notificationsRef.current = notifications;

  const addNotification = useCallback(
    async (notification: Notification) => {
      const updated = [notification, ...notificationsRef.current];
      setNotifications(updated);
      await AsyncStorage.setItem("notifications", JSON.stringify(updated));
      FS.saveNotification(notification).catch(() => {});

      // Trigger phone notification tray + elegant sound for the current device.
      // IMPORTANT: only fire immediately for notifications explicitly aimed at
      // THIS user that they did not author. Broadcasts / role-targeted items are
      // delivered to recipients via the Firestore listener (watermark-deduped) —
      // firing them here too would double-notify the author (and spuriously
      // notify the author of items meant for other roles).
      const currentUser = userRef.current;
      const isForMe =
        notification.targetUserId === "self" ||
        (!!currentUser &&
          notification.targetUserId === currentUser.id &&
          notification.sourceUserId !== currentUser.id);
      if (isForMe) {
        if (Platform.OS !== "web") {
          try {
            const Notif = await import("expo-notifications");
            await Notif.scheduleNotificationAsync({
              content: {
                title: notification.title,
                body: notification.body,
                sound: true,
                data: { id: notification.id },
              },
              trigger: null,
            });
          } catch {}
        }
      }
    },
    []
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      // Track in per-user local set so we don't depend on Firestore's shared
      // `read` flag for broadcast notifications. This prevents "notifications
      // reappear" bug when batchMarkRead fails silently or when the doc is
      // shared across users.
      const next = new Set(readNotifIdsRef.current);
      next.add(id);
      setReadNotifIds(next);
      persistReadNotifIds(next);
      const updated = notificationsRef.current.map((n) => (n.id === id ? { ...n, read: true } : n));
      setNotifications(updated);
      await AsyncStorage.setItem("notifications", JSON.stringify(updated));
      FS.markNotificationReadFlag(id).catch(() => {});
    },
    [persistReadNotifIds]
  );

  const markAllNotificationsRead = useCallback(
    async () => {
      const localSet = readNotifIdsRef.current;
      const unreadIds = notificationsRef.current
        .filter((n) => !n.read && !localSet.has(n.id))
        .map((n) => n.id);
      if (unreadIds.length === 0) return;
      const next = new Set(localSet);
      for (const id of unreadIds) next.add(id);
      setReadNotifIds(next);
      persistReadNotifIds(next);
      const updated = notificationsRef.current.map((n) => ({ ...n, read: true }));
      setNotifications(updated);
      AsyncStorage.setItem("notifications", JSON.stringify(updated)).catch(() => {});
      FS.batchMarkRead(unreadIds).catch(() => {});
    },
    [persistReadNotifIds]
  );

  const isNotifReadForUser = useCallback(
    (n: Notification) => {
      if (n.read) return true;
      return readNotifIdsRef.current.has(n.id);
    },
    []
  );

  const setPricingView = useCallback(async (mode: "auto" | "wholesale" | "retail") => {
    setPricingViewState(mode);
    try { await AsyncStorage.setItem("pricingView", mode); } catch {}
  }, []);

  const updateCartWeight = useCallback(
    (productId: string, colorName: string, weight: number) => {
      setCart((prev) =>
        weight <= 0
          ? prev.filter((c) => !(c.productId === productId && c.colorName === colorName))
          : prev.map((c) => {
              if (!(c.productId === productId && c.colorName === colorName)) return c;
              const cap =
                c.stockStatus === "partial" && c.availableQuantity != null
                  ? c.availableQuantity
                  : c.editMaxQty;
              return withRecalculatedCompanions({ ...c, weight: cap != null ? Math.min(weight, cap) : weight });
            })
      );
    },
    []
  );

  const updateCartActualWeight = useCallback(
    (productId: string, colorName: string, actualWeight: number) => {
      setCart((prev) =>
        prev.map((c) => {
          if (!(c.productId === productId && c.colorName === colorName)) return c;
          if (actualWeight <= 0) return { ...c, actualWeight: undefined };
          const cap =
            c.stockStatus === "partial" && c.availableQuantity != null
              ? c.availableQuantity
              : c.editMaxQty;
           return withRecalculatedCompanions({ ...c, actualWeight: cap != null ? Math.min(actualWeight, cap) : actualWeight });
        })
      );
    },
    []
  );

  const setSettings = useCallback(async (s: AppSettings) => {
    setSettingsState(s);
    await AsyncStorage.setItem("settings", JSON.stringify(s));
    if (s.globalColors?.length && products.length) {
      const colorOrder = new Map(s.globalColors.map((color, index) => [color.name.trim().toLocaleLowerCase(), index]));
      const reorderedProducts = products.map((product) => {
        const reorderedColors = [...product.colors].sort((a, b) => {
          const aIndex = colorOrder.get(a.name.trim().toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
          const bIndex = colorOrder.get(b.name.trim().toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });
        const changed = reorderedColors.some((color, index) => color.name !== product.colors[index]?.name);
        return changed ? { ...product, colors: reorderedColors } : product;
      });
      if (reorderedProducts.some((product, index) => product !== products[index])) {
        setProductsState(reorderedProducts);
        await AsyncStorage.setItem("products", JSON.stringify(reorderedProducts));
        await Promise.allSettled(
          reorderedProducts
            .filter((product, index) => product !== products[index])
            .map((product) => FS.saveProduct(product))
        );
      }
    }
    try {
      await FS.saveSettings(s);
    } catch (e: any) {
      console.warn("[Settings] Firebase save failed:", e?.code || e?.message || e);
      throw new Error(
        "تعذّر حفظ الإعدادات على السيرفر — تأكد من تسجيل الدخول كأدمن. سيتم حفظها على هذا الجهاز فقط."
      );
    }
  }, [products]);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    await AsyncStorage.setItem("theme", t);
  }, []);

  const setLanguage = useCallback(async (l: AppLanguage) => {
    setLanguageState(l);
    await AsyncStorage.setItem("language", l);
  }, []);

  // Effective price mode: customer/non-staff non-merchant => retail.
  // merchant => wholesale (always).
  // admin/staff: defaults to wholesale, but if pricingView is set explicitly
  // and the user has permission to toggle, use that.
  const canTogglePricing = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "supervisor" || user.role === "employee") {
      return (user.permissions ?? []).includes("toggle_price_view");
    }
    return false;
  }, [user?.role, user?.permissions]);

  const canViewPriceMenu = useMemo(() => {
    if (!user) return false;
    if (user.role === "merchant" || user.role === "admin") return true;
    return (
      (user.role === "employee" || user.role === "supervisor") &&
      (user.permissions ?? []).includes("view_price_menu")
    );
  }, [user?.role, user?.permissions]);

  const effectivePriceMode: "wholesale" | "retail" = useMemo(() => {
    if (!user) return "retail";
    if (user.role === "customer") return "retail";
    if (user.role === "merchant") return "wholesale";
    // staff/admin
    if (canTogglePricing && (pricingView === "wholesale" || pricingView === "retail")) {
      return pricingView;
    }
    // When the toggle permission is locked for staff, default to customer
    // (retail) prices rather than merchant (wholesale) prices.
    if (!canTogglePricing) return "retail";
    return "wholesale";
  }, [user?.role, pricingView, canTogglePricing]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        registeredCustomers,
        findCustomerByPhone,
        registerCustomer,
        updateRegisteredCustomer,
        purgeCustomerCache,
        deleteRegisteredCustomer,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        favorites,
        isFavorite,
        toggleFavorite,
        products,
        setProducts,
        addProductOne,
        updateProductOne,
        deleteProductOne,
        cart,
        setCart,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        orders,
        setOrders,
        addOrder,
        updateOrderStatus,
        deleteOrder,
        cancelOrder,
        sendOrderMessage,
        setOrderEditable,
        setOrderEditExpiry,
        beginOrderEdit,
        setOrderInvoiceImage,
        setOrderTransferProof,
        setOrderShipping,
        setOrderPaymentMethod,
        setOrderPaymentOverride,
        setCustomerPin,
        verifyCustomerPin,
        updateOrderItems,
        editingOrderId,
        setEditingOrderId,
        returnRequests,
        addReturnRequest,
        updateReturnStatus,
        cancelReturnRequest,
        deleteReturnRequest,
        tabs,
        setTabs,
        notifications,
        addNotification,
        onlineCount,
        onlineUsers,
        markNotificationRead,
        markAllNotificationsRead,
        updateCartWeight,
        updateCartActualWeight,
        settings,
        setSettings,
        theme,
        setTheme,
        language,
        setLanguage,
        isLoading,
        roleSwitching,
        showToast,
        toast,
        pricingView,
        setPricingView,
        effectivePriceMode,
        canTogglePricing,
        canViewPriceMenu,
        isNotifReadForUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
