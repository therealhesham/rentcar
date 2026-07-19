"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { updateCustomerBookingDates } from "@/app/[locale]/account/actions";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import {
  type BookingDaysPriceInput,
  bookingTotalInclTaxForDays,
} from "@/lib/booking-edit";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

export type BookingEditModalData = {
  bookingId: number;
  carName: string;
  carImage: string | null;
  carAlt: string;
  categoryTitle: string | null;
  branchName: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  started: boolean;
  pickupIso: string;
  numberOfDays: number;
  priceInput: BookingDaysPriceInput;
  oldTotalInclTax: number;
};

export type BookingEditModalProps = BookingEditModalData & {
  open: boolean;
  onClose: () => void;
};

const MAX_DAYS = 60;

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const DAYS_AR = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function timeOf(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function todayYmd(): string {
  return ymdOf(new Date());
}
function diffDaysYmd(startYmd: string, endYmd: string): number {
  const a = new Date(`${startYmd}T00:00:00Z`).getTime();
  const b = new Date(`${endYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
function formatDateAr(d: Date): string {
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function SarAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
      {formatSarAmount(Math.abs(amount))}
      <SarCurrencyGlyph className="h-[0.85em] w-[0.85em] shrink-0" />
    </span>
  );
}

export function BookingEditModal(props: BookingEditModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const originalPickup = useMemo(() => new Date(props.pickupIso), [props.pickupIso]);
  const minDays = props.started ? props.numberOfDays : 1;

  const [pickupYmd, setPickupYmd] = useState<string>(() => ymdOf(originalPickup));
  const [pickupTime, setPickupTime] = useState<string>(() => timeOf(originalPickup));
  const [days, setDays] = useState<number>(props.numberOfDays);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const startDate = new Date(props.pickupIso);
  const [calYear, setCalYear] = useState(startDate.getFullYear());
  const [calMonth, setCalMonth] = useState(startDate.getMonth());

  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayYmd()), []);

  // إعادة الضبط عند كل فتح + قفل تمرير الصفحة خلف المودال
  useEffect(() => {
    if (!props.open) return;
    setPickupYmd(ymdOf(originalPickup));
    setPickupTime(timeOf(originalPickup));
    setDays(props.numberOfDays);
    setPendingStart(null);
    setError(null);
    setCalYear(originalPickup.getFullYear());
    setCalMonth(originalPickup.getMonth());
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.open, originalPickup, props.numberOfDays]);

  // إغلاق بمفتاح Escape
  useEffect(() => {
    if (!props.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  const clampDays = (n: number) =>
    Math.max(minDays, Math.min(MAX_DAYS, Math.round(Number.isFinite(n) ? n : minDays)));

  const returnYmd = useMemo(() => {
    const d = addDays(new Date(`${pickupYmd}T00:00:00`), days);
    return ymdOf(d);
  }, [pickupYmd, days]);

  const effectivePickup = useMemo(() => {
    const d = new Date(`${pickupYmd}T${pickupTime}:00`);
    return Number.isNaN(d.getTime()) ? originalPickup : d;
  }, [pickupYmd, pickupTime, originalPickup]);

  const returnDate = useMemo(() => addDays(effectivePickup, days), [effectivePickup, days]);

  const newTotal = useMemo(
    () => bookingTotalInclTaxForDays(props.priceInput, days),
    [props.priceInput, days],
  );
  const diff = Math.round((newTotal - props.oldTotalInclTax) * 100) / 100;
  const isPaid = props.paymentStatus.trim().toUpperCase() === "PAID";

  const unchanged =
    days === props.numberOfDays &&
    pickupYmd === ymdOf(originalPickup) &&
    pickupTime === timeOf(originalPickup);

  const effMin = props.started ? pickupYmd : (today ?? "");

  function handleDayClick(ymd: string) {
    if (props.started) {
      if (ymd <= pickupYmd) return;
      setDays(clampDays(diffDaysYmd(pickupYmd, ymd)));
      return;
    }
    if (pendingStart === null) {
      setPendingStart(ymd);
      return;
    }
    const start = pendingStart <= ymd ? pendingStart : ymd;
    const end = pendingStart <= ymd ? ymd : pendingStart;
    const d = diffDaysYmd(start, end);
    setPickupYmd(start);
    setDays(d < 1 ? 1 : Math.min(MAX_DAYS, d));
    setPendingStart(null);
  }

  function buildCells() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const cells: Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ ymd: "", day: 0, currMonth: false, disabled: true });
    }
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`;
      cells.push({ ymd, day: d, currMonth: true, disabled: ymd < effMin });
    }
    while (cells.length < 42) {
      cells.push({ ymd: "", day: 0, currMonth: false, disabled: true });
    }
    return cells;
  }

  function prevMonth() {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bookingId", String(props.bookingId));
      fd.set("days", String(days));
      fd.set("pickupDate", effectivePickup.toISOString());
      const r = await updateCustomerBookingDates(fd);
      if (!r.ok) {
        setError(r.error ?? "تعذّر حفظ التعديل.");
        return;
      }
      props.onClose();
      if (r.paymentRedirect) {
        // نتج عن التعديل مبلغ مستحق — يُوجَّه العميل لصفحة الدفع لسداد الفرق أونلاين.
        router.push(r.paymentRedirect);
        return;
      }
      router.refresh();
    });
  }

  if (!props.open || typeof document === "undefined") return null;

  const cells = buildCells();

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تعديل الحجز"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#f4f4f5] shadow-2xl sm:rounded-3xl"
        dir="rtl"
      >
        {/* رأس المودال */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
            {props.carImage ? (
              <Image src={props.carImage} alt={props.carAlt} fill className="object-contain p-1" sizes="64px" />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-300">
                <Calendar className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#775927]">
              تعديل الحجز #{props.bookingId}
            </p>
            <h2 className="truncate text-base font-extrabold text-[#003749]">{props.carName}</h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-neutral-100 hover:text-[#003749]"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* جسم قابل للتمرير */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            {props.categoryTitle ? (
              <span className="inline-flex rounded-md bg-neutral-200/70 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                {props.categoryTitle}
              </span>
            ) : null}
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                isPaid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-orange-200 bg-orange-50 text-orange-900"
              }`}
            >
              {isPaid ? "مدفوع" : "بانتظار الدفع"}
            </span>
            {props.branchName ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                <MapPin className="h-3.5 w-3.5 text-[#775927]" />
                {props.branchName}
              </span>
            ) : null}
          </div>

          {/* التقويم */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            {props.started ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold leading-relaxed text-amber-950">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                بدأ موعد هذا الحجز — اختر يوماً لاحقاً لتمديد تاريخ العودة (تاريخ الاستلام ثابت).
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-on-surface-variant">
                <Calendar className="h-4 w-4 text-[#dbb878]" />
                {pendingStart ? "الآن اختر تاريخ العودة." : "اختر تاريخ الاستلام ثم تاريخ العودة."}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
                aria-label="الشهر السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-sm font-extrabold text-[#003749]">
                {MONTHS_AR[calMonth]} {calYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
                aria-label="الشهر التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center">
              {DAYS_AR.map((d) => (
                <span key={d} className="py-1 text-[11px] font-bold text-[#8a7752]">{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (!cell.currMonth) return <span key={i} aria-hidden />;
                const isPickup = cell.ymd === pickupYmd;
                const isReturn = cell.ymd === returnYmd;
                const inRange = cell.ymd > pickupYmd && cell.ymd < returnYmd;
                const isPending = pendingStart != null && cell.ymd === pendingStart;
                const isToday = today != null && cell.ymd === today;
                const isEnd = isPickup || isReturn;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={cell.disabled}
                    onClick={() => !cell.disabled && handleDayClick(cell.ymd)}
                    className={`relative flex h-10 w-full items-center justify-center text-[13px] font-bold transition-all
                      ${cell.disabled ? "cursor-not-allowed text-neutral-300" : "text-[#3a2f1e] hover:bg-[#fdfbf6]"}
                      ${inRange ? "bg-[#dbb878]/20 text-[#003749]" : ""}
                      ${isPickup && !isReturn ? "rounded-r-xl rounded-l-md" : ""}
                      ${isReturn && !isPickup ? "rounded-l-xl rounded-r-md" : ""}
                      ${isPickup && isReturn ? "rounded-xl" : ""}
                      ${isEnd ? "bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]" : ""}
                      ${isPending ? "rounded-xl ring-2 ring-[#003749] ring-offset-1" : ""}
                      ${isToday && !isEnd && !inRange && !isPending ? "rounded-lg ring-1 ring-[#dbb878]/60" : ""}
                    `}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* وقت الاستلام */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                <Clock className="h-4 w-4 text-[#dbb878]" />
                وقت الاستلام
              </span>
              {props.started ? (
                <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-extrabold tabular-nums text-on-surface" dir="ltr">
                  {timeOf(originalPickup)}
                </span>
              ) : (
                <select
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-bold tabular-nums text-on-surface shadow-sm outline-none focus:border-[#003749] focus:ring-2 focus:ring-[#003749]/20"
                  dir="ltr"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* المدة */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-on-surface-variant">مدة الإيجار</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDays((d) => clampDays(d - 1))}
                  disabled={days <= minDays}
                  aria-label="إنقاص يوم"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white text-xl font-black text-[#003749] shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[64px] rounded-xl bg-[#003749] px-3 py-2 text-center text-sm font-extrabold tabular-nums text-white">
                  {days} يوم
                </span>
                <button
                  type="button"
                  onClick={() => setDays((d) => clampDays(d + 1))}
                  disabled={days >= MAX_DAYS}
                  aria-label="زيادة يوم"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white text-xl font-black text-[#003749] shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-100 bg-gradient-to-br from-neutral-50/80 to-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">الاستلام</p>
                <p className="mt-1 text-sm font-extrabold text-on-surface">{formatDateAr(effectivePickup)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-gradient-to-br from-neutral-50/80 to-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">العودة</p>
                <p className="mt-1 text-sm font-extrabold text-on-surface">{formatDateAr(returnDate)}</p>
              </div>
            </div>
          </div>

          {/* السعر */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-on-surface-variant">الإجمالي الحالي</dt>
                <dd className="font-bold text-on-surface"><SarAmount amount={props.oldTotalInclTax} /></dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-on-surface-variant">بعد التعديل</dt>
                <dd className="font-extrabold text-[#003749]"><SarAmount amount={newTotal} /></dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              {Math.abs(diff) < 0.005 ? (
                <p className="text-[13px] font-bold text-on-surface-variant">لا يوجد فرق في السعر.</p>
              ) : diff > 0 ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3 text-[13px] font-bold leading-relaxed text-emerald-950">
                  <div className="flex items-center justify-between">
                    <span>مبلغ إضافي مستحق</span>
                    <span className="text-base font-black"><SarAmount amount={diff} /></span>
                  </div>
                  <p className="mt-1.5 text-[12px] font-semibold text-emerald-900/90">
                    {isPaid
                      ? "بعد حفظ التعديل سيتم تحويلك لصفحة الدفع لسداد الفرق أونلاين."
                      : "يُضاف الفرق إلى إجمالي الحجز ويُدفع عند إتمام الدفع."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-sky-200/80 bg-sky-50/90 p-3 text-[13px] font-bold leading-relaxed text-sky-950">
                  <div className="flex items-center justify-between">
                    <span>الفرق لصالحك</span>
                    <span className="text-base font-black"><SarAmount amount={diff} /></span>
                  </div>
                  <p className="mt-1.5 text-[12px] font-semibold text-sky-900/90">
                    {isPaid
                      ? `تُسجَّل مستحقات لك لدى الإدارة ويُرَدّ المبلغ إليك (نقداً في الفرع أو عبر ${
                          props.paymentMethod
                            ? bookingPaymentMethodLabelAr(props.paymentMethod)
                            : "نفس وسيلة الدفع"
                        }).`
                      : "يُخفَّض إجمالي الحجز وتدفع الإجمالي الجديد عند إتمام الدفع."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* تذييل ثابت */}
        <div className="flex gap-2 border-t border-neutral-200 bg-white px-5 py-4">
          <button
            type="button"
            disabled={pending || unchanged}
            onClick={submit}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#003749] px-5 py-3 text-sm font-extrabold text-white shadow-md transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "جاري الحفظ…" : "حفظ التعديل"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={props.onClose}
            className="inline-flex items-center justify-center rounded-xl border-2 border-[#003749] bg-white px-5 py-3 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:bg-[#003749]/5 disabled:opacity-60"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
