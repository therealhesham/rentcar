/** تحويل قيمة خلية Excel إلى نص قابل للتمرير لـ Server Actions (بدون Date أو كائنات). */
export function cellToPlainString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

export type ImportRow = Record<string, string>;

/** تحويل صفوف sheet_to_json إلى كائنات نصية فقط. */
export function sanitizeExcelRows(rows: Record<string, unknown>[]): ImportRow[] {
  return rows.map((row) => {
    const out: ImportRow = {};
    for (const [key, val] of Object.entries(row)) {
      out[String(key)] = cellToPlainString(val);
    }
    return out;
  });
}
