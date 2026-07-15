"use server";

import { requirePermissionForAction } from "@/lib/admin-access";
import {
  isReportId,
  REPORT_DEFS,
  type ReportParams,
} from "@/lib/reports/admin-report-definitions";
import { REPORT_MIME, type ReportFormat } from "@/lib/reports/report-model";
import { buildReportPdf } from "@/lib/reports/report-pdf";
import { buildReportXlsx } from "@/lib/reports/report-xlsx";

export type ExportReportResult =
  | { ok: true; fileName: string; mimeType: string; base64: string }
  | { ok: false; error: string };

/**
 * توليد تقرير إداري (Excel أو PDF) على السيرفر:
 * محمي بصلاحية التقرير المطلوبة ومحدود بنطاق فرع الموظف عبر مُحمِّل كل تقرير.
 */
export async function exportAdminReport(input: {
  reportId: string;
  format: ReportFormat;
  params?: ReportParams;
}): Promise<ExportReportResult> {
  if (!isReportId(input.reportId)) {
    return { ok: false, error: "تقرير غير معروف." };
  }
  if (input.format !== "xlsx" && input.format !== "pdf") {
    return { ok: false, error: "صيغة غير مدعومة." };
  }

  const def = REPORT_DEFS[input.reportId];
  const auth = await requirePermissionForAction(def.permission);
  if (!auth.ok) return { ok: false, error: auth.error };

  const params: ReportParams = {
    q: input.params?.q?.trim() || undefined,
    from: input.params?.from?.trim() || undefined,
    to: input.params?.to?.trim() || undefined,
  };

  try {
    const table = await def.load(auth.session, params);
    const buffer =
      input.format === "xlsx" ? await buildReportXlsx(table) : buildReportPdf(table);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      fileName: `${def.fileBase}-${stamp}.${input.format}`,
      mimeType: REPORT_MIME[input.format],
      base64: buffer.toString("base64"),
    };
  } catch (e) {
    console.error("[exportAdminReport] failed:", e);
    return { ok: false, error: "تعذّر توليد التقرير." };
  }
}
