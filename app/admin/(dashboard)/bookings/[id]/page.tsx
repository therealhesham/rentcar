import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingDetailView } from "@/components/admin/BookingDetailView";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { loadAdminBookingDetail } from "@/lib/admin-booking-detail";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

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
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-8 text-center">
        <p className="font-bold text-on-surface">{scope.error}</p>
        <Link href="/admin/car-bookings" className="mt-4 inline-block text-sm font-bold text-primary hover:underline">
          العودة لحجوزات السيارات
        </Link>
      </div>
    );
  }

  const booking = await loadAdminBookingDetail(id);
  if (!booking) notFound();

  return <BookingDetailView booking={booking} />;
}
