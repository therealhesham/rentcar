import ExcelJS from "exceljs";
import {
  cellText,
  formatReportDateTime,
  type ReportCell,
  type ReportTable,
} from "@/lib/reports/report-model";

/** يبني ملف Excel (‎.xlsx) عربي RTL من نموذج التقرير ويُرجعه كـ Buffer. */
export async function buildReportXlsx(table: ReportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RentCar Admin";
  wb.created = table.generatedAt;

  const ws = wb.addWorksheet("التقرير", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 0 }],
  });

  const colCount = table.columns.length;
  ws.columns = table.columns.map((c) => ({
    key: c.key,
    width: Math.max(10, (c.width ?? 16) + 2),
  }));

  const lastCol = ws.getColumn(colCount).letter;

  // صف العنوان (مدمج).
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = table.title;
  titleCell.font = { bold: true, size: 15 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  // سطر فرعي + وقت التوليد (مدمج).
  ws.mergeCells(`A2:${lastCol}2`);
  const subCell = ws.getCell("A2");
  const subParts = [table.subtitle, `التوليد: ${formatReportDateTime(table.generatedAt)}`].filter(
    Boolean,
  );
  subCell.value = subParts.join("  ·  ");
  subCell.font = { size: 10, color: { argb: "FF6B7280" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  // صف الترويسة (الأعمدة).
  const headerRowIdx = 4;
  const headerRow = ws.getRow(headerRowIdx);
  table.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { horizontal: c.align ?? "right", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  headerRow.height = 20;

  // صفوف البيانات.
  table.rows.forEach((row, rIdx) => {
    const excelRow = ws.getRow(headerRowIdx + 1 + rIdx);
    table.columns.forEach((c, i) => {
      const raw = row[c.key];
      const cell = excelRow.getCell(i + 1);
      if (c.numeric && typeof raw === "number" && Number.isFinite(raw)) {
        cell.value = raw;
        cell.numFmt = "#,##0.00";
      } else {
        cell.value = cellText(raw as ReportCell);
      }
      cell.alignment = { horizontal: c.align ?? "right", vertical: "middle" };
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  // تجميد صف الترويسة للتمرير.
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: headerRowIdx }];

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
