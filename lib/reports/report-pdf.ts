import fs from "node:fs";
import path from "node:path";

import "jspdf/dist/polyfills.es.js";
import { jsPDF } from "jspdf";

import {
  cellText,
  formatReportDateTime,
  type ReportColumn,
  type ReportTable,
} from "@/lib/reports/report-model";

const FONT_VFS_NAME = "Amiri-Regular.ttf";
const FONT_FAMILY_AR = "Amiri";

function fontPathAmiri(): string {
  return path.join(process.cwd(), "lib", "fonts", "Amiri-Regular.ttf");
}

function registerAmiriFont(doc: jsPDF): void {
  const fontPath = fontPathAmiri();
  if (!fs.existsSync(fontPath)) {
    throw new Error(`خط Amiri غير موجود: ${fontPath}`);
  }
  const fontBase64 = fs.readFileSync(fontPath).toString("base64");
  doc.addFileToVFS(FONT_VFS_NAME, fontBase64);
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY_AR, "normal");
  doc.setFont(FONT_FAMILY_AR, "normal");
  doc.setLanguage("ar");
}

/** نص أرقام/لاتيني — يُعرض دون تشكيل عربي حتى لا ينقلب. */
function isMostlyLtrText(s: string): boolean {
  const chars = s.replace(/\s/g, "");
  if (!chars) return false;
  const latin = (chars.match(/[A-Za-z0-9#+./:@,_\-—%→]/g) ?? []).length;
  return latin / chars.length >= 0.45;
}

function shape(doc: jsPDF, text: string): string {
  if (isMostlyLtrText(text)) return text;
  return doc.processArabic(text);
}

/** قصّ النص ليدخل ضمن عرض العمود (بالمليمتر). */
function fitText(doc: jsPDF, text: string, maxWidthMm: number): string {
  if (doc.getTextWidth(text) <= maxWidthMm) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxWidthMm) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

/**
 * يبني تقرير PDF (عربي — Amiri + RTL، أفقي A4) من نموذج التقرير ويُرجعه كـ Buffer.
 * الأعمدة تُرتَّب من اليمين إلى اليسار، مع كسر صفحات تلقائي وإعادة رسم الترويسة.
 */
export function buildReportPdf(table: ReportTable): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  registerAmiriFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // توزيع عرض الأعمدة حسب الأوزان.
  const totalWeight = table.columns.reduce((s, c) => s + (c.width ?? 16), 0) || 1;
  const colWidths = table.columns.map((c) => ((c.width ?? 16) / totalWeight) * contentW);

  const rowH = 8;
  const cellPad = 1.6;

  // x اليسار لكل عمود، مع ترتيب الأعمدة من اليمين لليسار.
  function columnLeftX(index: number): number {
    let right = pageW - margin;
    for (let i = 0; i < index; i++) right -= colWidths[i];
    return right - colWidths[index];
  }

  function drawCellText(
    col: ReportColumn,
    index: number,
    text: string,
    baselineY: number,
    bold: boolean,
  ): void {
    const leftX = columnLeftX(index);
    const w = colWidths[index];
    const shaped = shape(doc, fitText(doc, text, w - cellPad * 2));
    const align = col.align ?? "right";
    if (bold) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(31, 41, 55);
    if (align === "left") {
      doc.text(shaped, leftX + cellPad, baselineY, { align: "left" });
    } else if (align === "center") {
      doc.text(shaped, leftX + w / 2, baselineY, { align: "center" });
    } else {
      doc.text(shaped, leftX + w - cellPad, baselineY, { align: "right" });
    }
  }

  function drawHeaderRow(y: number): number {
    doc.setFillColor(31, 41, 55);
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setFontSize(9);
    table.columns.forEach((c, i) => {
      drawCellText(c, i, c.header, y + rowH - cellPad - 1, true);
    });
    return y + rowH;
  }

  // العنوان + السطر الفرعي.
  let y = margin;
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(shape(doc, table.title), pageW - margin, y + 5, { align: "right" });
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const subParts = [table.subtitle, `التوليد: ${formatReportDateTime(table.generatedAt)}`].filter(
    Boolean,
  ) as string[];
  if (subParts.length) {
    doc.text(shape(doc, subParts.join("  ·  ")), pageW - margin, y + 3, { align: "right" });
    y += 6;
  }
  y += 2;

  // الترويسة ثم الصفوف.
  y = drawHeaderRow(y);
  doc.setFontSize(8.5);

  table.rows.forEach((row, rIdx) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      y = drawHeaderRow(y);
      doc.setFontSize(8.5);
    }
    if (rIdx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);
    table.columns.forEach((c, i) => {
      drawCellText(c, i, cellText(row[c.key]), y + rowH - cellPad - 1, false);
    });
    y += rowH;
  });

  // ترقيم الصفحات.
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`${p} / ${pageCount}`, margin, pageH - 4, { align: "left" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
