"use client";

import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { exportAdminReport } from "@/app/admin/report-export-actions";
import type { ReportFormat } from "@/lib/reports/report-model";

type Props = {
  reportId: string;
  /** نص البحث الحالي (يُمرَّر للتقارير التي تدعمه، مثل الملغاة). */
  q?: string;
  /** يعرض مدخلَي تاريخ من/إلى (للتقارير الزمنية). */
  withDateRange?: boolean;
};

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function ReportExportButtons({ reportId, q, withDateRange }: Props) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  async function run(format: ReportFormat) {
    setBusy(format);
    setError("");
    try {
      const res = await exportAdminReport({ reportId, format, params: { q, from, to } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = base64ToBlob(res.base64, res.mimeType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر التصدير.");
    } finally {
      setBusy(null);
    }
  }

  const btnBase =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition-colors disabled:opacity-60";

  return (
    <div className="flex flex-col items-end gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {withDateRange && (
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="من تاريخ"
              className="rounded-lg border border-outline/40 bg-surface px-2 py-1.5 text-xs"
            />
            <span>←</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="إلى تاريخ"
              className="rounded-lg border border-outline/40 bg-surface px-2 py-1.5 text-xs"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => run("xlsx")}
          disabled={busy != null}
          className={`${btnBase} bg-[#ecfdf5] text-[#047857] hover:bg-[#d1fae5]`}
        >
          {busy === "xlsx" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileSpreadsheet className="size-4" aria-hidden />
          )}
          تصدير Excel
        </button>
        <button
          type="button"
          onClick={() => run("pdf")}
          disabled={busy != null}
          className={`${btnBase} bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2]`}
        >
          {busy === "pdf" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="size-4" aria-hidden />
          )}
          تصدير PDF
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
