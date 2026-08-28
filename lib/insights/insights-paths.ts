/**
 * تطبيع المسارات وتسميتها بالعربية لصفحة «إحصائيات».
 *
 * بلا تطبيع، كل تركيبة فلاتر تُعدّ «صفحة» مستقلة: `/fleet?from=...&to=...&branch=...`
 * يُنتج آلاف الصفوف كلٌّ منها بزيارة واحدة، فيختفي أن الأسطول هو أكثر الصفحات زيارة.
 * لذلك يُحذف الـ query string، وتُستبدل المعرّفات الرقمية والـ slugs بـ `:id`.
 */

/** المسار بلا query ولا hash ولا شرطة أخيرة. */
export function stripQuery(path: string): string {
  const clean = path.split("#")[0]!.split("?")[0]!;
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

/** بادئة اللغة (`/ar`, `/en`) ليست صفحة مختلفة — تُدمج حتى لا تنقسم أرقام كل صفحة نصفين. */
function stripLocale(path: string): string {
  const m = /^\/(ar|en)(?=\/|$)/.exec(path);
  return m ? path.slice(m[0].length) || "/" : path;
}

/**
 * القالب الذي تُجمَّع عليه الزيارات: بلا query، بلا لغة، وبالمعرّفات مستبدلة.
 * `/fleet/toyota-camry-2024` و`/fleet/hyundai-sonata` كلاهما `/fleet/:slug`.
 */
export function pathTemplate(rawPath: string): string {
  const path = stripLocale(stripQuery(rawPath));
  if (path === "/") return "/";

  const segments = path.split("/").filter(Boolean);

  /**
   * أول جزء **بعد** اسم القسم. أسماء أقسام كثيرة kebab-case مثل أسماء الـ slugs
   * تماماً (`/rental-terms`, `/admin/car-bookings`)، فلا يميّزها الشكل — يميّزها
   * موقعها وحده. ومسارات الأدمن كلها مسبوقة بـ `/admin`، فاسم القسم فيها هو الجزء
   * الثاني لا الأول. بدون هذه الإزاحة تنهار كل صفحات الأدمن في دلو `/admin/:slug`
   * واحد ويصير قسم «أكثر الصفحات زيارة» بلا معنى.
   */
  const sectionDepth = segments[0] === "admin" ? 2 : 1;

  const out = segments.map((segment, i) => {
    if (/^\d+$/.test(segment)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return ":id";
    // slug سيارة/فرع: حروف لاتينية صغيرة أو أرقام تفصلها شرطات.
    if (i >= sectionDepth && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(segment)) return ":slug";
    return segment;
  });

  return `/${out.join("/")}`;
}

const PUBLIC_PAGE_LABELS: Array<[RegExp, string]> = [
  [/^\/$/, "الصفحة الرئيسية"],
  [/^\/fleet$/, "قائمة الأسطول"],
  // خطوة رمز التحقق قبل الصفحة التي تحتويها: `/^\/fleet\/checkout/` يبتلعها لولا
  // ذلك، فتظهر مرحلتان مختلفتان من مسار الحجز باسم واحد ولا يُعرف أيّهما يُسرّب.
  [/^\/fleet\/checkout\/otp/, "خطوة رمز التحقق"],
  [/^\/fleet\/checkout/, "صفحة إتمام الحجز"],
  [/^\/fleet\/payment/, "صفحة الدفع"],
  [/^\/fleet\/[^/]+$/, "صفحة سيارة"],
  [/^\/branches/, "الفروع"],
  [/^\/cities/, "المدن"],
  [/^\/subscriptions?/, "باقات الاشتراك"],
  [/^\/corporate/, "حجز الشركات"],
  [/^\/contact/, "تواصل معنا"],
  [/^\/about/, "من نحن"],
  [/^\/account\/bookings/, "حجوزاتي"],
  [/^\/account/, "حساب العميل"],
  [/^\/login/, "تسجيل الدخول"],
  [/^\/rental-terms/, "الشروط والأحكام"],
  [/^\/privacy/, "سياسة الخصوصية"],
];

const ADMIN_PAGE_LABELS: Array<[RegExp, string]> = [
  [/^\/admin$/, "لوحة التحكم"],
  [/^\/admin\/insights/, "إحصائيات (سوبر أدمن)"],
  [/^\/admin\/statistics/, "الإحصائيات"],
  [/^\/admin\/logs/, "سجل النشاط"],
  [/^\/admin\/financials/, "الإدارة المالية"],
  [/^\/admin\/company-dues/, "مستحقات للشركة"],
  [/^\/admin\/customer-dues/, "مستحقات للعميل"],
  [/^\/admin\/ledger/, "دفتر الحركات المالية"],
  [/^\/admin\/car-bookings\/import/, "ترحيل حجوزات من Excel"],
  [/^\/admin\/car-bookings/, "حجوزات السيارات"],
  [/^\/admin\/bookings\/[^/]+\/finance/, "مالية حجز"],
  [/^\/admin\/bookings/, "تفاصيل حجز"],
  [/^\/admin\/missed-bookings/, "حجوزات فائتة"],
  [/^\/admin\/cancelled-bookings/, "الحجوزات الملغاة"],
  [/^\/admin\/branch-returns/, "التسليم إلى الفرع"],
  [/^\/admin\/late-returns/, "الاستلامات المتأخرة"],
  [/^\/admin\/customers/, "العملاء"],
  [/^\/admin\/direct-booking/, "حجز مباشر (مكتب)"],
  [/^\/admin\/corporate-leads/, "حجز الشركات"],
  [/^\/admin\/contact-messages/, "رسائل تواصل معنا"],
  [/^\/admin\/fleet-availability/, "توفر المركبات"],
  [/^\/admin\/fleet-turnaround/, "فترة التجهيز"],
  [/^\/admin\/fleet-visibility/, "إتاحة السيارات"],
  [/^\/admin\/vehicles\/import/, "استيراد مركبات"],
  [/^\/admin\/vehicles/, "المركبات"],
  [/^\/admin\/vehicle-units/, "لوحات السيارات"],
  [/^\/admin\/categories/, "فئات الأسطول"],
  [/^\/admin\/brands/, "البراندات"],
  [/^\/admin\/rental-addons/, "إضافات التأجير"],
  [/^\/admin\/rental-discounts/, "خصومات التأجير"],
  [/^\/admin\/coupon-codes/, "أكواد الخصم"],
  [/^\/admin\/cities/, "المدن"],
  [/^\/admin\/branches/, "الفروع"],
  [/^\/admin\/employees/, "موظفو الفروع"],
  [/^\/admin\/job-roles/, "الوظائف والصلاحيات"],
  [/^\/admin\/inter-city-shipping/, "شحن بين المدن"],
  [/^\/admin\/checkout-fees/, "رسوم إتمام الحجز"],
  [/^\/admin\/subscription-plans/, "باقات اشتراك"],
  [/^\/admin\/subscriptions/, "اشتراكات العملاء"],
  [/^\/admin\/site-branding/, "شعارات الموقع"],
  [/^\/admin\/social-links/, "روابط التواصل"],
  [/^\/admin\/home/, "هيرو الرئيسية"],
  [/^\/admin\/promo-banner/, "البانر الترويجي"],
  [/^\/admin\/rental-pricing-display/, "عرض أسعار التأجير"],
  [/^\/admin\/booking-otp-delivery/, "رمز التحقق"],
  [/^\/admin\/booking-widget-tabs/, "تبويبات ويدجت الحجز"],
  [/^\/admin\/kyc-doc-requirements/, "مستندات الهوية والرخصة"],
  [/^\/admin\/payment-methods/, "طرق دفع العميل"],
  [/^\/admin\/payment-icons/, "أيقونات وسائل الدفع"],
  [/^\/admin\/whatsapp-templates/, "قوالب الواتساب"],
  [/^\/admin\/cancellation-policy/, "سياسة إلغاء الحجز"],
  [/^\/admin\/rental-terms/, "الشروط والأحكام"],
  [/^\/admin\/privacy-policy/, "سياسة الخصوصية"],
  [/^\/admin\/system-guides/, "شروحات النظام"],
  [/^\/admin\/profile/, "ملفي الشخصي"],
  [/^\/admin\/test-geidea/, "اختبار بوابة جيديا"],
  [/^\/admin\/booking-notification-drops/, "حجوزات بلا إشعار"],
];

/** اسم عربي مفهوم للصفحة، أو `null` لو المسار غير معروف (يُعرض المسار الخام حينها). */
export function pageLabel(template: string, scope: "admin" | "public"): string | null {
  const table = scope === "admin" ? ADMIN_PAGE_LABELS : PUBLIC_PAGE_LABELS;
  for (const [pattern, label] of table) {
    if (pattern.test(template)) return label;
  }
  return null;
}
