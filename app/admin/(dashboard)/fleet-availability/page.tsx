import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { addDaysToYmd, getDirectBookingAvailability } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseYmd(raw: string | undefined): string {
  const t = raw?.trim();
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  return new Date().toISOString().slice(0, 10);
}

function parseDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(60, Math.floor(n)));
}

export default async function FleetAvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; days?: string }>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const sp = searchParams ? await searchParams : {};
  const startYmd = parseYmd(sp.date);
  const numberOfDays = parseDays(sp.days);
  const pickupDate = new Date(`${startYmd}T12:00:00.000Z`);
  const endInclusiveYmd = addDaysToYmd(startYmd, numberOfDays - 1);

  const models = await prisma.carModel.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
    },
  });

  const rows = await Promise.all(
    models.map(async (m) => {
      const av = await getDirectBookingAvailability({
        carModelId: m.id,
        pickupDate,
        numberOfDays,
      });
      const freeSlots = Math.max(0, av.fleetUnits - av.overlapping);
      return {
        id: m.id,
        title: `${m.brand.name} ${m.name}`,
        fleetUnits: av.fleetUnits,
        overlapping: av.overlapping,
        freeSlots,
        available: av.available,
      };
    }),
  );

  const withStock = rows.filter((r) => r.fleetUnits > 0);
  const noStock = rows.filter((r) => r.fleetUnits <= 0);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">توفر المركبات</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          مقارنة{" "}
          <span className="font-bold text-on-surface">وحدات الأسطول</span> بعدد{" "}
          <span className="font-bold text-on-surface">الحجوزات المباشرة النشطة</span> التي تتداخل مع
          الفترة المختارة. «المحجوز» = عدد الحجوزات المتزامنة في نفس الفترة، و«المتاح» = الفرق عن حد
          الأسطول.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-on-surface-variant">
          الفترة المعروضة
        </h2>
        <p className="mt-2 text-sm text-on-surface">
          من <span className="font-mono font-bold" dir="ltr">{startYmd}</span> لمدة{" "}
          <span className="font-bold tabular-nums">{numberOfDays}</span> يومًا (آخر يوم ضمن الفترة:{" "}
          <span className="font-mono font-bold" dir="ltr">{endInclusiveYmd}</span>).
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            تاريخ البداية
            <input
              type="date"
              name="date"
              defaultValue={startYmd}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
              dir="ltr"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            عدد الأيام
            <input
              type="number"
              name="days"
              min={1}
              max={60}
              defaultValue={numberOfDays}
              className="w-28 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
          >
            تحديث العرض
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
        <h2 className="text-lg font-extrabold tracking-tight">مركبات لها كمية في الأسطول</h2>
        {withStock.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">لا توجد مركبات بكمية في الأسطول.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                  <th className="px-3 py-2">المركبة</th>
                  <th className="px-3 py-2 tabular-nums">وحدات الأسطول</th>
                  <th className="px-3 py-2 tabular-nums">محجوز (متزامن)</th>
                  <th className="px-3 py-2 tabular-nums">متاح في الفترة</th>
                  <th className="px-3 py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {withStock.map((r) => (
                  <tr key={r.id} className="border-b border-outline-variant/15">
                    <td className="px-3 py-2 font-medium">{r.title}</td>
                    <td className="px-3 py-2 tabular-nums">{r.fleetUnits}</td>
                    <td className="px-3 py-2 tabular-nums">{r.overlapping}</td>
                    <td className="px-3 py-2 tabular-nums font-bold text-primary">{r.freeSlots}</td>
                    <td className="px-3 py-2">
                      {r.available ? (
                        <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-bold text-on-primary-container">
                          يوجد توفر
                        </span>
                      ) : (
                        <span className="rounded-full bg-error-container px-2.5 py-0.5 text-xs font-bold text-on-error-container">
                          ممتلئ في الفترة
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {noStock.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/50 p-5 md:p-6">
          <h2 className="text-lg font-extrabold tracking-tight text-on-surface-variant">
            بدون كمية في الأسطول ({noStock.length})
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            لا تظهر في الحجز المباشر حتى تُضاف كمية من «إضافة مركبة» أو من إدارة الأسطول.
          </p>
          <ul className="mt-3 columns-1 gap-2 text-sm sm:columns-2">
            {noStock.map((r) => (
              <li key={r.id} className="break-inside-avoid py-0.5">
                {r.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
