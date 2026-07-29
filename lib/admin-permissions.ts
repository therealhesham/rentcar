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
  "CANCEL_OVERRIDE",
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
  // منفصلة عمداً عن FINANCIALS: تتجاوز سياسة خصم الشرائح بالكامل (استرداد كامل أو
  // حجب كامل) — موظف مالية عادي لا يحتاجها بالضرورة رغم احتياجه صلاحية FINANCIALS.
  CANCEL_OVERRIDE: "تجاوز سياسة الإلغاء (استرداد كامل / بلا استرداد)",
};
