import { isKnownAdminPermission } from "@/lib/admin-permissions";

/** يقرأ عمود permissionsJson (موظف أو وظيفة) — أي قيمة تالفة تُعامل كقائمة فارغة. */
export function parsePermissionsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export type PermissionSource = {
  /** صلاحيات إضافية على مستوى الموظف نفسه (فوق وظيفته). */
  permissionsJson: string | null;
  /** الوظيفة المرتبطة — null للموظف بلا وظيفة (يعتمد على صلاحياته الفردية فقط). */
  jobRole: { permissionsJson: string | null } | null;
};

/**
 * الصلاحيات الفعلية = صلاحيات الوظيفة ⋃ الإضافات الفردية، بعد استبعاد أي مفتاح غير معروف
 * (صفحة اتشالت أو قيمة قديمة في القاعدة). الترتيب غير مهم — الاستهلاك عبر includes/Set.
 */
export function effectivePermissions(employee: PermissionSource): string[] {
  const merged = new Set([
    ...parsePermissionsJson(employee.jobRole?.permissionsJson),
    ...parsePermissionsJson(employee.permissionsJson),
  ]);
  return [...merged].filter(isKnownAdminPermission);
}
