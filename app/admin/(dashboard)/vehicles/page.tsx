import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { listFleetVehiclesForAdmin } from "@/lib/fleet-vehicle-admin-data";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const vehicles = await listFleetVehiclesForAdmin().catch(() => []);

  return (
    <>
      <AdminPageHeader
        title="المركبات والأسطول"
        description={
          <>
            المركبات الظاهرة هنا مرتبطة بجدول الأسطول. عدّل السعر أو الصورة أو النصوص كما تظهر للزائر في{" "}
            <Link href="/fleet" className="font-bold text-primary hover:underline">
              صفحة الأسطول
            </Link>
            .
          </>
        }
        actions={
          <Link
            href="/admin/vehicles/new"
            className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.45)]"
          >
            إضافة مركبة
          </Link>
        }
      />

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-14 text-center">
          <p className="text-lg font-bold text-on-surface">لا توجد مركبات في الأسطول بعد.</p>
          <p className="mt-2 text-on-surface-variant">
            ابدأ من{" "}
            <Link href="/admin/vehicles/new" className="font-bold text-primary hover:underline">
              إضافة مركبة
            </Link>
            .
          </p>
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
                <th className="px-4 py-3 font-bold text-on-surface-variant">الكمية</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3">
                    <div className="relative h-14 w-24 overflow-hidden rounded-lg bg-surface-container">
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- روابط ديناميكية من Spaces أو خارجية
                        <img
                          src={v.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
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
                  <td className="px-4 py-3 tabular-nums text-on-surface">{v.quantity}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vehicles/${v.id}/edit`}
                      className="inline-flex rounded-lg border border-outline-variant px-4 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-surface-container"
                    >
                      تعديل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
