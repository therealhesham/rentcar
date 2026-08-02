/**
 * نطاق رؤية موظف الأدمن — المصدر الوحيد لكل فلاتر الفروع في /admin.
 *
 * القاعدة (غير السوبر أدمن يُشتق نطاقه من فرعه/مدينته، وصلاحيات الصفحات مستقلة تماماً في
 * `permissionsJson` / وظيفته):
 *   • سوبر أدمن ............................ كل الفروع
 *   • branchId موجود ....................... فرعه فقط (يغلب cityId، والحصرية مفروضة أصلاً
 *                                             في app/admin/admin-employee-actions.ts)
 *   • cityId موجود بلا فرع ................. كل فروع مدينته
 *   • بلا فرع وبلا مدينة (إدارة مركزية) ..... كل الفروع
 */
import type { AdminSession } from "@/lib/admin-session-token";

export type AdminScope =
  | { kind: "all" }
  | { kind: "city"; cityId: number; cityName: string | null }
  | {
      kind: "branch";
      branchId: number | null;
      branchSlug: string | null;
      branchName: string | null;
    };

export function adminScope(session: AdminSession): AdminScope {
  if (session.isSuperAdmin) return { kind: "all" };
  if (session.branchId != null || session.branchSlug) {
    return {
      kind: "branch",
      branchId: session.branchId ?? null,
      branchSlug: session.branchSlug ?? null,
      branchName: session.branchName ?? null,
    };
  }
  if (session.cityId != null) {
    return { kind: "city", cityId: session.cityId, cityName: session.cityName ?? null };
  }
  return { kind: "all" };
}

/** هل النطاق يغطي أكثر من فرع؟ (يحدّد إظهار فلتر الفروع في الصفحات) */
export function scopeAllowsMultipleBranches(scope: AdminScope): boolean {
  return scope.kind !== "branch";
}

/** وصف النطاق للعرض في الترويسة والقائمة الجانبية. */
export function scopeLabel(scope: AdminScope): string {
  switch (scope.kind) {
    case "all":
      return "كل الفروع";
    case "city":
      return `مدينة ${scope.cityName?.trim() || `#${scope.cityId}`}`;
    case "branch":
      return `فرع ${scope.branchName?.trim() || scope.branchSlug?.trim() || "—"}`;
  }
}
