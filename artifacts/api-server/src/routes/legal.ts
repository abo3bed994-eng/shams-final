import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const BRAND = "شمس تكس (Shams Tex)";
const SUPPORT_EMAIL = "support@shamstex.com";
const COMPANY_LOCATION = "جمهورية مصر العربية";
const LAST_UPDATED = "19 أبريل 2026";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — ${BRAND}</title>
<style>
  :root { --gold:#C9A24B; --bg:#0B0B0B; --fg:#F5F1E6; --muted:#9C9385; --card:#141312; --border:#2A2722; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.85;font-size:16px}
  .wrap{max-width:780px;margin:0 auto;padding:32px 20px 80px}
  header{border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:26px}
  .brand{color:var(--gold);font-size:22px;font-weight:700;letter-spacing:.5px}
  h1{color:var(--gold);font-size:26px;margin:8px 0 4px}
  .meta{color:var(--muted);font-size:13px}
  h2{color:var(--gold);font-size:19px;margin-top:32px;border-right:3px solid var(--gold);padding-right:12px}
  h3{color:var(--fg);font-size:16px;margin-top:20px}
  p,li{color:var(--fg)}
  ul{padding-right:22px}
  a{color:var(--gold);text-decoration:none}
  a:hover{text-decoration:underline}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin-top:18px}
  .nav{display:flex;gap:14px;margin-top:14px;flex-wrap:wrap}
  .nav a{padding:8px 14px;border:1px solid var(--gold);border-radius:8px;font-size:14px}
  footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--border);color:var(--muted);font-size:13px;text-align:center}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">${BRAND}</div>
      <h1>${title}</h1>
      <div class="meta">آخر تحديث: ${LAST_UPDATED}</div>
      <nav class="nav">
        <a href="/api/legal/privacy">سياسة الخصوصية</a>
        <a href="/api/legal/terms">الشروط والأحكام</a>
      </nav>
    </header>
    ${bodyHtml}
    <footer>
      © ${new Date().getFullYear()} ${BRAND} — جميع الحقوق محفوظة<br/>
      للتواصل: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
    </footer>
  </div>
</body>
</html>`;
}

const privacyBody = `
<div class="card">
  <p>نحن في <strong>${BRAND}</strong> نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحفظ المعلومات التي نحصل عليها منك عند استخدام تطبيقنا للأقمشة والمنسوجات.</p>
</div>

<h2>1. المعلومات التي نجمعها</h2>
<h3>أ. معلومات تقدّمها بنفسك</h3>
<ul>
  <li><strong>رقم الجوال:</strong> لإنشاء الحساب والتحقق منه عبر رمز SMS.</li>
  <li><strong>الاسم وعنوان التوصيل:</strong> لمعالجة الطلبات وتسليمها.</li>
  <li><strong>تفضيلات الشراء:</strong> الكميات، الألوان، نوع الأقمشة المطلوبة.</li>
</ul>

<h3>ب. معلومات تُجمع تلقائياً</h3>
<ul>
  <li>نوع الجهاز ونظام التشغيل ورقم إصدار التطبيق.</li>
  <li>معرّف الجهاز للإشعارات (Push Token).</li>
  <li>سجلات الاستخدام (الصفحات المُزارة، أوقات الدخول) لتحسين الخدمة.</li>
</ul>

<h2>2. كيف نستخدم بياناتك</h2>
<ul>
  <li>تنفيذ طلباتك وتوصيلها.</li>
  <li>إرسال إشعارات عن حالة الطلب والعروض.</li>
  <li>الرد على استفساراتك ودعمك.</li>
  <li>كشف الاحتيال وحماية الحساب (مثل: تسجيل دخول من جهاز واحد فقط).</li>
  <li>تحسين التطبيق وتحليل الأداء بشكل مجمّع غير شخصي.</li>
</ul>

<h2>3. مع من نشارك بياناتك</h2>
<p>نحن <strong>لا نبيع</strong> بياناتك لأي طرف. نشاركها فقط مع:</p>
<ul>
  <li><strong>Google Firebase:</strong> لتخزين البيانات وإرسال الإشعارات (خوادم آمنة بمعايير ISO 27001).</li>
  <li><strong>شركات الشحن:</strong> الاسم والعنوان ورقم الجوال فقط لغرض التوصيل.</li>
  <li><strong>الجهات الحكومية:</strong> عند طلب رسمي قانوني فقط.</li>
</ul>

<h2>4. مدة حفظ البيانات</h2>
<ul>
  <li>الحساب وسجلات الطلبات: تُحفظ طوال فترة استخدامك للتطبيق.</li>
  <li>عند حذف حسابك: تُزال بياناتك خلال 30 يوماً (مع الاحتفاظ بالفواتير سنتين للالتزام الضريبي).</li>
</ul>

<h2>5. حقوقك</h2>
<ul>
  <li>طلب نسخة من بياناتك.</li>
  <li>طلب تصحيح أو حذف بياناتك.</li>
  <li>سحب الموافقة على الإشعارات في أي وقت.</li>
  <li>تقديم شكوى لجهة حماية البيانات المختصة.</li>
</ul>
<p>لممارسة أي حق، راسلنا على <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> وسنردّ خلال 14 يوماً.</p>

<h2>6. أمان البيانات</h2>
<ul>
  <li>تشفير الاتصال بالكامل عبر HTTPS/TLS.</li>
  <li>قواعد أمان صارمة (Firestore Security Rules) تمنع وصول أي شخص لبيانات غيره.</li>
  <li>نسخ احتياطية يومية مشفّرة.</li>
  <li>جلسة دخول واحدة لكل حساب لمنع الاختراق.</li>
</ul>

<h2>7. الأطفال</h2>
<p>التطبيق موجّه للبالغين (18+). لا نجمع بياناتٍ من أطفال عن قصد. إن علمت أن طفلاً سجّل بياناته، راسلنا فوراً للحذف.</p>

<h2>8. الإشعارات والصلاحيات</h2>
<ul>
  <li><strong>الإشعارات:</strong> تُستخدم لتحديثات الطلبات والعروض — يمكنك إيقافها من إعدادات الجهاز.</li>
  <li><strong>الكاميرا والمعرض:</strong> فقط عند رفعك صور المنتجات (للموظفين/المدير).</li>
</ul>

<h2>9. التحديثات على هذه السياسة</h2>
<p>قد نحدّث هذه السياسة من حين لآخر. سننبهك داخل التطبيق عند أي تغيير جوهري قبل سريانه بـ 7 أيام على الأقل.</p>

<h2>10. التواصل معنا</h2>
<div class="card">
  <p>${BRAND}<br/>
  ${COMPANY_LOCATION}<br/>
  البريد: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
</div>
`;

const termsBody = `
<div class="card">
  <p>مرحباً بك في تطبيق <strong>${BRAND}</strong> — منصّة بيع الأقمشة والمنسوجات. باستخدامك للتطبيق فإنك توافق على الشروط التالية. اقرأها بعناية.</p>
</div>

<h2>1. تعريفات</h2>
<ul>
  <li><strong>التطبيق:</strong> تطبيق ${BRAND} على iOS و Android.</li>
  <li><strong>المستخدم:</strong> أي شخص يفتح التطبيق سواء كان عميلاً أو موظفاً أو مديراً.</li>
  <li><strong>الطلب:</strong> طلب الشراء الذي يقدّمه العميل عبر التطبيق.</li>
</ul>

<h2>2. شروط فتح الحساب</h2>
<ul>
  <li>أن يكون عمرك 18 سنة فأكثر.</li>
  <li>أن تقدّم رقم جوال صحيح وعاملاً.</li>
  <li>المسؤولية الكاملة عن سرية حسابك وعدم مشاركته مع آخرين.</li>
  <li>يحق للإدارة إيقاف أو حذف أي حساب يخالف الشروط دون إنذار مسبق.</li>
</ul>

<h2>3. الأسعار والدفع</h2>
<ul>
  <li>الأسعار معروضة بالعملة المحلية وتشمل أو لا تشمل الضرائب حسب ما هو مبيّن في الطلب.</li>
  <li>قد يختلف السعر بين العميل العادي والعميل بالجملة.</li>
  <li>وسائل الدفع المتاحة: الدفع عند الاستلام، التحويل البنكي، أو ما يُضاف لاحقاً.</li>
  <li>الإدارة تحتفظ بحق تعديل الأسعار في أي وقت قبل تأكيد الطلب.</li>
</ul>

<h2>4. الطلبات والتوصيل</h2>
<ul>
  <li>تأكيد الطلب يتم عبر إشعار داخل التطبيق.</li>
  <li>مدة التوصيل تختلف حسب المنطقة وتُعرض عند الطلب.</li>
  <li>يلتزم العميل بتوفير عنوان دقيق ورقم تواصل صحيح.</li>
  <li>الإدارة غير مسؤولة عن تأخّر التوصيل بسبب عنوان خاطئ أو عدم الرد على الاتصال.</li>
</ul>

<h2>5. الإرجاع والاستبدال</h2>
<ul>
  <li>يمكن إرجاع البضاعة خلال <strong>3 أيام</strong> من الاستلام شرط أن تكون بحالتها الأصلية وغير مقصوصة.</li>
  <li>الأقمشة المقصوصة أو المخصّصة (تفصيل خاص) <strong>لا تُرَدّ</strong>.</li>
  <li>تكلفة الشحن للإرجاع على العميل ما لم يكن العيب من المصدر.</li>
</ul>

<h2>6. الاستخدام الممنوع</h2>
<p>يُحظر على المستخدم:</p>
<ul>
  <li>إساءة استخدام التطبيق أو محاولة اختراقه.</li>
  <li>إنشاء حسابات وهمية أو متعددة بنفس الرقم.</li>
  <li>نشر محتوى مسيء أو مخالف للقانون أو الآداب العامة.</li>
  <li>استخدام التطبيق لأغراض غير الشراء (مثل إعادة البيع دون اتفاق مكتوب).</li>
</ul>

<h2>7. الملكية الفكرية</h2>
<p>جميع الشعارات والصور والأكواد والتصاميم في التطبيق ملك حصري لـ ${BRAND}. يُحظر نسخها أو إعادة نشرها دون إذن مكتوب.</p>

<h2>8. حدود المسؤولية</h2>
<ul>
  <li>التطبيق يُقدّم "كما هو" دون ضمانات صريحة أو ضمنية.</li>
  <li>الإدارة غير مسؤولة عن أي خسائر غير مباشرة ناتجة عن انقطاع الخدمة أو خطأ تقني.</li>
  <li>الحد الأقصى لمسؤولية الإدارة هو قيمة آخر طلب دفعه العميل.</li>
</ul>

<h2>9. تعليق أو إغلاق الخدمة</h2>
<p>يحق للإدارة إيقاف الخدمة كلياً أو جزئياً للصيانة أو التحديث، وسنحاول إخطارك مسبقاً قدر الإمكان.</p>

<h2>10. القانون الواجب التطبيق</h2>
<p>تخضع هذه الشروط لقوانين ${COMPANY_LOCATION}، وأي نزاع يُحلّ ودياً، وإن تعذّر فأمام المحاكم المختصة.</p>

<h2>11. تعديل الشروط</h2>
<p>يحق للإدارة تعديل هذه الشروط في أي وقت. سننبّهك داخل التطبيق قبل سريان أي تغيير جوهري بـ 7 أيام.</p>

<h2>12. التواصل</h2>
<div class="card">
  <p>لأي استفسار حول هذه الشروط:<br/>
  ${BRAND} — ${COMPANY_LOCATION}<br/>
  البريد: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
</div>
`;

router.get("/legal/privacy", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.type("html").send(shell("سياسة الخصوصية", privacyBody));
});

router.get("/legal/terms", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.type("html").send(shell("الشروط والأحكام", termsBody));
});

router.get("/legal", (_req: Request, res: Response) => {
  res.redirect("/api/legal/privacy");
});

export default router;
