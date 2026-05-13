import fs from "node:fs";
import path from "node:path";

import "jspdf/dist/polyfills.es.js";
import { jsPDF } from "jspdf";

import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

/**
 * Temporary: English LTR invoice. Set to `false` to restore Arabic (Amiri + RTL).
 */
const INVOICE_LANG_EN = true;

/** نفس اسم الملف داخل الـ VFS */
const FONT_VFS_NAME = "Amiri-Regular.ttf";
const FONT_FAMILY_AR = "Amiri";

const BRANCH_LABEL_AR: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

const BRANCH_LABEL_EN: Record<string, string> = {
  jeddah: "Jeddah",
  madinah: "Madinah",
  tabuk: "Tabuk",
};

function paymentMethodLabel(code: string | null | undefined): string {
  if (INVOICE_LANG_EN) {
    switch (code) {
      case "TABBY":
        return "Tabby";
      case "TAMARA":
        return "Tamara";
      case "CARD":
        return "Credit card";
      case "APPLE_PAY":
        return "Apple Pay";
      case "POINTS":
        return "Points redemption";
      default:
        return code?.trim() || "—";
    }
  }
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
  return d.toLocaleString(INVOICE_LANG_EN ? "en-US" : "ar-SA", {
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

/**
 * تسجيل الخط داخل jsPDF (Arabic mode فقط)
 */
function registerAmiriFont(doc: jsPDF, fontPath: string): void {
  if (!fs.existsSync(fontPath)) {
    throw new Error(`خط Amiri غير موجود: ${fontPath}`);
  }

  const fontBytes = fs.readFileSync(fontPath);
  const fontBase64 = fontBytes.toString("base64");

  doc.addFileToVFS(FONT_VFS_NAME, fontBase64);
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY_AR, "normal");

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setLanguage("ar");
}

function registerInvoiceFont(doc: jsPDF, amiriPath: string | null): void {
  if (INVOICE_LANG_EN) {
    doc.setFont("helvetica", "normal");
    return;
  }
  if (!amiriPath) {
    throw new Error("Amiri font path required for Arabic invoice");
  }
  registerAmiriFont(doc, amiriPath);
}

function rgb(doc: jsPDF, r: number, g: number, b: number): void {
  doc.setTextColor(r, g, b);
}

function shapeInvoiceText(doc: jsPDF, text: string): string {
  if (INVOICE_LANG_EN) return text;
  return doc.processArabic(text);
}

/**
 * فاتورة PDF (عربي أو إنجليزي حسب `INVOICE_LANG_EN`)
 */
export async function buildBookingInvoicePdfBuffer(
  booking: BookingPaymentSnapshot
): Promise<Buffer> {
  const fp = INVOICE_LANG_EN ? null : fontPathAmiri();

  const branchLabel = INVOICE_LANG_EN
    ? BRANCH_LABEL_EN[booking.branch] ?? booking.branch
    : BRANCH_LABEL_AR[booking.branch] ?? booking.branch;

  const pickup = fmtDateTime(booking.pickupDate);

  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(
    dropoffD.getDate() + booking.numberOfDays
  );

  const dropoff = fmtDateTime(dropoffD);

  const t = booking.totals;
  const vatPct = booking.car.vatRatePercent;

  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
    putOnlyUsedFonts: true,
    compress: true,
  });

  registerInvoiceFont(doc, fp);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 48;
  const contentW = pageW - margin * 2;

  const rightX = pageW - margin;

  const lineStep = 18;

  let y = margin;

  const bodyFont = (): void => {
    doc.setFont(
      INVOICE_LANG_EN ? "helvetica" : FONT_FAMILY_AR,
      "normal"
    );
  };

  /**
   * LTR أو RTL حسب اللغة
   */
  const textLine = (
    text: string,
    fontSize: number,
    r: number,
    g: number,
    b: number,
    step = lineStep
  ) => {
    bodyFont();
    doc.setFontSize(fontSize);

    rgb(doc, r, g, b);

    const shaped = shapeInvoiceText(doc, text);

    if (INVOICE_LANG_EN) {
      doc.text(shaped, margin, y, {
        align: "left",
        maxWidth: contentW,
      });
    } else {
      doc.text(shaped, rightX, y, {
        align: "right",
        maxWidth: contentW,
      });
    }

    y += step;
  };

  /**
   * pagination
   */
  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();

      registerInvoiceFont(doc, fp);

      y = margin;
    }
  };

  /**
   * Header
   */
  textLine(
    INVOICE_LANG_EN ? "Invoice — Paid" : "فاتورة — تم الدفع",
    18,
    0,
    55,
    73,
    24
  );

  textLine(
    INVOICE_LANG_EN
      ? `Booking request #${booking.id}`
      : `طلب حجز رقم #${booking.id}`,
    11,
    60,
    60,
    60,
    28
  );

  /**
   * Booking Info
   */
  textLine(
    INVOICE_LANG_EN
      ? `Name: ${booking.fullName}`
      : `الاسم: ${booking.fullName}`,
    11,
    17,
    17,
    17
  );

  textLine(
    INVOICE_LANG_EN
      ? `Phone: ${booking.phone}`
      : `الجوال: ${booking.phone}`,
    11,
    17,
    17,
    17
  );

  textLine(
    INVOICE_LANG_EN
      ? `Vehicle: ${booking.car.fullTitle} — ${booking.car.categoryTitle}`
      : `المركبة: ${booking.car.fullTitle} — ${booking.car.categoryTitle}`,
    11,
    17,
    17,
    17
  );

  textLine(
    INVOICE_LANG_EN ? `Pickup: ${pickup}` : `الاستلام: ${pickup}`,
    11,
    17,
    17,
    17
  );

  textLine(
    INVOICE_LANG_EN ? `Drop-off: ${dropoff}` : `التسليم: ${dropoff}`,
    11,
    17,
    17,
    17
  );

  textLine(
    INVOICE_LANG_EN
      ? `Payment method: ${paymentMethodLabel(booking.paymentMethod)}`
      : `طريقة الدفع: ${paymentMethodLabel(booking.paymentMethod)}`,
    11,
    17,
    17,
    17
  );

  if (booking.paidAt) {
    textLine(
      INVOICE_LANG_EN
        ? `Paid at: ${fmtDateTime(booking.paidAt)}`
        : `تاريخ الدفع: ${fmtDateTime(booking.paidAt)}`,
      11,
      17,
      17,
      17
    );
  }

  if (booking.pickupMode === "DELIVERY") {
    textLine(
      INVOICE_LANG_EN
        ? `Delivery: ${(booking.deliveryAddress ?? "").trim() || "—"}`
        : `التوصيل: ${(booking.deliveryAddress ?? "").trim() || "—"}`,
      11,
      17,
      17,
      17
    );
  } else {
    textLine(
      INVOICE_LANG_EN
        ? `Branch: ${branchLabel}`
        : `الفرع: ${branchLabel}`,
      11,
      17,
      17,
      17
    );
  }

  y += 10;

  /**
   * Section title
   */
  textLine(
    INVOICE_LANG_EN ? "Amount details" : "تفاصيل المبالغ",
    13,
    0,
    55,
    73,
    24
  );

  const moneyCol = 120;
  const descMaxW = contentW - moneyCol;

  /**
   * invoice row
   */
  const row = (
    desc: string,
    amountExclTax: number,
    fontSize = 10,
    descColor: [number, number, number] = [
      17,
      17,
      17,
    ]
  ) => {
    newPageIfNeeded(lineStep + 6);

    bodyFont();
    doc.setFontSize(fontSize);

    rgb(
      doc,
      descColor[0],
      descColor[1],
      descColor[2]
    );

    const amt = formatSarAmount(amountExclTax);
    const amtWithUnit = INVOICE_LANG_EN
      ? `${amt} SAR`
      : `${amt} ر.س`;
    const shapedDesc = shapeInvoiceText(doc, desc);

    if (INVOICE_LANG_EN) {
      doc.text(shapedDesc, margin, y, {
        align: "left",
        maxWidth: descMaxW,
      });
      doc.text(amtWithUnit, rightX, y, { align: "right" });
    } else {
      doc.text(amtWithUnit, margin, y, { align: "left" });
      doc.text(shapedDesc, rightX, y, {
        align: "right",
        maxWidth: descMaxW,
      });
    }

    y += lineStep;
  };

  const rentalDesc = INVOICE_LANG_EN
    ? `Rental (${booking.numberOfDays} ${
        booking.numberOfDays === 1 ? "day" : "days"
      }) — ${booking.car.fullTitle}`
    : `الإيجار (${booking.numberOfDays} يوم) — ${booking.car.fullTitle}`;

  /**
   * rows
   */
  row(rentalDesc, t.rentalExclTax);

  for (const a of booking.addons) {
    row(a.titleAr, a.lineTotalExclTax);
  }

  if (
    booking.interCityShipping &&
    booking.interCityShipping.feeExclVatSar > 0
  ) {
    row(
      INVOICE_LANG_EN
        ? "Inter-city shipping"
        : "شحن بين المدن",
      booking.interCityShipping.feeExclVatSar
    );
  }

  for (const f of booking.checkoutOneTimeFees) {
    row(
      f.labelAr,
      f.feeExclVatSar
    );
  }

  /**
   * separator
   */
  y += 6;

  doc.setDrawColor(220, 220, 220);

  doc.setLineWidth(0.5);

  doc.line(
    margin,
    y,
    pageW - margin,
    y
  );

  y += 16;

  /**
   * totals
   */
  row(
    INVOICE_LANG_EN
      ? "Subtotal (excl. VAT)"
      : "المجموع غير شامل الضريبة",
    t.subtotalExclTax
  );

  row(
    INVOICE_LANG_EN
      ? `VAT (${vatPct}%)`
      : `ضريبة القيمة المضافة (${vatPct}%)`,
    t.vatAmount
  );

  row(
    INVOICE_LANG_EN ? "Total" : "الإجمالي",
    t.totalInclTax,
    13,
    [0, 55, 73]
  );

  y += 14;

  newPageIfNeeded(lineStep);

  /**
   * footer
   */
  textLine(
    INVOICE_LANG_EN
      ? "Electronic invoice — contact customer support for inquiries."
      : "فاتورة إلكترونية — للاستفسار يُرجى التواصل مع خدمة العملاء.",
    9,
    110,
    110,
    110,
    lineStep
  );

  /**
   * export
   */
  const out = doc.output("arraybuffer");

  return Buffer.from(out);
}