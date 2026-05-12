import type { ReactNode } from "react";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

type Props = {
  children: ReactNode;
  bold?: boolean;
  /** على المبلغ (الأرقام) */
  amountClassName?: string;
  /** على رمز العملة (مثل لون مختلف في صف الإجمالي) */
  glyphClassName?: string;
  className?: string;
};

/** رقم ثم رمز الريال بترتيب LTR ثابت (لا ينعكس مع dir=rtl للصفحة). */
export function SarAmountWithSymbol({
  children,
  bold,
  amountClassName,
  glyphClassName,
  className,
}: Props) {
  return (
    <span
      dir="ltr"
      className={`inline-flex flex-row flex-nowrap items-baseline gap-1.5 tabular-nums ${className ?? ""}`.trim()}
    >
      <span className={amountClassName} dir="ltr">
        {children}
      </span>
      <SarCurrencyGlyph
        bold={bold}
        className={`shrink-0 ${glyphClassName ?? ""}`.trim()}
      />
    </span>
  );
}
