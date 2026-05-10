import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { PaymentClient } from "@/components/fleet/PaymentClient";
import { SiteNav } from "@/components/shared/SiteNav";
import { getBookingForPayment } from "@/lib/booking-payment-data";

export const dynamic = "force-dynamic";

export default async function FleetPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const booking = await getBookingForPayment(id);
  if (!booking) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-24 pb-16">
        <PaymentClient booking={booking} />
      </div>
      <SiteFooter />
    </div>
  );
}
