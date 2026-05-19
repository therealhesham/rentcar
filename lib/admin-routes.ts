/** مسارات إدارة المحتوى والإعدادات العامة — للسوبر أدمن فقط */
export const SUPER_ADMIN_ONLY_PREFIXES = [
  "/admin/home",
  "/admin/promo-banner",
  "/admin/rental-pricing-display",
  "/admin/booking-otp-delivery",
  "/admin/booking-widget-tabs",
  "/admin/employees",
  "/admin/categories",
  "/admin/rental-addons",
  "/admin/cities",
  "/admin/branches",
  "/admin/inter-city-shipping",
  "/admin/checkout-fees",
  "/admin/subscription-plans",
  "/admin/subscriptions",
  "/admin/cancellation-policy",
  "/admin/corporate-leads",
  "/admin/statistics/fleet",
] as const;

export function isSuperAdminOnlyPath(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** إضافة/تعديل مركبات — سوبر أدمن فقط؛ عرض القائمة متاح لموظف الفرع */
export function isAdminVehiclesWritePath(pathname: string): boolean {
  if (pathname === "/admin/vehicles/new") return true;
  return /^\/admin\/vehicles\/[^/]+\/edit\/?$/.test(pathname);
}
