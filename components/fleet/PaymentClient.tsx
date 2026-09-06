"use client";

import {
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
import { useRouter } from "next/navigation";
import {
  confirmMockPayment,
  createApplePayExpressSession,
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
  isGeideaHostedCheckoutMethod,
  listEnabledCheckoutPaymentMethods,
  type CheckoutPaymentMethodFlags,
  type CustomerCheckoutPaymentMethod,
} from "@/lib/checkout-payment-method-flags";
import { ApplePayExpressButton } from "@/components/fleet/ApplePayExpressButton";
import type { PaymentIconUrls } from "@/lib/site-settings";
import { TabbyPromoSnippet } from "@/components/fleet/TabbyPromoSnippet";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  booking: BookingPaymentSnapshot;
  paymentMethodFlags: CheckoutPaymentMethodFlags;
  /** عند التفعيل: البطاقة/مدى تُحوَّل لصفحة الدفع المستضافة (جيديا) — بلا إدخال بطاقة محلي. */
  hostedCheckout?: boolean;
  /** رابط مكتبة جيديا لزر Apple Pay السريع — null إن لم تكن البوابة مهيّأة. */
  geideaScriptUrl?: string | null;
  /** شعارات وسائل الدفع (تابي/تمارا/البطاقة/مدى/إمكان) — قابلة للتعديل من لوحة الإدارة. */
  paymentIconUrls: PaymentIconUrls;
  /** مفاتيح تابي العامة لعرض شعار/نص "ادفع على 4 أقساط" — null لو البوابة غير مهيّأة */
  tabbyPromo?: { publicKey: string; merchantCode: string } | null;
  /** نتيجة فحص الأهلية المسبق (pre-scoring) — null لو لم يُفحص (تابي غير مهيّأة مثلاً) */
  tabbyEligibility?: { status: "eligible" | "rejected" | "unknown"; rejectionReason?: string } | null;
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

/** العربي كما كان بالضبط (`ar-SA`)؛ الإنجليزي `en-GB` ليرى أرقاماً لاتينية لا عربية‑هندية. */
function fmtWhen(d: Date, locale: string): { date: string; time: string } {
  const tag = locale === "en" ? "en-GB" : "ar-SA";
  return {
    date: d.toLocaleDateString(tag, { year: "numeric", month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" }),
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

/** احتياطي فقط حين لا يصل اسم الفرع من قاعدة البيانات (`pickupBranchLabelAr`). */
const BRANCH_FALLBACK: Record<string, { ar: string; en: string }> = {
  jeddah: { ar: "جدة", en: "Jeddah" },
  madinah: { ar: "المدينة المنورة", en: "Madinah" },
  tabuk: { ar: "تبوك", en: "Tabuk" },
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



/**
 * شعارات تابي/تمارا/البطاقة/مدى/إمكان تأتي من paymentIconUrls (قابلة للتعديل من
 * لوحة الإدارة) — لا قيم مثبّتة هنا، حتى تتفرّع الواجهة تلقائياً بمجرد رفع الأدمن
 * شعاراً جديداً دون أي تعديل على الكود.
 */
function buildMethodOptions(
  paymentIconUrls: PaymentIconUrls,
  t: (key: string) => string,
): MethodOption[] {
  return [
    {
      id: "TABBY",
      title: t("methodTabby"),
      hint: t("methodTabbyHint"),
      logoSrc: paymentIconUrls.TABBY,
    },
    {
      id: "TAMARA",
      title: t("methodTamara"),
      hint: t("methodTamaraHint"),
      logoSrc: paymentIconUrls.TAMARA,
    },
    {
      id: "CARD",
      title: t("methodCard"),
      hint: t("methodCardHint"),
      logoSrc: paymentIconUrls.CARD,
    },
    {
      id: "MADA",
      title: t("methodMada"),
      hint: t("methodMadaHint"),
      logoSrc: paymentIconUrls.MADA,
    },
    {
      id: "AMKAN",
      title: t("methodAmkan"),
      hint: t("methodAmkanHint"),
      logoSrc: paymentIconUrls.AMKAN,
    },
    {
      id: "CASH",
      title: t("methodCash"),
      hint: "",
      Icon: Store,
    },
    {
      id: "APPLE_PAY",
      title: t("methodApplePay"),
      hint: "",
      logoSrc: paymentIconUrls.APPLE_PAY,
    },
    {
      id: "POINTS",
      title: t("methodPoints"),
      hint: t("methodPointsHint"),
      Icon: Gift,
    },
  ];
}

/** تسمية وسيلة الدفع المخزّنة على الحجز، باللغة المعروضة (بديل bookingPaymentMethodLabelAr). */
function methodLabel(code: string | null | undefined, t: (key: string) => string): string {
  const key = code?.trim().toUpperCase() ?? "";
  const map: Record<string, string> = {
    CASH: "methodCash",
    CARD: "methodCard",
    MADA: "methodMada",
    AMKAN: "methodAmkan",
    TABBY: "methodTabby",
    TAMARA: "methodTamara",
    APPLE_PAY: "methodApplePay",
    POINTS: "methodPoints",
  };
  return map[key] ? t(map[key]) : (code?.trim() || "—");
}

export function PaymentClient({
  booking,
  paymentMethodFlags,
  hostedCheckout,
  geideaScriptUrl,
  paymentIconUrls,
  tabbyPromo,
  tabbyEligibility,
}: Props) {
  const t = useTranslations("Payment");
  const locale = useLocale();

  const enabledMethods = useMemo(
    () => listEnabledCheckoutPaymentMethods(paymentMethodFlags),
    [paymentMethodFlags],
  );

  const methodOptions = useMemo(
    () => buildMethodOptions(paymentIconUrls, t),
    [paymentIconUrls, t],
  );

  const router = useRouter();
  // زر Apple Pay السريع يحتاج بوابة مهيّأة + رابط المكتبة؛ غير ذلك يبقى النص التجريبي.
  const applePayExpressReady = Boolean(hostedCheckout && geideaScriptUrl);

  const ps = booking.paymentStatus.trim().toUpperCase();
  // وضع «دفع فرق التمديد»: الحجز مدفوع وعليه رصيد بعد تعديل/تمديد — تُعرض
  // طرق الدفع لسداد الرصيد فقط (بلا كاش؛ النقدي يسجّله موظف الفرع).
  const balanceDueSar = Math.round((booking.balanceDueAtBranchSar ?? 0) * 100) / 100;
  const balancePaymentMode = ps === "PAID" && balanceDueSar > 0;
  const paymentFinalized = ps !== "PENDING" && !balancePaymentMode;

  const visibleMethodOptions = useMemo(
    () =>
      methodOptions.filter(
        (opt) =>
          enabledMethods.includes(opt.id) &&
          // في وضع دفع فرق التمديد لا يُعرض «عند الفرع» — الرصيد يُسدَّد أونلاين.
          !(balancePaymentMode && opt.id === "CASH"),
      ),
    [methodOptions, enabledMethods, balancePaymentMode],
  );

  // pre-scoring: تُعطَّل فقط عند رفض صريح من تابي. "unknown" (تعذّر الوصول) تبقى
  // متاحة عمداً — تعطيلها بسبب عطل شبكي مؤقت عندنا كان يخسر بيعاً بلا سبب.
  const tabbyIneligible = tabbyEligibility?.status === "rejected";

  const [state, formAction, pending] = useActionState<ConfirmPaymentResult | null, FormData>(
    confirmMockPayment,
    null,
  );
  const [resendState, resendFormAction, resendPending] = useActionState<
    ResendBookingInvoiceResult | null,
    FormData
  >(resendBookingInvoice, null);
  const pickDefaultMethod = (methods: CheckoutPaymentMethod[]): CheckoutPaymentMethod =>
    methods.find((m) => !(m === "TABBY" && tabbyIneligible)) ?? methods[0] ?? "CARD";

  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    () => pickDefaultMethod(enabledMethods),
  );
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState(booking.fullName);
  const [pointsNote, setPointsNote] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (enabledMethods.includes(method) && !(method === "TABBY" && tabbyIneligible)) return;
    const next = pickDefaultMethod(enabledMethods);
    if (next) setMethod(next);
  }, [enabledMethods, method, tabbyIneligible]);

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

  const pickup = useMemo(() => fmtWhen(booking.pickupDate, locale), [booking.pickupDate, locale]);
  /*
   * موعد التسليم الذي طلبه العميل محفوظ في لقطة الغرامة وحدها — لا عمود
   * `dropoffDate` في الجدول. واشتقاقه من الأيام الكاملة يُسقط الساعات الزائدة،
   * فيعرض الصف موعداً أبكر من الطلب بينما يعرض سطر «مدة الإيجار» تحته تلك
   * الساعات («يوم واحد + 4 ساعات») — فتناقض الصفحة نفسها ويظن العميل أن هناك خطأ.
   *
   * اللقطة تُسجَّل فقط حين تُستحق غرامة، أي حين يتجاوز الفارق ساعتين (ما دونها
   * مجاني) — فالفروق الكبيرة وحدها تظهر بدقّة، وما يتبقّى فارقه ساعتان فأقل.
   */
  const dropoff = useMemo(() => {
    const requested = booking.delayPenalty?.actualDropoffAt;
    if (requested) {
      const exact = new Date(requested);
      if (!Number.isNaN(exact.getTime())) return fmtWhen(exact, locale);
    }
    const d = new Date(booking.pickupDate);
    d.setDate(d.getDate() + booking.numberOfDays);
    return fmtWhen(d, locale);
  }, [booking.pickupDate, booking.numberOfDays, booking.delayPenalty, locale]);
  const branchLabel =
    booking.pickupBranchLabelAr?.trim() ||
    BRANCH_FALLBACK[booking.branch]?.[locale === "en" ? "en" : "ar"] ||
    booking.branch;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (checkoutComplete) return;
    setClientError(null);
    if (!usesCardEntryForm(method) || hostedCheckout) return;

    const cardClean = card.replace(/\s+/g, "");
    if (!luhnOk(cardClean)) {
      e.preventDefault();
      setClientError(t("errCardNumber"));
      return;
    }
    const exp = expiry.replace(/\D/g, "");
    if (exp.length !== 4) {
      e.preventDefault();
      setClientError(t("errCardExpiry"));
      return;
    }
    const mm = Number(exp.slice(0, 2));
    if (mm < 1 || mm > 12) {
      e.preventDefault();
      setClientError(t("errCardExpiry"));
      return;
    }
    if (cvc.length < 3 || cvc.length > 4) {
      e.preventDefault();
      setClientError(t("errCardCvc"));
      return;
    }
    if (holder.trim().length < 3) {
      e.preventDefault();
      setClientError(t("errCardHolder"));
      return;
    }
  }

  // المبلغ يُحقن كعنصر (رمز الريال أيقونة، لا نص) — لذلك تُقسَّم الترجمة حول {amount}.
  const amountNode = (
    <>
      {formatSarAmount(payableAmountSar)} <SarCurrencyGlyph />
    </>
  );
  const withAmount = (key: "submitApplePay" | "submitMada") => {
    const [before, after] = t(key).split("{amount}");
    return (
      <>
        {before}
        {amountNode}
        {after}
      </>
    );
  };

  const submitLabel: ReactNode =
    method === "TABBY"
      ? t("submitTabby")
      : method === "TAMARA"
        ? t("submitTamara")
        : method === "AMKAN"
          ? t("submitAmkan")
          : method === "POINTS"
            ? t("submitPoints")
            : method === "CASH"
              ? (
                <>
                  {t("submitCash")} {amountNode}
                </>
              )
              : method === "APPLE_PAY"
                ? withAmount("submitApplePay")
                : method === "MADA"
                  ? withAmount("submitMada")
                  : (
                    <>
                      {t("submitPay")} {amountNode}
                    </>
                  );

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Stepper */}
      <BookingStepper
        currentStep={checkoutComplete ? 4 : 3}
        modelId={booking.car.modelId}
        bookingId={booking.id}
      />

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b5a3b]">
          {t("bookingNoPrefix")}{" "}
          <span dir="ltr" className="tabular-nums font-bold text-[#003749]">
            #{booking.id}
          </span>
          {" — "}
          {underReview
            ? t("introUnderReview")
            : cashConfirmed
              ? t("introCashConfirmed")
              : cashSubmitted
                ? t("introCashSubmitted")
                : checkoutComplete
                  ? ps === "REFUNDED"
                    ? t("introRefunded", { method: methodLabel(resolvedMethodCode, t) })
                    : ps === "PARTIAL_REFUND"
                      ? t("introPartialRefund", { method: methodLabel(resolvedMethodCode, t) })
                      : ps === "NO_REFUND"
                        ? t("introNoRefund")
                        : resolvedMethodCode
                          ? t("introPaidVia", { method: methodLabel(resolvedMethodCode, t) })
                          : t("introPaid")
                  : balancePaymentMode
                    ? t("introBalanceDue", { amount: formatSarAmount(balanceDueSar) })
                    : t("introChooseMethod")}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:gap-12">
        <section className="order-2 space-y-6 lg:order-1">
          {checkoutComplete ? (
            <div
              className={`overflow-hidden rounded-3xl border shadow-sm ${showAmberSuccessPanel
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
                }`}
            >
              <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
                <div
                  className={`grid size-16 place-items-center rounded-full ${showAmberSuccessPanel
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                    }`}
                >
                  <CheckCircle2 className="size-9" aria-hidden />
                </div>
                <h2
                  className={`text-lg font-extrabold ${showAmberSuccessPanel ? "text-amber-900" : "text-emerald-800"
                    }`}
                >
                  {underReview
                    ? t("successTitleUnderReview")
                    : cashConfirmed
                      ? t("successTitleCashConfirmed")
                      : cashSubmitted
                        ? t("successTitleCashSubmitted")
                        : ps === "REFUNDED" || ps === "PARTIAL_REFUND" || ps === "NO_REFUND"
                          ? t("successTitleRefundStatus")
                          : t("successTitlePaid")}
                </h2>
                <p
                  className={`max-w-md text-sm leading-relaxed ${showAmberSuccessPanel ? "text-amber-950/80" : "text-emerald-900/80"
                    }`}
                >
                  {underReview
                    ? t("successBodyUnderReview")
                    : cashConfirmed
                      ? t("successBodyCashConfirmed")
                      : cashSubmitted
                        ? t("successBodyCashSubmitted")
                        : ps === "REFUNDED" || ps === "PARTIAL_REFUND" || ps === "NO_REFUND"
                          ? t("successBodyRefundStatus")
                          : t("successBodyPaid")}
                </p>
                <p
                  dir="ltr"
                  className="rounded-xl bg-white/70 px-4 py-2 text-sm font-extrabold tabular-nums text-[#003749]"
                >
                  #{booking.id}
                </p>
                {resolvedMethodCode ? (
                  <p
                    className={`text-sm font-bold ${showAmberSuccessPanel ? "text-amber-900" : "text-emerald-900"
                      }`}
                  >
                    {t("paymentMethodLabel", { method: methodLabel(resolvedMethodCode, t) })}
                  </p>
                ) : null}
                <dl className="mt-3 grid w-full max-w-md gap-3 text-start text-xs sm:text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <dt className="text-on-surface-variant">{t("name")}</dt>
                      <dd className="font-bold text-[#003749]">{booking.fullName}</dd>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <dt className="text-on-surface-variant">{t("phone")}</dt>
                      <dd className="tabular-nums font-bold text-[#003749]" dir="ltr">
                        {maskPhone(booking.phone)}
                      </dd>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <dt className="text-on-surface-variant">
                      {booking.pickupMode === "DELIVERY" ? t("deliveryLocation") : t("branch")}
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
                              {t("openMap")}
                            </a>
                          ) : !booking.deliveryAddress?.trim() ? (
                            <span className="text-on-surface-variant">—</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="font-bold">
                          {branchLabel}
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
                    {t("backHome")}
                  </Link>
                  <Link
                    href="/fleet"
                    className="rounded-xl border border-[#003749] px-5 py-2.5 text-sm font-extrabold text-[#003749] hover:bg-[#003749]/5"
                  >
                    {t("browseFleet")}
                  </Link>
                </div>
              </div>
            </div>
          ) : noPaymentMethods ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
              <p className="font-extrabold text-amber-950">{t("noMethodsTitle")}</p>
              <p className="mt-2 text-sm text-amber-950/80">{t("noMethodsBody")}</p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-[#003749] px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-95"
              >
                {t("backHome")}
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
                    {balancePaymentMode ? t("balanceTitle") : t("methodsTitle")}
                  </h2>

                </div>
                <p className="text-xs text-on-surface-variant">
                  {t("methodsHint")}
                </p>
              </header>

              {balancePaymentMode ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <div className="flex items-center justify-between gap-3 font-extrabold">
                    <span>{t("balanceDueNow")}</span>
                    <span className="tabular-nums" dir="ltr">
                      {formatSarAmount(balanceDueSar)} <SarCurrencyGlyph className="inline h-[0.85em] w-[0.85em]" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    {t("balanceNote")}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("methodsAriaLabel")}>
                {visibleMethodOptions.map((opt) => {
                  const on = method === opt.id;
                  const ineligible = opt.id === "TABBY" && tabbyIneligible;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={opt.title}
                      aria-disabled={ineligible}
                      disabled={ineligible}
                      onClick={() => {
                        if (ineligible) return;
                        setMethod(opt.id);
                        setClientError(null);
                      }}
                      className={`relative flex flex-col items-start gap-2 rounded-xl border px-4 py-3 text-start transition-all ${ineligible
                        ? "cursor-not-allowed border-[#ebe4d3] bg-neutral-50 opacity-60"
                        : on
                          ? "border-[#dbb878] bg-[#003749]/[0.04] ring-2 ring-[#dbb878]/35"
                          : "border-[#ebe4d3] bg-white hover:border-[#dbb878]/40 hover:shadow-sm"
                        }`}
                    >
                      {on ? (
                        <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-[#003749] text-white">
                          <Check className="size-3" aria-hidden />
                        </span>
                      ) : null}
                      <span className="flex w-full items-center gap-3 pe-6">
                        {"logoSrc" in opt ? (
                          <span className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/[0.06]">
                            <Image
                              src={opt.logoSrc}
                              alt={opt.title}
                              width={100}
                              height={40}
                              className="h-7 w-auto max-w-full object-contain object-center"
                              sizes="100px"
                              priority={opt.id === "TABBY"}
                            />
                          </span>
                        ) : (
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${on
                              ? "bg-[#003749]/[0.06] ring-[#dbb878]/40"
                              : "bg-neutral-50 ring-black/[0.06]"
                              }`}
                          >
                            <opt.Icon
                              className={`size-5 ${on ? "text-[#003749]" : "text-neutral-500"}`}
                              aria-hidden
                            />
                          </span>
                        )}
                        <span className="font-extrabold text-[#003749]">{opt.title}</span>
                      </span>
                      {ineligible ? (
                        <span className="text-[11px] leading-snug font-bold text-red-700">
                          {t("tabbyIneligible")}
                        </span>
                      ) : opt.hint ? (
                        <span className="text-[11px] leading-snug text-on-surface-variant">{opt.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {method === "TABBY" ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                  <p className="font-bold">{t("tabbyPanelTitle")}</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    {t("tabbyPanelBody")}
                  </p>
                  {tabbyPromo ? (
                    <div className="mt-2">
                      <TabbyPromoSnippet
                        publicKey={tabbyPromo.publicKey}
                        merchantCode={tabbyPromo.merchantCode}
                        priceSar={payableAmountSar}
                        lang={locale === "en" ? "en" : "ar"}
                        source="cart"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {method === "TAMARA" ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <p className="font-bold">{t("tamaraPanelTitle")}</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    {t("tamaraPanelBody")}
                  </p>
                </div>
              ) : null}

              {method === "APPLE_PAY" ? (
                <div className="space-y-3 rounded-xl border border-neutral-800/15 bg-neutral-900/[0.04] px-4 py-3 text-sm text-neutral-900">
                  <p className="font-bold">Apple Pay</p>
                  {applePayExpressReady ? (
                    <ApplePayExpressButton
                      scriptUrl={geideaScriptUrl!}
                      createSession={() => createApplePayExpressSession(booking.id)}
                      onPaid={() => router.refresh()}
                    />
                  ) : (
                    <p className="text-xs leading-relaxed opacity-90">
                      {hostedCheckout
                        ? t("applePayHosted")
                        : t("applePayMock")}
                    </p>
                  )}
                </div>
              ) : null}

              {method === "POINTS" ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-950">{t("pointsTitle")}</p>
                  <p className="text-xs leading-relaxed text-amber-950/85">
                    {t("pointsBody")}
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-amber-950/80">{t("pointsNoteLabel")}</span>
                    <textarea
                      value={pointsNote}
                      onChange={(e) => setPointsNote(e.target.value)}
                      rows={2}
                      className="rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/40"
                      placeholder={t("pointsNotePlaceholder")}
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
                      {method === "MADA" ? t("cardSectionMada") : t("cardSectionCard")}
                    </h3>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-on-surface-variant">{t("cardHolder")}</span>
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
                    <span className="text-xs font-bold text-on-surface-variant">{t("cardNumber")}</span>
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
                      <span className="text-xs font-bold text-on-surface-variant">{t("cardExpiry")}</span>
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
                {t("complianceNote")}
              </p> */}

              {(clientError || serverError) ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
                  role="alert"
                >
                  {clientError ?? serverError}
                </div>
              ) : null}

              {/* Apple Pay السريع يتولّى الدفع بنفسه — إظهار زر الإرسال هنا كان
                  سينشئ جلسة جيديا ثانية ويحوّل العميل إلى HPP بلا داعٍ. */}
              {method === "APPLE_PAY" && applePayExpressReady ? null : (
                <button
                  type="submit"
                  disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003749] py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {t("processing")}
                    </>
                  ) : hostedCheckout && isGeideaHostedCheckoutMethod(method) ? (
                    <>
                      {t("submitSecure")} {formatSarAmount(payableAmountSar)}{" "}
                      <SarCurrencyGlyph />
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              )}
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
                  <dt className="font-bold text-[#003749]">{t("pickup")}</dt>
                  <dd className="tabular-nums text-on-surface" dir="ltr">
                    {pickup.date} · {pickup.time}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[#003749]">{t("dropoff")}</dt>
                  <dd className="tabular-nums text-on-surface" dir="ltr">
                    {dropoff.date} · {dropoff.time}
                  </dd>
                </div>
                {booking.pickupMode === "DELIVERY" ? (
                  <div>
                    <dt className="font-bold text-[#003749]">{t("deliveryLocation")}</dt>
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
                          {t("openMapFull")}
                        </a>
                      ) : !booking.deliveryAddress?.trim() ? (
                        <span className="text-sm text-on-surface-variant">—</span>
                      ) : null}
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="font-bold text-[#003749]">{t("branch")}</dt>
                    <dd className="text-on-surface">
                      {branchLabel}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-100 pt-3 font-bold">
                  <dt>{t("rentalDuration")}</dt>
                  <dd>
                    {booking.tripDurationLabelAr ??
                      `${booking.numberOfDays} ${booking.numberOfDays === 1 ? t("day") : t("days")}`}
                  </dd>
                </div>
              </dl>

              {booking.addons.length > 0 ? (
                <div className="border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-xs font-extrabold text-[#003749]">{t("addons")}</p>
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
                  label={t("rentalExclTax")}
                  value={
                    <>
                      {formatSarAmount(booking.totals.rentalExclTax)} <SarCurrencyGlyph />
                    </>
                  }
                />
                <Row
                  label={t("addons")}
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
                  label={t("vat", { rate: booking.car.vatRatePercent })}
                  value={
                    <>
                      {formatSarAmount(booking.totals.vatAmount)} <SarCurrencyGlyph />
                    </>
                  }
                />
                <Row
                  label={t("totalAmount")}
                  value={
                    <>
                      {formatSarAmount(booking.totals.totalInclTax)} <SarCurrencyGlyph />
                    </>
                  }
                  emphasize={!balancePaymentMode}
                />
                {balancePaymentMode ? (
                  <Row
                    label={t("dueNowBalance")}
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
              {t("totalsNote")}
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
