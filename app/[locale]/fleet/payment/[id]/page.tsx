import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { PaymentClient } from "@/components/fleet/PaymentClient";
import { SiteNav } from "@/components/shared/SiteNav";
import { requireCustomerPaymentPageAccess } from "@/lib/customer-booking-access";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { geideaCheckoutScriptUrl, isGeideaConfigured } from "@/lib/geidea/client";
import { reconcilePendingGeideaPaymentById } from "@/lib/geidea/mark-paid";
import { reconcilePendingTabbyPaymentById } from "@/lib/tabby/mark-paid";
import { checkTabbyEligibility, getTabbyConfig, type TabbyEligibility } from "@/lib/tabby/client";
import {
  getApplePayExpressEnabled,
  getCheckoutPaymentMethodFlags,
  getPaymentIconUrls,
} from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

// ديناميكي لا ثابت: العنوان يتبع لغة الزائر مثل محتوى الصفحة.
export async function generateMetadata() {
  const t = await getTranslations("Payment");
  return buildPageMetadata({
    title: t("title"),
    description: t("metaDescription"),
    noIndex: true,
  });
}

export default async function FleetPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  await requireCustomerPaymentPageAccess(id);

  // مصالحة: لو العميل عاد من البوابة (جيديا أو تابي) قبل وصول الـ webhook، تُجلب حالة الدفع
  // مباشرةً من البوابة ويُعلَّم الحجز مدفوعاً قبل عرض الصفحة.
  await Promise.all([
    reconcilePendingGeideaPaymentById(id),
    reconcilePendingTabbyPaymentById(id),
  ]);

  const [booking, paymentMethodFlags, applePayExpress, paymentIconUrls] = await Promise.all([
    getBookingForPayment(id),
    getCheckoutPaymentMethodFlags(),
    getApplePayExpressEnabled(),
    getPaymentIconUrls(),
  ]);
  if (!booking) notFound();

  const tabbyCfg = getTabbyConfig();
  const tabbyPromo = tabbyCfg
    ? { publicKey: tabbyCfg.publicKey, merchantCode: tabbyCfg.merchantCode }
    : null;

  // فحص أهلية تابي المسبق (pre-scoring) — يُعرض في الواجهة فقط؛ التحقق الملزِم يتكرر
  // وقت الإرسال الفعلي في payment-actions.ts (لا نثق بحالة العميل وحدها).
  let tabbyEligibility: TabbyEligibility | null = null;
  if (tabbyCfg) {
    const ps = booking.paymentStatus.trim().toUpperCase();
    const balanceDueSar = booking.balanceDueAtBranchSar ?? 0;
    const amountSar = ps === "PAID" && balanceDueSar > 0 ? balanceDueSar : booking.totals.totalInclTax;
    if (amountSar > 0) {
      tabbyEligibility = await checkTabbyEligibility({
        amountSar,
        buyer: { phone: booking.phone, email: booking.invoiceEmail, name: booking.fullName },
      });
    }
  }

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
          tabbyPromo={tabbyPromo}
          tabbyEligibility={tabbyEligibility}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
