export const ADMIN_PERMISSIONS = [
  "DASHBOARD",
  "FINANCIALS",
  "BOOKINGS",
  "CORPORATE_LEADS",
  "CONTENT",
  "FLEET",
  "SUBSCRIPTIONS",
  "POLICY",
  "EMPLOYEES",
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  DASHBOARD: "الرئيسية والإحصائيات",
  FINANCIALS: "الإدارة المالية",
  BOOKINGS: "الحجوزات والعملاء",
  CORPORATE_LEADS: "حجوزات الشركات",
  CONTENT: "المحتوى وإعدادات الموقع",
  FLEET: "إدارة المركبات والفروع",
  SUBSCRIPTIONS: "باقات واشتراكات العملاء",
  POLICY: "السياسات والشروط",
  EMPLOYEES: "إدارة موظفي الفروع",
};
