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
import {
  bookingDaysPriceInputFromSnapshot,
  bookingTotalInclTaxForDays,
} from "@/lib/booking-edit";
import type { BookingEditModalData } from "@/components/account/BookingEditModal";
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
      carModel: { include: { brand: true, category: true } },
      pickupBranch: { select: { slug: true, name: true } },
      returnBranch: { select: { slug: true, name: true } },
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
      balanceDueAtBranchSar?: number | null;
    };

    const returnDate = addDays(b.pickupDate, b.numberOfDays);
    const modeLabel = pickupModeLabel(b.pickupMode);
    const carImage = b.kind === "DIRECT" ? (b.carModel?.image?.trim() || null) : null;
    const carName =
      b.kind === "DIRECT" && b.carModel
        ? `${b.carModel.brand.name} ${b.carModel.name}`.trim()
        : (b.carType ?? "مركبة");
    const categoryTitle = b.carModel?.category?.title ?? null;
    const pickupBranchName = b.pickupBranch?.name ?? null;
    const returnBranchName = b.returnBranch?.name ?? null;
    const balanceDue = typeof rowRefund.balanceDueAtBranchSar === "number"
      ? rowRefund.balanceDueAtBranchSar
      : 0;
    const isTerminalCard = bookingSt === "CANCELLED" || bookingSt === "REJECTED";

    let editData: BookingEditModalData | null = null;
    const nowMs = Date.now();
    const bookingEndMs = b.pickupDate.getTime() + b.numberOfDays * 24 * 60 * 60 * 1000;
    if (
      b.kind === "DIRECT" &&
      b.carModel &&
      !isTerminalCard &&
      bookingSt !== "COMPLETED" &&
      nowMs < bookingEndMs
    ) {
      const priceInput = bookingDaysPriceInputFromSnapshot(
        b.carModel.price,
        b.carModel.vatRatePercent,
        b.addonsJson,
      );
      editData = {
        bookingId: b.id,
        carName,
        carImage,
        carAlt: b.carModel.alt ?? carName,
        categoryTitle,
        branchName: returnBranchName ?? pickupBranchName ?? null,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        started: b.pickupDate.getTime() <= nowMs,
        pickupIso: b.pickupDate.toISOString(),
        numberOfDays: b.numberOfDays,
        priceInput,
        oldTotalInclTax: bookingTotalInclTaxForDays(priceInput, b.numberOfDays),
      };
    }

    return (
      <li key={b.id}>
        <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#003749]/10 editorial-shadow">

          {/* صورة السيارة / رأس البطاقة */}
          <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-[#e8f4f5] to-[#d6eaeb]">
            {carImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={carImage}
                alt={carName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg viewBox="0 0 64 40" fill="none" className="h-20 w-32 text-[#003749]/20" aria-hidden>
                  <rect x="4" y="14" width="56" height="20" rx="6" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M12 14l6-10h28l6 10" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                  <circle cx="16" cy="34" r="5" stroke="currentColor" strokeWidth="2.5" />
                  <circle cx="48" cy="34" r="5" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>
            )}
            {/* تدرج من الأسفل يفصل الصورة عن المحتوى */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-transparent" aria-hidden />
            {/* شارة الحالة فوق الصورة */}
            <div className="absolute right-3 top-3 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm backdrop-blur-sm ${bookingStatusStyles(b.status)}`}
              >
                {bookingStatusLabelAr(b.status)}
              </span>
              {b.kind === "DIRECT" ? (
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm backdrop-blur-sm ${bookingPaymentPillClass(b.paymentStatus)}`}
                >
                  {bookingPaymentPillLabel(b.paymentStatus, b.paymentMethod)}
                </span>
              ) : null}
            </div>
            {/* رقم الحجز أسفل يسار */}
            <span
              className="absolute bottom-2 left-3 font-mono text-[11px] font-bold tabular-nums text-[#003749]/60"
              dir="ltr"
            >
              #{b.id}
            </span>
            {/* شارة المبلغ المستحق — overlay أسفل يمين الصورة */}
            {balanceDue > 0 && !isTerminalCard ? (
              <div className="absolute bottom-2 right-3 flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 shrink-0 text-amber-600" aria-hidden>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-black tabular-nums text-amber-900" dir="ltr">
                  {balanceDue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ﷼
                </span>
              </div>
            ) : null}
          </div>

          {/* جسم البطاقة */}
          <div className="flex flex-1 flex-col gap-4 p-5">
            {/* اسم السيارة والفئة */}
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                  {b.kind === "DIRECT" ? "حجز مباشر" : "طلب حجز"}
                </span>
                {categoryTitle ? (
                  <span className="inline-flex rounded-md bg-[#f0fbfb] px-2 py-0.5 text-[11px] font-bold text-[#003749]">
                    {categoryTitle}
                  </span>
                ) : null}
                {modeLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fffbf2] px-2 py-0.5 text-[11px] font-bold text-[#775927]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                      <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    {modeLabel}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-lg font-extrabold leading-snug text-[#003749]">
                {carName}
              </h3>
            </div>

            {/* معلومات الفروع */}
            {(pickupBranchName || returnBranchName) ? (
              <div className="flex items-center gap-2 text-xs">
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#775927]" aria-hidden>
                  <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="font-semibold text-on-surface-variant">
                  {pickupBranchName && returnBranchName && pickupBranchName !== returnBranchName ? (
                    <>{pickupBranchName} <span className="mx-1 text-neutral-400">←</span> {returnBranchName}</>
                  ) : (
                    pickupBranchName ?? returnBranchName
                  )}
                </span>
              </div>
            ) : null}

            {/* مخطط التواريخ */}
            <div className="rounded-2xl border border-neutral-100 bg-gradient-to-br from-neutral-50/80 to-white p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">الاستلام</p>
                  <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBookingDate(b.pickupDate)}</p>
                  <p className="text-[11px] tabular-nums text-on-surface-variant" dir="ltr">{formatBookingTime(b.pickupDate)}</p>
                </div>
                <div className="relative flex shrink-0 flex-col items-center justify-center px-1">
                  <span className="absolute top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-neutral-300" aria-hidden />
                  <span className="relative inline-flex items-center gap-1 rounded-full bg-[#003749] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {b.numberOfDays} {b.numberOfDays === 1 ? "يوم" : "أيام"}
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-end">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">الإرجاع</p>
                  <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBookingDate(returnDate)}</p>
                  <p className="text-[11px] tabular-nums text-on-surface-variant" dir="ltr">{formatBookingTime(returnDate)}</p>
                </div>
              </div>
            </div>

            <AccountBookingCardActions
              cancellationPolicyAr={cancellationPolicyAr}
              cancelMinHoursBeforePickup={cancelMinHoursBeforePickup}
              cancellationDeductTiers={cancellationDeductTiers}
              cancellationFinancePreview={cancellationFinancePreview}
              editData={editData}
              booking={{
                id: b.id,
                kind: b.kind,
                carModelId: b.carModelId,
                pickupDateIso: b.pickupDate.toISOString(),
                numberOfDays: b.numberOfDays,
                pickupMode: b.pickupMode,
                pickupBranchSlug: b.pickupBranch?.slug ?? null,
                returnBranchSlug: b.returnBranch?.slug ?? b.pickupBranch?.slug ?? "jeddah",
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
          </div>
        </article>
      </li>
    );
  };

  // تحذير رخصة القيادة: تنبيه قبل 30 يوماً من الانتهاء
  const licenseWarning = (() => {
    if (!profile.licenseExpiryDate) return null;
    const expDate = new Date(profile.licenseExpiryDate);
    if (Number.isNaN(expDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    if (diffDays <= 0) return { kind: "expired" as const, diffDays };
    if (diffDays <= 30) return { kind: "soon" as const, diffDays };
    return null;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface" dir="rtl">
      <SiteNav active="home" />
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-16 pt-28 sm:px-6">

        {/* ────── هيدر الملف الشخصي ────── */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003749] via-[#013040] to-[#163332] shadow-2xl">
          {/* خلفية زخرفية */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#dbb878]/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-[#dbb878]/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden />

          <div className="relative px-6 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              {/* معلومات العميل */}
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative shrink-0">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6be82] to-[#c9a356] text-2xl font-black text-[#003749] shadow-lg ring-4 ring-white/15">
                    {profileInitials(profile.name)}
                  </div>
                  {/* نقطة خضراء تدل على نشاط الحساب */}
                  <span className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-2 border-[#013040] bg-emerald-400" aria-hidden />
                </div>
                <div className="text-center sm:text-start">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#e6be82]/80">حساب العميل</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {profile.name ?? "عميلنا العزيز"}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
                    {profile.email ? (
                      <span className="flex items-center gap-1.5 text-sm text-white/60" dir="ltr">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        {profile.email}
                      </span>
                    ) : null}
                    {profile.phone ? (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-white/90" dir="ltr">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                          <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        {profile.phone}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:flex-col sm:items-stretch sm:gap-2">
                <Link
                  href="/subscriptions"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#dbb878] to-[#e6be82] px-5 py-2.5 text-sm font-extrabold text-[#003749] shadow-md transition-all hover:shadow-lg hover:brightness-105"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  الاشتراك الشهري
                </Link>
                <Link
                  href="/account/subscription"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  اشتراكي
                </Link>
                <form action={logoutCustomer}>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    تسجيل الخروج
                  </button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* ────── تحذير رخصة القيادة ────── */}
        {licenseWarning ? (
          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-bold leading-relaxed ${
              licenseWarning.kind === "expired"
                ? "border-red-300/70 bg-red-50 text-red-900"
                : "border-amber-300/70 bg-amber-50 text-amber-950"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              {licenseWarning.kind === "expired"
                ? "رخصة قيادتك منتهية الصلاحية — لا يمكن إتمام حجوزات جديدة حتى يتم تجديدها."
                : `تنتهي رخصة قيادتك خلال ${licenseWarning.diffDays} ${licenseWarning.diffDays === 1 ? "يوم" : "أيام"} — تأكد من تجديدها قبل موعد الإرجاع.`}
            </span>
          </div>
        ) : null}

        {/* ────── قسم الحجوزات ────── */}
        <section className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#003749]">حجوزاتي</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                الطلبات المرتبطة بحسابك أو بنفس رقم الجوال المسجّل.
              </p>
            </div>
            <Link
              href="/fleet"
              className="inline-flex items-center gap-2 rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              حجز جديد
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dbb878]/20 text-[#775927]">
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden>
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-base font-bold text-on-surface">لا توجد حجوزات بعد</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
                ابدأ بتصفّح المركبات المتاحة واحجز ما يناسبك في خطوات بسيطة.
              </p>
              <Link
                href="/fleet"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#003749] px-7 py-3 text-sm font-extrabold text-white shadow-md transition-opacity hover:opacity-95"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                تصفح الأسطول
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {upcomingBookings.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                    </span>
                    <h3 className="font-extrabold text-[#003749]">الحجوزات النشطة والقادمة</h3>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-emerald-800">
                      {upcomingBookings.length}
                    </span>
                  </div>
                  <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {upcomingBookings.map(renderBookingCard)}
                  </ul>
                </div>
              ) : null}

              {pastBookings.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-neutral-400" aria-hidden />
                    <h3 className="font-extrabold text-[#003749]">حجوزات سابقة</h3>
                    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-neutral-600">
                      {pastBookings.length}
                    </span>
                  </div>
                  <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
