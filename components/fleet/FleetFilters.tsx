"use client";

import type { ReactNode } from "react";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import type {
  FleetBrandFilterOption,
  FleetCategoryFilterOption,
  FleetPriceBounds,
} from "@/lib/fleet-data";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const DEFAULT_DAILY_PRICE_LABEL: ReactNode = (
  <>السعر اليومي (<SarCurrencyGlyph />، غير شامل الضريبة)</>
);

const PRICE_FILTER_DEBOUNCE_MS = 320;

function formatPrice(n: number): string {
  return n.toLocaleString("en-US");
}

type FleetFiltersProps = {
  categories: FleetCategoryFilterOption[];
  brands: FleetBrandFilterOption[];
  priceBounds: FleetPriceBounds;
  dailyPriceLabel?: ReactNode;
  /** standalone = قسم منفصل (قديم) · embedded = داخل بطاقة الحجز الموحّدة */
  variant?: "standalone" | "embedded";
};

const EMBEDDED_FIELD_CLASS =
  "w-full rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] py-3 ps-4 text-[13px] text-[#3d3428] focus:ring-2 focus:ring-[#dbb878]/35 disabled:opacity-60";

export function FleetFilters({
  categories,
  brands,
  priceBounds,
  dailyPriceLabel = DEFAULT_DAILY_PRICE_LABEL,
  variant = "standalone",
}: FleetFiltersProps) {
  const embedded = variant === "embedded";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appliedCategory = useMemo(() => {
    const raw = searchParams.get("category");
    if (!raw || raw === "all") return "all";
    return categories.some((c) => c.slug === raw) ? raw : "all";
  }, [searchParams, categories]);

  const appliedBrandId = useMemo(() => {
    const raw = searchParams.get("brand");
    if (!raw) return "all";
    const id = Number(raw);
    if (!Number.isFinite(id)) return "all";
    return brands.some((b) => b.id === id) ? String(id) : "all";
  }, [searchParams, brands]);

  const appliedMaxPrice = useMemo(() => {
    const raw = searchParams.get("maxPrice");
    if (!raw) return priceBounds.max;
    const n = Number(raw);
    if (!Number.isFinite(n)) return priceBounds.max;
    return Math.min(priceBounds.max, Math.max(priceBounds.min, n));
  }, [searchParams, priceBounds]);

  const [sliderPrice, setSliderPrice] = useState(appliedMaxPrice);

  useEffect(() => {
    setSliderPrice(appliedMaxPrice);
  }, [appliedMaxPrice]);

  useEffect(() => {
    return () => {
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    };
  }, []);

  const pushFilters = useCallback(
    (next: { category?: string; brandId?: string; maxPrice?: number }) => {
      const category = next.category ?? appliedCategory;
      const brandId = next.brandId ?? appliedBrandId;
      const maxPrice = next.maxPrice ?? appliedMaxPrice;

      const params = new URLSearchParams(searchParams.toString());

      if (category === "all") params.delete("category");
      else params.set("category", category);

      if (brandId === "all") params.delete("brand");
      else params.set("brand", brandId);

      if (maxPrice >= priceBounds.max) params.delete("maxPrice");
      else params.set("maxPrice", String(maxPrice));

      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [
      appliedBrandId,
      appliedCategory,
      appliedMaxPrice,
      pathname,
      priceBounds.max,
      router,
      searchParams,
    ],
  );

  function onSliderPriceChange(value: number) {
    setSliderPrice(value);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      pushFilters({ maxPrice: value });
    }, PRICE_FILTER_DEBOUNCE_MS);
  }

  const sliderStep = useMemo(() => {
    const span = priceBounds.max - priceBounds.min;
    if (span <= 100) return 10;
    if (span <= 500) return 25;
    return 50;
  }, [priceBounds]);

  const atMaxBound = sliderPrice >= priceBounds.max;

  const labelClass = embedded
    ? "ms-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b5a3b]"
    : "ms-1 text-xs font-bold uppercase tracking-widest text-primary";

  const filtersGrid = (
    <div className={`grid grid-cols-1 ${embedded ? "gap-4 md:gap-5" : "gap-8"} md:grid-cols-3`}>
            <div className="space-y-2">
              <label
                htmlFor="fleet-filter-category"
                className={labelClass}
              >
                التصنيف
              </label>
              <select
                id="fleet-filter-category"
                className={embedded ? EMBEDDED_FIELD_CLASS : "w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container disabled:opacity-60"}
                value={appliedCategory}
                disabled={isPending}
                onChange={(e) => pushFilters({ category: e.target.value })}
                dir="rtl"
              >
                <option value="all">كل التصنيفات</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="fleet-filter-brand"
                className={labelClass}
              >
                الماركة
              </label>
              <select
                id="fleet-filter-brand"
                className={embedded ? EMBEDDED_FIELD_CLASS : "w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container disabled:opacity-60"}
                value={appliedBrandId}
                disabled={isPending}
                onChange={(e) => pushFilters({ brandId: e.target.value })}
                dir="rtl"
              >
                <option value="all">كل الماركات</option>
                {brands.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="fleet-filter-max-price"
                  className={labelClass}
                >
                  {dailyPriceLabel}
                </label>
                {isPending ? (
                  <span
                    className={
                      embedded
                        ? "text-[10px] font-semibold text-[#aaa08e]"
                        : "text-[10px] font-semibold text-on-surface-variant"
                    }
                  >
                    جاري التحديث…
                  </span>
                ) : null}
              </div>
              <p className="text-center">
                <span
                  className={
                    embedded
                      ? "text-[10px] font-semibold text-[#aaa08e]"
                      : "text-[10px] font-semibold text-on-surface-variant"
                  }
                >
                  حتى
                </span>{" "}
                <SarAmountWithSymbol
                  bold
                  amountClassName={
                    embedded
                      ? "text-base font-extrabold tabular-nums text-[#003749]"
                      : "text-base font-extrabold tabular-nums text-primary"
                  }
                >
                  {atMaxBound ? `${formatPrice(priceBounds.max)}+` : formatPrice(sliderPrice)}
                </SarAmountWithSymbol>
              </p>
              <div className="flex items-center gap-3 py-1">
                <span
                  className="shrink-0 text-xs font-medium tabular-nums text-on-surface-variant"
                  dir="ltr"
                >
                  {formatPrice(priceBounds.min)}
                </span>
                <input
                  id="fleet-filter-max-price"
                  className={`h-2 min-w-0 flex-1 cursor-pointer ${embedded ? "accent-[#dbb878]" : "accent-primary"}`}
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={sliderStep}
                  value={sliderPrice}
                  disabled={isPending || priceBounds.min >= priceBounds.max}
                  onChange={(e) => onSliderPriceChange(Number(e.target.value))}
                  onInput={(e) => onSliderPriceChange(Number(e.currentTarget.value))}
                  aria-valuemin={priceBounds.min}
                  aria-valuemax={priceBounds.max}
                  aria-valuenow={sliderPrice}
                  aria-valuetext={
                    atMaxBound
                      ? `${formatPrice(priceBounds.max)} ريال وأكثر`
                      : `${formatPrice(sliderPrice)} ريال`
                  }
                  aria-label="حد أقصى للسعر اليومي"
                />
                <span
                  className="shrink-0 text-xs font-medium tabular-nums text-on-surface-variant"
                  dir="ltr"
                >
                  {formatPrice(priceBounds.max)}+
                </span>
              </div>
            </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="border-t border-[#f0ebe4] bg-gradient-to-b from-[#fdfbf6]/70 to-white px-3 py-4 sm:px-5 sm:py-5">
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b5a3b] sm:mb-4">
          تصفية النتائج
        </p>
        {filtersGrid}
      </div>
    );
  }

  return (
    <section className="bg-surface-container-low px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <div className="editorial-shadow rounded-2xl bg-surface-container-lowest p-8">{filtersGrid}</div>
      </div>
    </section>
  );
}
