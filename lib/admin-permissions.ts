import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";

export type AdminPagePermission = { href: string; label: string; groupLabel: string };

/**
 * صفحات موجودة فعلاً كـ routes لكن مش في القائمة الجانبية (تُفتح كصفحات فرعية أو أدوات
 * داخلية) — لازم تاخد صلاحية مستقلة زي أي صفحة تانية بدل ما تفضل بلا حماية.
 */
const EXTRA_PAGE_PERMISSIONS: AdminPagePermission[] = [
  {
    href: "/admin/bookings",
    label: "تفاصيل الحجز الفردي",
    groupLabel: "الحجوزات والعملاء",
  },
  {
    href: "/admin/statistics/fleet",
    label: "إحصائيات الأسطول (تفصيلي)",
    groupLabel: "الرئيسية",
  },
  {
    href: "/admin/test-geidea",
    label: "أداة اختبار بوابة جيديا",
    groupLabel: "الإدارة المالية",
  },
  // لازم تتسجّل مستقلة: بدونها يطابقها resolveAdminPagePermissionId بـ `/admin/vehicles`
  // فتاخد صلاحية عرض المركبات حق الاستيراد الجماعي بالغلط.
  {
    href: "/admin/vehicles/import",
    label: "استيراد مركبات من Excel",
    groupLabel: "الأسطول والفروع",
  },
];

/** كل صفحات الأدمن القابلة لمنح صلاحية مستقلة لها — الـ href نفسه هو معرّف الصلاحية.
 * صفحات `alwaysAllowed` مُستثناة عمداً لأنها متاحة لأي موظف مسجّل دخول: `/admin` (صفحة
 * الهبوط بعد الدخول وهدف إعادة التوجيه عند رفض الوصول — تخصيصها كصلاحية قابلة للمنع كان
 * سيُنتج حلقة إعادة توجيه لا نهائية)، و`/admin/system-guides` (شروحات النظام للجميع)،
 * و`/admin/profile` (كل موظف يغيّر كلمة مروره هو — الحماية بالجلسة نفسها). */
export const ADMIN_PAGE_PERMISSIONS: AdminPagePermission[] = [
  ...ADMIN_NAV_GROUPS.flatMap((group) =>
    group.items
      .filter((item) => !item.external && !item.alwaysAllowed)
      .map((item) => ({ href: item.href, label: item.label, groupLabel: group.label })),
  ),
  ...EXTRA_PAGE_PERMISSIONS,
];

/** قدرة خاصة غير مرتبطة بصفحة معيّنة — تتجاوز سياسة خصم الشرائح بالكامل عند الإلغاء. */
export const CANCEL_OVERRIDE = "CANCEL_OVERRIDE" as const;

/** قرارات غرامة الإرجاع المتأخر — كل قرار صلاحية مستقلة يمنحها مدير النظام. */
export const LATE_PENALTY_APPLY = "LATE_PENALTY_APPLY" as const;
export const LATE_PENALTY_WAIVE = "LATE_PENALTY_WAIVE" as const;
export const LATE_RETURN_ON_TIME = "LATE_RETURN_ON_TIME" as const;

/** الصلاحية المطلوبة لكل قرار في مودال الإرجاع المتأخر. */
export const LATE_PENALTY_DECISION_PERMISSIONS = {
  APPLY: LATE_PENALTY_APPLY,
  WAIVE: LATE_PENALTY_WAIVE,
  ON_TIME: LATE_RETURN_ON_TIME,
} as const;

/** القدرات الخاصة (غير المرتبطة بصفحة) كما تُعرض في فورم صلاحيات الموظف. */
export const ADMIN_CAPABILITY_PERMISSIONS = [
  CANCEL_OVERRIDE,
  LATE_PENALTY_APPLY,
  LATE_PENALTY_WAIVE,
  LATE_RETURN_ON_TIME,
] as const;

/**
 * معرّف الصلاحية: href صفحة (نص حر، مش literal union) أو CANCEL_OVERRIDE. النوع فضّل
 * string عمداً بدل استخراج union دقيق من ADMIN_NAV_GROUPS — الصفحات كتير ومتغيّرة، والحماية
 * الفعلية بتحصل وقت الحفظ (فلترة مقابل ADMIN_PAGE_PERMISSIONS المعروفة) مش وقت الـ compile.
 */
export type AdminPermission = string;

export const ADMIN_PERMISSION_LABELS: Record<string, string> = {
  ...Object.fromEntries(ADMIN_PAGE_PERMISSIONS.map((p) => [p.href, p.label])),
  [CANCEL_OVERRIDE]: "تجاوز سياسة الإلغاء (استرداد كامل / بلا استرداد)",
  [LATE_PENALTY_APPLY]: "تطبيق غرامة التأخير عند الإرجاع",
  [LATE_PENALTY_WAIVE]: "إعفاء العميل من غرامة التأخير",
  [LATE_RETURN_ON_TIME]: "اعتبار الإرجاع المتأخر تسليماً في الموعد (بلا قيد تأخير)",
};

const KNOWN_PERMISSION_IDS = new Set<string>([
  ...ADMIN_PAGE_PERMISSIONS.map((p) => p.href),
  ...ADMIN_CAPABILITY_PERMISSIONS,
]);

/** يتحقق إن معرّف الصلاحية معروف فعلاً قبل حفظه — يمنع تسرّب قيم غريبة من الفورم لعمود permissionsJson. */
export function isKnownAdminPermission(id: string): boolean {
  return KNOWN_PERMISSION_IDS.has(id);
}
