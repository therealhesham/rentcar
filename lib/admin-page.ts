import { redirect } from "next/navigation";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/admin-auth";
import type { AdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

async function enrichBranchName(session: AdminSession): Promise<AdminSession> {
  if (session.isSuperAdmin || session.branchName?.trim()) return session;
  if (!session.branchId && !session.branchSlug) return session;
  const branch = await prisma.branch.findFirst({
    where: session.branchId
      ? { id: session.branchId }
      : { slug: session.branchSlug! },
    select: { name: true },
  });
  if (!branch?.name) return session;
  return { ...session, branchName: branch.name };
}

export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return enrichBranchName(session);
}

/**
 * حماية صفحة تتطلب صلاحية محددة (نفس منطق requirePermissionForAction للإجراءات):
 * مدير النظام مسموح دائماً، وإلا يجب أن تتضمن صلاحيات الموظف الصلاحية المطلوبة.
 * غير المخوّل يُعاد توجيهه للوحة الرئيسية بدل رؤية بيانات لا يملكها.
 */
export async function requireAdminPagePermission(
  permission: AdminPermission,
): Promise<AdminSession> {
  const session = await requireAdminPage();
  if (session.isSuperAdmin) return session;
  if (!session.permissions.includes(permission)) {
    redirect("/admin");
  }
  return session;
}
