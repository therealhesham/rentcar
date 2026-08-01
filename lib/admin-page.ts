import { redirect } from "next/navigation";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/admin-auth";
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

/** حماية الصفحة تتحقق من الجلسة فقط — تحقق الصلاحية لكل صفحة مركزي في middleware.ts. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return enrichBranchName(session);
}
