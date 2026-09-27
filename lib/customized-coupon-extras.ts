/**
 * خصم ثابت يرافق **كل** كود مخصَّص (`CustomizedCoupon`) فوق خصمه الأساسي:
 * نسبة من سعر إضافة «كيلومتر مفتوح» ومن رسوم الشحن بين المدن.
 *
 * الملف بلا أي استيراد لقاعدة البيانات عمداً — تستخدمه صفحة الإتمام (client) لعرض
 * نفس الأرقام التي يحسبها الخادم عند إنشاء الحجز.
 */

export const CUSTOMIZED_COUPON_EXTRAS_DISCOUNT_PERCENT = 50;

/** `RentalAddon.slug` لإضافة الكيلومتر المفتوح. */
export const UNLIMITED_KM_ADDON_SLUG = "unlimited-km";

const LABEL_SUFFIX_AR = ` (خصم ${CUSTOMIZED_COUPON_EXTRAS_DISCOUNT_PERCENT}٪)`;

/** المبلغ بعد خصم الكود المخصَّص (دون ضريبة)، مقرَّب لهللتين. */
export function customizedCouponExtraPrice(amountExclTax: number): number {
  return Math.round(amountExclTax * (100 - CUSTOMIZED_COUPON_EXTRAS_DISCOUNT_PERCENT)) / 100;
}

export function isUnlimitedKmAddonSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === UNLIMITED_KM_ADDON_SLUG;
}

/**
 * يطبّق الخصم على بندي الكيلومتر المفتوح والشحن بين المدن داخل لقطة التسعير
 * (`addonsJson` بعد `JSON.parse`) — يعدّل الكائن مكانه. السعر المخفَّض يُجمَّد في
 * اللقطة نفسها، فكل ما يقرأ منها (الإجمالي، الفاتورة، كشف الحساب، تعديل المدة)
 * يراه دون أي تعديل إضافي. السعر الأصلي يُحفظ بجانبه، ووجوده يمنع تطبيق الخصم مرتين.
 *
 * @returns إجمالي التوفير (دون ضريبة) لكامل مدة الحجز.
 */
export function applyCustomizedCouponExtrasDiscount(snap: Record<string, unknown>): number {
  let savedExclTax = 0;

  if (Array.isArray(snap.items)) {
    snap.items = snap.items.map((raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const it = raw as Record<string, unknown>;
      if (!isUnlimitedKmAddonSlug(String(it.slug ?? "")) || it.originalPricePerDayExclTax != null) {
        return it;
      }
      const original = Number(it.pricePerDayExclTax ?? 0);
      const days = Number(it.days ?? 0);
      if (!(original > 0) || !(days > 0)) return it;
      const discounted = customizedCouponExtraPrice(original);
      const lineTotal = Math.round(discounted * days * 100) / 100;
      savedExclTax += Number(it.lineTotalExclTax ?? original * days) - lineTotal;
      return {
        ...it,
        titleAr: `${String(it.titleAr ?? "")}${LABEL_SUFFIX_AR}`,
        originalPricePerDayExclTax: original,
        pricePerDayExclTax: discounted,
        lineTotalExclTax: lineTotal,
      };
    });
  }

  const ship = snap.interCityShipping;
  if (ship && typeof ship === "object") {
    const s = ship as Record<string, unknown>;
    const original = Number(s.feeExclVatSar ?? 0);
    if (original > 0 && s.originalFeeExclVatSar == null) {
      const discounted = customizedCouponExtraPrice(original);
      savedExclTax += original - discounted;
      snap.interCityShipping = {
        ...s,
        labelAr: `${String(s.labelAr ?? "")}${LABEL_SUFFIX_AR}`,
        originalFeeExclVatSar: original,
        feeExclVatSar: discounted,
      };
    }
  }

  return Math.round(savedExclTax * 100) / 100;
}
