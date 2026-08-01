import { ADMIN_PAGE_PERMISSIONS } from "@/lib/admin-permissions";

/**
 * يطابق مسار صفحة أدمن بأطول href صلاحية مسجّل يطابقه (زي `/admin/statistics/fleet` أدق
 * من `/admin/statistics`). `/admin` نفسها مطابقة حصرية (مش prefix) عشان متبلعش كل شيء تحتها.
 * ترجع null لصفحة غير مسجّلة أصلاً — يُعامل كمنع افتراضي (fail-closed)، مش سماح.
 */
export function resolveAdminPagePermissionId(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of ADMIN_PAGE_PERMISSIONS) {
    const matches =
      href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;
    if (best == null || href.length > best.length) best = href;
  }
  return best;
}
