import React, { useState, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Notification } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import Icon from "@/components/Icon";
import { notifyAll, notifyByRoles, notifyUserByPhone } from "@/lib/pushService";
import { useAdminGuard } from "@/hooks/useAdminGuard";

type NotifType = "all" | "customers" | "merchants" | "employees" | "supervisors" | "private";
type TabKey = "compose" | "history";

const TYPE_OPTIONS: { key: NotifType; label: string; icon: string; desc: string; color: string }[] = [
  { key: "all", label: "الجميع", icon: "globe", desc: "كل المستخدمين", color: "#27AE60" },
  { key: "customers", label: "الزبائن", icon: "users", desc: "الزبائن فقط", color: "#3498DB" },
  { key: "merchants", label: "التجار", icon: "briefcase", desc: "التجار فقط", color: "#C9A84C" },
  { key: "employees", label: "الموظفين", icon: "tool", desc: "الموظفين", color: "#2980B9" },
  { key: "supervisors", label: "المشرفين", icon: "shield", desc: "المشرفين", color: "#8E44AD" },
  { key: "private", label: "خاص", icon: "user", desc: "شخص محدد", color: "#E67E22" },
];

const STAFF_USERS = [
  { id: "u3", phone: "0000000003", name: "موظف", role: "employee" as const },
  { id: "u4", phone: "0000000004", name: "مشرف", role: "supervisor" as const },
];

const ROLE_LABEL: Record<string, string> = {
  customer: "زبون",
  merchant: "تاجر",
  employee: "موظف",
  supervisor: "مشرف",
  admin: "مدير",
};
const ROLE_COLOR: Record<string, string> = {
  customer: "#888",
  merchant: "#C9A84C",
  employee: "#2980B9",
  supervisor: "#8E44AD",
  admin: "#C0392B",
};

const FALLBACK_TEMPLATES = [
  { id: "tmpl_offers", title: "عروض جديدة", body: "تصفح أحدث العروض والخصومات الحصرية على أقمشتنا المميزة!" },
  { id: "tmpl_arrivals", title: "وصول بضاعة جديدة", body: "تم وصول تشكيلة جديدة من الأقمشة. زوروا المعرض أو تصفحوا التطبيق!" },
  { id: "tmpl_update", title: "تحديث مهم", body: "يرجى مراجعة طلباتكم الحالية للاطلاع على آخر التحديثات." },
  { id: "tmpl_maint", title: "صيانة مجدولة", body: "سيتم إجراء صيانة مجدولة على النظام. نعتذر عن أي إزعاج." },
];

export default function AdminNotificationsScreen() {
  useAdminGuard("send_notifications");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addNotification, notifications, registeredCustomers, user, settings, setSettings } = useApp();
  const templates = settings.notificationTemplates ?? FALLBACK_TEMPLATES;
  const [tmplModalOpen, setTmplModalOpen] = useState(false);
  const [tmplEditing, setTmplEditing] = useState<{ id: string; title: string; body: string } | null>(null);
  const [tmplTitle, setTmplTitle] = useState("");
  const [tmplBody, setTmplBody] = useState("");

  const openNewTemplate = () => {
    setTmplEditing(null);
    setTmplTitle("");
    setTmplBody("");
    setTmplModalOpen(true);
  };
  const openEditTemplate = (t: { id: string; title: string; body: string }) => {
    setTmplEditing(t);
    setTmplTitle(t.title);
    setTmplBody(t.body);
    setTmplModalOpen(true);
  };
  const saveTemplate = async () => {
    const titleT = tmplTitle.trim();
    const bodyT = tmplBody.trim();
    if (!titleT || !bodyT) {
      Alert.alert("خطأ", "العنوان والنص مطلوبان");
      return;
    }
    const list = templates.slice();
    if (tmplEditing) {
      const idx = list.findIndex((x) => x.id === tmplEditing.id);
      if (idx >= 0) list[idx] = { ...tmplEditing, title: titleT, body: bodyT };
    } else {
      list.push({
        id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: titleT,
        body: bodyT,
      });
    }
    try {
      await setSettings({ ...settings, notificationTemplates: list });
      setTmplModalOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("تعذّر الحفظ", "تأكد من اتصال الإنترنت ثم حاول مجدداً");
    }
  };
  const deleteTemplate = (t: { id: string; title: string; body: string }) => {
    Alert.alert("حذف القالب", `هل تريد حذف "${t.title}"؟`, [
      { text: "تراجع", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const list = templates.filter((x) => x.id !== t.id);
          try {
            await setSettings({ ...settings, notificationTemplates: list });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("تعذّر الحذف", "تأكد من اتصال الإنترنت ثم حاول مجدداً");
          }
        },
      },
    ]);
  };
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notifType, setNotifType] = useState<NotifType>(
    user?.role === "supervisor" ? "private" : "all"
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("compose");
  const [searchQuery, setSearchQuery] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const successAnim = useRef(new Animated.Value(0)).current;

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isSupervisor = user?.role === "supervisor";
  const supervisorCanSend = isSupervisor && user?.permissions?.includes("send_notifications");
  const isAdmin = user?.role === "admin";

  const visibleTypeOptions = isSupervisor
    ? TYPE_OPTIONS.filter((o) => o.key === "private")
    : TYPE_OPTIONS;

  const allPickableUsers = useMemo(() => {
    const merged = [...STAFF_USERS, ...registeredCustomers];
    const seen = new Set<string>();
    return merged.filter((u) => {
      const key = u.phone || u.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [registeredCustomers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allPickableUsers;
    const q = searchQuery.trim().toLowerCase();
    return allPickableUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.phone.includes(q)
    );
  }, [allPickableUsers, searchQuery]);

  const selectedUser = allPickableUsers.find((c) => c.id === selectedUserId);

  const getTargetCount = () => {
    switch (notifType) {
      case "all": return allPickableUsers.length;
      case "customers": return registeredCustomers.filter(c => c.role === "customer").length;
      case "merchants": return registeredCustomers.filter(c => c.role === "merchant").length;
      case "employees": return STAFF_USERS.filter(u => u.role === "employee").length;
      case "supervisors": return STAFF_USERS.filter(u => u.role === "supervisor").length;
      case "private": return selectedUser ? 1 : 0;
      default: return 0;
    }
  };

  const showSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleSend = async () => {
    if (!isAdmin && !supervisorCanSend) {
      Alert.alert("غير مصرح", "ليس لديك صلاحية إرسال الإشعارات");
      return;
    }
    if (!title.trim() || !body.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال العنوان والمحتوى");
      return;
    }
    if (notifType === "private" && !selectedUserId) {
      Alert.alert("خطأ", "الرجاء اختيار المستخدم");
      return;
    }

    const targetLabel =
      notifType === "all" ? "جميع المستخدمين" :
      notifType === "customers" ? "جميع الزبائن" :
      notifType === "merchants" ? "جميع التجار" :
      notifType === "employees" ? "جميع الموظفين" :
      notifType === "supervisors" ? "جميع المشرفين" :
      selectedUser?.name ?? "المستخدم";

    Alert.alert(
      "تأكيد الإرسال",
      `سيتم إرسال الإشعار إلى ${targetLabel} (${getTargetCount()} مستخدم).\n\nالعنوان: ${title.trim()}\n\nهل تريد المتابعة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "إرسال", onPress: doSend },
      ]
    );
  };

  const doSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    const notif: any = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
      read: false,
      // Stamp the author so the sender's own Firestore listener skips it (no
      // self-notification for a broadcast they just sent).
      ...(user?.id ? { sourceUserId: user.id } : {}),
    };

    if (notifType === "all") notif.targetRole = "all";
    if (notifType === "customers") notif.targetRole = "customer";
    if (notifType === "merchants") notif.targetRole = "merchant";
    if (notifType === "employees") notif.targetRole = "employee";
    if (notifType === "supervisors") notif.targetRole = "supervisor";
    if (notifType === "private") {
      notif.targetUserId = selectedUserId;
      const target = allPickableUsers.find((u) => u.id === selectedUserId);
      if (target?.phone) notif.targetUserPhone = target.phone;
    }

    try {
      await addNotification(notif);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      Alert.alert("تعذّر الإرسال", "تأكد من اتصال الإنترنت ثم حاول مجدداً");
      return;
    }

    try {
      if (notifType === "all") {
        await notifyAll(title.trim(), body.trim(), { type: "broadcast" });
      } else if (notifType === "customers") {
        await notifyByRoles(["customer"], title.trim(), body.trim(), { type: "broadcast" });
      } else if (notifType === "merchants") {
        await notifyByRoles(["merchant"], title.trim(), body.trim(), { type: "broadcast" });
      } else if (notifType === "employees") {
        await notifyByRoles(["employee"], title.trim(), body.trim(), { type: "broadcast" });
      } else if (notifType === "supervisors") {
        await notifyByRoles(["supervisor"], title.trim(), body.trim(), { type: "broadcast" });
      } else if (notifType === "private" && selectedUser) {
        await notifyUserByPhone(selectedUser.phone, title.trim(), body.trim(), { type: "private" });
      }
    } catch (_) {}

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    setSentCount((c) => c + 1);
    showSuccessAnimation();

    setTitle("");
    setBody("");
    setSelectedUserId(null);
    setSearchQuery("");
    setShowUserPicker(false);
  };

  const handleTemplate = (tmpl: { title: string; body: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTitle(tmpl.title);
    setBody(tmpl.body);
  };

  const recentNotifs = useMemo(() => {
    return [...notifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [notifications]);

  const getNotifBadge = (n: Notification) => {
    if (n.targetUserId) return { label: "خاص", color: "#E67E22" };
    if (n.targetRole === "customer") return { label: "زبائن", color: "#3498DB" };
    if (n.targetRole === "merchant") return { label: "تجار", color: "#C9A84C" };
    if (n.targetRole === "employee") return { label: "موظفين", color: "#2980B9" };
    if (n.targetRole === "supervisor") return { label: "مشرفين", color: "#8E44AD" };
    return { label: "الجميع", color: "#27AE60" };
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "compose", label: "إنشاء إشعار", icon: "edit-3" },
    { key: "history", label: "السجل", icon: "clock" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="مركز الإشعارات" onBack={() => router.back()} />

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, { borderBottomColor: active ? colors.gold : "transparent" }]}
            >
              <Icon name={tab.icon as any} size={16} color={active ? colors.gold : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? colors.gold : colors.mutedForeground, fontFamily: active ? "Inter_700Bold" : "Inter_400Regular" }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.successOverlay,
          {
            opacity: successAnim,
            transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          },
        ]}
      >
        <View style={[styles.successCard, { backgroundColor: "#27AE60", borderRadius: colors.radius }]}>
          <Icon name="check-circle" size={32} color="#fff" />
          <Text style={styles.successText}>تم إرسال الإشعار بنجاح!</Text>
        </View>
      </Animated.View>

      {isSupervisor && !supervisorCanSend && (
        <View style={[styles.warningBanner, { backgroundColor: "#C0392B22", borderColor: "#C0392B55", margin: 16, borderRadius: colors.radius }]}>
          <Icon name="alert-triangle" size={18} color="#C0392B" />
          <Text style={[styles.warningText, { color: "#C0392B", fontFamily: "Inter_500Medium" }]}>
            لا تملك صلاحية إرسال الإشعارات. تواصل مع المدير لمنحك الإذن.
          </Text>
        </View>
      )}

      {activeTab === "compose" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.sectionHeader}>
              <Icon name="send" size={16} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                إرسال إلى
              </Text>
            </View>
            <View style={styles.typeGrid}>
              {visibleTypeOptions.map((opt) => {
                const active = notifType === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      setNotifType(opt.key);
                      setSelectedUserId(null);
                      setShowUserPicker(opt.key === "private");
                      setSearchQuery("");
                    }}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? opt.color + "22" : colors.surface,
                        borderColor: active ? opt.color : colors.border,
                        borderRadius: colors.radius - 4,
                      },
                    ]}
                  >
                    <Icon name={opt.icon as any} size={16} color={active ? opt.color : colors.mutedForeground} />
                    <Text style={[styles.typeLabel, { color: active ? opt.color : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {notifType !== "private" && (
              <View style={[styles.targetInfo, { backgroundColor: colors.surface, borderRadius: colors.radius - 4 }]}>
                <Icon name="users" size={14} color={colors.gold} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  سيصل إلى {getTargetCount()} مستخدم
                </Text>
              </View>
            )}
          </View>

          {notifType === "private" && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={styles.sectionHeader}>
                <Icon name="user" size={16} color={colors.gold} />
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  اختر المستخدم
                </Text>
              </View>

              <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Icon name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="بحث بالاسم أو الرقم..."
                  placeholderTextColor={colors.mutedForeground}
                  textAlign="right"
                />
              </View>

              {selectedUser && (
                <View style={[styles.selectedUserCard, { backgroundColor: colors.gold + "15", borderColor: colors.gold + "44", borderRadius: colors.radius - 4 }]}>
                  <View style={[styles.userAvatar, { backgroundColor: (ROLE_COLOR[selectedUser.role] ?? "#888") + "33" }]}>
                    <Text style={{ color: ROLE_COLOR[selectedUser.role] ?? "#888", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {selectedUser.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>
                      {selectedUser.name}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>
                      {selectedUser.phone} · {ROLE_LABEL[selectedUser.role] ?? selectedUser.role}
                    </Text>
                  </View>
                  <Pressable onPress={() => { setSelectedUserId(null); setShowUserPicker(true); }}>
                    <Icon name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}

              {!selectedUser && (
                <View style={[styles.userList, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                  {filteredUsers.length === 0 ? (
                    <View style={styles.noResults}>
                      <Icon name="search" size={24} color={colors.mutedForeground} />
                      <Text style={[styles.noResultsText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        لا يوجد نتائج
                      </Text>
                    </View>
                  ) : (
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled showsVerticalScrollIndicator>
                      {filteredUsers.map((c) => {
                        const roleColor = ROLE_COLOR[c.role] ?? "#888";
                        return (
                          <Pressable
                            key={c.phone || c.id}
                            onPress={() => {
                              setSelectedUserId(c.id);
                              setShowUserPicker(false);
                              setSearchQuery("");
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={[styles.userItem, { borderBottomColor: colors.border }]}
                          >
                            <View style={[styles.userAvatar, { backgroundColor: roleColor + "33" }]}>
                              <Text style={{ color: roleColor, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                                {c.name.charAt(0)}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" }}>
                                  {c.name}
                                </Text>
                                <View style={{ backgroundColor: roleColor + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                  <Text style={{ color: roleColor, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                                    {ROLE_LABEL[c.role] ?? c.role}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" }}>
                                {c.phone}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.sectionHeader}>
              <Icon name="file-text" size={16} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                محتوى الإشعار
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                العنوان
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: title.trim() ? colors.gold + "66" : colors.border,
                    borderRadius: colors.radius - 4,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="عنوان الإشعار"
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                الرسالة
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: body.trim() ? colors.gold + "66" : colors.border,
                    borderRadius: colors.radius - 4,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                value={body}
                onChangeText={setBody}
                placeholder="اكتب رسالتك هنا..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                textAlign="right"
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {body.length} حرف
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.sectionHeader, { justifyContent: "space-between" }]}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Icon name="zap" size={16} color={colors.gold} />
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  قوالب جاهزة
                </Text>
              </View>
              <Pressable
                onPress={openNewTemplate}
                style={({ pressed }) => ({
                  flexDirection: "row-reverse", alignItems: "center", gap: 4,
                  paddingHorizontal: 10, paddingVertical: 6,
                  backgroundColor: pressed ? colors.gold + "30" : colors.gold + "18",
                  borderColor: colors.gold + "55", borderWidth: 1,
                  borderRadius: 8,
                })}
              >
                <Icon name="plus" size={14} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  قالب جديد
                </Text>
              </Pressable>
            </View>
            <View style={styles.templatesGrid}>
              {templates.length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular", paddingVertical: 12 }}>
                  لا توجد قوالب — اضغط "قالب جديد" لإنشاء واحد
                </Text>
              )}
              {templates.map((tmpl) => (
                <View
                  key={tmpl.id}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: colors.radius - 4,
                    },
                  ]}
                >
                  <Pressable onPress={() => handleTemplate(tmpl)} style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "right" }} numberOfLines={1}>
                      {tmpl.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", lineHeight: 16 }} numberOfLines={2}>
                      {tmpl.body}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 8, justifyContent: "flex-start" }}>
                    <Pressable
                      onPress={() => openEditTemplate(tmpl)}
                      style={({ pressed }) => ({
                        flexDirection: "row-reverse", alignItems: "center", gap: 4,
                        paddingHorizontal: 10, paddingVertical: 5,
                        backgroundColor: pressed ? "#3498DB30" : "#3498DB15",
                        borderColor: "#3498DB55", borderWidth: 1, borderRadius: 6,
                      })}
                    >
                      <Icon name="edit-2" size={11} color="#3498DB" />
                      <Text style={{ color: "#3498DB", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>تعديل</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteTemplate(tmpl)}
                      style={({ pressed }) => ({
                        flexDirection: "row-reverse", alignItems: "center", gap: 4,
                        paddingHorizontal: 10, paddingVertical: 5,
                        backgroundColor: pressed ? "#E74C3C30" : "#E74C3C15",
                        borderColor: "#E74C3C55", borderWidth: 1, borderRadius: 6,
                      })}
                    >
                      <Icon name="trash-2" size={11} color="#E74C3C" />
                      <Text style={{ color: "#E74C3C", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>حذف</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleSend}
            disabled={loading || !title.trim() || !body.trim() || (notifType === "private" && !selectedUserId)}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.gold,
                borderRadius: colors.radius,
                opacity: (loading || !title.trim() || !body.trim() || (notifType === "private" && !selectedUserId)) ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <Text style={[styles.sendBtnText, { color: colors.background }]}>جاري الإرسال...</Text>
            ) : (
              <>
                <Icon name="send" size={20} color={colors.background} />
                <Text style={[styles.sendBtnText, { color: colors.background }]}>
                  إرسال الإشعار
                </Text>
              </>
            )}
          </Pressable>

          {sentCount > 0 && (
            <View style={[styles.sentStats, { backgroundColor: colors.surface, borderRadius: colors.radius - 4 }]}>
              <Icon name="check-circle" size={14} color="#27AE60" />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                تم إرسال {sentCount} إشعار في هذه الجلسة
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {recentNotifs.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="bell-off" size={48} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 16 }}>
                لا توجد إشعارات مرسلة
              </Text>
            </View>
          ) : (
            <FlatList
              data={recentNotifs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.historyContent, { paddingBottom: bottomPad + 40 }]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== "web"}
              renderItem={({ item: n }) => {
                const badge = getNotifBadge(n);
                const targetUser = n.targetUserId ? allPickableUsers.find(u => u.id === n.targetUserId) : null;
                return (
                  <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <View style={styles.historyHeader}>
                      <View style={[styles.historyBadge, { backgroundColor: badge.color + "22", borderColor: badge.color + "44" }]}>
                        <Text style={{ color: badge.color, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>{badge.label}</Text>
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, flex: 1, textAlign: "right" }}>
                        {new Date(n.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" }}>
                      {n.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right", lineHeight: 20 }} numberOfLines={3}>
                      {n.body}
                    </Text>
                    {targetUser && (
                      <View style={[styles.targetUserInfo, { backgroundColor: colors.surface, borderRadius: 8 }]}>
                        <Icon name="user" size={12} color={colors.mutedForeground} />
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                          {targetUser.name} · {targetUser.phone}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      <Modal visible={tmplModalOpen} transparent animationType="fade" onRequestClose={() => setTmplModalOpen(false)}>
        <Pressable
          onPress={() => setTmplModalOpen(false)}
          style={{ flex: 1, backgroundColor: "#000A", justifyContent: "center", padding: 20 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 20, gap: 14 }}
          >
            <Text style={{ color: colors.gold, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "right" }}>
              {tmplEditing ? "تعديل القالب" : "قالب جديد"}
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>العنوان</Text>
              <TextInput
                value={tmplTitle}
                onChangeText={setTmplTitle}
                placeholder="مثال: عرض خاص"
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
                style={{
                  borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
                  color: colors.foreground, backgroundColor: colors.input, fontFamily: "Inter_400Regular",
                }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" }}>النص</Text>
              <TextInput
                value={tmplBody}
                onChangeText={setTmplBody}
                placeholder="نص الإشعار..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                textAlign="right"
                textAlignVertical="top"
                style={{
                  borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
                  color: colors.foreground, backgroundColor: colors.input, fontFamily: "Inter_400Regular",
                  minHeight: 90,
                }}
              />
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={saveTemplate}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: pressed ? colors.gold + "DD" : colors.gold,
                  alignItems: "center",
                })}
              >
                <Text style={{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 14 }}>حفظ</Text>
              </Pressable>
              <Pressable
                onPress={() => setTmplModalOpen(false)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: pressed ? colors.surface : "transparent",
                  borderWidth: 1, borderColor: colors.border, alignItems: "center",
                })}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>إلغاء</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
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
    paddingVertical: 12,
    borderBottomWidth: 2.5,
  },
  tabText: { fontSize: 14 },
  section: { gap: 12, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, textAlign: "right" },
  typeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    minWidth: "30%",
    flexGrow: 1,
    justifyContent: "center",
  },
  typeLabel: { fontSize: 12 },
  targetInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13 },
  selectedUserCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  userList: { borderWidth: 1, overflow: "hidden" },
  userItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  noResults: { alignItems: "center", padding: 24, gap: 8 },
  noResultsText: { fontSize: 13 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, textAlign: "right" },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 100,
  },
  charCount: { fontSize: 11, textAlign: "left" },
  templatesGrid: { gap: 8 },
  templateCard: {
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  sendBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  sendBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sentStats: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
  },
  successOverlay: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: "center",
  },
  successCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  historyContent: { padding: 16, gap: 10 },
  historyCard: { padding: 14, borderWidth: 1, gap: 6 },
  historyHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  targetUserInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emptyHistory: { alignItems: "center", paddingTop: 80, gap: 16 },
  warningBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 13, textAlign: "right", lineHeight: 20 },
});
