"use client";

import { CheckCircle2, CreditCard, Lock, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { confirmMockPayment } from "@/app/fleet/payment/payment-actions";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

type Props = { booking: BookingPaymentSnapshot };

function maskPhone(p: string): string {
  if (p.length <= 4) return p;
  return `${"•".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
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

export function PaymentClient({ booking }: Props) {
  const initiallyPaid = booking.paymentStatus === "PAID";
  const [state, formAction, pending] = useActionState(confirmMockPayment, null);
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState(booking.fullName);
  const [clientError, setClientError] = useState<string | null>(null);

  const paid = initiallyPaid || (state?.ok ?? false);

  const pickup = useMemo(() => fmtWhen(booking.pickupDate), [booking.pickupDate]);
  const dropoff = useMemo(() => {
    const d = new Date(booking.pickupDate);
    d.setDate(d.getDate() + booking.numberOfDays);
    return fmtWhen(d);
  }, [booking.pickupDate, booking.numberOfDays]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (paid) return;
    setClientError(null);
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

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-on-surface-variant">
        <Link href="/fleet" className="font-bold text-[#003749] hover:underline">
          الأسطول
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <Link href="/fleet/checkout" className="font-bold text-[#003749] hover:underline">
          الإتمام
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <span className="font-semibold text-on-surface">الدفع</span>
      </nav>

      <h1 className="mb-2 text-xl font-extrabold text-[#ea580c] sm:text-2xl">إتمام الدفع</h1>
      <p className="mb-6 text-sm text-on-surface-variant">
        طلب الحجز رقم{" "}
        <span dir="ltr" className="tabular-nums font-bold text-[#003749]">
          #{booking.id}
        </span>{" "}
        — {paid ? "تم الدفع بنجاح." : "أكمل الدفع لتأكيد حجزك."}
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        {/* قسم الدفع */}
        <section className="order-2 space-y-6 lg:order-1">
          {paid ? (
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-9" aria-hidden />
                </div>
                <h2 className="text-lg font-extrabold text-emerald-800">تم استلام الدفع</h2>
                <p className="max-w-md text-sm text-emerald-900/80">
                  شكراً لك! تم تأكيد حجزك وسيتواصل معك فريقنا قريباً لتأكيد التسليم
                  وأي إجراءات إضافية. احتفظ برقم الطلب للمراجعة.
                </p>
                <dl className="mt-3 grid w-full max-w-md grid-cols-2 gap-3 text-start text-xs sm:text-sm">
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
          ) : (
            <form
              action={formAction}
              onSubmit={onSubmit}
              className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <input type="hidden" name="bookingRequestId" value={booking.id} />

              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-5 text-[#003749]" aria-hidden />
                  <h2 className="text-lg font-extrabold text-[#003749]">بطاقة ائتمانية</h2>
                </div>

              </header>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant">اسم حامل البطاقة</span>
                <input
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  required
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
                  required
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
                    required
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
                    required
                    className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                    dir="ltr"
                  />
                </label>
              </div>


              {(clientError || state?.error) ? (
                <p className="text-sm font-bold text-error" role="alert">
                  {clientError ?? state?.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-[#003749] py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {pending
                  ? "جاري معالجة الدفع…"
                  : `ادفع ${formatSarAmount(booking.totals.totalInclTax)} ر.س`}
              </button>
            </form>
          )}
        </section>

        {/* ملخص الطلب */}
        <aside className="order-1 space-y-4 lg:order-2">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md">
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
                <div className="flex justify-between border-t border-neutral-100 pt-3 font-bold">
                  <dt>مدة الإيجار</dt>
                  <dd dir="ltr">{booking.numberOfDays} يوم</dd>
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
                          {formatSarAmount(a.lineTotalExclTax)} ر.س
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2 border-t border-neutral-100 pt-3 text-sm">
                <Row label="الإيجار (غير شامل الضريبة)" value={`${formatSarAmount(booking.totals.rentalExclTax)} ر.س`} />
                <Row label="الإضافات" value={`${formatSarAmount(booking.totals.addonsExclTax)} ر.س`} />
                <Row
                  label={`ضريبة القيمة المضافة ${booking.car.vatRatePercent}%`}
                  value={`${formatSarAmount(booking.totals.vatAmount)} ر.س`}
                />
                <Row
                  label="المبلغ الإجمالي"
                  value={`${formatSarAmount(booking.totals.totalInclTax)} ر.س`}
                  emphasize
                />
              </div>
            </div>
          </div>
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
  value: string;
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
