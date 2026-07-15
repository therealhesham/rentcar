/** نموذج تقرير مجرّد يُستخدم لتوليد Excel و PDF من نفس البيانات. */

export type ReportAlign = "right" | "left" | "center";

export type ReportColumn = {
  /** مفتاح الحقل في صفوف البيانات. */
  key: string;
  /** عنوان العمود (عربي). */
  header: string;
  /** عرض تقريبي للعمود (وحدات نسبية) — يُستخدم لتوزيع عرض PDF وعرض أعمدة Excel. */
  width?: number;
  /** محاذاة القيمة داخل الخلية. */
  align?: ReportAlign;
  /** رقمي: يُنسَّق كعدد في Excel (فواصل + منزلتان). */
  numeric?: boolean;
};

export type ReportCell = string | number | null | undefined;
export type ReportRow = Record<string, ReportCell>;

export type ReportTable = {
  /** عنوان التقرير في أعلى الملف. */
  title: string;
  /** سطر فرعي اختياري (نطاق/فلترة). */
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** وقت التوليد — يُطبع في ترويسة الملف. */
  generatedAt: Date;
};

export type ReportFormat = "xlsx" | "pdf";

export const REPORT_MIME: Record<ReportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** نص خلية آمن للعرض (يحوّل null/undefined إلى شرطة). */
export function cellText(v: ReportCell): string {
  if (v == null || v === "") return "—";
  return String(v);
}

/** تنسيق تاريخ/وقت LTR بأرقام غربية — لا يُمرَّر عبر تشكيل عربي. */
export function formatReportDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** تنسيق تاريخ فقط (YYYY-MM-DD). */
export function formatReportDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
