import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { parseBookingPricingSnapshot } from "@/lib/booking-pricing-snapshot";

export function BookingAddonsSnapshot({ raw }: { raw: string }) {
  try {
    const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(raw);
    const rows: { key: string; title: string; amount: number | null }[] = [];
    addons.forEach((a, i) => {
      rows.push({
        key: `addon-${i}`,
        title: a.titleAr,
        amount: a.lineTotalExclTax,
      });
    });
    if (interCityShipping && interCityShipping.feeExclVatSar > 0) {
      rows.push({
        key: "inter-city",
        title: interCityShipping.labelAr,
        amount: interCityShipping.feeExclVatSar,
      });
    }
    for (const f of checkoutOneTimeFees) {
      rows.push({
        key: `co-${f.slug}`,
        title: f.labelAr,
        amount: f.feeExclVatSar,
      });
    }
    if (rows.length === 0) {
      return <p className="text-sm text-on-surface-variant">لا توجد بنود مسجّلة.</p>;
    }
    return (
      <ul className="space-y-2">
        {rows.map((it) => (
          <li
            key={it.key}
            className="flex justify-between gap-2 border-b border-outline-variant/15 pb-2 text-sm last:border-0"
          >
            <span className="font-medium text-on-surface">{it.title}</span>
            <span dir="ltr" className="shrink-0 tabular-nums font-bold text-on-surface-variant">
              {it.amount != null ? (
                <>
                  {it.amount} <SarCurrencyGlyph />
                </>
              ) : (
                ""
              )}
              <span className="ms-1 text-[10px] font-normal">غير شامل الضريبة</span>
            </span>
          </li>
        ))}
      </ul>
    );
  } catch {
    return (
      <pre
        className="max-h-48 overflow-auto rounded-lg bg-inverse-surface/5 p-3 text-xs"
        dir="ltr"
      >
        {raw}
      </pre>
    );
  }
}
