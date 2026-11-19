import type { AdminSession } from "@/lib/admin-auth";
import { bookingBranchWhere } from "@/lib/admin-access";
import { adminScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

/**
 * نطاق موظف الفرع/المدينة في معاينة حساب العميل.
 *
 * حسابات الموقع (`User`) لا تتبع فرعاً، فصفحة العملاء تعرضها لنطاق «كل الفروع» فقط.
 * هنا نوسّعها قليلاً بأمان: موظف الفرع يرى العميل فقط إن كان له حجز واحد على الأقل
 * داخل نطاقه (بنفس ملكية حساب العميل: `customerId` أو رقم الجوال)، وفي المعاينة لا تظهر
 * له إلا حجوزات نطاقه (`bookingBranchWhere`).
 */
export function sessionSeesAllCustomers(session: AdminSession): boolean {
  return adminScope(session).kind === "all";
}

/** يعيد معرّفات العملاء الذين يحق للموظف معاينتهم من بين القائمة المعطاة. */
export async function customerIdsInSessionScope(
  session: AdminSession,
  users: Array<{ id: number; phone: string | null }>,
): Promise<Set<number>> {
  if (users.length === 0) return new Set();
  if (sessionSeesAllCustomers(session)) return new Set(users.map((u) => u.id));

  const ids = users.map((u) => u.id);
  const phones = users.map((u) => u.phone).filter((p): p is string => Boolean(p));
  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      OR: [{ customerId: { in: ids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])],
    }),
    select: { customerId: true, phone: true },
  });
  const hitIds = new Set(rows.map((r) => r.customerId).filter((x): x is number => x != null));
  const hitPhones = new Set(rows.map((r) => r.phone));
  return new Set(
    users.filter((u) => hitIds.has(u.id) || (u.phone != null && hitPhones.has(u.phone))).map((u) => u.id),
  );
}
