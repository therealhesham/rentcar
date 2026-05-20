import Link from "next/link";
import { bookingBranchWhere } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { addDaysToYmd, NON_BLOCKING_BOOKING_STATUSES } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BRANCH_LABEL: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatSectionDate(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminCarBookingsPage() {
  const session = await requireAdminPage();

  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      kind: "DIRECT",
      carModelId: { not: null },
      NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
    }),
    include: {
      carModel: { include: { brand: true, category: true } },
      pickupBranch: { select: { slug: true, name: true } },
      returnBranch: { select: { slug: true, name: true } },
    },
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
  });

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = dateKey(row.pickupDate);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const sortedKeys = [...groups.keys()].sort();

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">حجوزات السيارات</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          الحجوزات المباشرة المرتبطة بموديل سيارة، مرتبة حسب{" "}
          <span className="font-bold text-on-surface">تاريخ بداية الحجز</span>. الحالات الملغاة أو
          المرفوضة لا تظهر هنا.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            العودة للوحة التحكم
          </Link>
        </p>
      </header>

      {sortedKeys.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-6 text-sm text-on-surface-variant">
          لا توجد حجوزات مباشرة نشطة حالياً.
        </p>
      ) : (
        <div className="space-y-10">
          {sortedKeys.map((ymd) => {
            const dayRows = groups.get(ymd)!;
            return (
              <section
                key={ymd}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6"
              >
                <h2 className="text-lg font-extrabold tracking-tight text-primary">
                  {formatSectionDate(ymd)}
                  <span className="ms-2 font-mono text-sm font-bold text-on-surface-variant" dir="ltr">
                    ({ymd})
                  </span>
                </h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[920px] text-start text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                        <th className="px-3 py-2">السيارة</th>
                        <th className="px-3 py-2">من — إلى</th>
                        <th className="px-3 py-2">الأيام</th>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">الجوال</th>
                        <th className="px-3 py-2">فرع الاستلام</th>
                        <th className="px-3 py-2">فرع الإرجاع</th>
                        <th className="px-3 py-2">طريقة الاستلام</th>
                        <th className="px-3 py-2">الحالة</th>
                        <th className="px-3 py-2">عرض</th>
                        <th className="px-3 py-2">رقم الطلب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((b) => {
                        const startYmd = dateKey(b.pickupDate);
                        const lastDayYmd = addDaysToYmd(startYmd, b.numberOfDays - 1);
                        const carLabel = b.carModel
                          ? `${b.carModel.brand.name} ${b.carModel.name}`
                          : "—";
                        return (
                          <tr key={b.id} className="border-b border-outline-variant/15">
                            <td className="px-3 py-2 font-medium">{carLabel}</td>
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {startYmd} → {lastDayYmd}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{b.numberOfDays}</td>
                            <td className="px-3 py-2">{b.fullName}</td>
                            <td className="px-3 py-2" dir="ltr">
                              {b.phone}
                            </td>
                            <td className="px-3 py-2">
                              {b.pickupBranch?.name ??
                                BRANCH_LABEL[b.pickupBranch?.slug ?? ""] ??
                                "—"}
                            </td>
                            <td className="px-3 py-2">
                              {b.returnBranch?.name ??
                                BRANCH_LABEL[b.returnBranch?.slug ?? ""] ??
                                "—"}
                            </td>
                            <td className="px-3 py-2">
                              {b.pickupMode === "DELIVERY" ? (
                                <span className="inline-flex max-w-[min(100%,280px)] flex-col gap-1">
                                  <span className="font-bold text-primary">توصيل</span>
                                  {b.deliveryAddress?.trim() ? (
                                    <span className="whitespace-pre-wrap text-xs leading-snug text-on-surface">
                                      {b.deliveryAddress.trim()}
                                    </span>
                                  ) : null}
                                  {b.deliveryLat != null && b.deliveryLng != null ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${b.deliveryLat},${b.deliveryLng}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-bold text-on-surface-variant underline"
                                      dir="ltr"
                                    >
                                      الخريطة
                                    </a>
                                  ) : !b.deliveryAddress?.trim() ? (
                                    <span className="text-xs text-on-surface-variant">بدون عنوان/خريطة</span>
                                  ) : null}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant">فرع</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{b.status}</td>
                            <td className="px-3 py-2">
                              <Link
                                href={`/admin/bookings/${b.id}`}
                                className="font-bold text-primary hover:underline"
                              >
                                التفاصيل
                              </Link>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                              #{b.id}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
