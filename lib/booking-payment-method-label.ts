/** تسمية عربية لوسيلة الدفع المخزّنة على الحجز. */
export function bookingPaymentMethodLabelAr(code: string | null | undefined): string {
  switch (code?.trim().toUpperCase()) {
    case "TABBY":
      return "تابي";
    case "TAMARA":
      return "تمارا";
    case "CARD":
      return "بطاقة ائتمانية";
    case "APPLE_PAY":
      return "Apple Pay";
    case "POINTS":
      return "استبدال نقاط";
    default:
      return code?.trim() ? code : "—";
  }
}
