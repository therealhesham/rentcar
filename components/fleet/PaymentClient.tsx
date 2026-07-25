"use client";

import {
  Apple,
  Check,
  CheckCircle2,
  CreditCard,
  Gift,
  Loader2,
  Lock,
  Mail,
  Shield,
  Store,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { BookingStepper } from "@/components/fleet/BookingStepper";
import {
  confirmMockPayment,
  resendBookingInvoice,
  type ConfirmPaymentResult,
} from "@/app/[locale]/fleet/payment/payment-actions";
import type { ResendBookingInvoiceResult } from "@/lib/booking-invoice-email";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import {
  isBookingUnderReview,
  isCashBookingConfirmed,
  isCashCheckoutSubmitted,
  isCashPaymentMethod,
  isInvoiceDeliveryReady,
} from "@/lib/booking-cash-flow";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import {
  listEnabledCheckoutPaymentMethods,
  type CheckoutPaymentMethodFlags,
  type CustomerCheckoutPaymentMethod,
} from "@/lib/checkout-payment-method-flags";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

type Props = {
  booking: BookingPaymentSnapshot;
  paymentMethodFlags: CheckoutPaymentMethodFlags;
  /** عند التفعيل: البطاقة/مدى/Apple Pay تُحوَّل لصفحة الدفع المستضافة (جيديا) — بلا إدخال بطاقة محلي. */
  hostedCheckout?: boolean;
};

export type CheckoutPaymentMethod = CustomerCheckoutPaymentMethod;

function usesCardEntryForm(method: CheckoutPaymentMethod): boolean {
  return method === "CARD" || method === "MADA";
}

function maskPhone(p: string): string {
  if (p.length <= 4) return p;
  return `${"•".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(1, local.length - visible.length))}${domain}`;
}

function fmtWhen(d: Date): { date: string; time: string } {
  return {
    date: d.toLocaleDateString("ar-SA", { year: "numeric", month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
  };
}

function luhnOk(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

const BRANCH_LABEL_AR: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

type MethodOption =
  | {
      id: CheckoutPaymentMethod;
      title: string;
      hint: string;
      logoSrc: string;
    }
  | {
      id: CheckoutPaymentMethod;
      title: string;
      hint: string;
      Icon: typeof CreditCard;
    };



const METHOD_OPTIONS: MethodOption[] = [
  {
    id: "TABBY",
    title: "تابي",
    hint: "تقسيط على دفعات — يُفعَّل ربط بوابة تابي لاحقاً",
    logoSrc: "/tabby.png",
  },
  {
    id: "TAMARA",
    title: "تمارا",
    hint: "تقسيط حسب شروط تمارا — يُفعَّل الربط لاحقاً",
    logoSrc: "/tamara.png",
  },
  {
    id: "CARD",
    title: "بطاقة ائتمانية",
    hint: "فيزا، ماستركارد — بوابة الدفع بالبطاقة",
    Icon: CreditCard,
  },
  {
    id: "MADA",
    title: "مدى",
    hint: "الدفع ببطاقة مدى",
    Icon: CreditCard,
  },
  {
    id: "AMKAN",
    title: "إمكان",
    hint: "خدمة إمكان للدفع",
    Icon: Wallet,
  },
  {
    id: "CASH",
    title: "عند الفرع",
    hint: "",
    Icon: Store,
  },
  {
    id: "APPLE_PAY",
    title: "Apple Pay",
    hint: "دفع سريع من محفظة آبل — يُفعَّل عند ربط البوابة (مثل Stripe أو مزوّد محلي)",
    Icon: Apple,
  },
  {
    id: "POINTS",
    title: "استبدال نقاط",
    hint: "خصم من رصيد نقاط برنامج الولاء — يُربَط بنظام النقاط لاحقاً",
    Icon: Gift,
  },
];

export function PaymentClient({ booking, paymentMethodFlags, hostedCheckout }: Props) {
  const enabledMethods = useMemo(
    () => listEnabledCheckoutPaymentMethods(paymentMethodFlags),
    [paymentMethodFlags],
  );

  const ps = booking.paymentStatus.trim().toUpperCase();
  // وضع «دفع فرق التمديد»: الحجز مدفوع وعليه رصيد بعد تعديل/تمديد — تُعرض
  // طرق الدفع لسداد الرصيد فقط (بلا كاش؛ النقدي يسجّله موظف الفرع).
  const balanceDueSar = Math.round((booking.balanceDueAtBranchSar ?? 0) * 100) / 100;
  const balancePaymentMode = ps === "PAID" && balanceDueSar > 0;
  const paymentFinalized = ps !== "PENDING" && !balancePaymentMode;

  const visibleMethodOptions = useMemo(
    () =>
      METHOD_OPTIONS.filter(
        (opt) =>
          enabledMethods.includes(opt.id) &&
          // في وضع دفع فرق التمديد لا يُعرض «عند الفرع» — الرصيد يُسدَّد أونلاين.
          !(balancePaymentMode && opt.id === "CASH"),
      ),
    [enabledMethods, balancePaymentMode],
  );

  const [state, formAction, pending] = useActionState<ConfirmPaymentResult | null, FormData>(
    confirmMockPayment,
    null,
  );
  const [resendState, resendFormAction, resendPending] = useActionState<
    ResendBookingInvoiceResult | null,
    FormData
  >(resendBookingInvoice, null);
  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    () => enabledMethods[0] ?? "CARD",
  );
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState(booking.fullName);
  const [pointsNote, setPointsNote] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (enabledMethods.includes(method)) return;
    const next = enabledMethods[0];
    if (next) setMethod(next);
  }, [enabledMethods, method]);

  // المبلغ المطلوب سداده الآن: الرصيد فقط في وضع فرق التمديد، وإلا الإجمالي كاملاً.
  const payableAmountSar = balancePaymentMode ? balanceDueSar : booking.totals.totalInclTax;

  const cashSubmitted =
    !balancePaymentMode &&
    (isCashCheckoutSubmitted(booking) ||
      (state?.ok === true && isCashPaymentMethod(state.paymentMethod)));

  const underReview =
    cashSubmitted &&
    (isBookingUnderReview(booking.status) ||
      (state?.ok === true && state.underReview === true));

  const cashConfirmed =
    cashSubmitted && !underReview && isCashBookingConfirmed(booking.status);

  const paid =
    !cashSubmitted &&
    (paymentFinalized || (state?.ok === true && state.underReview !== true));

  const checkoutComplete = cashSubmitted || paid;
  const canResendInvoice = isInvoiceDeliveryReady({
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    status: booking.status,
  });
  const noPaymentMethods = !checkoutComplete && visibleMethodOptions.length === 0;

  const serverError = state && state.ok === false ? state.error : null;

  const resolvedMethodCode =
    booking.paymentMethod ??
    (state?.ok && state.paymentMethod ? state.paymentMethod : null);

  const showAmberSuccessPanel =
    underReview ||
    (cashSubmitted && !cashConfirmed) ||
    ps === "REFUNDED" ||
    ps === "PARTIAL_REFUND" ||
    ps === "NO_REFUND";

  const pickup = useMemo(() => fmtWhen(booking.pickupDate), [booking.pickupDate]);
  const dropoff = useMemo(() => {
    const d = new Date(booking.pickupDate);
    d.setDate(d.getDate() + booking.numberOfDays);
    return fmtWhen(d);
  }, [booking.pickupDate, booking.numberOfDays]);
  const branchLabelAr =
    booking.pickupBranchLabelAr?.trim() || BRANCH_LABEL_AR[booking.branch] || booking.branch;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (checkoutComplete) return;
    setClientError(null);
    if (!usesCardEntryForm(method) || hostedCheckout) return;

    const cardClean = card.replace(/\s+/g, "");
    if (!luhnOk(cardClean)) {
      e.preventDefault();
      setClientError("رقم البطاقة غير صحيح.");
      return;
    }
    const exp = expiry.replace(/\D/g, "");
    if (exp.length !== 4) {
      e.preventDefault();
      setClientError("صلاحية البطاقة غير صحيحة (MM/YY).");
      return;
    }
    const mm = Number(exp.slice(0, 2));
    if (mm < 1 || mm > 12) {
      e.preventDefault();
      setClientError("صلاحية البطاقة غير صحيحة (MM/YY).");
      return;
    }
    if (cvc.length < 3 || cvc.length > 4) {
      e.preventDefault();
      setClientError("رمز التحقق (CVC) غير صحيح.");
      return;
    }
    if (holder.trim().length < 3) {
      e.preventDefault();
      setClientError("اسم حامل البطاقة قصير.");
      return;
    }
  }

  const submitLabel: ReactNode =
    method === "TABBY"
      ? "المتابعة عبر تابي (تجريبي)"
      : method === "TAMARA"
        ? "المتابعة عبر تمارا (تجريبي)"
        : method === "AMKAN"
          ? "المتابعة عبر إمكان (تجريبي)"
          : method === "POINTS"
            ? "تأكيد استبدال النقاط (تجريبي)"
            : method === "CASH"
              ? (
                  <>
                    تأكيد الحجز (عند الفرع) {formatSarAmount(payableAmountSar)}{" "}
                    <SarCurrencyGlyph />
                  </>
                )
              : method === "APPLE_PAY"
                ? (
                    <>
                      ادفع {formatSarAmount(payableAmountSar)} <SarCurrencyGlyph /> عبر Apple Pay
                    </>
                  )
                : method === "MADA"
                  ? (
                      <>
                        ادفع {formatSarAmount(payableAmountSar)} <SarCurrencyGlyph /> عبر مدى
                      </>
                    )
                  : (
                      <>
                        ادفع {formatSarAmount(payableAmountSar)} <SarCurrencyGlyph />
                      </>
                    );

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Stepper */}
      <BookingStepper
        currentStep={checkoutComplete ? 4 : 3}
        modelId={booking.car.modelId}
        bookingId={booking.id}
      />

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">إتمام الدفع</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b5a3b]">
          طلب الحجز رقم{" "}
          <span dir="ltr" className="tabular-nums font-bold text-[#003749]">
            #{booking.id}
          </span>
          {" — "}
          {underReview
            ? "تم تسجيل طلبك بالدفع نقداً وهو تحت المراجعة — سيتواصل معك فريقنا قريباً لتأكيد الحجز هاتفياً."
            : cashConfirmed
              ? "تم تأكيد حجزك بالدفع نقداً — يُستحق المبلغ عند الاستلام أو في الفرع حسب الاتفاق."
              : cashSubmitted
                ? "تم تسجيل طلبك بالدفع نقداً — سيتابعك فريقنا لإتمام الإجراءات."
                : checkoutComplete
                  ? ps === "REFUNDED"
                    ? `تم استرداد المبلغ بالكامل عبر ${bookingPaymentMethodLabelAr(resolvedMethodCode)}.`
                    : ps === "PARTIAL_REFUND"
                      ? `تم استرداد جزء من المبلغ عبر ${bookingPaymentMethodLabelAr(resolvedMethodCode)}.`
                      : ps === "NO_REFUND"
                        ? "لا يوجد مبلغ مسترد بحسب سياسة الإلغاء."
                        : resolvedMethodCode
                          ? `تم الدفع عبر ${bookingPaymentMethodLabelAr(resolvedMethodCode)}.`
                          : "تم الدفع بنجاح."
                  : balancePaymentMode
                    ? `تم تعديل حجزك ونتج عنه فرق تمديد مستحق ${formatSarAmount(balanceDueSar)} ر.س — اختر وسيلة الدفع لسداده.`
                    : "اختر طريقة الدفع المناسبة وأكمل الإجراء."}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:gap-12">
        <section className="order-2 space-y-6 lg:order-1">
          {checkoutComplete ? (
            <div
              className={`overflow-hidden rounded-3xl border shadow-sm ${
                showAmberSuccessPanel
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
                <div
                  className={`grid size-16 place-items-center rounded-full ${
                    showAmberSuccessPanel
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <CheckCircle2 className="size-9" aria-hidden />
                </div>
                <h2
                  className={`text-lg font-extrabold ${
                    showAmberSuccessPanel ? "text-amber-900" : "text-emerald-800"
                  }`}
                >
                  {underReview
                    ? "تم استلام طلبك"
                    : cashConfirmed
                      ? "تم تأكيد حجزك"
                      : cashSubmitted
                        ? "تم تسجيل طلبك"
                        : ps === "REFUNDED" || ps === "PARTIAL_REFUND" || ps === "NO_REFUND"
                          ? "حالة الدفع بعد الإلغاء"
                          : "تم استلام الدفع"}
                </h2>
                <p
                  className={`max-w-md text-sm leading-relaxed ${
                    showAmberSuccessPanel ? "text-amber-950/80" : "text-emerald-900/80"
                  }`}
                >
                  {underReview
                    ? "شكراً لك! تم تسجيل طلبك بالدفع نقداً. سيتواصل معك فريقنا قريباً لتأكيد الحجز هاتفياً."
                    : cashConfirmed
                      ? "شكراً لك! تم تأكيد حجزك هاتفياً. يُستحق المبلغ نقداً عند الاستلام أو في الفرع حسب الاتفاق."
                      : cashSubmitted
                        ? "شكراً لك! تم تسجيل طلبك بالدفع نقداً."
                        : ps === "REFUNDED" || ps === "PARTIAL_REFUND" || ps === "NO_REFUND"
                          ? "تم تحديث حالة الدفع وفق سياسة الإلغاء. للاستفسار تواصل مع فريق الدعم."
                          : "شكراً لك! تم تأكيد حجزك وسيتواصل معك فريقنا قريباً لتأكيد التسليم وأي إجراءات إضافية."}
                </p>
                <p
                  dir="ltr"
                  className="rounded-xl bg-white/70 px-4 py-2 text-sm font-extrabold tabular-nums text-[#003749]"
                >
                  #{booking.id}
                </p>
                {resolvedMethodCode ? (
                  <p
                    className={`text-sm font-bold ${
                      showAmberSuccessPanel ? "text-amber-900" : "text-emerald-900"
                    }`}
                  >
                    طريقة الدفع: {bookingPaymentMethodLabelAr(resolvedMethodCode)}
                  </p>
                ) : null}
                <dl className="mt-3 grid w-full max-w-md gap-3 text-start text-xs sm:text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <dt className="text-on-surface-variant">الاسم</dt>
                      <dd className="font-bold text-[#003749]">{booking.fullName}</dd>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <dt className="text-on-surface-variant">الجوال</dt>
                      <dd className="tabular-nums font-bold text-[#003749]" dir="ltr">
                        {maskPhone(booking.phone)}
                      </dd>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <dt className="text-on-surface-variant">
                      {booking.pickupMode === "DELIVERY" ? "موقع التوصيل" : "الفرع"}
                    </dt>
                    <dd className="mt-0.5 text-[#003749]">
                        {booking.pickupMode === "DELIVERY" ? (
                          <span className="flex flex-col gap-1">
                            {booking.deliveryAddress?.trim() ? (
                              <span className="whitespace-pre-wrap font-bold">
                                {booking.deliveryAddress.trim()}
                              </span>
                            ) : null}
                            {booking.deliveryLat != null && booking.deliveryLng != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${booking.deliveryLat},${booking.deliveryLng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-emerald-800 underline"
                                dir="ltr"
                              >
                                فتح الخريطة
                              </a>
                            ) : !booking.deliveryAddress?.trim() ? (
                              <span className="text-on-surface-variant">—</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="font-bold">
                            {branchLabelAr}
                          </span>
                        )}
                    </dd>
                  </div>
                </dl>
               
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95"
                  >
                    العودة للرئيسية
                  </Link>
                  <Link
                    href="/fleet"
                    className="rounded-xl border border-[#003749] px-5 py-2.5 text-sm font-extrabold text-[#003749] hover:bg-[#003749]/5"
                  >
                    تصفح الأسطول
                  </Link>
                </div>
              </div>
            </div>
          ) : noPaymentMethods ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
              <p className="font-extrabold text-amber-950">لا توجد طرق دفع متاحة حالياً</p>
              <p className="mt-2 text-sm text-amber-950/80">
                تواصل مع فريق الحجز لإتمام الدفع، أو حاول لاحقاً بعد تفعيل الطرق من الإدارة.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95"
              >
                العودة للرئيسية
              </Link>
            </div>
          ) : (
            <form
              action={formAction}
              onSubmit={onSubmit}
              className="space-y-5 rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-sm sm:p-8"
            >
              <input type="hidden" name="bookingRequestId" value={booking.id} />
              <input type="hidden" name="paymentMethod" value={method} />

              <header className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#003749]">
                    {balancePaymentMode ? "سداد فرق التمديد" : "طرق الدفع"}
                  </h2>

                </div>
                <p className="text-xs text-on-surface-variant">
                  يمكن للعميل الدفع عبر تابي أو تمارا أو بطاقة ائتمانية أو Apple Pay أو استبدال نقاط. الربط
                  الفعلي مع مزوّدي الخدمة يُضاف لاحقاً دون تغيير مسار الحجز.
                </p>
              </header>

              {balancePaymentMode ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <div className="flex items-center justify-between gap-3 font-extrabold">
                    <span>فرق التمديد المستحق الآن</span>
                    <span className="tabular-nums" dir="ltr">
                      {formatSarAmount(balanceDueSar)} <SarCurrencyGlyph className="inline h-[0.85em] w-[0.85em]" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    حجزك مدفوع سابقاً — المطلوب سداد فرق التعديل/التمديد فقط. يمكنك أيضاً دفعه
                    نقداً لدى موظف الفرع عند الاستلام.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="طريقة الدفع">
                {visibleMethodOptions.map((opt) => {
                  const on = method === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={opt.title}
                      onClick={() => {
                        setMethod(opt.id);
                        setClientError(null);
                      }}
                      className={`relative flex flex-col items-start gap-2 rounded-xl border px-4 py-3 text-start transition-all ${
                        on
                          ? "border-[#dbb878] bg-[#003749]/[0.04] ring-2 ring-[#dbb878]/35"
                          : "border-[#ebe4d3] bg-white hover:border-[#dbb878]/40 hover:shadow-sm"
                      }`}
                    >
                      {on ? (
                        <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-[#003749] text-white">
                          <Check className="size-3" aria-hidden />
                        </span>
                      ) : null}
                      <span className="flex w-full flex-wrap items-center gap-3 pe-6">
                        {"logoSrc" in opt ? (
                          <span className="relative flex h-10 shrink-0 items-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/[0.06]">
                            <Image
                              src={opt.logoSrc}
                              alt=""
                              width={152}
                              height={48}
                              className="h-10 w-auto max-w-[min(100%,152px)] object-contain object-center"
                              sizes="152px"
                              priority={opt.id === "TABBY"}
                            />
                          </span>
                        ) : (
                          <>
                            <span
                              className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${
                                on
                                  ? "bg-[#003749]/[0.06] ring-[#dbb878]/40"
                                  : "bg-neutral-50 ring-black/[0.06]"
                              }`}
                            >
                              <opt.Icon
                                className={`size-5 ${on ? "text-[#003749]" : "text-neutral-500"}`}
                                aria-hidden
                              />
                            </span>
                            <span className="font-extrabold text-[#003749]">{opt.title}</span>
                          </>
                        )}
                      </span>
                      {opt.hint ? (
                        <span className="text-[11px] leading-snug text-on-surface-variant">{opt.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {method === "TABBY" ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                  <p className="font-bold">تابي</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    بعد التفعيل، سيتم تحويل العميل إلى صفحة تابي لاختيار خطة التقسيط والموافقة على الشروط.
                    المبلغ المعروض هنا هو الإجمالي شاملاً الضريبة.
                  </p>
                </div>
              ) : null}

              {method === "TAMARA" ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <p className="font-bold">تمارا</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    بعد التفعيل، سيتم فتح جلسة تمارا لإتمام التقسيط وفق سياساتهم. يمكن دمجها مع عروض
                    الشركة لاحقاً.
                  </p>
                </div>
              ) : null}

              {method === "APPLE_PAY" ? (
                <div className="rounded-xl border border-neutral-800/15 bg-neutral-900/[0.04] px-4 py-3 text-sm text-neutral-900">
                  <p className="font-bold">Apple Pay</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    بعد التفعيل، ستُعرض جلسة Apple Pay (عبر البوابة المدعومة) لإتمام الدفع من iPhone أو
                    Mac أو Apple Watch. الوضع الحالي تجريبي ويُسجَّل الطلب كمدفوع للاختبار.
                  </p>
                </div>
              ) : null}

              {method === "POINTS" ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-950">استبدال نقاط</p>
                  <p className="text-xs leading-relaxed text-amber-950/85">
                    أدخل ملاحظة اختيارية (مثلاً رقم العضوية أو النقاط المراد استخدامها). ربط نظام النقاط
                    الفعلي يُضاف على الخادم لاحقاً.
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-amber-950/80">ملاحظة (اختياري)</span>
                    <textarea
                      value={pointsNote}
                      onChange={(e) => setPointsNote(e.target.value)}
                      rows={2}
                      className="rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/40"
                      placeholder="مثال: استخدام 5000 نقطة من برنامج الولاء"
                      dir="rtl"
                    />
                  </label>
                </div>
              ) : null}

              {usesCardEntryForm(method) && !hostedCheckout ? (
                <div className="space-y-4 border-t border-neutral-100 pt-5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-[#003749]" aria-hidden />
                    <h3 className="font-extrabold text-[#003749]">
                      {method === "MADA" ? "بيانات بطاقة مدى" : "بيانات البطاقة"}
                    </h3>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-on-surface-variant">اسم حامل البطاقة</span>
                    <input
                      value={holder}
                      onChange={(e) => setHolder(e.target.value)}
                      required={usesCardEntryForm(method)}
                      minLength={3}
                      className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                      dir="rtl"
                      autoComplete="cc-name"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-on-surface-variant">رقم البطاقة</span>
                    <input
                      value={card}
                      onChange={(e) => setCard(formatCardNumber(e.target.value))}
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="4242 4242 4242 4242"
                      required={usesCardEntryForm(method)}
                      className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                      dir="ltr"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-on-surface-variant">الصلاحية (MM/YY)</span>
                      <input
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="12/29"
                        required={usesCardEntryForm(method)}
                        className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                        dir="ltr"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-on-surface-variant">CVC</span>
                      <input
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        required={usesCardEntryForm(method)}
                        className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                        dir="ltr"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {/* <p className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-on-surface-variant">
                <Shield className="mt-0.5 size-3.5 shrink-0 text-[#003749]" aria-hidden />
                التأكيد الحالي يحدّث حالة الطلب في النظام للاختبار. ربط تابي وتمارا والبوابة البنكية وApple
                Pay ونظام النقاط يتم على مستوى الخادم والامتثال (PCI-DSS) عند التشغيل الفعلي.
              </p> */}

              {(clientError || serverError) ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
                  role="alert"
                >
                  {clientError ?? serverError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003749] py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    جاري المعالجة…
                  </>
                ) : hostedCheckout && usesCardEntryForm(method) ? (
                  <>
                    المتابعة للدفع الآمن {formatSarAmount(payableAmountSar)}{" "}
                    <SarCurrencyGlyph />
                  </>
                ) : (
                  submitLabel
                )}
              </button>
            </form>
          )}
        </section>

        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-[#ebe4d3] bg-white shadow-md">
            <div className="relative aspect-[16/10] bg-neutral-100">
              <Image
                src={booking.car.image}
                alt={booking.car.alt}
                fill
                className="object-contain p-4"
                sizes="(max-width: 1024px) 100vw, 360px"
              />
            </div>
            <div className="space-y-4 border-t border-neutral-100 p-5">
              <div>
                <h2 className="text-lg font-extrabold leading-snug text-[#003749]">
                  {booking.car.fullTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#ea580c]">{booking.car.categoryTitle}</p>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-bold text-[#003749]">الاستلام</dt>
                  <dd className="tabular-nums text-on-surface" dir="ltr">
                    {pickup.date} · {pickup.time}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[#003749]">التسليم</dt>
                  <dd className="tabular-nums text-on-surface" dir="ltr">
                    {dropoff.date} · {dropoff.time}
                  </dd>
                </div>
                {booking.pickupMode === "DELIVERY" ? (
                  <div>
                    <dt className="font-bold text-[#003749]">موقع التوصيل</dt>
                    <dd className="mt-1 text-on-surface">
                      {booking.deliveryAddress?.trim() ? (
                        <p className="whitespace-pre-wrap text-sm">{booking.deliveryAddress.trim()}</p>
                      ) : null}
                      {booking.deliveryLat != null && booking.deliveryLng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${booking.deliveryLat},${booking.deliveryLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-bold text-[#003749] underline"
                          dir="ltr"
                        >
                          فتح الموقع على الخريطة
                        </a>
                      ) : !booking.deliveryAddress?.trim() ? (
                        <span className="text-sm text-on-surface-variant">—</span>
                      ) : null}
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="font-bold text-[#003749]">الفرع</dt>
                    <dd className="text-on-surface">
                      {branchLabelAr}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-100 pt-3 font-bold">
                  <dt>مدة الإيجار</dt>
                  <dd>
                    {booking.tripDurationLabelAr ??
                      `${booking.numberOfDays} ${booking.numberOfDays === 1 ? "يوم" : "أيام"}`}
                  </dd>
                </div>
              </dl>

              {booking.addons.length > 0 ? (
                <div className="border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-xs font-extrabold text-[#003749]">الإضافات</p>
                  <ul className="space-y-1.5 text-xs">
                    {booking.addons.map((a, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{a.titleAr}</span>
                        <span className="tabular-nums font-bold text-[#003749]" dir="ltr">
                          {formatSarAmount(a.lineTotalExclTax)} <SarCurrencyGlyph />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2 border-t border-neutral-100 pt-3 text-sm">
                <Row
                  label="الإيجار (غير شامل الضريبة)"
                  value={
                    <>
                      {formatSarAmount(booking.totals.rentalExclTax)} <SarCurrencyGlyph />
                    </>
                  }
                />
                <Row
                  label="الإضافات"
                  value={
                    <>
                      {formatSarAmount(booking.totals.addonsExclTax)} <SarCurrencyGlyph />
                    </>
                  }
                />
                {booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0 ? (
                  <Row
                    label={booking.interCityShipping.labelAr}
                    value={
                      <>
                        {formatSarAmount(booking.interCityShipping.feeExclVatSar)}{" "}
                        <SarCurrencyGlyph />
                      </>
                    }
                  />
                ) : null}
                {booking.checkoutOneTimeFees.map((f) => (
                  <Row
                    key={f.slug}
                    label={f.labelAr}
                    value={
                      <>
                        {formatSarAmount(f.feeExclVatSar)} <SarCurrencyGlyph />
                      </>
                    }
                  />
                ))}
                {booking.delayPenalty && booking.delayPenalty.feeExclVatSar > 0 ? (
                  <Row
                    label={booking.delayPenalty.labelAr}
                    value={
                      <>
                        {formatSarAmount(booking.delayPenalty.feeExclVatSar)}{" "}
                        <SarCurrencyGlyph />
                      </>
                    }
                  />
                ) : null}
                <Row
                  label={`ضريبة القيمة المضافة ${booking.car.vatRatePercent}%`}
                  value={
                    <>
                      {formatSarAmount(booking.totals.vatAmount)} <SarCurrencyGlyph />
                    </>
                  }
                />
                <Row
                  label="المبلغ الإجمالي"
                  value={
                    <>
                      {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
                    </>
                  }
                  emphasize={!balancePaymentMode}
                />
                {balancePaymentMode ? (
                  <Row
                    label="المستحق الآن (فرق تمديد)"
                    value={
                      <>
                        {formatSarAmount(balanceDueSar)} <SarCurrencyGlyph />
                      </>
                    }
                    emphasize
                  />
                ) : null}
              </div>
            </div>
          </div>

          {!checkoutComplete ? (
            <p className="rounded-2xl border border-[#ebe4d3] bg-[#fffdf9] px-4 py-3 text-center text-xs leading-relaxed text-[#6b5a3b]">
              المبلغ المعروض شاملاً ضريبة القيمة المضافة. لن يُخصم أي مبلغ حتى تؤكد الدفع.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${emphasize ? "rounded-lg bg-[#003749] px-3 py-2 text-white" : ""}`}
    >
      <span className={emphasize ? "text-sm font-extrabold" : "text-sm text-on-surface-variant"}>
        {label}
      </span>
      <span className="tabular-nums text-sm font-bold" dir="ltr">
        {value}
      </span>
    </div>
  );
}
