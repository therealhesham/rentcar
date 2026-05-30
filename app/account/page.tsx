import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutCustomer } from "@/app/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { AccountBookingCardActions } from "@/components/account/AccountBookingCardActions";
import { getCustomerProfile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
import { bookingStatusLabelAr } from "@/lib/booking-display-labels";
import { computeCancellationRefundBreakdown } from "@/lib/booking-cancellation-refund";
import { resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
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

function formatBookingDate(date: Date): string {
  return date.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBookingTime(date: Date): string {
  return date.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function pickupModeLabel(mode: string | null | undefined): string | null {
  const k = mode?.trim().toLowerCase();
  if (!k) return null;
  if (k === "delivery") return "توصيل للعميل";
  if (k === "branch" || k === "pickup") return "استلام من الفرع";
  return null;
}

function bookingPaymentPillClass(paymentStatus: string): string {
  const k = paymentStatus.trim().toUpperCase();
  if (k === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (k === "REFUNDED") return "border-sky-200 bg-sky-50 text-sky-950";
  if (k === "PARTIAL_REFUND") return "border-violet-200 bg-violet-50 text-violet-950";
  if (k === "NO_REFUND") return "border-neutral-300 bg-neutral-100 text-neutral-900";
  return "border-orange-200 bg-orange-50 text-orange-900";
}

function bookingPaymentPillLabel(
  paymentStatus: string,
  paymentMethod: string | null | undefined,
): string {
  const k = paymentStatus.trim().toUpperCase();
  if (k === "PAID") return "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  if (isCashPaymentMethod(paymentMethod)) return "الدفع عند الفرع";
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
      pickupBranch: { select: { slug: true } },
      returnBranch: { select: { slug: true } },
    },
  });

  const [cancellationPolicyAr, cancelMinHoursBeforePickup, cancellationDeductTiers] =
    await Promise.all([
      getCustomerCancellationPolicyAr(),
      getCustomerCancelMinHoursBeforePickup(),
      getCustomerCancellationDeductTiers(),
    ]);

  type BookingRow = (typeof bookings)[number];

  const isPastOrTerminal = (b: BookingRow): boolean => {
    const k = b.status.trim().toUpperCase();
    return k === "CANCELLED" || k === "REJECTED" || k === "COMPLETED";
  };

  const upcomingBookings = bookings.filter((b) => !isPastOrTerminal(b));
  const pastBookings = bookings.filter((b) => isPastOrTerminal(b));

  const renderBookingCard = (b: BookingRow) => {
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
        pricePerDayExclTax: resolveBookingRentalPricePerDayExclTax(
          b.carModel.price,
          b.addonsJson,
        ),
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

    const returnDate = addDays(b.pickupDate, b.numberOfDays);
    const modeLabel = pickupModeLabel(b.pickupMode);

    return (
      <li key={b.id}>
        <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:border-[#003749]/15 hover:shadow-xl hover:ring-[#dbb878]/20 editorial-shadow">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#003749] via-[#dbb878] to-[#003749] opacity-80"
            aria-hidden
          />
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f0fbfb] to-[#e6f4f4] text-[#003749] ring-1 ring-[#003749]/10"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <path
                  d="M5 16v2m14-2v2M4.5 11l1.2-3.6A2 2 0 017.6 6h8.8a2 2 0 011.9 1.4L19.5 11M5 16h14a1 1 0 001-1v-2.5a1.5 1.5 0 00-1.5-1.5h-13A1.5 1.5 0 004 12.5V15a1 1 0 001 1z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="7.5" cy="14" r="0.5" fill="currentColor" stroke="currentColor" />
                <circle cx="16.5" cy="14" r="0.5" fill="currentColor" stroke="currentColor" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold leading-snug text-[#003749]">
                {b.kind === "DIRECT" && b.carModel
                  ? `${b.carModel.brand.name} ${b.carModel.name}`
                  : b.carType}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                  {b.kind === "DIRECT" ? "حجز مباشر" : "طلب حجز"}
                </span>
                {modeLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#f0fbfb] px-2 py-0.5 text-[11px] font-bold text-[#003749]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                      <path
                        d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    {modeLabel}
                  </span>
                ) : null}
                <span className="text-[11px] tabular-nums text-on-surface-variant/80" dir="ltr">
                  #{b.id}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${bookingStatusStyles(b.status)}`}
              >
                {bookingStatusLabelAr(b.status)}
              </span>
              {b.kind === "DIRECT" ? (
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${bookingPaymentPillClass(b.paymentStatus)}`}
                >
                  {bookingPaymentPillLabel(b.paymentStatus, b.paymentMethod)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-100 bg-gradient-to-br from-neutral-50/80 to-white p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 text-start">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  الاستلام
                </p>
                <p className="mt-1 truncate text-sm font-extrabold text-on-surface">
                  {formatBookingDate(b.pickupDate)}
                </p>
                <p className="text-[11px] tabular-nums text-on-surface-variant" dir="ltr">
                  {formatBookingTime(b.pickupDate)}
                </p>
              </div>
              <div className="relative flex flex-1 items-center justify-center px-1">
                <span
                  className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-neutral-300"
                  aria-hidden
                />
                <span className="relative inline-flex items-center gap-1 rounded-full bg-[#003749] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
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
              <div className="min-w-0 text-end">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  الإرجاع
                </p>
                <p className="mt-1 truncate text-sm font-extrabold text-on-surface">
                  {formatBookingDate(returnDate)}
                </p>
                <p className="text-[11px] tabular-nums text-on-surface-variant" dir="ltr">
                  {formatBookingTime(returnDate)}
                </p>
              </div>
            </div>
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
              pickupBranchSlug: b.pickupBranch?.slug ?? null,
              returnBranchSlug:
                b.returnBranch?.slug ?? b.pickupBranch?.slug ?? "jeddah",
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
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003749] via-[#013040] to-[#163332] p-6 shadow-xl sm:p-8">
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#dbb878]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-[#dbb878]/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6be82] to-[#dbb878] text-2xl font-black text-[#003749] shadow-lg ring-4 ring-white/15"
                aria-hidden
              >
                {profileInitials(profile.name)}
              </div>
              <div className="text-center sm:text-start">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e6be82]">
                  حساب العميل
                </p>
                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  مرحباً، {profile.name ?? "عميلنا العزيز"}
                </h1>
                <div className="mt-2 flex flex-col items-center gap-1 text-sm text-white/70 sm:flex-row sm:items-center sm:gap-4">
                  <span className="tabular-nums" dir="ltr">
                    {profile.email}
                  </span>
                  {profile.phone ? (
                    <span className="font-bold tabular-nums text-white" dir="ltr">
                      {profile.phone}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:flex-col sm:items-stretch">
              <Link
                href="/subscriptions"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e6be82] px-5 py-2.5 text-sm font-extrabold text-[#003749] shadow-md transition-transform hover:scale-[1.02]"
              >
                الاشتراك الشهري
              </Link>
              <Link
                href="/account/subscription"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                اشتراكي
              </Link>
              <form action={logoutCustomer} className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-transparent px-5 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                    <path
                      d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
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
            <Link
              href="/fleet"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003749] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              حجز جديد
            </Link>
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
            <div className="mt-6 space-y-10">
              {upcomingBookings.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                    <h3 className="text-sm font-extrabold text-[#003749]">الحجوزات النشطة والقادمة</h3>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">
                      {upcomingBookings.length}
                    </span>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {upcomingBookings.map(renderBookingCard)}
                  </ul>
                </div>
              ) : null}

              {pastBookings.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" aria-hidden />
                    <h3 className="text-sm font-extrabold text-[#003749]">حجوزات سابقة</h3>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-on-surface-variant">
                      {pastBookings.length}
                    </span>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {pastBookings.map(renderBookingCard)}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
