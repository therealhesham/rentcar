export type AdminNavItem = {
  href: string;
  label: string;
  /** lucide icon name key — mapped in AdminSidebar */
  icon:
    | "layout-dashboard"
    | "users"
    | "calendar-plus"
    | "car"
    | "image"
    | "megaphone"
    | "badge-dollar"
    | "shield-check"
    | "sliders"
    | "tags"
    | "puzzle"
    | "percent"
    | "map-pin"
    | "truck"
    | "receipt"
    | "building-2"
    | "package"
    | "repeat"
    | "clipboard-list"
    | "scale"
    | "briefcase"
    | "activity"
    | "bar-chart-2"
    | "external-link"
    | "home"
    | "user-cog"
    | "corner-down-left"
    | "ban"
    | "calendar-x"
    | "credit-card"
    | "file-text"
    | "graduation-cap"
    | "message-square";
  external?: boolean;
  /** إخفاء العنصر من القائمة الجانبية (لكن الصفحة لا تزال صالحة) */
  hidden?: boolean;
  /**
   * صفحة متاحة لأي موظف مسجّل دخول بلا صلاحية مستقلة — لا تظهر في شاشة منح الصلاحيات
   * ولا يفحصها middleware. لصفحات الهبوط والمساعدة فقط.
   */
  alwaysAllowed?: boolean;
  /**
   * صفحة لمدير النظام وحده. **لا** تُسجَّل في `ADMIN_PAGE_PERMISSIONS`، فيعيد
   * `resolveAdminPagePermissionId` لها null ويعامله middleware كمنع افتراضي — أي أن
   * غير السوبر أدمن ممنوع منها ولا توجد صلاحية أصلاً يمكن منحها له. وهي تختفي من
   * قائمته الجانبية للسبب نفسه: `getAdminNavGroupsForSession` يُبقي ما يملك صلاحيته.
   */
  superAdminOnly?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
  /** يجعل القسم قابلاً للطي (مختصراً بشكل افتراضي) */
  collapsible?: boolean;
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "main",
    label: "الرئيسية",
    items: [
      { href: "/admin", label: "لوحة التحكم", icon: "layout-dashboard", alwaysAllowed: true },
      { href: "/admin/statistics", label: "الإحصائيات", icon: "bar-chart-2" },
      {
        href: "/admin/insights",
        label: "إحصائيات (سوبر أدمن)",
        icon: "activity",
        superAdminOnly: true,
      },
      { href: "/admin/logs", label: "سجل النشاط", icon: "activity" },
      { href: "/admin/financials", label: "الإدارة المالية", icon: "badge-dollar" },
      { href: "/admin/company-dues", label: "مستحقات للشركة", icon: "receipt" },
      { href: "/admin/customer-dues", label: "مستحقات للعميل", icon: "receipt" },
      { href: "/admin/ledger", label: "دفتر الحركات المالية", icon: "credit-card" },
      {
        // الصفحة نفسها تقصر الدخول على GEIDEA_REPORT_EMAIL فوق فحص السوبر أدمن هذا.
        href: "/admin/geidea-payments",
        label: "مدفوعات جيديا",
        icon: "credit-card",
        superAdminOnly: true,
      },
    ],
  },
  {
    id: "bookings",
    label: "الحجوزات والعملاء",
    items: [
      { href: "/admin/car-bookings", label: "حجوزات السيارات", icon: "clipboard-list", hidden: true },
      { href: "/admin/missed-bookings", label: "حجوزات فائتة", icon: "calendar-x", hidden: true },
      { href: "/admin/cancelled-bookings", label: "الحجوزات الملغاة", icon: "ban", hidden: true },
      { href: "/admin/branch-returns", label: "التسليم الى الفرع", icon: "corner-down-left" },
      { href: "/admin/late-returns", label: "الاستلامات المتأخرة", icon: "calendar-x" },
      { href: "/admin/customers", label: "العملاء", icon: "users" },
      { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)", icon: "calendar-plus", hidden: true },
      { href: "/admin/corporate-leads", label: "حجز الشركات", icon: "briefcase" },
      { href: "/admin/contact-messages", label: "رسائل تواصل معنا", icon: "message-square" },
      { href: "/admin/fleet-availability", label: "توفر المركبات", icon: "activity", hidden: true },
      { href: "/admin/fleet-turnaround", label: "فترة التجهيز", icon: "repeat" },
    ],
  },
  {
    id: "content",
    label: "المحتوى والموقع",
    collapsible: true,
    items: [
      { href: "/admin/site-branding", label: "شعارات الموقع", icon: "image" },
      { href: "/admin/social-links", label: "روابط التواصل الاجتماعي", icon: "megaphone" },
      { href: "/admin/home", label: "هيرو الرئيسية", icon: "image" },
      { href: "/admin/promo-banner", label: "البانر الترويجي", icon: "megaphone" },
      { href: "/admin/rental-pricing-display", label: "عرض أسعار التأجير", icon: "badge-dollar" },
      { href: "/admin/booking-otp-delivery", label: "رمز التحقق", icon: "shield-check" },
      { href: "/admin/booking-widget-tabs", label: "تبويبات ويدجت الحجز", icon: "sliders" },
      {
        href: "/admin/kyc-doc-requirements",
        label: "مستندات الهوية والرخصة",
        icon: "shield-check",
        superAdminOnly: true,
      },
      { href: "/admin/payment-methods", label: "طرق دفع العميل", icon: "credit-card" },
      { href: "/admin/payment-icons", label: "أيقونات وسائل الدفع", icon: "image" },
      { href: "/admin/whatsapp-templates", label: "قوالب الواتساب", icon: "megaphone" },
    ],
  },
  {
    id: "fleet",
    label: "الأسطول والفروع",
    collapsible: true,
    items: [
      { href: "/admin/vehicles", label: "المركبات", icon: "car" },
      { href: "/admin/vehicle-units", label: "لوحات السيارات", icon: "car" },
      { href: "/admin/fleet-visibility", label: "إتاحة السيارات", icon: "sliders" },
      { href: "/admin/categories", label: "فئات الأسطول", icon: "tags" },
      { href: "/admin/brands", label: "البراندات", icon: "tags" },
      { href: "/admin/rental-addons", label: "إضافات التأجير", icon: "puzzle" },
      { href: "/admin/rental-discounts", label: "خصومات التأجير", icon: "percent" },
      { href: "/admin/coupon-codes", label: "أكواد الخصم", icon: "percent" },
      { href: "/admin/cities", label: "المدن", icon: "map-pin" },
      { href: "/admin/branches", label: "الفروع", icon: "building-2" },
      { href: "/admin/employees", label: "موظفو الفروع", icon: "user-cog" },
      { href: "/admin/job-roles", label: "الوظائف والصلاحيات", icon: "shield-check" },
      { href: "/admin/inter-city-shipping", label: "شحن بين المدن", icon: "truck" },
      { href: "/admin/checkout-fees", label: "رسوم إتمام الحجز", icon: "receipt" },
      { href: "/admin/subscription-plans", label: "باقات اشتراك", icon: "package" },
      { href: "/admin/subscriptions", label: "اشتراكات العملاء", icon: "repeat" },
    ],
  },
  {
    id: "policy",
    label: "السياسات",
    items: [
      { href: "/admin/cancellation-policy", label: "إلغاء الحجز", icon: "scale" },
      { href: "/admin/rental-terms", label: "الشروط والأحكام", icon: "file-text" },
      { href: "/admin/privacy-policy", label: "سياسة الخصوصية", icon: "file-text" },
    ],
  },
  {
    id: "account",
    label: "حسابي",
    items: [
      {
        href: "/admin/profile",
        label: "ملفي الشخصي",
        icon: "user-cog",
        alwaysAllowed: true,
      },
    ],
  },
  {
    id: "help",
    label: "المساعدة",
    items: [
      {
        href: "/admin/system-guides",
        label: "شروحات النظام",
        icon: "graduation-cap",
        alwaysAllowed: true,
      },
    ],
  },
  {
    id: "external",
    label: "روابط سريعة",
    items: [
      { href: "/fleet", label: "عرض الأسطول", icon: "external-link", external: true },
      { href: "/", label: "الموقع العام", icon: "home", external: true },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * هل المسار يخص صفحة `alwaysAllowed`؟ يستعمله middleware لتخطّي فحص الصلاحية، وشاشة
 * الصلاحيات لاستبعاد الصفحة من قائمة المنح — المصدر الواحد هو ADMIN_NAV_GROUPS.
 */
export function isAlwaysAllowedAdminPage(pathname: string): boolean {
  return ADMIN_NAV_GROUPS.some((group) =>
    group.items.some(
      (item) =>
        item.alwaysAllowed && !item.external && isAdminNavActive(pathname, item.href),
    ),
  );
}
