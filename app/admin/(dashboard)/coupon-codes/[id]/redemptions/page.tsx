import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCouponRedemptionsForAdmin } from "@/lib/coupon-code-admin-data";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminCouponRedemptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const { couponCode, redemptions } = await getCouponRedemptionsForAdmin(id);
  if (!couponCode) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <Link
          href="/admin/coupon-codes"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← أكواد الخصم
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">
          استخدامات الكود: <span className="font-mono" dir="ltr">{couponCode.code}</span>
        </h1>
        <p className="mt-2 text-on-surface-variant">
          {redemptions.length} استخدام
          {couponCode.maxUses != null ? ` من أصل ${couponCode.maxUses}` : ""}.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">رقم الجوال</th>
              <th className="px-4 py-3 font-bold">قيمة الخصم</th>
              <th className="px-4 py-3 font-bold">تاريخ الاستخدام</th>
              <th className="px-4 py-3 font-bold">الحجز</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد استخدامات بعد.
                </td>
              </tr>
            ) : (
              redemptions.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3 tabular-nums" dir="ltr">{r.customerPhone}</td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">
                    {r.discountAmountSar.toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {formatDateTime(r.redeemedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${r.bookingRequestId}`}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                    >
                      عرض الحجز #{r.bookingRequestId}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
