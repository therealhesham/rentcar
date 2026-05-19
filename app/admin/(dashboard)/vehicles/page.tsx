import Link from "next/link";
import { BranchFleetQuantityForm } from "@/components/admin/BranchFleetQuantityForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { listFleetVehiclesForAdmin } from "@/lib/fleet-vehicle-admin-data";
import { prisma } from "@/lib/prisma";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesPage() {
  const session = await requireAdminPage();
  const readOnly = !session.isSuperAdmin;
  const branchId = session.branchId;

  const [vehicles, branchRow] = await Promise.all([
    listFleetVehiclesForAdmin(branchId),
    branchId
      ? prisma.branch.findFirst({
          where: { id: branchId },
          select: { name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const branchBookingCounts = branchRow?.slug
    ? await prisma.bookingRequest.groupBy({
        by: ["carModelId"],
        where: {
          branch: branchRow.slug,
          carModelId: { not: null },
          kind: "DIRECT",
        },
        _count: { _all: true },
      })
    : [];

  const bookingsByModel = new Map(
    branchBookingCounts
      .filter((r) => r.carModelId != null)
      .map((r) => [r.carModelId!, r._count._all]),
  );

  return (
    <>
      <AdminPageHeader
        title={readOnly ? "أسطول الفرع" : "المركبات والأسطول"}
        description={
          readOnly && branchRow ? (
            <>
              حدّد <span className="font-bold text-on-surface">كمية كل مركبة</span> المتاحة في فرع{" "}
              <span className="font-bold text-on-surface">{branchRow.name}</span>. التوفر عند الحجز
              يُحسب من هذا الرقم ومن الحجوزات النشطة في الفرع. إضافة موديلات جديدة من مدير النظام
              فقط.
            </>
          ) : (
            <>
              المركبات الظاهرة هنا مرتبطة بجدول الأسطول لكل فرع. عدّل السعر أو الصورة كما تظهر
              للزائر في{" "}
              <Link href="/fleet" className="font-bold text-primary hover:underline">
                صفحة الأسطول
              </Link>
              .
            </>
          )
        }
        actions={
          readOnly ? undefined : (
            <Link
              href="/admin/vehicles/new"
              className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.45)]"
            >
              إضافة مركبة
            </Link>
          )
        }
      />

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-14 text-center">
          <p className="text-lg font-bold text-on-surface">
            {readOnly ? "لا توجد مركبات في الكتالوج بعد." : "لا توجد مركبات في الأسطول بعد."}
          </p>
          {!readOnly ? (
            <p className="mt-2 text-on-surface-variant">
              ابدأ من{" "}
              <Link href="/admin/vehicles/new" className="font-bold text-primary hover:underline">
                إضافة مركبة
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                <th className="px-4 py-3 font-bold text-on-surface-variant">صورة</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">المركبة</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">السنة</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">السعر / يوم</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">
                  {readOnly && branchId ? "الكمية في فرعك" : "الكمية (مجموع الفروع)"}
                </th>
                {readOnly && branchRow ? (
                  <th className="px-4 py-3 font-bold text-on-surface-variant">حجوزات الفرع</th>
                ) : null}
                {readOnly && branchId ? (
                  <th className="px-4 py-3 font-bold text-on-surface-variant">تحديث الكمية</th>
                ) : null}
                {!readOnly ? (
                  <th className="px-4 py-3 font-bold text-on-surface-variant">إجراء</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3">
                    <div className="relative h-14 w-24 overflow-hidden rounded-lg bg-surface-container">
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-on-surface-variant">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-on-surface">
                    {v.brandName} <span className="text-on-surface-variant">|</span> {v.modelName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-on-surface">{v.year}</td>
                  <td className="px-4 py-3 font-bold text-primary">
                    <SarAmountWithSymbol amountClassName="tabular-nums font-bold">
                      {v.price.toLocaleString("en-US")}
                    </SarAmountWithSymbol>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-bold text-on-surface">{v.quantity}</td>
                  {readOnly && branchRow ? (
                    <td className="px-4 py-3 tabular-nums text-on-surface">
                      {bookingsByModel.get(v.id) ?? 0}
                    </td>
                  ) : null}
                  {readOnly && branchId ? (
                    <td className="px-4 py-3">
                      <BranchFleetQuantityForm
                        modelId={v.id}
                        branchId={branchId}
                        defaultQuantity={v.quantity}
                      />
                    </td>
                  ) : null}
                  {!readOnly ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/vehicles/${v.id}/edit`}
                        className="inline-flex rounded-lg border border-outline-variant px-4 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
