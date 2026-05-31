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

/** تحويل صفوف خام إلى كائنات نصية فقط. */
export function sanitizeExcelRows(rows: Record<string, unknown>[]): ImportRow[] {
  return rows.map((row) => {
    const out: ImportRow = {};
    for (const [key, val] of Object.entries(row)) {
      out[String(key)] = cellToPlainString(val);
    }
    return out;
  });
}

function matrixToImportRows(matrix: unknown[][]): { headers: string[]; rows: ImportRow[] } {
  if (matrix.length === 0) {
    throw new Error("الملف فارغ.");
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell, i) => {
    const label = cellToPlainString(cell);
    return label || `عمود_${i + 1}`;
  });

  if (headers.every((h) => h.startsWith("عمود_"))) {
    throw new Error("لا توجد أعمدة في الصف الأول.");
  }

  const rows: ImportRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const empty = line.every((c) => cellToPlainString(c) === "");
    if (empty) continue;

    const obj: ImportRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = cellToPlainString(line[c]);
    }
    rows.push(obj);
  }

  if (rows.length === 0) {
    throw new Error("لا توجد صفوف بيانات بعد رأس الجدول.");
  }

  return { headers, rows };
}

/** CSV بسيط (يدعم حقول بين علامتي اقتباس). */
function parseCsvText(text: string): unknown[][] {
  const raw = text.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: ImportRow[] }> {
  const text = await file.text();
  return matrixToImportRows(parseCsvText(text));
}

async function parseXlsxFile(file: File): Promise<{ headers: string[]; rows: ImportRow[] }> {
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const matrix = await readXlsxFile(file);
  return matrixToImportRows(matrix);
}

/** قراءة .xlsx أو .csv في المتصفح (بدون مكتبة SheetJS/xlsx). */
export async function parseSpreadsheetFile(
  file: File,
): Promise<{ headers: string[]; rows: ImportRow[] }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return parseCsvFile(file);
  }

  if (name.endsWith(".xlsx")) {
    return parseXlsxFile(file);
  }

  if (name.endsWith(".xls")) {
    throw new Error("صيغة .xls القديمة غير مدعومة. احفظ الملف كـ .xlsx أو .csv.");
  }

  throw new Error("الصيغة غير مدعومة. استخدم .xlsx أو .csv");
}
