import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { SendDroppedBookingNotificationButton } from "@/components/admin/SendDroppedBookingNotificationButton";
import { requireAdminPage } from "@/lib/admin-page";
import { bookingBranchWhere } from "@/lib/admin-access";
import { BOOKING_EVENTS } from "@/lib/booking-audit";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reasonFor(row: {
  kind: string;
  paymentStatus: string;
  paymentMethod: string | null;
}): string {
  const status = row.paymentStatus.trim().toUpperCase();
  if (row.kind === "DIRECT" && status === "PENDING" && !row.paymentMethod?.trim()) {
    return "لم يختر العميل وسيلة الدفع بعد";
  }
  if (row.kind === "DIRECT" && status === "PENDING" && row.paymentMethod?.trim()) {
    return "اختار وسيلة الدفع لكن لم يُكمل العملية";
  }
  if (status === "PAID") {
    return "الدفع تم لكن الإشعار لم يُرسل — يستحق مراجعة";
  }
  return "لم يُرسل له إشعار بعد";
}

export default async function BookingNotificationDropsPage() {
  const session = await requireAdminPage();

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // نتجاهل آخر ١٥ دقيقة حتى ما نزعجش عميل لسه في منتصف عملية الدفع فعلياً.
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);

  const bookings = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      createdAt: { gte: since, lte: staleBefore },
      logs: { none: { event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT } },
    }),
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      fullName: true,
      phone: true,
      contactEmail: true,
      createdAt: true,
      paymentStatus: true,
      paymentMethod: true,
      pickupBranch: { select: { name: true } },
      returnBranch: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="حجوزات بلا إشعار (آخر ٢٤ ساعة)"
        description="حجوزات لم يصل عنها إشعار للموظفين — غالباً لأن العميل سايب صفحة الدفع قبل ما يختار وسيلة الدفع أو يكمل العملية. اضغط «إرسال الإشعار الآن» لتنبيه الموظفين يدوياً بنفس منطق الإرسال التلقائي (نفس العلامة تُسجَّل في سجل أحداث الحجز فتمنع أي تكرار لاحق)."
      />

      <AdminCard
        title={`${bookings.length} حجز بانتظار الإشعار`}
        description="لا تظهر هنا الحجوزات الأحدث من ١٥ دقيقة، ولا الحجوزات المؤرشفة، ولا التي خارج نطاق صلاحيتك."
      >
        {bookings.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-on-surface-variant">
            لا توجد حجوزات معلّقة الآن.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
            <table className="w-full min-w-[900px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container/80">
                  <th className="px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">العميل</th>
                  <th className="px-4 py-3 font-bold">إيميل العميل</th>
                  <th className="px-4 py-3 font-bold">الفرع</th>
                  <th className="px-4 py-3 font-bold">وقت الإنشاء</th>
                  <th className="px-4 py-3 font-bold">وسيلة الدفع</th>
                  <th className="px-4 py-3 font-bold">السبب المرجّح</th>
                  <th className="px-4 py-3 font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-4 py-3 tabular-nums text-on-surface-variant">
                      <a
                        href={`/admin/bookings/${b.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        #{b.id}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{b.fullName}</div>
                      <div dir="ltr" className="text-xs text-on-surface-variant">
                        {b.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.contactEmail?.trim() ? (
                        <span dir="ltr" className="text-xs">
                          {b.contactEmail}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-error">لا يوجد إيميل</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {b.pickupBranch?.name?.trim() || b.returnBranch?.name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-on-surface-variant">
                      {fmtDateTime(b.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {bookingPaymentMethodLabelAr(b.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{reasonFor(b)}</td>
                    <td className="px-4 py-3">
                      <SendDroppedBookingNotificationButton bookingId={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
