import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

/** يطابق المشروع الشغال: نفس اسم الملف والعائلة في VFS */
const FONT_VFS_NAME = "Amiri-Regular.ttf";
const FONT_FAMILY = "Amiri";

const BRANCH_LABEL_AR: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

function paymentMethodLabelAr(code: string | null | undefined): string {
  switch (code) {
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
      return code?.trim() || "—";
  }
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fontPathAmiri(): string {
  return path.join(process.cwd(), "lib", "fonts", "Amiri-Regular.ttf");
}

/** نفس تسلسل المشروع الشغال: Base64 في VFS + addFont بثلاث وسائط فقط + setLanguage('ar') */
function registerAmiriFont(doc: jsPDF, fontPath: string): void {
  if (!fs.existsSync(fontPath)) {
    throw new Error(`خط Amiri غير موجود: ${fontPath}`);
  }
  const fontBytes = fs.readFileSync(fontPath);
  const fontBase64 = fontBytes.toString("base64");
  doc.addFileToVFS(FONT_VFS_NAME, fontBase64);
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "normal");
  doc.setFont(FONT_FAMILY, "normal");
  doc.setLanguage("ar");
}

function rgb(doc: jsPDF, r: number, g: number, b: number): void {
  doc.setTextColor(r, g, b);
}

/**
 * فاتورة PDF — jsPDF + Amiri بنفس أسلوب المشروع الشغال (بدون Identity-H وبدون binary في VFS).
 */
export function buildBookingInvoicePdfBuffer(booking: BookingPaymentSnapshot): Promise<Buffer> {
  const fp = fontPathAmiri();
  const branchLabel = BRANCH_LABEL_AR[booking.branch] ?? booking.branch;
  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
  const dropoff = fmtDateTime(dropoffD);
  const t = booking.totals;
  const vatPct = booking.car.vatRatePercent;

  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4", compress: true });
  registerAmiriFont(doc, fp);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const rightX = pageW - margin;
  const lineStep = 14;

  let y = margin;

  const rtlLine = (text: string, fontSize: number, r: number, g: number, b: number, step = lineStep) => {
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(fontSize);
    rgb(doc, r, g, b);
    doc.text(text, rightX, y, { align: "right", maxWidth: contentW });
    y += step;
  };

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      registerAmiriFont(doc, fp);
      y = margin;
    }
  };

  rtlLine("فاتورة — تم الدفع", 16, 0, 55, 73, 20);
  rtlLine(`طلب حجز رقم #${booking.id}`, 11, 51, 51, 51, 22);

  rtlLine(`الاسم: ${booking.fullName}`, 11, 17, 17, 17);
  rtlLine(`الجوال: ${booking.phone}`, 11, 17, 17, 17);
  rtlLine(`المركبة: ${booking.car.fullTitle} — ${booking.car.categoryTitle}`, 11, 17, 17, 17);
  rtlLine(`الاستلام: ${pickup}`, 11, 17, 17, 17);
  rtlLine(`التسليم: ${dropoff}`, 11, 17, 17, 17);
  rtlLine(`طريقة الدفع: ${paymentMethodLabelAr(booking.paymentMethod)}`, 11, 17, 17, 17);
  if (booking.paidAt) {
    rtlLine(`تاريخ الدفع: ${fmtDateTime(booking.paidAt)}`, 11, 17, 17, 17);
  }
  if (booking.pickupMode === "DELIVERY") {
    rtlLine(`التوصيل: ${(booking.deliveryAddress ?? "").trim() || "—"}`, 11, 17, 17, 17);
  } else {
    rtlLine(`الفرع: ${branchLabel}`, 11, 17, 17, 17);
  }

  y += 6;
  rtlLine("تفاصيل المبالغ", 12, 0, 55, 73, 18);

  const moneyCol = 100;
  const descMaxW = contentW - moneyCol;

  const row = (
    descAr: string,
    amountExclTax: number,
    fontSize = 10,
    descColor: [number, number, number] = [17, 17, 17],
  ) => {
    newPageIfNeeded(lineStep + 4);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(fontSize);
    rgb(doc, descColor[0], descColor[1], descColor[2]);
    const amt = formatSarAmount(amountExclTax);
    doc.text(`${amt} ر.س`, margin, y, { align: "left" });
    doc.text(descAr, rightX, y, { align: "right", maxWidth: descMaxW });
    y += lineStep;
  };

  row(`الإيجار (${booking.numberOfDays} يوم) — ${booking.car.fullTitle}`, t.rentalExclTax);
  for (const a of booking.addons) {
    row(a.titleAr, a.lineTotalExclTax);
  }
  if (booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0) {
    row("شحن بين المدن", booking.interCityShipping.feeExclVatSar);
  }
  for (const f of booking.checkoutOneTimeFees) {
    row(f.labelAr, f.feeExclVatSar);
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  row("المجموع غير شامل الضريبة", t.subtotalExclTax);
  row(`ضريبة القيمة المضافة (${vatPct}%)`, t.vatAmount);
  row("الإجمالي", t.totalInclTax, 12, [0, 55, 73]);

  y += 8;
  newPageIfNeeded(lineStep);
  rtlLine("فاتورة إلكترونية — للاستفسار يُرجى التواصل مع خدمة العملاء.", 9, 102, 102, 102, lineStep);

  const out = doc.output("arraybuffer");
  return Promise.resolve(Buffer.from(out));
}
