import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomizedCouponCreateForm } from "@/app/admin/(dashboard)/customized-coupons/CustomizedCouponCreateForm";
import { CustomizedCouponDeleteForm } from "@/app/admin/(dashboard)/customized-coupons/CustomizedCouponDeleteForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getCustomizedCouponsForAdmin,
  type CustomizedCouponAdminRow,
} from "@/lib/customized-coupon-admin-data";

export const dynamic = "force-dynamic";

function formatValue(kind: string, value: number): string {
  return kind === "PERCENT" ? `${value}%` : `${value} ر.س`;
}

function formatScope(scope: string): string {
  return scope === "RENTAL_ONLY" ? "الإيجار فقط" : "الإجمالي كامل";
}

function couponStatusLabel(
  row: CustomizedCouponAdminRow,
  now: Date,
): { text: string; cls: string } {
  if (row.isUsed) {
    return { text: "مُستخدَم", cls: "bg-outline-variant/40 text-on-surface-variant" };
  }
  if (!row.isActive) {
    return { text: "معطّل", cls: "bg-outline-variant/40 text-on-surface-variant" };
  }
  if (row.endsAt && now.getTime() > row.endsAt.getTime()) {
    return { text: "منتهي", cls: "bg-error/10 text-error" };
  }
  return { text: "نشط", cls: "bg-primary-container/50 text-on-primary-container" };
}

export default async function AdminCustomizedCouponsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const coupons = await getCustomizedCouponsForAdmin();
  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <Link href="/admin" className="mb-3 inline-block text-sm font-bold text-primary hover:underline">
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">أكواد الخصم المخصَّصة</h1>
        <p className="mt-2 text-on-surface-variant">
          كود خصم يُخصَّص لرقم جوال عميل واحد بعينه. عند إدخال العميل لكود في صفحة الدفع يُفحص هذا
          الجدول أولاً — قبل أكواد الخصم العامة — وإن كان الكود مخصَّصاً لرقمه فعلاً يُطبَّق ويُقفل
          بعد أول استخدام. غير ذلك، البحث يكمل في{" "}
          <Link href="/admin/coupon-codes" className="font-bold text-primary hover:underline">
            أكواد الخصم العامة
          </Link>{" "}
          كالمعتاد.
        </p>
      </header>

      <CustomizedCouponCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[920px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الكود</th>
              <th className="px-4 py-3 font-bold">العميل</th>
              <th className="px-4 py-3 font-bold">الخصم</th>
              <th className="px-4 py-3 font-bold">النطاق</th>
              <th className="px-4 py-3 font-bold">ينتهي في</th>
              <th className="px-4 py-3 font-bold">الحالة</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد أكواد مخصَّصة بعد.
                </td>
              </tr>
            ) : (
              coupons.map((c) => {
                const status = couponStatusLabel(c, now);
                return (
                  <tr key={c.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold tabular-nums" dir="ltr">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                      {c.customerPhone}
                    </td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">
                      {formatValue(c.kind, c.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatScope(c.scope)}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {c.endsAt ? c.endsAt.toISOString().slice(0, 10) : "بلا نهاية"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.cls}`}>
                        {status.text}
                      </span>
                      {c.isUsed && c.usedByBookingRequestId != null ? (
                        <Link
                          href={`/admin/bookings/${c.usedByBookingRequestId}`}
                          className="ms-2 text-xs font-bold text-primary hover:underline"
                        >
                          الحجز #{c.usedByBookingRequestId}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/customized-coupons/${c.id}/edit`}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                        >
                          تعديل
                        </Link>
                        <CustomizedCouponDeleteForm id={c.id} code={c.code} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
