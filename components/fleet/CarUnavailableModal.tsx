"use client";

import { ArrowLeftRight, CalendarOff, Loader2, MapPinOff, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { CheckoutAlternativeDTO } from "@/lib/checkout-alternatives";
import { DIALOG_Z } from "@/lib/overlay-z-index";
import { dailyRentalInclTaxSar, type RentalPriceDisplayMode } from "@/lib/pricing";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  open: boolean;
  onClose: () => void;
  onChangeDates: () => void;
  fleetUnits?: number;
  /**
   * سياق البحث — بدونه لا يمكن اقتراح بدائل، فيعود المودال إلى شكله السابق
   * (رسالة + «غيّر التواريخ») بدل أن يعرض قائمة فارغة.
   */
  modelId?: number;
  pickupIso?: string | null;
  days?: number;
  branchSlug?: string | null;
  /** اختيار بديل — الأب يبني الرابط لأنه يملك بقية معاملات الرحلة. */
  onPickAlternative?: (modelId: number) => void;
  /** وضع التصفح الاختياري — يُخفي رسالة «غير متاح» ويُظهر قائمة البدائل مباشرةً
   * بعنوان محايد، لأن المستخدم اختار بنفسه تغيير السيارة.
   */
  browsing?: boolean;
  /** طريقة عرض السعر — توافق طريقة عرض صفحة الحجز. */
  priceMode?: RentalPriceDisplayMode;
};

export function CarUnavailableModal({
  open,
  onClose,
  onChangeDates,
  fleetUnits,
  modelId,
  pickupIso,
  days,
  branchSlug,
  onPickAlternative,
  browsing = false,
  priceMode = "INCLUSIVE",
}: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [alternatives, setAlternatives] = useState<CheckoutAlternativeDTO[] | null>(null);
  const [loadingAlts, setLoadingAlts] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const canSuggest =
    open && Boolean(modelId && pickupIso && branchSlug && onPickAlternative);

  useEffect(() => {
    if (!canSuggest) {
      setAlternatives(null);
      return;
    }
    const ctrl = new AbortController();
    setLoadingAlts(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          excludeModelId: String(modelId),
          pickupDate: String(pickupIso).slice(0, 10),
          days: String(days && days >= 1 ? days : 1),
          branch: String(branchSlug),
        });
        const res = await fetch(`/api/bookings/direct/alternatives?${params}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          alternatives?: CheckoutAlternativeDTO[];
        };
        setAlternatives(data.ok && data.alternatives ? data.alternatives : []);
      } catch {
        if (!ctrl.signal.aborted) setAlternatives([]);
      } finally {
        if (!ctrl.signal.aborted) setLoadingAlts(false);
      }
    })();
    return () => ctrl.abort();
  }, [canSuggest, modelId, pickupIso, days, branchSlug]);

  if (!open) return null;

  const isNoFleet = fleetUnits === 0;
  const hasAlternatives = Boolean(alternatives && alternatives.length > 0);

  // ── وضع «غير متاح» العادي ──
  const title = isNoFleet
    ? isRTL ? "غير متوفرة بالفرع" : "Unavailable at Branch"
    : isRTL ? "غير متاح" : "Unavailable";

  const message = isNoFleet
    ? isRTL ? "هذه السيارة غير متوفرة في الفرع المختار." : "This vehicle is not available at the selected branch."
    : isRTL ? "خلال هذه الفترة (جميع السيارات محجوزة)" : "For these dates (fully booked)";

  const primaryBtnText = isNoFleet
    ? isRTL ? "تغيير الفرع / البيانات" : "Change Branch / Dates"
    : isRTL ? "اختيار تواريخ أخرى" : "Choose Other Dates";

  const secondaryBtnText = isRTL ? "تصفح الأسطول" : "Browse Fleet";
  const closeLabel = isRTL ? "إغلاق" : "Close";

  // ── وضع التصفح الاختياري — عنوان محايد ──
  const browsingTitle = isRTL ? "غيّر سيارتك" : "Switch Your Car";
  const browsingSubtitle = isRTL
    ? "اختر سيارة أخرى بنفس التواريخ والفرع"
    : "Pick another car for the same dates & branch";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: DIALOG_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="car-unavailable-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/45 backdrop-blur-[3px] transition-opacity"
        aria-label={closeLabel}
        onClick={onClose}
      />

      <div
        className={`relative w-full overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06] ${
          hasAlternatives ? "max-w-[520px]" : "max-w-[420px]"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 z-10 rounded-full p-1.5 text-[#aaa08e] transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </button>

        <div
          className="max-h-[85vh] overflow-y-auto px-6 pb-7 pt-9 text-center sm:px-8"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* ── أيقونة + عنوان: يختلفان حسب الوضع ── */}
          <div
            className="mx-auto mb-5 flex size-[4.25rem] items-center justify-center rounded-2xl shadow-inner"
            style={{
              background: browsing
                ? `linear-gradient(145deg, rgba(219,184,120,0.22) 0%, rgba(219,184,120,0.06) 100%)`
                : `linear-gradient(145deg, rgba(219,184,120,0.18) 0%, rgba(0,55,73,0.08) 100%)`,
              color: TEAL,
            }}
          >
            {browsing ? (
              <ArrowLeftRight className="size-9" strokeWidth={1.75} aria-hidden />
            ) : isNoFleet ? (
              <MapPinOff className="size-9" strokeWidth={1.75} aria-hidden />
            ) : (
              <CalendarOff className="size-9" strokeWidth={1.75} aria-hidden />
            )}
          </div>

          <h2
            id="car-unavailable-title"
            className="text-[1.35rem] font-extrabold tracking-tight text-[#003749] sm:text-2xl"
          >
            {browsing ? browsingTitle : title}
          </h2>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#6b7280]">
            {browsing ? browsingSubtitle : message}
          </p>

          {loadingAlts ? (
            <div className="mt-7 flex items-center justify-center gap-2 text-[13px] font-bold text-[#aaa08e]">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {isRTL ? "جاري البحث عن سيارات متاحة…" : "Finding available cars…"}
            </div>
          ) : null}

          {hasAlternatives ? (
            <div className="mt-7 text-start">
              <p className="mb-3 text-[13px] font-extrabold text-[#003749]">
                {isRTL
                  ? "متاحة بنفس التواريخ ونفس الفرع:"
                  : "Available for the same dates and branch:"}
              </p>
              <ul className="space-y-2">
                {alternatives!.map((alt) => (
                  <li key={alt.modelId}>
                    <button
                      type="button"
                      onClick={() => {
                        onPickAlternative?.(alt.modelId);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[#ebe4d3] bg-white p-2.5 text-start transition-all hover:border-[#dbb878]/70 hover:bg-[#fffdf8] hover:shadow-[0_10px_24px_-14px_rgba(15,61,71,0.35)]"
                    >
                      <span className="relative size-[52px] shrink-0 overflow-hidden rounded-xl bg-[#fdfbf6]">
                        <Image
                          src={alt.image}
                          alt={alt.alt}
                          fill
                          sizes="52px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-extrabold text-[#003749]">
                          {alt.fullTitle}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-bold text-[#8a7752]">
                            {alt.categoryTitle}
                          </span>
                          {alt.sameCategory ? (
                            <span className="shrink-0 rounded-full bg-[#dbb878]/18 px-1.5 py-px text-[9.5px] font-extrabold text-[#8a6d2f]">
                              {isRTL ? "نفس الفئة" : "Same class"}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        {priceMode === "INCLUSIVE" ? (
                          <>
                            {alt.originalPricePerDayExclTax > alt.pricePerDayExclTax ? (
                              <span
                                className="block text-[11px] font-bold tabular-nums text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-75"
                                dir="ltr"
                              >
                                {formatSarAmount(
                                  dailyRentalInclTaxSar(alt.originalPricePerDayExclTax, alt.vatRatePercent),
                                )}{" "}
                                <SarCurrencyGlyph />
                              </span>
                            ) : null}
                            <span
                              className="block text-[14px] font-extrabold tabular-nums text-[#003749]"
                              dir="ltr"
                            >
                              {formatSarAmount(
                                dailyRentalInclTaxSar(alt.pricePerDayExclTax, alt.vatRatePercent),
                              )}{" "}
                              <span className="text-[#dbb878]" aria-hidden>
                                <SarCurrencyGlyph />
                              </span>
                            </span>
                            <span className="block text-[10px] font-bold text-[#aaa08e]">
                              {isRTL ? "يومياً (شامل ض)" : "per day (incl. tax)"}
                            </span>
                          </>
                        ) : priceMode === "SPLIT" ? (
                          <>
                            {alt.originalPricePerDayExclTax > alt.pricePerDayExclTax ? (
                              <span
                                className="block text-[11px] font-bold tabular-nums text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-75"
                                dir="ltr"
                              >
                                {formatSarAmount(alt.originalPricePerDayExclTax)}{" "}
                                <SarCurrencyGlyph />
                              </span>
                            ) : null}
                            <span
                              className="block text-[14px] font-extrabold tabular-nums text-[#003749]"
                              dir="ltr"
                            >
                              {formatSarAmount(alt.pricePerDayExclTax)}{" "}
                              <span className="text-[#dbb878]" aria-hidden>
                                <SarCurrencyGlyph />
                              </span>
                            </span>
                            <span className="block text-[10px] font-bold text-[#aaa08e]">
                              {isRTL ? "يومياً (قبل ض)" : "per day (ex. tax)"}
                            </span>
                          </>
                        ) : (
                          /* EX_TAX */
                          <>
                            {alt.originalPricePerDayExclTax > alt.pricePerDayExclTax ? (
                              <span
                                className="block text-[11px] font-bold tabular-nums text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-75"
                                dir="ltr"
                              >
                                {formatSarAmount(alt.originalPricePerDayExclTax)}{" "}
                                <SarCurrencyGlyph />
                              </span>
                            ) : null}
                            <span
                              className="block text-[14px] font-extrabold tabular-nums text-[#003749]"
                              dir="ltr"
                            >
                              {formatSarAmount(alt.pricePerDayExclTax)}{" "}
                              <span className="text-[#dbb878]" aria-hidden>
                                <SarCurrencyGlyph />
                              </span>
                            </span>
                            <span className="block text-[10px] font-bold text-[#aaa08e]">
                              {isRTL ? "يومياً" : "per day"}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* أزرار التذييل — تُخفى في وضع التصفح الاختياري */}
          {!browsing ? (
            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  onChangeDates();
                  onClose();
                }}
                className={
                  hasAlternatives
                    ? "w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3 text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
                    : "w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_28px_-10px_rgba(201,163,86,0.55)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
                }
                style={
                  hasAlternatives
                    ? undefined
                    : { background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }
                }
              >
                {primaryBtnText}
              </button>
              <Link
                href="/fleet"
                onClick={onClose}
                className="w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3 text-center text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
              >
                {secondaryBtnText}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
