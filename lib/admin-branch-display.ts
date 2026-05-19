import type { AdminSession } from "@/lib/admin-auth";

/** اسم الفرع للعرض (عربي) — لا يعرض slug إلا كاحتياط */
export function adminBranchDisplayName(session: AdminSession): string {
  if (session.isSuperAdmin) return "";
  return session.branchName?.trim() || session.branchSlug?.trim() || "—";
}
