import type { ReactNode } from "react";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import type { RentalPriceDisplayMode } from "@/lib/pricing";

/** عنوان شريط «الحد الأقصى للسعر اليومي» في صفحة الأسطول. */
export function fleetDailyPriceFilterLabel(mode: RentalPriceDisplayMode): ReactNode {
  if (mode === "INCLUSIVE") {
    return <>الحد الأقصى للسعر اليومي (<SarCurrencyGlyph />، شامل الضريبة)</>;
  }
  if (mode === "SPLIT") {
    return <>الحد الأقصى للسعر اليومي (<SarCurrencyGlyph />، قبل الضريبة)</>;
  }
  return <>السعر اليومي (<SarCurrencyGlyph />، غير شامل الضريبة)</>;
}
