import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { PaymentClient } from "@/components/fleet/PaymentClient";
import { SiteNav } from "@/components/shared/SiteNav";
import { requireCustomerPaymentPageAccess } from "@/lib/customer-booking-access";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { geideaCheckoutScriptUrl, isGeideaConfigured } from "@/lib/geidea/client";
import { reconcilePendingGeideaPaymentById } from "@/lib/geidea/mark-paid";
import { reconcilePendingTabbyPaymentById } from "@/lib/tabby/mark-paid";
import { amkanAmountLimitsOrNull } from "@/lib/amkan/client";
import { reconcilePendingAmkanPaymentById } from "@/lib/amkan/mark-paid";
import {
  getApplePayExpressEnabled,
  getCheckoutPaymentMethodFlags,
  getPaymentIconUrls,
} from "@/lib/site-settings";
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

  // مصالحة: لو العميل عاد من البوابة (جيديا أو تابي أو إمكان) قبل وصول الـ webhook،
  // تُجلب حالة الدفع مباشرةً من البوابة ويُعلَّم الحجز مدفوعاً قبل عرض الصفحة.
  await Promise.all([
    reconcilePendingGeideaPaymentById(id),
    reconcilePendingTabbyPaymentById(id),
    reconcilePendingAmkanPaymentById(id),
  ]);

  const [booking, paymentMethodFlags, applePayExpress, paymentIconUrls, amkanLimits] = await Promise.all([
    getBookingForPayment(id),
    getCheckoutPaymentMethodFlags(),
    getApplePayExpressEnabled(),
    getPaymentIconUrls(),
    amkanAmountLimitsOrNull(),
  ]);
  if (!booking) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-24 pb-20">
        <PaymentClient
          booking={booking}
          paymentMethodFlags={paymentMethodFlags}
          hostedCheckout={isGeideaConfigured()}
          // معطّلاً يبقى null فيسقط Apple Pay تلقائياً إلى التحويل لصفحة جيديا.
          geideaScriptUrl={applePayExpress ? geideaCheckoutScriptUrl() : null}
          paymentIconUrls={paymentIconUrls}
          amkanLimits={amkanLimits}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
