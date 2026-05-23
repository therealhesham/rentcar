import fs from "node:fs";
import path from "node:path";

import "jspdf/dist/polyfills.es.js";
import { jsPDF } from "jspdf";

import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import { SAR_CURRENCY_SYMBOL } from "@/lib/sar-currency";

/**
 * Invoice language mode. Set to `false` for Arabic (Amiri + RTL).
 */
const INVOICE_LANG_EN = false;

/** نفس اسم الملف داخل الـ VFS */
const FONT_VFS_NAME = "Amiri-Regular.ttf";
const FONT_FAMILY_AR = "Amiri";
const SAR_FONT_VFS_NAME = "saudi_riyal.ttf";
const SAR_FONT_FAMILY = "SaudiRiyal";

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

/** إزالة علامات الاتجاه الخفية — تظهر أحياناً كمؤشر إدخال في PDF. */
function stripBidiMarks(s: string): string {
  return s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

/** تنسيق LTR بأرقام غربية — لا يُمرَّر عبر processArabic (يقلب التاريخ). */
function fmtDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** نصوص أرقام / لاتينية — تُعرض دون تشكيل عربي. */
function isMostlyLtrText(s: string): boolean {
  const chars = s.replace(/\s/g, "");
  if (!chars) return false;
  const latin = (chars.match(/[A-Za-z0-9#+./:@,_\-—%]/g) ?? []).length;
  return latin / chars.length >= 0.45;
}

function fontPathAmiri(): string {
  return path.join(process.cwd(), "lib", "fonts", "Amiri-Regular.ttf");
}

function fontPathSaudiRiyal(): string {
  return path.join(process.cwd(), "lib", "fonts", "saudi_riyal.ttf");
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

function registerSaudiRiyalFont(doc: jsPDF, fontPath: string): boolean {
  if (!fs.existsSync(fontPath)) return false;
  const fontBytes = fs.readFileSync(fontPath);
  doc.addFileToVFS(SAR_FONT_VFS_NAME, fontBytes.toString("base64"));
  doc.addFont(SAR_FONT_VFS_NAME, SAR_FONT_FAMILY, "normal");
  return true;
}

function registerInvoiceFonts(doc: jsPDF, amiriPath: string): boolean {
  registerAmiriFont(doc, amiriPath);
  return registerSaudiRiyalFont(doc, fontPathSaudiRiyal());
}

function registerInvoiceFont(doc: jsPDF, amiriPath: string | null): void {
  if (INVOICE_LANG_EN) {
    doc.setFont("helvetica", "normal");
    return;
  }
  if (!amiriPath) {
    throw new Error("Amiri font path required for Arabic invoice");
  }
  registerInvoiceFonts(doc, amiriPath);
}

function rgb(doc: jsPDF, r: number, g: number, b: number): void {
  doc.setTextColor(r, g, b);
}

function shapeInvoiceText(doc: jsPDF, text: string): string {
  if (INVOICE_LANG_EN) return text;
  // processArabic handles Arabic shaping (ligatures, joining) and bidi ordering.
  // Do NOT add manual reversal — Amiri font + processArabic + align:"right" works correctly.
  return doc.processArabic(text);
}

/**
 * فاتورة PDF (عربي — Amiri + RTL)
 */
export async function buildBookingInvoicePdfBuffer(
  booking: BookingPaymentSnapshot
): Promise<Buffer> {
  const fp = fontPathAmiri();
  const branchLabel = booking.pickupBranchLabelAr?.trim() || "—";

  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
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

  const sarFontOk = registerInvoiceFonts(doc, fp);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 48;
  const contentW = pageW - margin * 2;
  const rightX = pageW - margin;

  /** أعمدة ثابتة — تسمح بمحاذاة القيم والمبالغ دون تداخل. */
  const COL_GAP = 14;
  const LABEL_COL_W = 124;
  const VALUE_COL_RIGHT = rightX - LABEL_COL_W - COL_GAP;
  const VALUE_COL_W = VALUE_COL_RIGHT - margin;
  const AMOUNT_COL_W = 100;
  const AMOUNT_COL_RIGHT = margin + AMOUNT_COL_W;
  const DESC_COL_W = contentW - AMOUNT_COL_W - COL_GAP;
  const LINE_H = 14;

  let y = 0;

  // ─── Helpers ───

  const shape = (text: string): string => stripBidiMarks(doc.processArabic(text));

  const formatValueText = (value: string, ltr?: boolean): string => {
    const useLtr = ltr ?? isMostlyLtrText(value);
    return useLtr ? stripBidiMarks(value) : shape(value);
  };

  /** رقم ثم رمز — محاذاة يمين عمود المبالغ. */
  const drawSarAmount = (
    anchorRight: number,
    lineY: number,
    amount: number,
    opts?: { fontSize?: number; color?: [number, number, number] },
  ) => {
    if (opts?.fontSize != null) doc.setFontSize(opts.fontSize);
    if (opts?.color) doc.setTextColor(...opts.color);

    const num = formatSarAmount(amount);
    doc.setFont(FONT_FAMILY_AR, "normal");
    const numW = doc.getTextWidth(num);
    const gap = doc.getTextWidth(" ");

    const clusterRight = anchorRight;

    doc.setFont(FONT_FAMILY_AR, "normal");
    doc.text(num, clusterRight, lineY, { align: "right" });

    doc.setFont(sarFontOk ? SAR_FONT_FAMILY : FONT_FAMILY_AR, "normal");
    doc.text(SAR_CURRENCY_SYMBOL, clusterRight - numW - gap, lineY, { align: "right" });
    doc.setFont(FONT_FAMILY_AR, "normal");
  };

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      registerInvoiceFonts(doc, fp);
      y = margin;
    }
  };

  // ─── HEADER BAND ───

  const headerH = 90;
  // Dark brand background
  doc.setFillColor(0, 55, 73); // #003749
  doc.rect(0, 0, pageW, headerH, "F");

  // Gold accent line at bottom of header
  doc.setFillColor(223, 177, 99); // #dfb163
  doc.rect(0, headerH, pageW, 3, "F");

  // Company name — gold
  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(22);
  doc.setTextColor(223, 177, 99);
  doc.text(shape("روائس لتأجير السيارات"), rightX - 4, 40, { align: "right" });

  // Invoice title — white
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(shape("إيصال دفع — فاتورة ضريبية مبسطة"), rightX - 4, 62, { align: "right" });

  // Booking ref — white, left side
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 220);
  doc.text(`#${booking.id}`, margin + 4, 40, { align: "left" });
  doc.setFontSize(8);
  doc.text(shape("رقم المرجع"), margin + 4, 54, { align: "left" });

  y = headerH + 3 + 32; // below gold accent + spacing

  // ─── BOOKING INFO SECTION ───

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(13);
  doc.setTextColor(0, 55, 73);
  doc.text(shape("بيانات الحجز"), rightX, y, { align: "right" });
  y += 8;

  // Separator line under section title
  doc.setDrawColor(223, 177, 99);
  doc.setLineWidth(1.5);
  doc.line(rightX - 85, y, rightX, y);
  y += 18;

  // Info rows — عمود عنوان | عمود قيمة بمحاذاة يمين موحّدة
  const infoRow = (
    label: string,
    value: string,
    options?: { ltr?: boolean },
  ) => {
    doc.setFont(FONT_FAMILY_AR, "normal");
    doc.setFontSize(10);

    const valueText = formatValueText(value, options?.ltr);
    const valueLines = doc.splitTextToSize(valueText, VALUE_COL_W);
    const rowH = Math.max(18, valueLines.length * LINE_H);

    newPageIfNeeded(rowH);

    doc.setTextColor(120, 120, 120);
    doc.text(shape(label), rightX, y, { align: "right" });

    doc.setTextColor(30, 30, 30);
    doc.text(valueLines, VALUE_COL_RIGHT, y, { align: "right" });

    y += rowH;
  };

  infoRow("الاسم", booking.fullName);
  infoRow("الجوال", booking.phone, { ltr: true });
  infoRow("المركبة", `${booking.car.fullTitle} — ${booking.car.categoryTitle}`);
  infoRow("الاستلام", pickup, { ltr: true });
  infoRow("التسليم", dropoff, { ltr: true });
  infoRow("طريقة الدفع", paymentMethodLabel(booking.paymentMethod), {
    ltr: isMostlyLtrText(paymentMethodLabel(booking.paymentMethod)),
  });

  if (booking.paidAt) {
    infoRow("تاريخ الدفع", fmtDateTime(booking.paidAt), { ltr: true });
  }

  if (booking.pickupMode === "DELIVERY") {
    infoRow("التوصيل", (booking.deliveryAddress ?? "").trim() || "—");
  } else {
    infoRow("فرع الاستلام", branchLabel);
  }

  y += 12;

  // ─── AMOUNTS SECTION ───

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(13);
  doc.setTextColor(0, 55, 73);
  doc.text(shape("تفاصيل المبالغ"), rightX, y, { align: "right" });
  y += 8;

  doc.setDrawColor(223, 177, 99);
  doc.setLineWidth(1.5);
  doc.line(rightX - 85, y, rightX, y);
  y += 18;

  // Table header
  doc.setFillColor(245, 245, 240);
  doc.rect(margin, y - 12, contentW, 18, "F");

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(shape("البند"), rightX, y, { align: "right" });
  {
    const amountLabel = shape("المبلغ");
    doc.setFont(FONT_FAMILY_AR, "normal");
    const labelW = doc.getTextWidth(`${amountLabel} `);
    doc.text(amountLabel, AMOUNT_COL_RIGHT, y, { align: "right" });
    if (sarFontOk) doc.setFont(SAR_FONT_FAMILY, "normal");
    doc.text(SAR_CURRENCY_SYMBOL, AMOUNT_COL_RIGHT - labelW, y, { align: "right" });
    doc.setFont(FONT_FAMILY_AR, "normal");
  }
  y += 14;

  // Light separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 14;

  // Row helper
  const amountRow = (
    desc: string,
    amount: number,
    bold = false,
    highlight = false,
  ) => {
    doc.setFont(FONT_FAMILY_AR, "normal");
    doc.setFontSize(bold ? 11 : 10);

    const descText = formatValueText(desc, isMostlyLtrText(desc));
    const descLines = doc.splitTextToSize(descText, DESC_COL_W);
    const rowH = Math.max(20, descLines.length * LINE_H);

    newPageIfNeeded(rowH);

    if (highlight) {
      doc.setFillColor(245, 245, 240);
      doc.rect(margin, y - 11, contentW, rowH, "F");
    }

    doc.setTextColor(bold ? 0 : 50, bold ? 55 : 50, bold ? 73 : 50);
    doc.text(descLines, rightX, y, { align: "right" });

    doc.setTextColor(bold ? 0 : 30, bold ? 55 : 30, bold ? 73 : 30);
    drawSarAmount(AMOUNT_COL_RIGHT, y, amount, { fontSize: bold ? 11 : 10 });

    y += rowH;
  };

  // Line items
  const rentalDuration = booking.tripDurationLabelAr ?? `${booking.numberOfDays} يوم`;
  amountRow(`الإيجار (${rentalDuration}) — ${booking.car.fullTitle}`, t.rentalExclTax);

  for (const a of booking.addons) {
    amountRow(a.titleAr, a.lineTotalExclTax);
  }

  if (booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0) {
    amountRow("شحن بين المدن", booking.interCityShipping.feeExclVatSar);
  }

  for (const f of booking.checkoutOneTimeFees) {
    amountRow(f.labelAr, f.feeExclVatSar);
  }

  if (booking.delayPenalty && booking.delayPenalty.feeExclVatSar > 0) {
    amountRow(booking.delayPenalty.labelAr, booking.delayPenalty.feeExclVatSar);
  }

  // Separator before totals
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 16;

  // Subtotal & VAT
  amountRow("المجموع غير شامل الضريبة", t.subtotalExclTax, true);
  amountRow(`ضريبة القيمة المضافة (${vatPct}%)`, t.vatAmount);

  // Total separator
  y += 2;
  doc.setDrawColor(0, 55, 73);
  doc.setLineWidth(1);
  doc.line(margin, y, rightX, y);
  y += 18;

  // Grand Total — prominent
  newPageIfNeeded(30);
  doc.setFillColor(0, 55, 73);
  doc.rect(margin, y - 14, contentW, 28, "F");

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(shape("الإجمالي المدفوع"), rightX - 8, y, { align: "right" });

  doc.setTextColor(223, 177, 99);
  drawSarAmount(AMOUNT_COL_RIGHT, y, t.totalInclTax, { fontSize: 14, color: [223, 177, 99] });

  y += 36;

  // ─── FOOTER ───

  newPageIfNeeded(40);

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 16;

  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(shape("فاتورة إلكترونية — هذا الإيصال تم إصداره آلياً ولا يتطلب توقيع."), rightX, y, {
    align: "right",
    maxWidth: contentW,
  });
  y += 14;
  doc.text(shape("للاستفسار يُرجى التواصل مع خدمة العملاء عبر الموقع أو الهاتف."), rightX, y, {
    align: "right",
    maxWidth: contentW,
  });

  // Export
  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}