import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BookingClientRow = {
  phone: string;
  fullName: string;
  lastAt: Date;
  requestCount: number;
  lastKind: string;
};

function aggregateClientsFromBookings(
  rows: Array<{
    phone: string;
    fullName: string;
    createdAt: Date;
    kind: string;
  }>,
): BookingClientRow[] {
  const map = new Map<
    string,
    { fullName: string; lastAt: Date; requestCount: number; lastKind: string }
  >();

  for (const r of rows) {
    const cur = map.get(r.phone);
    if (!cur) {
      map.set(r.phone, {
        fullName: r.fullName,
        lastAt: r.createdAt,
        requestCount: 1,
        lastKind: r.kind,
      });
    } else {
      cur.requestCount += 1;
    }
  }

  return [...map.entries()]
    .map(([phone, v]) => ({
      phone,
      fullName: v.fullName,
      lastAt: v.lastAt,
      requestCount: v.requestCount,
      lastKind: v.lastKind,
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

export default async function AdminCustomersPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [users, bookingRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    }),
    prisma.bookingRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: {
        phone: true,
        fullName: true,
        createdAt: true,
        kind: true,
      },
    }),
  ]);

  const clientsFromBookings = aggregateClientsFromBookings(bookingRows);

  return (
    <>
      <header className="mb-10">
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

      <section className="mb-10 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <h2 className="text-xl font-extrabold tracking-tight">من طلبات الحجز</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          {clientsFromBookings.length} رقم جوال مميّز — أحدث طلب لكل رقم يُستخدم للاسم المعروض.
        </p>

        {clientsFromBookings.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">لا توجد طلبات حجز بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">الاسم (آخر طلب)</th>
                  <th className="px-3 py-2">الجوال</th>
                  <th className="px-3 py-2">عدد الطلبات</th>
                  <th className="px-3 py-2">آخر نوع</th>
                  <th className="px-3 py-2">آخر نشاط</th>
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
          <p className="mt-4 text-sm text-on-surface-variant">لا يوجد مستخدمون في الجدول.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">البريد</th>
                  <th className="px-3 py-2">الاسم</th>
                  <th className="px-3 py-2">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-outline-variant/15">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">{u.name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                      {u.createdAt.toLocaleString("ar-SA")}
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
