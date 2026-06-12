import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { PaymentClient } from "@/components/fleet/PaymentClient";
import { SiteNav } from "@/components/shared/SiteNav";
import { requireCustomerPaymentPageAccess } from "@/lib/customer-booking-access";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { getCheckoutPaymentMethodFlags } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "إتمام الدفع",
  description: "اختر طريقة الدفع وأكمل حجز السيارة.",
  noIndex: true,
});

export default async function FleetPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  await requireCustomerPaymentPageAccess(id);

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
