import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/lib/i18n";
import GoldHeader from "@/components/GoldHeader";

const CONTACT_EMAIL = "aboabedtheking@gmail.com";

type Section = { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };

const SECTIONS: Section[] = [
  {
    titleAr: "مقدمة",
    titleEn: "Introduction",
    bodyAr:
      "تحرص شمس تكس على حماية خصوصية عملائها واحترام بياناتهم الشخصية. توضح هذه السياسة أنواع المعلومات التي نجمعها وكيفية استخدامها وحمايتها عند استخدامك لتطبيقنا. باستخدامك للتطبيق فإنك توافق على الممارسات الموضحة في هذه السياسة.",
    bodyEn:
      "Shams Tex is committed to protecting the privacy of its customers and respecting their personal data. This policy explains what information we collect, how we use it, and how we protect it when you use our app. By using the app you agree to the practices described in this policy.",
  },
  {
    titleAr: "المعلومات التي نجمعها",
    titleEn: "Information We Collect",
    bodyAr:
      "• رقم هاتفك: نستخدمه لتسجيل دخولك والتحقق منه عبر رسالة رمز (OTP).\n• بيانات الحساب: الاسم وعناوين التوصيل.\n• بيانات الطلبات: تفاصيل المنتجات والكميات وطريقة الدفع المختارة وسجل طلباتك.\n• الصور التي ترفعها: مثل صور إثبات التحويل البنكي أو فواتير الإرجاع، لتأكيد الدفع أو معالجة طلبات الإرجاع.\n• رمز الإشعارات (Push Token): لإرسال إشعارات حالة الطلبات والعروض إلى جهازك.\n• بيانات محفوظة على جهازك: نخزّن بعض البيانات محليًا (مثل تفضيلاتك وجلسة الدخول) لتسريع عمل التطبيق.\n\nملاحظة: لا نجمع أرقام البطاقات البنكية الكاملة أو رمز التحقق (CVV) أو بيانات اعتماد الدفع. أما صور إثبات التحويل التي ترفعها فتُخزَّن فقط لمعالجة الدفع أو طلبات الإرجاع.",
    bodyEn:
      "• Your phone number: used to sign you in and verify you via a one-time code (OTP).\n• Account data: name and delivery addresses.\n• Order data: product details, quantities, the selected payment method, and your order history.\n• Images you upload: such as bank-transfer proof or return invoices, to confirm payment or process returns.\n• Push notification token: to send order-status and promotional notifications to your device.\n• Data stored on your device: we keep some data locally (such as your preferences and login session) to make the app faster.\n\nNote: we do not collect full bank card numbers, CVV, or payment-card credentials. Any transfer-proof images you upload are stored only to process payment or returns.",
  },
  {
    titleAr: "كيفية استخدام المعلومات",
    titleEn: "How We Use Information",
    bodyAr:
      "نستخدم بياناتك لتنفيذ طلباتك ومتابعة حالتها، والتحقق من هويتك عند الدخول، والتواصل معك بشأن الطلبات والعروض والإشعارات المهمة، ومعالجة عمليات الدفع والإرجاع، وتحسين تجربتك وأداء التطبيق. لا نستخدم بياناتك لأي غرض آخر دون موافقتك.",
    bodyEn:
      "We use your data to fulfill and track your orders, verify your identity at sign-in, communicate with you about orders, offers and important notifications, process payments and returns, and improve your experience and the app's performance. We do not use your data for any other purpose without your consent.",
  },
  {
    titleAr: "خدمات الطرف الثالث",
    titleEn: "Third-Party Services",
    bodyAr:
      "يعتمد التطبيق على خدمات Google Firebase لتشغيله، وتشمل: تسجيل الدخول عبر الهاتف (Firebase Authentication)، وتخزين بيانات الطلبات والحسابات (Cloud Firestore)، وتخزين الصور (Firebase Storage)، وإرسال الإشعارات (Cloud Messaging). تُعالَج هذه البيانات وتُخزَّن على خوادم Google وفقًا لسياسة خصوصية Google. ونحرص على مشاركة الحد الأدنى اللازم فقط لتشغيل الخدمة.",
    bodyEn:
      "The app relies on Google Firebase services to operate, including: phone sign-in (Firebase Authentication), storage of order and account data (Cloud Firestore), image storage (Firebase Storage), and notifications (Cloud Messaging). This data is processed and stored on Google's servers in accordance with Google's privacy policy. We only share the minimum necessary to run the service.",
  },
  {
    titleAr: "مشاركة المعلومات",
    titleEn: "Sharing of Information",
    bodyAr:
      "لا نقوم ببيع أو تأجير بياناتك الشخصية لأي طرف ثالث. قد نشارك الحد الأدنى من البيانات اللازمة مع شركات الشحن والتوصيل بهدف إتمام تسليم طلبك فقط، ومع مزوّدي الخدمات التقنية (مثل Google) لتشغيل التطبيق، مع التزامهم بالحفاظ على سريتها.",
    bodyEn:
      "We do not sell or rent your personal data to any third party. We may share the minimum necessary data with shipping and delivery companies solely to complete your order's delivery, and with technical service providers (such as Google) to operate the app, all bound to keep it confidential.",
  },
  {
    titleAr: "الاحتفاظ بالبيانات",
    titleEn: "Data Retention",
    bodyAr:
      "نحتفظ ببياناتك طوال فترة استخدامك للتطبيق وللمدة اللازمة لتقديم خدماتنا والوفاء بالالتزامات القانونية والمحاسبية. عند طلبك حذف حسابك، نحذف بياناتك الشخصية خلال مدة معقولة ما لم يُلزمنا القانون بالاحتفاظ ببعضها.",
    bodyEn:
      "We retain your data for as long as you use the app and for the period necessary to provide our services and meet legal and accounting obligations. When you request account deletion, we delete your personal data within a reasonable period unless the law requires us to retain some of it.",
  },
  {
    titleAr: "حماية البيانات",
    titleEn: "Data Security",
    bodyAr:
      "نتخذ إجراءات تقنية وتنظيمية مناسبة لحماية بياناتك من الوصول أو الاستخدام أو الإفصاح غير المصرح به. ومع ذلك لا يمكن ضمان أمان أي وسيلة نقل عبر الإنترنت بشكل مطلق، لذا نوصي بالحفاظ على سرية بيانات دخولك وعدم مشاركتها.",
    bodyEn:
      "We take appropriate technical and organizational measures to protect your data from unauthorized access, use, or disclosure. However, no method of transmission over the internet is fully secure, so we recommend keeping your login details confidential and not sharing them.",
  },
  {
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    bodyAr:
      "قد نرسل إليك إشعارات تتعلق بحالة طلباتك أو العروض الترويجية. يمكنك التحكم في إشعارات جهازك من إعدادات الهاتف في أي وقت.",
    bodyEn:
      "We may send you notifications about your order status or promotions. You can control your device notifications from your phone settings at any time.",
  },
  {
    titleAr: "حقوقك",
    titleEn: "Your Rights",
    bodyAr:
      "يحق لك الاطلاع على بياناتك الشخصية أو تصحيحها أو طلب حذف حسابك وبياناتك. لممارسة هذه الحقوق، تواصل معنا عبر البريد الإلكتروني الموضح أدناه وسنستجيب لطلبك خلال مدة معقولة.",
    bodyEn:
      "You have the right to access, correct, or request deletion of your account and data. To exercise these rights, contact us via the email below and we will respond within a reasonable period.",
  },
  {
    titleAr: "خصوصية الأطفال",
    titleEn: "Children's Privacy",
    bodyAr:
      "هذا التطبيق غير موجَّه للأطفال دون سن 13 عامًا، ولا نجمع عن قصد بيانات منهم. إذا علمنا بجمع بيانات طفل دون موافقة وليّ أمره، فسنحذفها.",
    bodyEn:
      "This app is not directed to children under 13, and we do not knowingly collect data from them. If we learn that we have collected a child's data without parental consent, we will delete it.",
  },
  {
    titleAr: "التعديلات على السياسة",
    titleEn: "Changes to This Policy",
    bodyAr:
      "قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سيتم نشر أي تغييرات داخل التطبيق، ويعد استمرارك في استخدام التطبيق بعد التحديث موافقة على السياسة المعدّلة.",
    bodyEn:
      "We may update this privacy policy from time to time. Any changes will be posted within the app, and your continued use of the app after an update constitutes acceptance of the revised policy.",
  },
  {
    titleAr: "التواصل معنا",
    titleEn: "Contact Us",
    bodyAr:
      `إذا كان لديك أي استفسار بخصوص سياسة الخصوصية أو طريقة معالجة بياناتك، أو لطلب حذف حسابك، تواصل معنا عبر البريد الإلكتروني:\n${CONTACT_EMAIL}`,
    bodyEn:
      `If you have any questions about this privacy policy or how we handle your data, or to request account deletion, contact us by email:\n${CONTACT_EMAIL}`,
  },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL } = useTranslation();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const align: "right" | "left" = isRTL ? "right" : "left";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title={isRTL ? "سياسة الخصوصية" : "Privacy Policy"} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <Text
          style={[styles.updated, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: align }]}
        >
          {isRTL ? "آخر تحديث: يونيو 2026" : "Last updated: June 2026"}
        </Text>
        {SECTIONS.map((s, i) => (
          <View
            key={i}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Text style={[styles.title, { color: colors.gold, fontFamily: "Inter_700Bold", textAlign: align }]}>
              {isRTL ? s.titleAr : s.titleEn}
            </Text>
            <Text style={[styles.body, { color: colors.foreground, fontFamily: "Inter_400Regular", textAlign: align }]}>
              {isRTL ? s.bodyAr : s.bodyEn}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  updated: { fontSize: 12, marginBottom: 4 },
  card: { padding: 16, borderWidth: 1, gap: 8 },
  title: { fontSize: 15 },
  body: { fontSize: 13, lineHeight: 22 },
});
