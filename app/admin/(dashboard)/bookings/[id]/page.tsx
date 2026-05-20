import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingDetailEditActions } from "@/components/admin/BookingDetailEditActions";
import { BookingDetailView } from "@/components/admin/BookingDetailView";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { loadAdminBookingCancellationContext } from "@/lib/admin-booking-cancellation";
import {
  loadAdminBookingDetail,
  loadAdminBookingEditContext,
} from "@/lib/admin-booking-detail";
import { toEditableBookingRow } from "@/lib/admin-booking-edit-map";
import { requireAdminPage } from "@/lib/admin-page";

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

  const [booking, editContext] = await Promise.all([
    loadAdminBookingDetail(id),
    loadAdminBookingEditContext(),
  ]);
  if (!booking) notFound();

  const cancellation = await loadAdminBookingCancellationContext(booking);

  const editable = toEditableBookingRow(booking);

  const editActions = (
    <Suspense fallback={<EditActionsFallback />}>
      <BookingDetailEditActions
        request={editable}
        categories={editContext.categories}
        models={editContext.models}
      />
    </Suspense>
  );

  return (
    <BookingDetailView
      booking={booking}
      editActions={editActions}
      cancellation={cancellation}
    />
  );
}
