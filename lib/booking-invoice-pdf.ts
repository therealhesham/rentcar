import path from "node:path";
import PDFDocument from "pdfkit";
import { convertArabic } from "arabic-persian-reshaper/ArabicShaper";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

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

/** نص عربي للعرض في PDFKit (LTR) بعد التشكيل والعكس البصري. */
function pdfAr(s: string): string {
  const t = s.trim();
  if (!t) return "";
  try {
    return convertArabic(t).split("").reverse().join("");
  } catch {
    return t;
  }
}

function fontPathAr(): string {
  return path.join(process.cwd(), "lib", "fonts", "NotoSansArabic-Regular.ttf");
}

/**
 * فاتورة PDF بنفس أرقام البريد الإلكتروني (إجماليات من BookingPaymentSnapshot).
 */
export function buildBookingInvoicePdfBuffer(booking: BookingPaymentSnapshot): Promise<Buffer> {
  const fp = fontPathAr();
  const branchLabel = BRANCH_LABEL_AR[booking.branch] ?? booking.branch;
  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
  const dropoff = fmtDateTime(dropoffD);
  const t = booking.totals;
  const vatPct = booking.car.vatRatePercent;
  const margin = 48;
  const pageInnerW = 595.28 - margin * 2;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin,
      info: { Title: `Invoice #${booking.id}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.registerFont("notoar", fp);
      doc.font("notoar");
    } catch (e) {
      reject(
        new Error(
          `خط العربية للفاتورة غير متاح (${fp}). أضف الملف أو أعد تنزيل NotoSansArabic-Regular.ttf`,
          { cause: e },
        ),
      );
      return;
    }

    let y = margin;

    const lineH = 14;
    const bump = (h = lineH) => {
      y += h;
      if (y > 780) {
        doc.addPage();
        y = margin;
        doc.font("notoar");
      }
    };

    doc.fillColor("#003749").fontSize(16).text(pdfAr("فاتورة — تم الدفع"), margin, y, {
      width: pageInnerW,
      align: "right",
    });
    bump(22);
    doc.fontSize(11).fillColor("#333").text(pdfAr(`طلب حجز رقم #${booking.id}`), margin, y, {
      width: pageInnerW,
      align: "right",
    });
    bump(24);

    doc.fillColor("#111").fontSize(11);
    doc.text(pdfAr(`الاسم: ${booking.fullName}`), margin, y, { width: pageInnerW, align: "right" });
    bump();
    doc.text(pdfAr(`الجوال: ${booking.phone}`), margin, y, { width: pageInnerW, align: "right" });
    bump();
    doc.text(pdfAr(`المركبة: ${booking.car.fullTitle} — ${booking.car.categoryTitle}`), margin, y, {
      width: pageInnerW,
      align: "right",
    });
    bump();
    doc.text(pdfAr(`الاستلام: ${pickup}`), margin, y, { width: pageInnerW, align: "right" });
    bump();
    doc.text(pdfAr(`التسليم: ${dropoff}`), margin, y, { width: pageInnerW, align: "right" });
    bump();
    doc.text(pdfAr(`طريقة الدفع: ${paymentMethodLabelAr(booking.paymentMethod)}`), margin, y, {
      width: pageInnerW,
      align: "right",
    });
    bump();
    if (booking.paidAt) {
      doc.text(pdfAr(`تاريخ الدفع: ${fmtDateTime(booking.paidAt)}`), margin, y, {
        width: pageInnerW,
        align: "right",
      });
      bump();
    }

    if (booking.pickupMode === "DELIVERY") {
      doc.text(
        pdfAr(`التوصيل: ${(booking.deliveryAddress ?? "").trim() || "—"}`),
        margin,
        y,
        { width: pageInnerW, align: "right" },
      );
    } else {
      doc.text(pdfAr(`الفرع: ${branchLabel}`), margin, y, { width: pageInnerW, align: "right" });
    }
    bump(22);

    doc.fillColor("#003749").fontSize(12).text(pdfAr("تفاصيل المبالغ"), margin, y, {
      width: pageInnerW,
      align: "right",
    });
    bump(20);

    doc.fillColor("#111").fontSize(10);
    const moneyColW = 100;
    const descX = margin + moneyColW;
    const descW = pageInnerW - moneyColW;

    const row = (descAr: string, amountExclTax: number) => {
      const amt = formatSarAmount(amountExclTax);
      doc.font("Helvetica").fontSize(10).fillColor("#111").text(amt, margin, y, {
        width: 72,
        align: "left",
      });
      doc.font("notoar").text(pdfAr("ر.س"), margin + 74, y);
      doc.font("notoar").text(pdfAr(descAr), descX, y, { width: descW, align: "right" });
      bump();
    };

    row(
      `الإيجار (${booking.numberOfDays} يوم) — ${booking.car.fullTitle}`,
      t.rentalExclTax,
    );

    for (const a of booking.addons) {
      row(a.titleAr, a.lineTotalExclTax);
    }

    if (booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0) {
      row("شحن بين المدن", booking.interCityShipping.feeExclVatSar);
    }

    for (const f of booking.checkoutOneTimeFees) {
      row(f.labelAr, f.feeExclVatSar);
    }

    doc.moveTo(margin, y).lineTo(margin + pageInnerW, y).strokeColor("#ccc").lineWidth(0.5).stroke();
    bump(8);

    doc.fontSize(10).fillColor("#111");
    row("المجموع غير شامل الضريبة", t.subtotalExclTax);
    row(`ضريبة القيمة المضافة (${vatPct}%)`, t.vatAmount);

    doc.fontSize(12).fillColor("#003749");
    row("الإجمالي", t.totalInclTax);

    bump(16);
    doc.fontSize(9).fillColor("#666").text(
      pdfAr("فاتورة إلكترونية — للاستفسار يُرجى التواصل مع خدمة العملاء."),
      margin,
      y,
      { width: pageInnerW, align: "right" },
    );

    doc.end();
  });
}
