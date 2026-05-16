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
};

export function FleetFilters({
  categories,
  brands,
  priceBounds,
  dailyPriceLabel = DEFAULT_DAILY_PRICE_LABEL,
}: FleetFiltersProps) {
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

  return (
    <section className="bg-surface-container-low px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <div className="editorial-shadow rounded-2xl bg-surface-container-lowest p-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="fleet-filter-category"
                className="ms-1 text-xs font-bold uppercase tracking-widest text-primary"
              >
                التصنيف
              </label>
              <select
                id="fleet-filter-category"
                className="w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container disabled:opacity-60"
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
                className="ms-1 text-xs font-bold uppercase tracking-widest text-primary"
              >
                الماركة
              </label>
              <select
                id="fleet-filter-brand"
                className="w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container disabled:opacity-60"
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
                  className="ms-1 text-xs font-bold uppercase tracking-widest text-primary"
                >
                  {dailyPriceLabel}
                </label>
                {isPending ? (
                  <span className="text-[10px] font-semibold text-on-surface-variant">جاري التحديث…</span>
                ) : null}
              </div>
              <p className="text-center">
                <span className="text-[10px] font-semibold text-on-surface-variant">حتى</span>{" "}
                <SarAmountWithSymbol
                  bold
                  amountClassName="text-base font-extrabold tabular-nums text-primary"
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
                  className="accent-primary h-2 min-w-0 flex-1 cursor-pointer"
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
        </div>
      </div>
    </section>
  );
}
