import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingDetailEditActions } from "@/components/admin/BookingDetailEditActions";
import { BookingDetailView } from "@/components/admin/BookingDetailView";
import { BookingAuditLog } from "@/components/admin/BookingAuditLog";
import { assertBookingRequestInScope, sessionHasPermission } from "@/lib/admin-access";
import { LATE_PENALTY_DECISION_PERMISSIONS } from "@/lib/admin-permissions";
import { loadAdminBookingCancellationContext } from "@/lib/admin-booking-cancellation";
import {
  loadAdminBookingDetail,
  loadAdminBookingEditContext,
} from "@/lib/admin-booking-detail";
import { toEditableBookingRow } from "@/lib/admin-booking-edit-map";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { Logs } from "lucide-react";

export const dynamic = "force-dynamic";

function EditActionsFallback() {
  return (
    <div className="h-10 w-full animate-pulse rounded-xl bg-surface-container-high" />
  );
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminPage();
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  // يتحكم بظهور خياري «استرداد كامل» و«بلا استرداد» في لوحة الإلغاء — يُحسب هنا
  // (لا في المكوّن العميل) لأن جلسة الإدارة لا تصل إلا للسيرفر.
  const canOverrideCancelPolicy =
    session.isSuperAdmin || session.permissions.includes("CANCEL_OVERRIDE");

  // نفس المبدأ لقرارات غرامة الإرجاع المتأخر — كل قرار صلاحية مستقلة يمنحها مدير النظام.
  const latePenaltyDecisionPerms = {
    apply: sessionHasPermission(session, LATE_PENALTY_DECISION_PERMISSIONS.APPLY),
    waive: sessionHasPermission(session, LATE_PENALTY_DECISION_PERMISSIONS.WAIVE),
    onTime: sessionHasPermission(session, LATE_PENALTY_DECISION_PERMISSIONS.ON_TIME),
  };

  const scope = await assertBookingRequestInScope(session, id);
  if (!scope.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-outline-variant/30 bg-white px-6 py-10 text-center shadow-sm">
        <p className="font-bold text-on-surface">{scope.error}</p>
        <Link
          href="/admin/car-bookings"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
        >
          العودة لحجوزات السيارات
        </Link>
      </div>
    );
  }

  const [booking, logs] = await Promise.all([
    loadAdminBookingDetail(id),
    prisma.bookingLog.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        event: true,
        actorKind: true,
        actorName: true,
        fromStatus: true,
        toStatus: true,
        notes: true,
        createdAt: true,
      },
    }),
  ]);
  if (!booking) notFound();

  const editable = toEditableBookingRow(booking);

  const [cancellation, editContext] = await Promise.all([
    loadAdminBookingCancellationContext(booking),
    loadAdminBookingEditContext(
      editable.kind === "DIRECT"
        ? {
            branchSlug: editable.branch,
            pickupDate: new Date(editable.pickupIso),
            numberOfDays: editable.numberOfDays,
            excludeBookingRequestId: booking.id,
          }
        : undefined,
    ),
  ]);

  const canEditBooking =
    session.isSuperAdmin || session.permissions.includes("BOOKING_EDIT");

  const editActions = canEditBooking ? (
    <Suspense fallback={<EditActionsFallback />}>
      <BookingDetailEditActions
        request={editable}
        categories={editContext.categories}
        models={editContext.models}
        branches={editContext.branches}
      />
    </Suspense>
  ) : null;

  return (
    <>
      <BookingDetailView
        booking={booking}
        editActions={editActions}
        cancellation={cancellation}
        canOverrideCancelPolicy={canOverrideCancelPolicy}
        latePenaltyDecisionPerms={latePenaltyDecisionPerms}
        canEditBooking={canEditBooking}
      />
      <section className="mx-auto mt-8 max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-on-surface">
            <span className="text-lg"><Logs/></span>
            سجل الأحداث
            <span className="mr-auto rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold text-on-surface-variant">
              {logs.length} حدث
            </span>
          </h2>
          <BookingAuditLog logs={logs} />
        </div>
      </section>
    </>
  );
}
