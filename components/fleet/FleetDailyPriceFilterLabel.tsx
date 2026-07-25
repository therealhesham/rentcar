import type { ReactNode } from "react";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import type { RentalPriceDisplayMode } from "@/lib/pricing";

/** عنوان شريط «الحد الأقصى للسعر اليومي» في صفحة الأسطول. */
export function fleetDailyPriceFilterLabel(mode: RentalPriceDisplayMode, locale: string = "ar"): ReactNode {
  const isEn = locale === "en";
  if (mode === "INCLUSIVE") {
    return isEn ? (
      <>Max Daily Price (<SarCurrencyGlyph />, incl. VAT)</>
    ) : (
      <>الحد الأقصى للسعر اليومي (<SarCurrencyGlyph />، شامل الضريبة)</>
    );
  }
  if (mode === "SPLIT") {
    return isEn ? (
      <>Max Daily Price (<SarCurrencyGlyph />, excl. VAT)</>
    ) : (
      <>الحد الأقصى للسعر اليومي (<SarCurrencyGlyph />، قبل الضريبة)</>
    );
  }
  return isEn ? (
    <>Daily Price (<SarCurrencyGlyph />, excl. VAT)</>
  ) : (
    <>السعر اليومي (<SarCurrencyGlyph />، غير شامل الضريبة)</>
  );
}
