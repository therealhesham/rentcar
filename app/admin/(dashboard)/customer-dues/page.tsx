import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, bookingWhereForScope } from "@/lib/admin-scope";
import { VISIBLE_BOOKINGS_WHERE } from "@/lib/booking-visibility";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSar } from "@/lib/admin-statistics";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { prisma } from "@/lib/prisma";
import { SettleCustomerDueModal } from "./SettleCustomerDueModal";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CustomerDuesPage() {
  const session = await requireAdminPage();

  // المؤرشف يخرج من المستحقات القائمة والمُسوّاة معاً.
  const scopeWhere = {
    ...bookingWhereForScope(adminScope(session)),
    ...VISIBLE_BOOKINGS_WHERE,
  };

  const [outstanding, settled] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: {
        ...scopeWhere,
        refundDueToCustomerSar: { gt: 0 },
        refundDueSettledAt: null,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { name: true, email: true } },
        carModel: { include: { brand: true } },
      },
    }),
    prisma.bookingRequest.findMany({
      where: {
        ...scopeWhere,
        refundDueToCustomerSar: { gt: 0 },
        refundDueSettledAt: { not: null },
      },
      orderBy: { refundDueSettledAt: "desc" },
      take: 20,
      include: {
        carModel: { include: { brand: true } },
      },
    }),
  ]);

  const outstandingTotalSar = outstanding.reduce(
    (s, b) => s + (b.refundDueToCustomerSar ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="مستحقات للعميل"
        description="مبالغ مستحقة للعملاء بعد تعديلات قلّصت إجمالي حجوزات مدفوعة — تُسوَّى نقداً أو عبر نفس وسيلة الدفع."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatCard
          label="مستحقات قائمة"
          value={outstanding.length}
          highlight={outstanding.length > 0}
          hint="بانتظار التسوية"
        />
        <AdminStatCard
          label="إجمالي المبالغ القائمة"
          value={`${formatSar(outstandingTotalSar)} ر.س`}
          highlight={outstandingTotalSar > 0}
        />
        <AdminStatCard label="تسويات مسجّلة (آخر 20)" value={settled.length} />
      </div>

      <AdminCard
        title="مستحقات بانتظار التسوية"
        description="اختر آلية الاسترداد لكل حجز: نقداً في الفرع أو إلكترونياً عبر نفس وسيلة دفع العميل."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">السيارة</th>
                <th className="pb-3">المبلغ المستحق</th>
                <th className="pb-3">وسيلة الدفع الأصلية</th>
                <th className="pb-3">آخر تعديل</th>
                <th className="pb-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {outstanding.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    لا توجد مستحقات قائمة للعملاء حالياً.
                  </td>
                </tr>
              ) : (
                outstanding.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-surface-container/30">
                    <td className="py-3 pr-2">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="font-bold text-primary hover:underline"
                        dir="ltr"
                      >
                        #{b.id}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-on-surface">{b.fullName}</div>
                      <div className="text-xs text-on-surface-variant" dir="ltr">
                        {b.phone}
                      </div>
                    </td>
                    <td className="py-3">
                      {b.carModel
                        ? `${b.carModel.brand.name} ${b.carModel.name}`.trim()
                        : b.carType || "—"}
                    </td>
                    <td className="py-3 font-extrabold text-sky-800 tabular-nums" dir="ltr">
                      {formatSar(b.refundDueToCustomerSar ?? 0)} ر.س
                    </td>
                    <td className="py-3 text-xs font-bold">
                      {bookingPaymentMethodLabelAr(b.paymentMethod)}
                    </td>
                    <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                      {fmtDate(b.updatedAt)}
                    </td>
                    <td className="py-3">
                      <SettleCustomerDueModal
                        bookingId={b.id}
                        customerName={b.fullName}
                        amountSar={b.refundDueToCustomerSar ?? 0}
                        paymentMethod={b.paymentMethod}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard title="تسويات سابقة" description="آخر 20 تسوية مستحقات مسجّلة.">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">المبلغ</th>
                <th className="pb-3">آلية التسوية</th>
                <th className="pb-3">المرجع</th>
                <th className="pb-3">بواسطة</th>
                <th className="pb-3">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {settled.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    لا توجد تسويات سابقة.
                  </td>
                </tr>
              ) : (
                settled.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-surface-container/30">
                    <td className="py-3 pr-2">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="font-bold text-primary hover:underline"
                        dir="ltr"
                      >
                        #{b.id}
                      </Link>
                    </td>
                    <td className="py-3">{b.fullName}</td>
                    <td className="py-3 font-bold tabular-nums" dir="ltr">
                      {formatSar(b.refundDueToCustomerSar ?? 0)} ر.س
                    </td>
                    <td className="py-3 text-xs font-bold">
                      {b.refundDueSettledMethod === "CASH"
                        ? "نقداً"
                        : bookingPaymentMethodLabelAr(b.refundDueSettledMethod)}
                    </td>
                    <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                      {b.refundDueSettledRef ?? "—"}
                    </td>
                    <td className="py-3 text-xs">{b.refundDueSettledBy ?? "—"}</td>
                    <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                      {fmtDate(b.refundDueSettledAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
