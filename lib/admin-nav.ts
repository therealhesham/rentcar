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
    | "credit-card"
    | "file-text";
  external?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "main",
    label: "الرئيسية",
    items: [
      { href: "/admin", label: "لوحة التحكم", icon: "layout-dashboard" },
      { href: "/admin/statistics", label: "الإحصائيات", icon: "bar-chart-2" },
      { href: "/admin/financials", label: "الإدارة المالية", icon: "badge-dollar" },
    ],
  },
  {
    id: "bookings",
    label: "الحجوزات والعملاء",
    items: [
      { href: "/admin/car-bookings", label: "حجوزات السيارات", icon: "clipboard-list" },
      { href: "/admin/cancelled-bookings", label: "الحجوزات الملغاة", icon: "ban" },
      { href: "/admin/branch-returns", label: "التسليم الى الفرع", icon: "corner-down-left" },
      { href: "/admin/customers", label: "العملاء", icon: "users" },
      { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)", icon: "calendar-plus" },
      { href: "/admin/corporate-leads", label: "حجز الشركات", icon: "briefcase" },
      { href: "/admin/fleet-availability", label: "توفر المركبات", icon: "activity" },
    ],
  },
  {
    id: "content",
    label: "المحتوى والموقع",
    items: [
      { href: "/admin/home", label: "هيرو الرئيسية", icon: "image" },
      { href: "/admin/promo-banner", label: "البانر الترويجي", icon: "megaphone" },
      { href: "/admin/rental-pricing-display", label: "عرض أسعار التأجير", icon: "badge-dollar" },
      { href: "/admin/booking-otp-delivery", label: "رمز التحقق", icon: "shield-check" },
      { href: "/admin/booking-widget-tabs", label: "تبويبات ويدجت الحجز", icon: "sliders" },
      { href: "/admin/payment-methods", label: "طرق دفع العميل", icon: "credit-card" },
      { href: "/admin/whatsapp-templates", label: "قوالب الواتساب", icon: "megaphone" },
    ],
  },
  {
    id: "fleet",
    label: "الأسطول والفروع",
    items: [
      { href: "/admin/vehicles", label: "المركبات", icon: "car" },
      { href: "/admin/categories", label: "فئات الأسطول", icon: "tags" },
      { href: "/admin/rental-addons", label: "إضافات التأجير", icon: "puzzle" },
      { href: "/admin/rental-discounts", label: "خصومات التأجير", icon: "percent" },
      { href: "/admin/cities", label: "المدن", icon: "map-pin" },
      { href: "/admin/branches", label: "الفروع", icon: "building-2" },
      { href: "/admin/employees", label: "موظفو الفروع", icon: "user-cog" },
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
