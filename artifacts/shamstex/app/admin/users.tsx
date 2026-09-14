import React, { useMemo, useState } from "react";
import {
  Alert,
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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, User, UserRole, EmployeePermission } from "@/context/AppContext";
import { notifyUserByPhone } from "@/lib/pushService";
import { FS } from "@/lib/firebase";
import { canonicalPhone, samePhone } from "@/lib/phoneUtils";
import GoldHeader from "@/components/GoldHeader";
import { useAdminGuard } from "@/hooks/useAdminGuard";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "زبون",
  merchant: "تاجر",
  employee: "موظف",
  supervisor: "مشرف",
  admin: "مدير",
};

const ROLE_COLORS: Record<UserRole, string> = {
  customer: "#888",
  merchant: "#C9A84C",
  employee: "#2980B9",
  supervisor: "#8E44AD",
  admin: "#C0392B",
};

const ROLE_ICONS: Record<UserRole, string> = {
  customer: "user",
  merchant: "briefcase",
  employee: "tool",
  supervisor: "shield",
  admin: "star",
};

const PERMISSION_LABELS: Record<EmployeePermission, string> = {
  view_orders: "عرض الطلبات",
  edit_orders: "تعديل الطلبات",
  view_products: "عرض المنتجات",
  edit_products: "تعديل المنتجات",
  view_users: "عرض المستخدمين",
  send_notifications: "إرسال الإشعارات",
  manage_staff: "إدارة الموظفين",
  approve_upgrades: "الموافقة على الترقيات",
  delete_orders: "حذف الطلبات",
  cancel_returns: "إلغاء الاسترجاعات",
  manage_settings: "إدارة الإعدادات",
  manage_payments: "تفعيل/تعطيل وسائل الدفع",
  toggle_price_view: "التبديل بين أسعار التجار/العملاء",
  revert_final: "التراجع عن الشحن/التسليم",
};

const EMPLOYEE_PERMISSIONS: EmployeePermission[] = [
  "view_orders",
  "edit_orders",
  "view_products",
  "edit_products",
  "view_users",
  "send_notifications",
  "toggle_price_view",
];

// Permissions an admin may additionally grant to an employee via the permissions
// grid (beyond their default set). Lets staff hold delete_orders, approvals, and
// payment-method control without being promoted to supervisor.
const EMPLOYEE_GRANTABLE: EmployeePermission[] = [
  ...EMPLOYEE_PERMISSIONS,
  "delete_orders",
  "approve_upgrades",
  "manage_payments",
  "revert_final",
];

const SUPERVISOR_PERMISSIONS: EmployeePermission[] = [
  "view_orders",
  "edit_orders",
  "view_products",
  "edit_products",
  "view_users",
  "send_notifications",
  "manage_staff",
  "approve_upgrades",
  "delete_orders",
  "cancel_returns",
  "manage_settings",
  "manage_payments",
  "toggle_price_view",
];

const SUPERVISOR_GRANTABLE: EmployeePermission[] = [
  ...SUPERVISOR_PERMISSIONS,
  "revert_final",
];

const DEMO_STAFF: User[] = [
  { id: "u1", phone: "0000000001", name: "مدير النظام", role: "admin" },
  { id: "u0", phone: "01221131138", name: "المدير", role: "admin" },
  {
    id: "u3",
    phone: "0000000003",
    name: "موظف",
    role: "employee",
    permissions: ["view_orders", "view_products"],
  },
  {
    id: "u4",
    phone: "0000000004",
    name: "مشرف",
    role: "supervisor",
    permissions: ["view_orders", "edit_orders", "view_products", "view_users", "send_notifications", "approve_upgrades"],
  },
];

type TabKey = "customers" | "staff";
type SortKey = "name" | "date" | "orders";

export default function AdminUsersScreen() {
  useAdminGuard("view_users");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, registeredCustomers, updateRegisteredCustomer, deleteRegisteredCustomer, registerCustomer, addNotification, orders } = useApp();
  const [activeTab, setActiveTab] = useState<TabKey>("customers");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [custFilter, setCustFilter] = useState<"all" | "customers" | "merchants" | "banned">("all");
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string; newRole?: UserRole } | null>(null);
  const [deletedStaffPhones, setDeletedStaffPhones] = useState<string[]>([]);

  const isDeletedStaff = (phone: string) =>
    deletedStaffPhones.some((d) => samePhone(d, phone));

  const canApproveUpgrades = user?.role === "admin" || (user?.permissions ?? []).includes("approve_upgrades");

  // Build staff list with canonical-phone deduplication so the same person never
  // appears twice (e.g., once as "01221131138" demo seed and once as "+201221131138" registry).
  const rawStaff: User[] = [
    ...DEMO_STAFF
      .filter((demo) => !isDeletedStaff(demo.phone))
      .map((demo) => {
        const fromRegistry = registeredCustomers.find((c) => samePhone(c.phone, demo.phone));
        return fromRegistry ? { ...demo, ...fromRegistry } : demo;
      }),
    ...registeredCustomers.filter(
      (c) =>
        (c.role === "admin" || c.role === "employee" || c.role === "supervisor") &&
        !DEMO_STAFF.some((d) => samePhone(d.phone, c.phone)) &&
        !isDeletedStaff(c.phone)
    ),
  ];
  const staffMap = new Map<string, User>();
  for (const u of rawStaff) {
    const key = canonicalPhone(u.phone) || u.id;
    const existing = staffMap.get(key);
    if (!existing) {
      staffMap.set(key, u);
    } else {
      // Merge: prefer the more-privileged role and keep the latest non-empty fields.
      const rank: Record<string, number> = { admin: 5, supervisor: 4, employee: 3, merchant: 2, customer: 1 };
      const winner = (rank[u.role] ?? 0) > (rank[existing.role] ?? 0) ? u : existing;
      const loser = winner === u ? existing : u;
      staffMap.set(key, { ...loser, ...winner, name: winner.name || loser.name });
    }
  }
  const staffList: User[] = [...staffMap.values()];

  const saveStaffMember = (updatedUser: User) => {
    const exists = registeredCustomers.find((c) => samePhone(c.phone, updatedUser.phone));
    if (exists) {
      // Use the existing registry phone format as the primary key so we don't fork docs.
      updateRegisteredCustomer({ ...exists, ...updatedUser, phone: exists.phone });
    } else {
      registerCustomer(updatedUser);
    }
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Customers list deduplicated by canonical phone too.
  const customerMap = new Map<string, User>();
  for (const c of registeredCustomers) {
    // Defensive: missing/unknown role → treat as customer so freshly re-registered
    // accounts (which might briefly land without an explicit role field) still show.
    const role = c.role || "customer";
    if (role !== "customer" && role !== "merchant") continue;
    const key = canonicalPhone(c.phone) || c.id;
    const existing = customerMap.get(key);
    if (!existing) {
      customerMap.set(key, c);
    } else {
      const cTime = (c as any).lastUpdated || c.registeredAt || "";
      const eTime = (existing as any).lastUpdated || existing.registeredAt || "";
      if (cTime > eTime) customerMap.set(key, c);
    }
  }
  const customerList = [...customerMap.values()];
  const pendingUpgrades = customerList.filter((u) => u.upgradeStatus === "pending");
  const activeCustomers = customerList.filter((u) => u.upgradeStatus !== "pending");

  const orderCountsByUser = useMemo(() => {
    const counts: Record<string, { total: number; pending: number; totalSpent: number; lastOrderDate: string | null }> = {};
    for (const o of orders) {
      const uid = o.userId;
      if (!counts[uid]) counts[uid] = { total: 0, pending: 0, totalSpent: 0, lastOrderDate: null };
      counts[uid].total++;
      if (o.status === "pending" || o.status === "received" || o.status === "preparing") counts[uid].pending++;
      counts[uid].totalSpent += o.total ?? 0;
      if (!counts[uid].lastOrderDate || o.createdAt > counts[uid].lastOrderDate!) {
        counts[uid].lastOrderDate = o.createdAt;
      }
    }
    return counts;
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    let list = activeCustomers;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q));
    }
    if (custFilter === "customers") {
      list = list.filter((u) => (u.role || "customer") === "customer" && !(u as any).banned);
    } else if (custFilter === "merchants") {
      list = list.filter((u) => u.role === "merchant" && !(u as any).banned);
    } else if (custFilter === "banned") {
      list = list.filter((u) => (u as any).banned);
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ar");
      if (sortBy === "orders") {
        return (orderCountsByUser[b.id]?.total ?? 0) - (orderCountsByUser[a.id]?.total ?? 0);
      }
      const dateA = a.registeredAt ?? "";
      const dateB = b.registeredAt ?? "";
      return dateB.localeCompare(dateA);
    });
    return list;
  }, [activeCustomers, searchQuery, sortBy, custFilter, orderCountsByUser]);

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q));
  }, [staffList, searchQuery]);

  const saveCustomerChange = (updatedUser: User) => {
    updateRegisteredCustomer(updatedUser);
  };

  const handleChangeCustomerRole = (userId: string, newRole: UserRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Look up in the FULL registeredCustomers (not customerList) so a merchant
    // who was just changed to staff (and thus excluded from customerList) can
    // still be resolved during the confirm step. Also fall back to canonical
    // phone matching in case the id drifted across registrations.
    const updated =
      registeredCustomers.find((u) => u.id === userId) ||
      customerList.find((u) => u.id === userId) ||
      registeredCustomers.find((u) => samePhone(u.phone, userId)) ||
      customerList.find((u) => samePhone(u.phone, userId));
    if (updated) {
      let perms: EmployeePermission[] | undefined = undefined;
      if (newRole === "employee") perms = ["view_orders", "view_products"];
      if (newRole === "supervisor") perms = [...SUPERVISOR_PERMISSIONS];

      saveCustomerChange({ ...updated, role: newRole, permissions: perms, upgradeStatus: undefined, lastUpdated: new Date().toISOString() } as any);

      // Wipe any pending orders for this user so they don't carry over across
      // roles (e.g. a customer becoming merchant shouldn't see old retail orders
      // sitting in the queue). Best-effort, never blocks the UI.
      if (updated.phone) {
        FS.deleteOrdersForUserPhone(updated.phone).catch(() => {});
      }

      if (user) {
        FS.appendAuditLog({
          actorId: user.id,
          actorName: user.name ?? "—",
          actorRole: user.role,
          action: "user.role_change",
          targetId: updated.id,
          targetType: "user",
          details: { phone: updated.phone, fromRole: updated.role, toRole: newRole },
        }).catch(() => {});
      }

      const notifications: Record<string, { title: string; body: string }> = {
        merchant: { title: "🎉 تمت ترقيتك إلى تاجر!", body: "تم تفعيل حسابك كتاجر. سيتم تحديث حسابك تلقائياً خلال لحظات للاستفادة من أسعار الجملة." },
        employee: { title: "تم تعيينك كموظف 🛠️", body: "تم تفعيل حسابك كموظف. يمكنك الآن الوصول إلى لوحة الإدارة." },
        supervisor: { title: "تم تعيينك كمشرف 🛡️", body: "تم تفعيل حسابك كمشرف. لديك صلاحيات إشرافية كاملة." },
        customer: { title: "تغيير الدور", body: "تم تغيير دورك إلى زبون عادي. سيتم تحديث حسابك تلقائياً خلال لحظات." },
      };
      const notif = notifications[newRole];
      if (notif) {
        addNotification({
          id: `role_${newRole}_${updated.id}_${Date.now()}`,
          title: notif.title,
          body: notif.body,
          createdAt: new Date().toISOString(),
          read: false,
          targetUserId: updated.id,
          targetUserPhone: updated.phone,
        });
        notifyUserByPhone(updated.phone, notif.title, notif.body, { type: "role_change", newRole }).catch(() => {});
      }
    }
    setConfirmAction(null);
  };

  const handleToggleVip = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const target = customerList.find((u) => u.id === userId);
    if (target) saveCustomerChange({ ...target, vip: !target.vip, lastUpdated: new Date().toISOString() } as any);
  };

  const handleApproveUpgrade = (userId: string) => {
    if (!canApproveUpgrades) {
      Alert.alert("غير مسموح", "ليس لديك صلاحية الموافقة على الترقيات.");
      return;
    }
    Alert.alert("تأكيد", "هل تريد ترقية هذا المستخدم إلى تاجر؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "موافقة", onPress: () => handleChangeCustomerRole(userId, "merchant") },
    ]);
  };

  const handleRejectUpgrade = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const target = customerList.find((u) => u.id === userId);
    if (target) saveCustomerChange({ ...target, upgradeStatus: "rejected", lastUpdated: new Date().toISOString() } as any);
  };

  const handleChangeStaffRole = (userId: string, newRole: UserRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const target = staffList.find((u) => u.id === userId);
    if (!target) return;
    // Wipe pending orders for this staff member too — they may have placed
    // orders as a customer/merchant before being promoted.
    if (target.phone) {
      FS.deleteOrdersForUserPhone(target.phone).catch(() => {});
    }
    if (user) {
      FS.appendAuditLog({
        actorId: user.id,
        actorName: user.name ?? "—",
        actorRole: user.role,
        action: "staff.role_change",
        targetId: target.id,
        targetType: "user",
        details: { phone: target.phone, fromRole: target.role, toRole: newRole },
      }).catch(() => {});
    }
    if (newRole === "admin") {
      saveStaffMember({ ...target, role: "admin", permissions: [] });
      addNotification({
        id: `role_admin_${target.id}_${Date.now()}`,
        title: "ترقية إلى مدير 🎉",
        body: "تم ترقيتك إلى مدير. لديك الآن صلاحيات كاملة.",
        createdAt: new Date().toISOString(),
        read: false,
        targetUserId: target.id,
        targetUserPhone: target.phone,
      });
      notifyUserByPhone(target.phone, "🎉 ترقية إلى مدير!", "تم ترقيتك إلى مدير. لديك الآن صلاحيات كاملة.", { type: "role_change", newRole: "admin" }).catch(() => {});
    } else if (newRole === "supervisor") {
      saveStaffMember({ ...target, role: "supervisor", permissions: [...SUPERVISOR_PERMISSIONS] });
      addNotification({
        id: `role_supervisor_${target.id}_${Date.now()}`,
        title: "تغيير الدور إلى مشرف 🛡️",
        body: "تم تغيير دورك إلى مشرف.",
        createdAt: new Date().toISOString(),
        read: false,
        targetUserId: target.id,
        targetUserPhone: target.phone,
      });
      notifyUserByPhone(target.phone, "تغيير الدور إلى مشرف 🛡️", "تم تغيير دورك إلى مشرف.", { type: "role_change", newRole: "supervisor" }).catch(() => {});
    } else if (newRole === "employee") {
      saveStaffMember({ ...target, role: "employee", permissions: [...EMPLOYEE_PERMISSIONS] });
      addNotification({
        id: `role_employee_${target.id}_${Date.now()}`,
        title: "تغيير الدور إلى موظف 🛠️",
        body: "تم تغيير دورك إلى موظف.",
        createdAt: new Date().toISOString(),
        read: false,
        targetUserId: target.id,
        targetUserPhone: target.phone,
      });
      notifyUserByPhone(target.phone, "تغيير الدور إلى موظف 🛠️", "تم تغيير دورك إلى موظف.", { type: "role_change", newRole: "employee" }).catch(() => {});
    }
  };

  const handleToggleStaffPermission = (userId: string, permission: EmployeePermission) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = staffList.find((u) => u.id === userId);
    if (!target) return;
    const current = target.permissions ?? [];
    const perms = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    saveStaffMember({ ...target, permissions: perms });
  };

  const handleSaveStaffName = (userId: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed.length < 2) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const target = staffList.find((u) => u.id === userId);
    if (target) saveStaffMember({ ...target, name: trimmed });
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const handleSaveCustomerName = (userId: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed.length < 2) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const target = customerList.find((u) => u.id === userId);
    if (target) saveCustomerChange({ ...target, name: trimmed, lastUpdated: new Date().toISOString() } as any);
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const PRIMARY_ADMIN_PHONE = "+201221131138";
  // Both legacy local format and new E.164 format to protect existing accounts during migration.
  const PROTECTED_PHONES = [
    "+201221131138",
    "01221131138",
    "0000000001",
    "+200000000001",
  ];

  const handleBanCustomer = (u: User) => {
    if (PROTECTED_PHONES.some((p) => samePhone(p, u.phone))) {
      Alert.alert("غير مسموح", "لا يمكن حظر المدير الأساسي.");
      return;
    }
    Alert.alert(
      "حظر المستخدم",
      `هل تريد حظر "${u.name}" (${u.phone})؟\n\nلن يتمكن من تسجيل الدخول أو استخدام التطبيق.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حظر",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            saveCustomerChange({
              ...u,
              banned: true,
              bannedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            } as any);
            if (user) {
              FS.appendAuditLog({
                actorId: user.id,
                actorName: user.name ?? "—",
                actorRole: user.role,
                action: "user.ban",
                targetId: u.id,
                targetType: "user",
                details: { phone: u.phone },
              }).catch(() => {});
            }
          },
        },
      ]
    );
  };

  const handleUnbanCustomer = (u: User) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveCustomerChange({
      ...u,
      banned: false,
      bannedAt: undefined,
      bannedReason: undefined,
      lastUpdated: new Date().toISOString(),
    } as any);
    if (user) {
      FS.appendAuditLog({
        actorId: user.id,
        actorName: user.name ?? "—",
        actorRole: user.role,
        action: "user.unban",
        targetId: u.id,
        targetType: "user",
        details: { phone: u.phone },
      }).catch(() => {});
    }
  };

  const handleDeleteCustomer = (u: User) => {
    Alert.alert(
      "حذف المستخدم",
      `هل أنت متأكد من حذف "${u.name}" (${u.phone})؟\n\nسيتم حذف بياناته نهائياً.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteRegisteredCustomer(u.phone);
            setExpandedUser(null);
          },
        },
      ]
    );
  };

  const handleDeleteStaff = (u: User) => {
    if (PROTECTED_PHONES.some((p) => samePhone(p, u.phone))) return;
    Alert.alert(
      "حذف عضو الفريق",
      `هل أنت متأكد من حذف "${u.name}" من الفريق؟\n\nسيتم حذف بياناته نهائياً.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setDeletedStaffPhones((prev) => [...prev, u.phone]);
            deleteRegisteredCustomer(u.phone);
            setExpandedUser(null);
          },
        },
      ]
    );
  };

  const handlePromoteToAdmin = (u: User) => {
    Alert.alert(
      "ترقية إلى مدير",
      `هل أنت متأكد من ترقية "${u.name}" إلى مدير؟\n\nسيحصل على كامل الصلاحيات.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "ترقية",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Wipe pending orders on role promotion to keep queues clean.
            if (u.phone) {
              FS.deleteOrdersForUserPhone(u.phone).catch(() => {});
            }
            saveStaffMember({ ...u, role: "admin", permissions: [] });
            addNotification({
              id: `role_admin_${u.id}_${Date.now()}`,
              title: "ترقية إلى مدير 🎉",
              body: "تم ترقيتك إلى مدير. لديك الآن صلاحيات كاملة. سيتم التحديث تلقائياً.",
              createdAt: new Date().toISOString(),
              read: false,
              targetUserId: u.id,
              targetUserPhone: u.phone,
            });
            notifyUserByPhone(
              u.phone,
              "🎉 ترقية إلى مدير!",
              "تم ترقيتك إلى مدير. لديك الآن صلاحيات كاملة.",
              { type: "role_change", newRole: "admin" }
            ).catch(() => {});
          },
        },
      ]
    );
  };

  const tabs: { key: TabKey; label: string; count: number; icon: string }[] = [
    { key: "customers", label: "الزبائن والتجار", count: customerList.length, icon: "users" },
    { key: "staff", label: "فريق العمل", count: staffList.length, icon: "shield" },
  ];

  const sortOptions: { key: SortKey; label: string; icon: string }[] = [
    { key: "date", label: "الأحدث", icon: "clock" },
    { key: "name", label: "الاسم", icon: "type" },
    { key: "orders", label: "الطلبات", icon: "package" },
  ];

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return "لا يوجد";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "اليوم";
    if (days === 1) return "أمس";
    if (days < 7) return `منذ ${days} أيام`;
    if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
    return formatDate(dateStr);
  };

  const renderNameEdit = (u: User, onSave: (id: string) => void) => (
    <View style={styles.nameEditRow}>
      {editingNameId === u.id ? (
        <>
          <Pressable
            onPress={() => onSave(u.id)}
            style={[styles.nameActionBtn, { backgroundColor: colors.gold, borderRadius: 8 }]}
          >
            <Icon name="check" size={14} color={colors.background} />
          </Pressable>
          <Pressable
            onPress={() => { setEditingNameId(null); setEditingNameValue(""); }}
            style={[styles.nameActionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 }]}
          >
            <Icon name="x" size={14} color={colors.foreground} />
          </Pressable>
          <TextInput
            style={[styles.nameInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.gold, fontFamily: "Inter_500Medium" }]}
            value={editingNameValue}
            onChangeText={setEditingNameValue}
            textAlign="right"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(u.id)}
          />
        </>
      ) : (
        <Pressable
          onPress={() => { setEditingNameId(u.id); setEditingNameValue(u.name); }}
          style={[styles.editNameBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="edit-3" size={13} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 12 }}>تعديل الاسم</Text>
        </Pressable>
      )}
    </View>
  );

  const renderPermissions = (u: User, allowedPerms: EmployeePermission[], onToggle: (id: string, p: EmployeePermission) => void) => (
    <View style={{ gap: 8 }}>
      <Text style={[styles.expandLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        الصلاحيات
      </Text>
      <View style={styles.permissionsGrid}>
        {allowedPerms.map((perm) => {
          const active = (u.permissions ?? []).includes(perm);
          return (
            <Pressable
              key={perm}
              onPress={() => onToggle(u.id, perm)}
              style={[
                styles.permChip,
                { backgroundColor: active ? colors.gold + "22" : colors.surface, borderColor: active ? colors.gold : colors.border },
              ]}
            >
              <Icon name={active ? "check-square" : "square"} size={13} color={active ? colors.gold : colors.mutedForeground} />
              <Text style={{ color: active ? colors.gold : colors.foreground, fontFamily: active ? "Inter_500Medium" : "Inter_400Regular", fontSize: 11 }}>
                {PERMISSION_LABELS[perm]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderCustomerCard = (u: User) => {
    const isExpanded = expandedUser === u.id;
    const stats = orderCountsByUser[u.id];
    const totalOrders = stats?.total ?? 0;
    const pendingOrders = stats?.pending ?? 0;
    const totalSpent = stats?.totalSpent ?? 0;
    const lastOrder = stats?.lastOrderDate ?? null;

    return (
      <View key={u.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Pressable onPress={() => setExpandedUser(isExpanded ? null : u.id)} style={styles.userRow}>
          <View style={styles.userExpandIcon}>
            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {u.name}
              </Text>
              {u.vip && (
                <View style={[styles.vipBadge, { backgroundColor: colors.gold + "33" }]}>
                  <Icon name="star" size={10} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>مميز</Text>
                </View>
              )}
              {u.banned && (
                <View style={[styles.vipBadge, { backgroundColor: "#E74C3C33" }]}>
                  <Icon name="slash" size={10} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>محظور</Text>
                </View>
              )}
            </View>
            <Text style={[styles.userPhone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {u.phone}
            </Text>
            <View style={styles.userMetaRow}>
              {totalOrders > 0 && (
                <View style={styles.userMetaItem}>
                  <Icon name="package" size={10} color={colors.mutedForeground + "AA"} />
                  <Text style={[styles.userMetaText, { color: colors.mutedForeground + "AA" }]}>
                    {totalOrders} طلب
                  </Text>
                </View>
              )}
              {pendingOrders > 0 && (
                <View style={[styles.userMetaPill, { backgroundColor: "#F39C12" + "22" }]}>
                  <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 9 }}>
                    {pendingOrders} قيد التنفيذ
                  </Text>
                </View>
              )}
              {lastOrder && (
                <View style={styles.userMetaItem}>
                  <Icon name="clock" size={10} color={colors.mutedForeground + "88"} />
                  <Text style={[styles.userMetaText, { color: colors.mutedForeground + "88" }]}>
                    {formatRelative(lastOrder)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={[styles.roleChip, { backgroundColor: ROLE_COLORS[u.role] + "22", borderColor: ROLE_COLORS[u.role] + "55" }]}>
              <Icon name={ROLE_ICONS[u.role]} size={11} color={ROLE_COLORS[u.role]} />
              <Text style={{ color: ROLE_COLORS[u.role], fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {ROLE_LABELS[u.role]}
              </Text>
            </View>
            {totalSpent > 0 && (
              <Text style={{ color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular", fontSize: 10 }}>
                {totalSpent.toLocaleString("ar-EG")} ج.م
              </Text>
            )}
          </View>
        </Pressable>

        {isExpanded && (user?.role === "admin" || (user?.role === "supervisor" && (user.permissions ?? []).includes("view_users"))) && u.id !== user.id && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            {totalOrders > 0 && (
              <View style={[styles.orderStatsBar, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <View style={styles.orderStatItem}>
                  <Text style={[styles.orderStatNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{totalOrders}</Text>
                  <Text style={[styles.orderStatLabel, { color: colors.mutedForeground }]}>إجمالي الطلبات</Text>
                </View>
                <View style={[styles.orderStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.orderStatItem}>
                  <Text style={[styles.orderStatNum, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>{totalSpent.toLocaleString("ar-EG")}</Text>
                  <Text style={[styles.orderStatLabel, { color: colors.mutedForeground }]}>ج.م إجمالي</Text>
                </View>
                <View style={[styles.orderStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.orderStatItem}>
                  <Text style={[styles.orderStatNum, { color: pendingOrders > 0 ? "#F39C12" : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{pendingOrders}</Text>
                  <Text style={[styles.orderStatLabel, { color: colors.mutedForeground }]}>قيد التنفيذ</Text>
                </View>
              </View>
            )}

            {u.registeredAt && (
              <View style={styles.dateRow}>
                <Icon name="calendar" size={12} color={colors.mutedForeground + "99"} />
                <Text style={{ color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  تسجيل: {formatDate(u.registeredAt)}
                </Text>
                {lastOrder && (
                  <>
                    <Text style={{ color: colors.mutedForeground + "55", fontSize: 11 }}>·</Text>
                    <Text style={{ color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular", fontSize: 11 }}>
                      آخر طلب: {formatRelative(lastOrder)}
                    </Text>
                  </>
                )}
              </View>
            )}

            {renderNameEdit(u, handleSaveCustomerName)}

            <Text style={[styles.expandLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              تغيير الدور
            </Text>

            {confirmAction?.userId === u.id ? (
              <View style={[styles.confirmBox, { backgroundColor: "#F39C12" + "11", borderColor: "#F39C12" + "44", borderRadius: colors.radius - 4 }]}>
                <Text style={{ color: "#F39C12", fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>
                  {confirmAction.newRole === "merchant"
                    ? `ترقية "${u.name}" إلى تاجر؟`
                    : confirmAction.newRole === "employee"
                    ? `تعيين "${u.name}" كموظف؟`
                    : confirmAction.newRole === "supervisor"
                    ? `تعيين "${u.name}" كمشرف؟`
                    : `تغيير "${u.name}" إلى زبون عادي؟`}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right", lineHeight: 18 }}>
                  سيتم إشعار المستخدم وتحديث حسابه تلقائياً.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => setConfirmAction(null)}
                    style={[styles.confirmCancelBtn, { borderColor: colors.border, borderRadius: 8 }]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>إلغاء</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleChangeCustomerRole(u.id, confirmAction.newRole!)}
                    style={[styles.confirmOkBtn, { backgroundColor: colors.gold, borderRadius: 8 }]}
                  >
                    <Icon name="check" size={14} color={colors.background} />
                    <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 13 }}>تأكيد</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
                {(user?.role === "admin" ? ["customer", "merchant", "employee", "supervisor"] as UserRole[] : ["customer", "merchant"] as UserRole[]).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => {
                      if (u.role === role) return;
                      setConfirmAction({ userId: u.id, action: "role", newRole: role });
                    }}
                    style={[
                      styles.roleBtn,
                      {
                        flex: 1,
                        backgroundColor: u.role === role ? ROLE_COLORS[role] + "22" : colors.surface,
                        borderColor: u.role === role ? ROLE_COLORS[role] : colors.border,
                      },
                    ]}
                  >
                    <Icon name={ROLE_ICONS[role]} size={14} color={u.role === role ? ROLE_COLORS[role] : colors.mutedForeground} />
                    <Text style={{
                      color: u.role === role ? ROLE_COLORS[role] : colors.foreground,
                      fontFamily: u.role === role ? "Inter_700Bold" : "Inter_400Regular",
                      fontSize: 13,
                    }}>
                      {ROLE_LABELS[role]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.vipToggleRow}>
              <Pressable
                onPress={() => handleToggleVip(u.id)}
                style={[styles.vipToggleBtn, { backgroundColor: u.vip ? colors.gold + "22" : colors.surface, borderColor: u.vip ? colors.gold : colors.border }]}
              >
                <Icon name="star" size={14} color={u.vip ? colors.gold : colors.mutedForeground} />
                <Text style={{ color: u.vip ? colors.gold : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {u.vip ? "إلغاء العميل المميز" : "تعيين عميل مميز"}
                </Text>
              </Pressable>
            </View>

            {(user?.role === "admin" || (user?.role === "supervisor" && (user.permissions ?? []).includes("manage_staff"))) && !PROTECTED_PHONES.some((p) => samePhone(p, u.phone)) && (
              <Pressable
                onPress={() => (u.banned ? handleUnbanCustomer(u) : handleBanCustomer(u))}
                style={[styles.deleteUserBtn, { borderColor: u.banned ? "#27AE6044" : "#F39C1244", backgroundColor: u.banned ? "#27AE6011" : "#F39C1211", borderRadius: colors.radius - 4 }]}
              >
                <Icon name={u.banned ? "unlock" : "slash"} size={14} color={u.banned ? "#27AE60" : "#F39C12"} />
                <Text style={{ color: u.banned ? "#27AE60" : "#F39C12", fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {u.banned ? "إلغاء حظر المستخدم" : "حظر المستخدم"}
                </Text>
              </Pressable>
            )}

            {user?.role === "admin" && (
              <Pressable
                onPress={() => handleDeleteCustomer(u)}
                style={[styles.deleteUserBtn, { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11", borderRadius: colors.radius - 4 }]}
              >
                <Icon name="trash-2" size={14} color="#E74C3C" />
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  حذف المستخدم نهائياً
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderStaffCard = (u: User) => {
    const isExpanded = expandedUser === u.id;
    const showPermissions = (u.role === "employee" || u.role === "supervisor");
    const allowedPerms = u.role === "supervisor" ? SUPERVISOR_GRANTABLE : EMPLOYEE_GRANTABLE;
    const activePermCount = (u.permissions ?? []).length;

    return (
      <View key={u.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Pressable onPress={() => setExpandedUser(isExpanded ? null : u.id)} style={styles.userRow}>
          <View style={styles.userExpandIcon}>
            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {u.name}
              </Text>
            </View>
            <Text style={[styles.userPhone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {u.phone}
            </Text>
            {showPermissions && (
              <View style={styles.userMetaRow}>
                <View style={styles.userMetaItem}>
                  <Icon name="key" size={10} color={colors.mutedForeground + "AA"} />
                  <Text style={[styles.userMetaText, { color: colors.mutedForeground + "AA" }]}>
                    {activePermCount} صلاحية
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={[styles.roleChip, { backgroundColor: ROLE_COLORS[u.role] + "22", borderColor: ROLE_COLORS[u.role] + "55" }]}>
              <Icon name={ROLE_ICONS[u.role]} size={11} color={ROLE_COLORS[u.role]} />
              <Text style={{ color: ROLE_COLORS[u.role], fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {ROLE_LABELS[u.role]}
              </Text>
            </View>
          </View>
        </Pressable>

        {isExpanded && (user?.role === "admin" || (user?.role === "supervisor" && (user.permissions ?? []).includes("manage_staff"))) && u.id !== user.id && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            {PROTECTED_PHONES.includes(u.phone) && (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, padding: 10, backgroundColor: colors.gold + "11", borderRadius: colors.radius - 4, borderWidth: 1, borderColor: colors.gold + "33" }}>
                <Icon name="lock" size={14} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: "right" }}>
                  المدير الأساسي — محمي من التعديل والحذف
                </Text>
              </View>
            )}
            {!PROTECTED_PHONES.includes(u.phone) && renderNameEdit(u, handleSaveStaffName)}
            {!PROTECTED_PHONES.includes(u.phone) && user?.role === "admin" && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.expandLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  الدور الوظيفي
                </Text>
                <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
                  {(["admin", "supervisor", "employee"] as UserRole[]).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => {
                        if (u.role === role) return;
                        if (role === "admin") {
                          handlePromoteToAdmin(u);
                        } else {
                          Alert.alert(
                            "تغيير الدور",
                            `هل تريد تغيير دور "${u.name}" إلى ${ROLE_LABELS[role]}؟`,
                            [
                              { text: "إلغاء", style: "cancel" },
                              { text: "تأكيد", onPress: () => handleChangeStaffRole(u.id, role) },
                            ]
                          );
                        }
                      }}
                      style={[
                        styles.roleBtn,
                        {
                          backgroundColor: u.role === role ? ROLE_COLORS[role] + "33" : colors.surface,
                          borderColor: u.role === role ? ROLE_COLORS[role] : colors.border,
                          flex: 1,
                        },
                      ]}
                    >
                      <Icon
                        name={ROLE_ICONS[role]}
                        size={14}
                        color={u.role === role ? ROLE_COLORS[role] : colors.mutedForeground}
                      />
                      <Text
                        style={{
                          color: u.role === role ? ROLE_COLORS[role] : colors.foreground,
                          fontFamily: u.role === role ? "Inter_700Bold" : "Inter_400Regular",
                          fontSize: 13,
                        }}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {showPermissions && (user?.role === "admin" || (user?.role === "supervisor" && (user.permissions ?? []).includes("manage_staff"))) && renderPermissions(u, allowedPerms, handleToggleStaffPermission)}

            {!PROTECTED_PHONES.includes(u.phone) && user?.role === "admin" && (
              <Pressable
                onPress={() => handleDeleteStaff(u)}
                style={[styles.deleteUserBtn, { borderColor: "#E74C3C44", backgroundColor: "#E74C3C11", borderRadius: colors.radius - 4 }]}
              >
                <Icon name="trash-2" size={14} color="#E74C3C" />
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  حذف من الفريق نهائياً
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const customerCount = customerList.filter(c => c.role === "customer").length;
  const merchantCount = customerList.filter(c => c.role === "merchant").length;
  const vipCount = customerList.filter(c => c.vip).length;
  const employeeCount = staffList.filter(s => s.role === "employee").length;
  const supervisorCount = staffList.filter(s => s.role === "supervisor").length;
  const adminCount = staffList.filter(s => s.role === "admin").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="إدارة المستخدمين" onBack={() => router.back()} />

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => { setActiveTab(tab.key); setExpandedUser(null); setSearchQuery(""); }}
              style={[styles.tab, { borderBottomColor: active ? colors.gold : "transparent" }]}
            >
              <Icon name={tab.icon} size={16} color={active ? colors.gold : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? colors.gold : colors.mutedForeground, fontFamily: active ? "Inter_700Bold" : "Inter_400Regular" }]}>
                {tab.label}
              </Text>
              <View style={[styles.tabCount, { backgroundColor: active ? colors.gold + "33" : colors.border + "66" }]}>
                <Text style={{ color: active ? colors.gold : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                  {tab.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
          <Icon name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder={activeTab === "customers" ? "بحث بالاسم أو رقم الهاتف..." : "بحث في فريق العمل..."}
            placeholderTextColor={colors.mutedForeground + "88"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Icon name="x-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        {activeTab === "customers" && (
          <View style={styles.sortRow}>
            {sortOptions.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setSortBy(opt.key)}
                style={[
                  styles.sortBtn,
                  {
                    backgroundColor: sortBy === opt.key ? colors.gold + "22" : "transparent",
                    borderColor: sortBy === opt.key ? colors.gold + "55" : "transparent",
                  },
                ]}
              >
                <Icon name={opt.icon} size={11} color={sortBy === opt.key ? colors.gold : colors.mutedForeground + "88"} />
                <Text style={{
                  color: sortBy === opt.key ? colors.gold : colors.mutedForeground + "88",
                  fontFamily: sortBy === opt.key ? "Inter_600SemiBold" : "Inter_400Regular",
                  fontSize: 11,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {activeTab === "customers" && (
          <View style={styles.sortRow}>
            {([
              { key: "all", label: "الكل" },
              { key: "customers", label: "زبائن" },
              { key: "merchants", label: "تجار" },
              { key: "banned", label: "محظور" },
            ] as const).map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setCustFilter(opt.key)}
                style={[
                  styles.sortBtn,
                  {
                    backgroundColor: custFilter === opt.key ? colors.gold + "22" : "transparent",
                    borderColor: custFilter === opt.key ? colors.gold + "55" : "transparent",
                  },
                ]}
              >
                <Text style={{
                  color: custFilter === opt.key ? colors.gold : colors.mutedForeground + "88",
                  fontFamily: custFilter === opt.key ? "Inter_600SemiBold" : "Inter_400Regular",
                  fontSize: 11,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        {activeTab === "customers" ? (
          <>
            <View style={styles.statsRow}>
              {[
                { label: "زبائن", value: customerCount, color: colors.foreground, icon: "user" },
                { label: "تجار", value: merchantCount, color: colors.gold, icon: "briefcase" },
                { label: "مميزون", value: vipCount, color: "#F39C12", icon: "star" },
                { label: "ترقيات", value: pendingUpgrades.length, color: "#C0392B", icon: "arrow-up-circle" },
              ].map((stat) => (
                <View key={stat.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name={stat.icon} size={14} color={stat.color + "88"} />
                  <Text style={[styles.statNum, { color: stat.color, fontFamily: "Inter_700Bold" }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {pendingUpgrades.length > 0 && canApproveUpgrades && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionBadge, { backgroundColor: "#C0392B" + "22" }]}>
                    <Text style={{ color: "#C0392B", fontFamily: "Inter_700Bold", fontSize: 11 }}>{pendingUpgrades.length}</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
                    طلبات الترقية
                  </Text>
                  <Icon name="arrow-up-circle" size={18} color={colors.gold} />
                </View>
                {pendingUpgrades.map((u) => (
                  <View key={u.id} style={[styles.upgradeCard, { backgroundColor: colors.gold + "08", borderColor: colors.gold + "33", borderRadius: colors.radius }]}>
                    <View style={styles.userInfo}>
                      <Text style={[styles.upgradeUserName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{u.name}</Text>
                      <Text style={[styles.userPhone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{u.phone}</Text>
                      {u.registeredAt && (
                        <Text style={{ color: colors.mutedForeground + "88", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>
                          مسجل منذ {formatDate(u.registeredAt)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.upgradeActions}>
                      <Pressable onPress={() => handleRejectUpgrade(u.id)} style={[styles.rejectBtn, { borderColor: colors.destructive + "66", borderRadius: 8 }]}>
                        <Icon name="x" size={14} color={colors.destructive} />
                      </Pressable>
                      <Pressable onPress={() => handleApproveUpgrade(u.id)} style={[styles.approveBtn, { backgroundColor: colors.gold, borderRadius: 8 }]}>
                        <Icon name="check" size={14} color={colors.background} />
                        <Text style={{ color: colors.background, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>قبول</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {searchQuery.trim() ? `نتائج البحث (${filteredCustomers.length})` : `الزبائن والتجار (${activeCustomers.length})`}
                </Text>
              </View>
              {filteredCustomers.length === 0 && (
                <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Icon name="search" size={28} color={colors.mutedForeground + "55"} />
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    {searchQuery.trim() ? "لا توجد نتائج للبحث" : "لا يوجد زبائن مسجلون بعد"}
                  </Text>
                </View>
              )}
              {filteredCustomers.map((u) => renderCustomerCard(u))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              {[
                { label: "موظفون", value: employeeCount, color: "#2980B9", icon: "tool" },
                { label: "مشرفون", value: supervisorCount, color: "#8E44AD", icon: "shield" },
                { label: "مدراء", value: adminCount, color: "#C0392B", icon: "star" },
              ].map((stat) => (
                <View key={stat.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name={stat.icon} size={14} color={stat.color + "88"} />
                  <Text style={[styles.statNum, { color: stat.color, fontFamily: "Inter_700Bold" }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {searchQuery.trim() ? `نتائج البحث (${filteredStaff.length})` : `فريق العمل (${staffList.length})`}
                </Text>
              </View>
              {filteredStaff.length === 0 && (
                <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Icon name="search" size={28} color={colors.mutedForeground + "55"} />
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    لا توجد نتائج للبحث
                  </Text>
                </View>
              )}
              {filteredStaff.map((u) => renderStaffCard(u))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 13 },
  tabCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInputContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: 38,
  },
  sortRow: {
    flexDirection: "row-reverse",
    gap: 6,
  },
  sortBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: { padding: 16, gap: 16 },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  sectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, textAlign: "right", flex: 1 },
  statsRow: { flexDirection: "row-reverse", gap: 8 },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  statNum: { fontSize: 20 },
  statLabel: { fontSize: 9, textAlign: "center" },
  upgradeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  upgradeUserName: { fontSize: 14 },
  userInfo: { flex: 1, gap: 3 },
  upgradeActions: { flexDirection: "row-reverse", gap: 8 },
  rejectBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  approveBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 14, height: 36 },
  userCard: { borderWidth: 1, overflow: "hidden" },
  userRow: { flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 12 },
  userExpandIcon: { padding: 2 },
  userDetails: { flex: 1, gap: 3, alignItems: "flex-end" },
  userNameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  userName: { fontSize: 14 },
  userPhone: { fontSize: 12 },
  userMetaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 3 },
  userMetaItem: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  userMetaText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  userMetaPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  roleChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  vipBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  expandedSection: { borderTopWidth: 1, padding: 14, gap: 12 },
  orderStatsBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
  },
  orderStatItem: { flex: 1, alignItems: "center", gap: 2 },
  orderStatNum: { fontSize: 16 },
  orderStatLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  orderStatDivider: { width: 1, height: 28 },
  dateRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  expandLabel: { fontSize: 12, textAlign: "right" },
  roleBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  confirmBox: {
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  confirmActions: { flexDirection: "row-reverse", gap: 8 },
  confirmCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1 },
  confirmOkBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  vipToggleRow: { alignItems: "flex-end" },
  vipToggleBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  permissionsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  permChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  nameEditRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  nameActionBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  editNameBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  deleteUserBtn: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    borderWidth: 1,
    gap: 8,
  },
});
