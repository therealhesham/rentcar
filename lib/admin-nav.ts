import type { AdminPermission } from "@/lib/admin-permissions";

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
  permission?: AdminPermission;
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
      { href: "/admin", label: "لوحة التحكم", icon: "layout-dashboard", permission: "DASHBOARD" },
      { href: "/admin/statistics", label: "الإحصائيات", icon: "bar-chart-2", permission: "DASHBOARD" },
      { href: "/admin/financials", label: "الإدارة المالية", icon: "badge-dollar", permission: "FINANCIALS" },
    ],
  },
  {
    id: "bookings",
    label: "الحجوزات والعملاء",
    items: [
      { href: "/admin/car-bookings", label: "حجوزات السيارات", icon: "clipboard-list", permission: "BOOKINGS" },
      { href: "/admin/cancelled-bookings", label: "الحجوزات الملغاة", icon: "ban", permission: "BOOKINGS" },
      { href: "/admin/branch-returns", label: "التسليم الى الفرع", icon: "corner-down-left", permission: "BOOKINGS" },
      { href: "/admin/customers", label: "العملاء", icon: "users", permission: "BOOKINGS" },
      { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)", icon: "calendar-plus", permission: "BOOKINGS" },
      { href: "/admin/corporate-leads", label: "حجز الشركات", icon: "briefcase", permission: "CORPORATE_LEADS" },
      { href: "/admin/fleet-availability", label: "توفر المركبات", icon: "activity", permission: "BOOKINGS" },
    ],
  },
  {
    id: "content",
    label: "المحتوى والموقع",
    items: [
      { href: "/admin/home", label: "هيرو الرئيسية", icon: "image", permission: "CONTENT" },
      { href: "/admin/promo-banner", label: "البانر الترويجي", icon: "megaphone", permission: "CONTENT" },
      { href: "/admin/rental-pricing-display", label: "عرض أسعار التأجير", icon: "badge-dollar", permission: "CONTENT" },
      { href: "/admin/booking-otp-delivery", label: "رمز التحقق", icon: "shield-check", permission: "CONTENT" },
      { href: "/admin/booking-widget-tabs", label: "تبويبات ويدجت الحجز", icon: "sliders", permission: "CONTENT" },
      { href: "/admin/payment-methods", label: "طرق دفع العميل", icon: "credit-card", permission: "CONTENT" },
      { href: "/admin/whatsapp-templates", label: "قوالب الواتساب", icon: "megaphone", permission: "CONTENT" },
    ],
  },
  {
    id: "fleet",
    label: "الأسطول والفروع",
    items: [
      { href: "/admin/vehicles", label: "المركبات", icon: "car", permission: "FLEET" },
      { href: "/admin/categories", label: "فئات الأسطول", icon: "tags", permission: "FLEET" },
      { href: "/admin/rental-addons", label: "إضافات التأجير", icon: "puzzle", permission: "FLEET" },
      { href: "/admin/rental-discounts", label: "خصومات التأجير", icon: "percent", permission: "FLEET" },
      { href: "/admin/cities", label: "المدن", icon: "map-pin", permission: "FLEET" },
      { href: "/admin/branches", label: "الفروع", icon: "building-2", permission: "FLEET" },
      { href: "/admin/employees", label: "موظفو الفروع", icon: "user-cog", permission: "EMPLOYEES" },
      { href: "/admin/inter-city-shipping", label: "شحن بين المدن", icon: "truck", permission: "FLEET" },
      { href: "/admin/checkout-fees", label: "رسوم إتمام الحجز", icon: "receipt", permission: "FLEET" },
      { href: "/admin/subscription-plans", label: "باقات اشتراك", icon: "package", permission: "SUBSCRIPTIONS" },
      { href: "/admin/subscriptions", label: "اشتراكات العملاء", icon: "repeat", permission: "SUBSCRIPTIONS" },
    ],
  },
  {
    id: "policy",
    label: "السياسات",
    items: [
      { href: "/admin/cancellation-policy", label: "إلغاء الحجز", icon: "scale", permission: "POLICY" },
      { href: "/admin/rental-terms", label: "الشروط والأحكام", icon: "file-text", permission: "POLICY" },
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
