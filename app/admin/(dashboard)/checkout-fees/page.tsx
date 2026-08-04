import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CheckoutFeeCreateForm } from "./CheckoutFeeCreateForm";
import { CheckoutFeeRow } from "./CheckoutFeeRow";

export const dynamic = "force-dynamic";

export default async function AdminCheckoutFeesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const fees = await prisma.checkoutOneTimeFee.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <>
      <AdminPageHeader
        title="رسوم إتمام الحجز"
        description="رسوم لمرة واحدة تُضاف تلقائياً في صفحة إتمام حجز الأسطول والدفع (مثل تفويض أو إبرام عقد). يمكنك إضافة أكثر من بند؛ المبالغ غير شاملة الضريبة. الشحن بين المدن يُدار من صفحة «شحن بين المدن»."
        backHref="/admin"
      />

      <CheckoutFeeCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[560px] text-start">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-high/50 text-xs font-bold uppercase text-on-surface-variant">
              <th className="px-4 py-3">slug</th>
              <th className="px-4 py-3">الاسم والمبلغ</th>
              <th className="px-4 py-3">حالة</th>
              <th className="px-4 py-3">—</th>
            </tr>
          </thead>
          <tbody>
            {fees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  لا توجد رسوم بعد. أضف أول بند أعلاه (مثال slug: <code dir="ltr">contract-auth</code>).
                </td>
              </tr>
            ) : (
              fees.map((f) => <CheckoutFeeRow key={f.id} row={f} />)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
