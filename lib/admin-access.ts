import type { Prisma } from "@prisma/client";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { ADMIN_NAV_GROUPS, type AdminNavGroup } from "@/lib/admin-nav";
import type { AdminPermission } from "@/lib/admin-permissions";
import { isSuperAdminOnlyPath } from "@/lib/admin-routes";
import { bookingInBranchScope } from "@/lib/booking-branches";
import { prisma } from "@/lib/prisma";

export { isSuperAdminOnlyPath, SUPER_ADMIN_ONLY_PREFIXES } from "@/lib/admin-routes";

const BRANCH_NAV_GROUP_IDS = new Set(["main", "bookings", "external"]);

const BRANCH_EXTRA_NAV: AdminNavGroup["items"] = [
  { href: "/admin/vehicles", label: "المركبات", icon: "car" },
];

export function getAdminNavGroupsForSession(session: AdminSession): AdminNavGroup[] {
  if (session.isSuperAdmin) return ADMIN_NAV_GROUPS;

  const allowedPermissions = new Set(session.permissions || []);
  
  return ADMIN_NAV_GROUPS.map((group) => {
    const filteredItems = group.items.filter((item) => {
      if (item.external) return true; // Always show external links
      if (!item.permission) return false; // Hide items with no permission explicitly defined (safety)
      return allowedPermissions.has(item.permission);
    });

    return {
      ...group,
      items: filteredItems,
    };
  }).filter((group) => group.items.length > 0);
}

export { adminBranchDisplayName } from "@/lib/admin-branch-display";

export function bookingBranchWhere(
  session: AdminSession,
  extra?: Prisma.BookingRequestWhereInput,
): Prisma.BookingRequestWhereInput {
  const base: Prisma.BookingRequestWhereInput =
    session.isSuperAdmin || !session.branchSlug
      ? {}
      : bookingInBranchScope(session.branchSlug);
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

export async function requirePermissionForAction(
  permission: AdminPermission
): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return auth;
  if (auth.session.isSuperAdmin) return auth;
  if (!auth.session.permissions.includes(permission)) {
    return { ok: false, error: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
  }
  return auth;
}

export async function assertBookingRequestInScope(
  session: AdminSession,
  bookingRequestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.isSuperAdmin) return { ok: true };
  if (!session.branchSlug) {
    // If they have no branchSlug, they are a headquarters employee.
    // They are allowed to see all branches.
    return { ok: true };
  }
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      branchId: true,
      returnBranchId: true,
      pickupBranch: { select: { slug: true } },
      returnBranch: { select: { slug: true } },
    },
  });
  if (!row) return { ok: false, error: "الطلب غير موجود." };
  const slug = session.branchSlug.trim().toLowerCase();
  const pickup = row.pickupBranch?.slug?.toLowerCase();
  const ret = row.returnBranch?.slug?.toLowerCase();
  if (pickup !== slug && ret !== slug) {
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
