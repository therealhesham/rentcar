import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { InterCityShippingCreateForm } from "./InterCityShippingCreateForm";
import { InterCityShippingFeeRow } from "./InterCityShippingFeeRow";

export const dynamic = "force-dynamic";

export default async function AdminInterCityShippingPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [cities, fees] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true },
    }),
    prisma.interCityShippingFee.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        fromCity: { select: { slug: true, name: true } },
        toCity: { select: { slug: true, name: true } },
      },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="رسوم الشحن بين المدن"
        description="تُطبَّق تلقائياً في حجز الأسطول عندما تختلف مدينة الاستلام (أو مدينة عنوان التوصيل المختارة للرسوم) عن مدينة فرع إرجاع المركبة. لكل اتجاه (من → إلى) سطر مستقل؛ لمسار العكس أضف سطراً ثانياً."
        backHref="/admin"
      />

      <InterCityShippingCreateForm cities={cities} />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[640px] text-start">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-high/50 text-xs font-bold uppercase text-on-surface-variant">
              <th className="px-4 py-3">من</th>
              <th className="px-4 py-3">slug</th>
              <th className="px-4 py-3">إلى</th>
              <th className="px-4 py-3">slug</th>
              <th className="px-4 py-3 text-end">ريال (دون ضريبة)</th>
              <th className="px-4 py-3">حالة</th>
              <th className="px-4 py-3">—</th>
            </tr>
          </thead>
          <tbody>
            {fees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  لا توجد مسارات بعد. أضف أول مسار أعلاه.
                </td>
              </tr>
            ) : (
              fees.map((f) => <InterCityShippingFeeRow key={f.id} row={f} />)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
