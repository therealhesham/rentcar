import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BlacklistBadge, CustomerBlacklistToggle } from "@/components/admin/CustomerBlacklistToggle";
import { bookingBranchWhere, sessionHasPermission } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BookingClientRow = {
  phone: string;
  fullName: string;
  lastAt: Date;
  requestCount: number;
  lastKind: string;
  /** أحدث حجز لهذا الجوال — يُستخدم هدفاً لزر الحظر (يُنشئ حساباً إن لم يوجد). */
  lastBookingId: number;
};

function aggregateClientsFromBookings(
  rows: Array<{
    id: number;
    phone: string;
    fullName: string;
    createdAt: Date;
    kind: string;
  }>,
): BookingClientRow[] {
  const map = new Map<
    string,
    {
      fullName: string;
      lastAt: Date;
      requestCount: number;
      lastKind: string;
      lastBookingId: number;
    }
  >();

  for (const r of rows) {
    const cur = map.get(r.phone);
    if (!cur) {
      map.set(r.phone, {
        fullName: r.fullName,
        lastAt: r.createdAt,
        requestCount: 1,
        lastKind: r.kind,
        lastBookingId: r.id,
      });
    } else {
      cur.requestCount += 1;
    }
  }

  return [...map.entries()]
    .map(([phone, v]) => ({ phone, ...v }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** «05xxxxxxxx» أو «5xxxxxxxx» أو «+9665…» → الأرقام المحلية للبحث داخل الجوال المخزّن (+9665…). */
function phoneSearchDigits(q: string): string | null {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.replace(/^(00966|966|0)/, "");
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; blacklisted?: string }>;
}) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const onlyBlacklisted = sp.blacklisted === "1";
  const canManageBlacklist = sessionHasPermission(session, "/admin/customers");
  const phoneDigits = q ? phoneSearchDigits(q) : null;

  const userWhere: Prisma.UserWhereInput = {
    ...(onlyBlacklisted ? { isBlacklisted: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
          ],
        }
      : {}),
  };

  const bookingSearch: Prisma.BookingRequestWhereInput | undefined = q
    ? {
        OR: [
          { fullName: { contains: q } },
          ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
        ],
      }
    : undefined;

  // حسابات الموقع غير مرتبطة بفرع — تُعرض لمن نطاقه كل الفروع فقط.
  const [users, bookingRows, blacklistedPhoneRows] = await Promise.all([
    adminScope(session).kind === "all"
      ? prisma.user.findMany({
          where: userWhere,
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
            isBlacklisted: true,
            blacklistReason: true,
            blacklistedAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.bookingRequest.findMany({
      where: bookingBranchWhere(session, bookingSearch),
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: {
        id: true,
        phone: true,
        fullName: true,
        createdAt: true,
        kind: true,
      },
    }),
    prisma.user.findMany({
      where: { isBlacklisted: true, phone: { not: null } },
      select: { phone: true },
    }),
  ]);

  const blacklistedPhones = new Set(
    blacklistedPhoneRows.map((u) => u.phone).filter((p): p is string => Boolean(p)),
  );
  const clientsFromBookings = aggregateClientsFromBookings(bookingRows).filter(
    (c) => !onlyBlacklisted || blacklistedPhones.has(c.phone),
  );

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">العملاء</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          حسابات مسجّلة في النظام (إن وُجدت)، وقائمة مُشتقة من{" "}
          <span className="font-bold text-on-surface">طلبات الحجز</span> مجمّعة برقم الجوال (أحدث
          اسم يظهر لكل رقم).
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
        </p>
      </header>

      <form
        method="get"
        className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4"
      >
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <span className="text-xs font-bold text-on-surface-variant">بحث بالاسم أو الجوال أو البريد</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="مثال: محمد أو 05xxxxxxxx"
            className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm font-bold">
          <input type="checkbox" name="blacklisted" value="1" defaultChecked={onlyBlacklisted} />
          القائمة السوداء فقط
        </label>
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
        >
          بحث
        </button>
        {q || onlyBlacklisted ? (
          <Link
            href="/admin/customers"
            className="py-2 text-sm font-bold text-on-surface-variant hover:underline"
          >
            مسح
          </Link>
        ) : null}
      </form>

      <section className="mb-10 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <h2 className="text-xl font-extrabold tracking-tight">من طلبات الحجز</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          {clientsFromBookings.length} رقم جوال مميّز — أحدث طلب لكل رقم يُستخدم للاسم المعروض.
        </p>

        {clientsFromBookings.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            {q || onlyBlacklisted ? "لا نتائج مطابقة." : "لا توجد طلبات حجز بعد."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">الاسم (آخر طلب)</th>
                  <th className="px-3 py-2">الجوال</th>
                  <th className="px-3 py-2">عدد الطلبات</th>
                  <th className="px-3 py-2">آخر نوع</th>
                  <th className="px-3 py-2">آخر نشاط</th>
                  <th className="px-3 py-2">القائمة السوداء</th>
                </tr>
              </thead>
              <tbody>
                {clientsFromBookings.map((c) => (
                  <tr key={c.phone} className="border-b border-outline-variant/15">
                    <td className="px-3 py-2 font-medium">{c.fullName}</td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      {c.phone}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.requestCount}</td>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {c.lastKind === "DIRECT" ? "حجز مباشر" : "طلب حجز"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                      {c.lastAt.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-2">
                      {canManageBlacklist ? (
                        <CustomerBlacklistToggle
                          compact
                          target={{ kind: "booking", bookingId: c.lastBookingId }}
                          isBlacklisted={blacklistedPhones.has(c.phone)}
                        />
                      ) : blacklistedPhones.has(c.phone) ? (
                        <BlacklistBadge />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <h2 className="text-xl font-extrabold tracking-tight">مستخدمون مسجّلون (User)</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          حسابات البريد في جدول المستخدمين — قد تكون فارغة إن لم يُفعّل تسجيل العملاء بعد.
        </p>

        {users.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            {q || onlyBlacklisted ? "لا نتائج مطابقة." : "لا يوجد مستخدمون في الجدول."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">البريد</th>
                  <th className="px-3 py-2">الاسم</th>
                  <th className="px-3 py-2">الجوال</th>
                  <th className="px-3 py-2">تاريخ الإنشاء</th>
                  <th className="px-3 py-2">القائمة السوداء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-outline-variant/15 align-top">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">{u.name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs" dir="ltr">
                      {u.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                      {u.createdAt.toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-2">
                      {canManageBlacklist ? (
                        <CustomerBlacklistToggle
                          target={{ kind: "user", userId: u.id }}
                          isBlacklisted={u.isBlacklisted}
                          reason={u.blacklistReason}
                          blacklistedAt={u.blacklistedAt?.toISOString() ?? null}
                        />
                      ) : u.isBlacklisted ? (
                        <BlacklistBadge />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
