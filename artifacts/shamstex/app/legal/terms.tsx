import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import GoldHeader from "@/components/GoldHeader";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "قبول الشروط",
    body: "باستخدامك لتطبيق شمس تكس فإنك تقر بموافقتك على هذه الشروط والأحكام بالكامل. إذا كنت لا توافق على أي بند منها يرجى التوقف عن استخدام التطبيق.",
  },
  {
    title: "الحساب وتسجيل الدخول",
    body: "يتطلب استخدام التطبيق إنشاء حساب برقم هاتف صحيح. أنت مسؤول عن الحفاظ على سرية بيانات حسابك وعن جميع العمليات التي تتم من خلاله. يحق لإدارة شمس تكس تعليق أو إيقاف أي حساب يُساء استخدامه أو يخالف هذه الشروط.",
  },
  {
    title: "الطلبات والأسعار",
    body: "تخضع جميع الطلبات لتأكيد التوفر لدى شمس تكس. الأسعار المعروضة قابلة للتغيير، وقد تختلف أسعار التجزئة عن أسعار الجملة الخاصة بالتجار المعتمدين. في حال عدم توفر صنف بعد الطلب، يحق لفريق العمل إخطارك لتعديل الطلب أو اختيار بديل أو إلغاء الصنف غير المتوفر.",
  },
  {
    title: "الحد الأدنى للطلب",
    body: "تطبّق حدود دنيا على الكميات بحسب وحدة بيع المنتج: 20 كيلوجرامًا كحد أدنى لكل لون في الطلبات بالوزن (كيلو)، و50 مترًا كحد أدنى لكل لون في الطلبات بالمتر، وثوب واحد كحد أدنى في الطلبات بالعدد. قد يتم رفض أو تعديل الطلبات التي لا تستوفي هذه الحدود.",
  },
  {
    title: "الدفع",
    body: "يوفر التطبيق وسائل دفع متعددة تشمل الدفع النقدي والتحويل البنكي والمحافظ الإلكترونية. قد تُضاف رسوم إضافية على بعض وسائل الدفع، ويتم توضيحها قبل تأكيد الطلب. أنت مسؤول عن صحة بيانات الدفع التي تقدمها.",
  },
  {
    title: "الشحن والتوصيل",
    body: "تختلف مدة ورسوم التوصيل حسب المنطقة ووسيلة الاستلام المختارة (التوصيل أو الاستلام من الفروع). نبذل جهدنا لتسليم الطلبات في الوقت المناسب، إلا أن أوقات التسليم تقديرية وقد تتأثر بظروف خارجة عن إرادتنا.",
  },
  {
    title: "الاسترجاع والاستبدال",
    body: "يحق للعميل تقديم طلب استرجاع وفق سياسة الاسترجاع المعمول بها داخل التطبيق وخلال المدة المحددة بعد الاستلام. تخضع طلبات الاسترجاع للمراجعة والموافقة من قبل إدارة شمس تكس.",
  },
  {
    title: "حسابات التجار",
    body: "تتطلب ترقية الحساب إلى تاجر موافقة الإدارة. يلتزم التجار باستخدام أسعار الجملة لأغراض تجارية مشروعة، ويحق للإدارة سحب صفة التاجر عند مخالفة ذلك.",
  },
  {
    title: "حدود المسؤولية",
    body: "يُقدّم التطبيق وخدماته كما هي. لا تتحمل شمس تكس المسؤولية عن أي أضرار غير مباشرة تنشأ عن استخدام التطبيق، باستثناء ما يقتضيه القانون المعمول به.",
  },
  {
    title: "تعديل الشروط",
    body: "يحق لشمس تكس تحديث هذه الشروط في أي وقت. سيتم نشر التعديلات داخل التطبيق، ويُعد استمرارك في استخدامه موافقة على الشروط المعدّلة.",
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="الشروط والأحكام" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      >
        <Text style={[styles.updated, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          آخر تحديث: يونيو 2026
        </Text>
        {SECTIONS.map((s, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.title, { color: colors.gold, fontFamily: "Inter_700Bold" }]}>
              {s.title}
            </Text>
            <Text style={[styles.body, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
              {s.body}
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
  updated: { fontSize: 12, textAlign: "right", marginBottom: 4 },
  card: { padding: 16, borderWidth: 1, gap: 8 },
  title: { fontSize: 15, textAlign: "right" },
  body: { fontSize: 13, textAlign: "right", lineHeight: 22 },
});
