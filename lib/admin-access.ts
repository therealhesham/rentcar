import type { Prisma } from "@prisma/client";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { ADMIN_NAV_GROUPS, type AdminNavGroup } from "@/lib/admin-nav";
import { isSuperAdminOnlyPath } from "@/lib/admin-routes";
import { prisma } from "@/lib/prisma";

export { isSuperAdminOnlyPath, SUPER_ADMIN_ONLY_PREFIXES } from "@/lib/admin-routes";

const BRANCH_NAV_GROUP_IDS = new Set(["main", "bookings", "external"]);

const BRANCH_EXTRA_NAV: AdminNavGroup["items"] = [
  { href: "/admin/vehicles", label: "المركبات", icon: "car" },
];

export function getAdminNavGroupsForSession(session: AdminSession): AdminNavGroup[] {
  if (session.isSuperAdmin) return ADMIN_NAV_GROUPS;
  return ADMIN_NAV_GROUPS.filter((g) => BRANCH_NAV_GROUP_IDS.has(g.id)).map((g) => {
    if (g.id !== "bookings") return g;
    return {
      ...g,
      items: [
        ...g.items.filter((i) => i.href !== "/admin/corporate-leads"),
        ...BRANCH_EXTRA_NAV,
      ],
    };
  });
}

export { adminBranchDisplayName } from "@/lib/admin-branch-display";

export function bookingBranchWhere(
  session: AdminSession,
  extra?: Prisma.BookingRequestWhereInput,
): Prisma.BookingRequestWhereInput {
  const base: Prisma.BookingRequestWhereInput =
    session.isSuperAdmin || !session.branchSlug
      ? {}
      : { branch: session.branchSlug };
  if (!extra || Object.keys(extra).length === 0) return base;
  return { AND: [base, extra] };
}

export async function requireAdminForAction(): Promise<
  { ok: true; session: AdminSession } | { ok: false; error: string }
> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "غير مصرّح." };
  return { ok: true, session };
}

export async function requireSuperAdminForAction(): Promise<
  { ok: true; session: AdminSession } | { ok: false; error: string }
> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return auth;
  if (!auth.session.isSuperAdmin) {
    return { ok: false, error: "هذا الإجراء متاح لمدير النظام فقط." };
  }
  return auth;
}

export async function assertBookingRequestInScope(
  session: AdminSession,
  bookingRequestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.isSuperAdmin) return { ok: true };
  if (!session.branchSlug) {
    return { ok: false, error: "حسابك غير مرتبط بفرع." };
  }
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: { branch: true },
  });
  if (!row) return { ok: false, error: "الطلب غير موجود." };
  if (row.branch !== session.branchSlug) {
    return { ok: false, error: "لا يمكنك تعديل حجز فرع آخر." };
  }
  return { ok: true };
}

export function enforceBranchOnFormData(
  session: AdminSession,
  formData: FormData,
): FormData {
  if (session.isSuperAdmin || !session.branchSlug) return formData;
  const copy = new FormData();
  for (const [key, value] of formData.entries()) {
    copy.append(key, value);
  }
  copy.set("branch", session.branchSlug);
  return copy;
}
