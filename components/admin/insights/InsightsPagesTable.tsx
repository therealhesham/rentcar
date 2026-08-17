"use client";

import { ExternalLink, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExitPageRow, PageUsageRow } from "@/lib/insights/insights-types";

type PreviewTarget = { url: string; label: string };

function PreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // الخلفية يجب ألا تنزلق تحت المودال أثناء تمرير المعاينة.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة ${target.label}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 bg-surface-container-low/50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-on-surface">{target.label}</p>
            <p className="truncate text-xs text-on-surface-variant" dir="ltr">
              {target.url}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-lg bg-surface-container-high p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={
                    device === d
                      ? "rounded-md bg-white px-3 py-1 text-xs font-bold text-on-surface shadow-sm"
                      : "rounded-md px-3 py-1 text-xs font-bold text-on-surface-variant"
                  }
                >
                  {d === "desktop" ? "كمبيوتر" : "جوال"}
                </button>
              ))}
            </div>
            <a
              href={target.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              فتح
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 justify-center overflow-auto bg-surface-container-low/60 p-3">
          <iframe
            // إعادة إنشاء الإطار عند تغيير الجهاز: تغيير العرض وحده لا يعيد تشغيل
            // استعلامات CSS المتجاوبة التي قِيست وقت التحميل.
            key={device}
            src={target.url}
            title={`معاينة ${target.label}`}
            className="h-full rounded-lg border border-outline-variant/30 bg-white shadow-sm"
            style={{ width: device === "mobile" ? 390 : "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

function PageActions({
  url,
  label,
  onPreview,
}: {
  url: string;
  label: string;
  onPreview: (t: PreviewTarget) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onPreview({ url, label })}
        className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 px-2.5 py-1 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
      >
        <Eye className="h-3.5 w-3.5" />
        معاينة
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 px-2.5 py-1 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        فتح
      </a>
    </div>
  );
}

export function InsightsTopPagesTable({ rows }: { rows: PageUsageRow[] }) {
  const [target, setTarget] = useState<PreviewTarget | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/25 text-xs text-on-surface-variant">
              <th className="py-2 text-start font-bold">الصفحة</th>
              <th className="py-2 text-start font-bold">الزيارات</th>
              <th className="py-2 text-start font-bold">زوّار مختلفون</th>
              <th className="py-2 text-start font-bold">النسبة</th>
              <th className="py-2 text-end font-bold">نموذج</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.template} className="border-b border-outline-variant/10 last:border-0">
                <td className="max-w-[260px] py-3 pe-3">
                  <p className="truncate font-bold text-on-surface">{row.label}</p>
                  <p className="truncate text-xs text-on-surface-variant" dir="ltr">
                    {row.template}
                  </p>
                </td>
                <td className="py-3 pe-3 font-extrabold tabular-nums text-on-surface">
                  {row.views.toLocaleString("ar-EG")}
                </td>
                <td className="py-3 pe-3 tabular-nums text-on-surface-variant">
                  {row.visitors.toLocaleString("ar-EG")}
                </td>
                <td className="w-32 py-3 pe-3">
                  <span className="text-xs font-bold tabular-nums text-on-surface-variant">
                    {(row.share * 100).toFixed(row.share < 0.1 ? 1 : 0)}%
                  </span>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(row.share * 100, 1.5)}%` }}
                    />
                  </div>
                </td>
                <td className="py-3">
                  <PageActions url={row.sampleUrl} label={row.label} onPreview={setTarget} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target ? <PreviewModal target={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}

export function InsightsExitPagesTable({ rows }: { rows: ExitPageRow[] }) {
  const [target, setTarget] = useState<PreviewTarget | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/25 text-xs text-on-surface-variant">
              <th className="py-2 text-start font-bold">الصفحة</th>
              <th className="py-2 text-start font-bold">توقّفت عندها</th>
              <th className="py-2 text-start font-bold">نسبة التوقّف</th>
              <th className="py-2 text-start font-bold">دخل وخرج فوراً</th>
              <th className="py-2 text-end font-bold">نموذج</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.template} className="border-b border-outline-variant/10 last:border-0">
                <td className="max-w-[240px] py-3 pe-3">
                  <p className="truncate font-bold text-on-surface">{row.label}</p>
                  <p className="truncate text-xs text-on-surface-variant" dir="ltr">
                    {row.template}
                  </p>
                </td>
                <td className="py-3 pe-3">
                  <span className="font-extrabold tabular-nums text-on-surface">
                    {row.exits.toLocaleString("ar-EG")}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {" "}
                    من {row.views.toLocaleString("ar-EG")} زيارة
                  </span>
                </td>
                <td className="w-32 py-3 pe-3">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      row.exitRate >= 0.6 ? "text-rose-600" : "text-on-surface-variant"
                    }`}
                  >
                    {(row.exitRate * 100).toFixed(0)}%
                  </span>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${
                        row.exitRate >= 0.6 ? "bg-rose-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.max(row.exitRate * 100, 1.5)}%` }}
                    />
                  </div>
                </td>
                <td className="py-3 pe-3 tabular-nums text-on-surface-variant">
                  {row.bounces.toLocaleString("ar-EG")}
                </td>
                <td className="py-3">
                  <PageActions url={row.sampleUrl} label={row.label} onPreview={setTarget} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target ? <PreviewModal target={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
