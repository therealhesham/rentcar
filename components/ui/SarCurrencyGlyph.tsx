import { SAR_CURRENCY_SYMBOL } from "@/lib/sar-currency";

type Props = {
  /** استخدمه بجانب أرقام بخط عريض (مثل بطاقة الأسطول). */
  bold?: boolean;
  className?: string;
};

/** رمز الريال U+20C1 مع خط يوفّر الشكل (خط Cairo الافتراضي لا يحتوي الحرف). */
export function SarCurrencyGlyph({ bold, className }: Props) {
  return (
    <span
      className={`sar-currency-glyph ${bold ? "sar-currency-glyph--bold" : ""} ${className ?? ""}`.trim()}
      aria-hidden
    >
      {SAR_CURRENCY_SYMBOL}
    </span>
  );
}
