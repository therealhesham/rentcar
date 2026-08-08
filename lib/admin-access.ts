import type { Prisma } from "@prisma/client";
import type { AdminSession } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { ADMIN_NAV_GROUPS, type AdminNavGroup } from "@/lib/admin-nav";
import type { AdminPermission } from "@/lib/admin-permissions";
import {
  adminScope,
  andScope,
  bookingWhereForScope,
  isBranchSlugInScope,
} from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export function getAdminNavGroupsForSession(session: AdminSession): AdminNavGroup[] {
  if (session.isSuperAdmin) return ADMIN_NAV_GROUPS;

  const allowedPermissions = new Set(session.permissions || []);
  
  return ADMIN_NAV_GROUPS.map((group) => {
    const filteredItems = group.items.filter((item) => {
      if (item.external) return true; // Always show external links
      if (item.alwaysAllowed) return true; // لوحة التحكم والشروحات متاحة دائماً (نفس منطق middleware)
      return allowedPermissions.has(item.href);
    });

    return {
      ...group,
      items: filteredItems,
    };
  }).filter((group) => group.items.length > 0);
}

export function bookingBranchWhere(
  session: AdminSession,
  extra?: Prisma.BookingRequestWhereInput,
): Prisma.BookingRequestWhereInput {
  return andScope(bookingWhereForScope(adminScope(session)), extra);
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
  const scope = adminScope(session);
  // موظف الإدارة المركزية (بلا فرع وبلا مدينة) نطاقه كل الفروع — لا فحص إضافي.
  if (scope.kind === "all") return { ok: true };

  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      pickupBranch: { select: { id: true, slug: true, cityId: true } },
      returnBranch: { select: { id: true, slug: true, cityId: true } },
    },
  });
  if (!row) return { ok: false, error: "الطلب غير موجود." };

  const sides = [row.pickupBranch, row.returnBranch];
  if (scope.kind === "city") {
    if (sides.some((b) => b?.cityId === scope.cityId)) return { ok: true };
    return { ok: false, error: "لا يمكنك تعديل حجز خارج مدينتك." };
  }

  const matches =
    scope.branchId != null
      ? sides.some((b) => b?.id === scope.branchId)
      : sides.some(
          (b) => b?.slug.toLowerCase() === scope.branchSlug?.trim().toLowerCase(),
        );
  if (!matches) return { ok: false, error: "لا يمكنك تعديل حجز فرع آخر." };
  return { ok: true };
}

/**
 * يتحقق أن الفرع المُرسل في الفورم داخل نطاق الموظف. لازم لنطاق المدينة تحديداً: هناك
 * لا نفرض فرعاً بعينه (المشرف يختار من فروع مدينته) فالتحقق هو الحاجز الوحيد.
 */
export async function assertBranchSlugInScope(
  session: AdminSession,
  branchSlug: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = adminScope(session);
  if (scope.kind === "all") return { ok: true };
  if (!branchSlug?.trim()) return { ok: false, error: "اختر فرعاً." };
  if (await isBranchSlugInScope(scope, branchSlug)) return { ok: true };
  return { ok: false, error: "الفرع المختار خارج نطاق حسابك." };
}

/**
 * يثبّت حقل `branch` على فرع الموظف. في نطاق المدينة أو كل الفروع لا يوجد فرع واحد نفرضه —
 * الفورم يختار، والتحقق يتم عبر assertBranchSlugInScope.
 */
export function enforceBranchOnFormData(
  session: AdminSession,
  formData: FormData,
): FormData {
  const scope = adminScope(session);
  if (scope.kind !== "branch" || !scope.branchSlug) return formData;
  const copy = new FormData();
  for (const [key, value] of formData.entries()) {
    copy.append(key, value);
  }
  copy.set("branch", scope.branchSlug);
  return copy;
}
