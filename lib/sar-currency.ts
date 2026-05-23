import { formatSarAmount } from "@/lib/booking-checkout-pricing";

/** Unicode U+20C1 (SAUDI RIYAL SIGN). عرِّفه دائماً عبر مكوّن SarCurrencyGlyph مع خط saudi_riyal في globals.css. */
export const SAR_CURRENCY_SYMBOL = "\u20C1";

/** CSS لخط رمز الريال (بريد HTML / الواجهة). */
export const SAUDI_RIYAL_FONT_CSS_URL =
  "https://cdn.jsdelivr.net/npm/@emran-alhaddad/saudi-riyal-font@1.1.0/index.css";

/** `<span>` لرمز الريال في HTML (فاتورة البريد). */
export function sarCurrencySymbolHtml(): string {
  return `<span style="font-family:'saudi_riyal',sans-serif;font-size:1.08em;line-height:1;vertical-align:baseline;">${SAR_CURRENCY_SYMBOL}</span>`;
}

/** مبلغ + رمز الريال في HTML (الرقم ثم الرمز — LTR). */
export function formatSarAmountHtml(amount: number): string {
  return `<span dir="ltr" style="unicode-bidi:isolate;white-space:nowrap;">${formatSarAmount(amount)}&nbsp;${sarCurrencySymbolHtml()}</span>`;
}

/** مبلغ + رمز الريال في نص عادي. */
export function formatSarAmountPlain(amount: number): string {
  return `${formatSarAmount(amount)} ${SAR_CURRENCY_SYMBOL}`;
}
