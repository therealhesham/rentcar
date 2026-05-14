import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutCustomer } from "@/app/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { AccountBookingCardActions } from "@/components/account/AccountBookingCardActions";
import { getCustomerProfile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { computeCancellationRefundBreakdown } from "@/lib/booking-cancellation-refund";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  computeCancellationDeductedDays,
  hoursBeforePickup,
} from "@/lib/cancellation-deduct";
import {
  getCustomerCancellationPolicyAr,
  getCustomerCancelMinHoursBeforePickup,
  getCustomerCancellationDeductTiers,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";

function profileInitials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "؟";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`;
  }
  return trimmed.slice(0, 2);
}

function bookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "جديد",
    PENDING: "قيد المراجعة",
    CONFIRMED: "مؤكد",
    APPROVED: "مؤكد",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغى",
    REJECTED: "مرفوض",
  };
  const key = status.trim().toUpperCase();
  return map[key] ?? status;
}

function bookingPaymentPillClass(paymentStatus: string): string {
  const k = paymentStatus.trim().toUpperCase();
  if (k === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (k === "REFUNDED") return "border-sky-200 bg-sky-50 text-sky-950";
  if (k === "PARTIAL_REFUND") return "border-violet-200 bg-violet-50 text-violet-950";
  if (k === "NO_REFUND") return "border-neutral-300 bg-neutral-100 text-neutral-900";
  return "border-orange-200 bg-orange-50 text-orange-900";
}

function bookingPaymentPillLabel(paymentStatus: string): string {
  const k = paymentStatus.trim().toUpperCase();
  if (k === "PAID") return "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

function bookingStatusStyles(status: string): string {
  const key = status.trim().toUpperCase();
  if (key === "NEW" || key === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  if (key === "CONFIRMED" || key === "APPROVED" || key === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  }
  if (key === "CANCELLED" || key === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  return "border-neutral-200 bg-neutral-100 text-on-surface";
}

export default async function AccountDashboardPage() {
  const profile = await getCustomerProfile();
  if (!profile) redirect("/account/login");

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      OR: [
        { customerId: profile.id },
        ...(profile.phone ? [{ phone: profile.phone }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      carModel: { include: { brand: true } },
    },
  });

  const [cancellationPolicyAr, cancelMinHoursBeforePickup, cancellationDeductTiers] =
    await Promise.all([
      getCustomerCancellationPolicyAr(),
      getCustomerCancelMinHoursBeforePickup(),
      getCustomerCancellationDeductTiers(),
    ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <header className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg sm:p-8 editorial-shadow">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003749] to-[#163332] text-2xl font-black text-white shadow-inner ring-4 ring-[#dbb878]/35"
                aria-hidden
              >
                {profileInitials(profile.name)}
              </div>
              <div className="text-center sm:text-start">
                <p className="text-xs font-bold uppercase tracking-wide text-[#775927]">
                  حساب العميل
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">
                  حسابي
                </h1>
                <p className="mt-2 text-base font-semibold text-on-surface">
                  {profile.name ?? "—"}
                </p>
                <p className="mt-1 text-sm tabular-nums text-on-surface-variant" dir="ltr">
                  {profile.email}
                </p>
                {profile.phone ? (
                  <p className="mt-1 text-sm font-bold tabular-nums text-[#003749]" dir="ltr">
                    {profile.phone}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:flex-col sm:items-stretch">
              <Link
                href="/fleet"
                className="inline-flex items-center justify-center rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-opacity hover:opacity-95"
              >
                احجز الآن
              </Link>
              <Link
                href="/subscriptions"
                className="inline-flex items-center justify-center rounded-xl border border-[#163332]/25 bg-[#f0fbfb] px-5 py-2.5 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:bg-white"
              >
                الاشتراك الشهري
              </Link>
              <Link
                href="/account/subscription"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-neutral-50"
              >
                اشتراكي
              </Link>
              <form action={logoutCustomer} className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-neutral-50"
                >
                  خروج
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200/80 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#003749]">حجوزاتي</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-on-surface-variant">
                تظهر الطلبات المرتبطة بحسابك أو بنفس رقم الجوال المسجّل.
              </p>
            </div>
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold tabular-nums text-on-surface-variant shadow-sm">
              {bookings.length} طلب
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center shadow-sm editorial-shadow">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbb878]/25 text-[#775927]">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
                  <path
                    d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-10 0h12m-12 0a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold text-on-surface">لا توجد حجوزات بعد</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
                ابدأ بتصفّح المركبات المتاحة واحجز ما يناسبك في خطوات بسيطة.
              </p>
              <Link
                href="/fleet"
                className="mt-6 inline-flex rounded-xl bg-[#003749] px-6 py-3 text-sm font-extrabold text-white shadow-md transition-opacity hover:opacity-95"
              >
                تصفح الأسطول
              </Link>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {bookings.map((b) => {
                const bookingSt = b.status.trim().toUpperCase();
                let cancellationFinancePreview: {
                  paidInclTax: number;
                  refundInclTax: number;
                  methodLabel: string;
                } | null = null;
                if (
                  b.kind === "DIRECT" &&
                  b.paymentStatus.trim().toUpperCase() === "PAID" &&
                  b.carModel &&
                  bookingSt !== "CANCELLED" &&
                  bookingSt !== "REJECTED"
                ) {
                  const h = hoursBeforePickup(b.pickupDate, new Date());
                  const deduct = computeCancellationDeductedDays(
                    h,
                    cancellationDeductTiers,
                    b.numberOfDays,
                  );
                  const br = computeCancellationRefundBreakdown({
                    numberOfDays: b.numberOfDays,
                    deductDays: deduct,
                    pricePerDayExclTax: b.carModel.price,
                    vatRatePercent: b.carModel.vatRatePercent,
                    addonsJson: b.addonsJson,
                  });
                  if (br) {
                    cancellationFinancePreview = {
                      paidInclTax: br.paidTotalInclTax,
                      refundInclTax: br.refundInclTax,
                      methodLabel: bookingPaymentMethodLabelAr(b.paymentMethod),
                    };
                  }
                }

                const rowRefund = b as typeof b & {
                  cancellationRefundAmountSar?: number | null;
                  cancellationRefundExternalRef?: string | null;
                };

                return (
                <li key={b.id}>
                  <article className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md editorial-shadow">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-extrabold leading-snug text-[#003749]">
                          {b.kind === "DIRECT" && b.carModel
                            ? `${b.carModel.brand.name} ${b.carModel.name}`
                            : b.carType}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-lg bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                            {b.kind === "DIRECT" ? "حجز مباشر" : "طلب حجز"}
                          </span>
                          <span className="text-xs tabular-nums text-on-surface-variant" dir="ltr">
                            #{b.id}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${bookingStatusStyles(b.status)}`}
                        >
                          {bookingStatusLabel(b.status)}
                        </span>
                        {b.kind === "DIRECT" ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${bookingPaymentPillClass(b.paymentStatus)}`}
                          >
                            {bookingPaymentPillLabel(b.paymentStatus)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-4 text-xs tabular-nums text-on-surface-variant">
                      <span dir="ltr" className="inline-flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#775927]" aria-hidden>
                          <path
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        الاستلام: {b.pickupDate.toLocaleString("ar-SA")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-on-surface">
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#775927]" aria-hidden>
                          <path
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        {b.numberOfDays} يوم
                      </span>
                    </div>

                    <AccountBookingCardActions
                      cancellationPolicyAr={cancellationPolicyAr}
                      cancelMinHoursBeforePickup={cancelMinHoursBeforePickup}
                      cancellationDeductTiers={cancellationDeductTiers}
                      cancellationFinancePreview={cancellationFinancePreview}
                      booking={{
                        id: b.id,
                        kind: b.kind,
                        carModelId: b.carModelId,
                        pickupDateIso: b.pickupDate.toISOString(),
                        numberOfDays: b.numberOfDays,
                        pickupMode: b.pickupMode,
                        branch: b.branch,
                        deliveryLat: b.deliveryLat,
                        deliveryLng: b.deliveryLng,
                        deliveryAddress: b.deliveryAddress,
                        paymentStatus: b.paymentStatus,
                        paymentMethod: b.paymentMethod,
                        status: b.status,
                        cancellationDeductedDays: b.cancellationDeductedDays ?? null,
                        cancellationRefundAmountSar: rowRefund.cancellationRefundAmountSar ?? null,
                        cancellationRefundExternalRef: rowRefund.cancellationRefundExternalRef ?? null,
                      }}
                    />
                  </article>
                </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
