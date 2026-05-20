import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { PaymentClient } from "@/components/fleet/PaymentClient";
import { SiteNav } from "@/components/shared/SiteNav";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { getCheckoutPaymentMethodFlags } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إتمام الدفع | Rawaes",
  description: "اختر طريقة الدفع وأكمل حجز السيارة.",
};

export default async function FleetPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [booking, paymentMethodFlags] = await Promise.all([
    getBookingForPayment(id),
    getCheckoutPaymentMethodFlags(),
  ]);
  if (!booking) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-24 pb-20">
        <PaymentClient booking={booking} paymentMethodFlags={paymentMethodFlags} />
      </div>
      <SiteFooter />
    </div>
  );
}
