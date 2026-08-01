"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type {
  QuantityApplyResult,
  QuantityMapping,
  QuantityPreview,
} from "@/app/admin/fleet-quantity-actions";
import {
  applyFleetQuantityImport,
  previewFleetQuantityImport,
} from "@/app/admin/fleet-quantity-actions";
import { FLEET_QUANTITY_COLUMNS } from "@/lib/fleet-quantity-import";
import { parseSpreadsheetFile, type ImportRow } from "@/lib/vehicle-import-excel";

export type BranchOption = { id: number; name: string };

type Props = {
  branches: BranchOption[];
  /** موظف محصور بفرعه — لا يظهر اختيار الفرع ولا يُصدَّر قالب لفرع آخر. */
  lockedBranchId: number | null;
};

type ParsedFile = { fileName: string; headers: string[]; rows: ImportRow[] };

const NONE = "__none__";

const FIELDS: { key: keyof QuantityMapping; label: string; hint: string }[] = [
  { key: "quantity", label: "الكمية الجديدة", hint: "مطلوب — العدد بعد التحديث" },
  { key: "branch", label: "الفرع", hint: "أو اختر فرعاً افتراضياً بالأسفل" },
  { key: "brand", label: "الماركة", hint: "مع الموديل والسنة تحدّد السيارة" },
  { key: "model", label: "الموديل", hint: "مطلوب للمطابقة بالاسم" },
  { key: "year", label: "السنة", hint: "يرفع دقة مطابقة الموديل" },
  {
    key: "key",
    label: FLEET_QUANTITY_COLUMNS.key,
    hint: "عمود مخفي في القالب — اتركه كما هو",
  },
];

const DETECT: [keyof QuantityMapping, string[]][] = [
  ["key", ["رقمالنظام", "المعرّف", "المعرف"]],
  ["quantity", ["الكمية", "كمية", "quantity", "qty", "stock", "count", "العدد"]],
  ["branch", ["الفرع", "فرع", "branch", "location", "site", "معرض"]],
  ["brand", ["الماركة", "ماركة", "brand", "make", "manufacturer"]],
  ["model", ["الموديل", "موديل", "model", "النوع"]],
  ["year", ["السنة", "سنة", "year", "سنةالصنع"]],
];

function autoDetect(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()[\]]/g, "");
  const out: Record<string, string> = {};
  for (const [field, keywords] of DETECT) {
    for (const h of headers) {
      if (keywords.some((kw) => norm(h).includes(norm(kw)))) {
        out[field] = h;
        break;
      }
    }
  }
  return out;
}

function StatCard({ label, value, color = "text-on-surface" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-center">
      <p className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-on-surface-variant">{label}</p>
    </div>
  );
}

function ErrorList({ errors }: { errors: { row: number; message: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <div className="border-b border-outline-variant/30 px-4 py-3">
        <p className="text-sm font-bold text-error">الصفوف المتخطّاة ({errors.length})</p>
      </div>
      <div className="max-h-60 divide-y divide-outline-variant/20 overflow-y-auto">
        {errors.map((e, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span className="mt-px shrink-0 font-bold tabular-nums text-on-surface-variant">
              {e.row > 0 ? `صف ${e.row}` : "عام"}
            </span>
            <span className="text-error">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadZone({ onParsed }: { onParsed: (data: ParsedFile) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parse = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const { headers, rows } = await parseSpreadsheetFile(file);
        onParsed({ fileName: file.name, headers, rows });
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل قراءة الملف.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed],
  );

  return (
    <div
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parse(f); }}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="flex min-h-60 cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/50 p-10 text-center transition-colors hover:border-primary/40 hover:bg-surface-container/70"
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); }}
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {loading ? (
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-lg font-extrabold text-on-surface">
          {loading ? "جاري تحليل الملف…" : "ارفع الملف بعد تعديل عمود الكمية"}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">اسحب وأفلت أو انقر للاختيار · xlsx / csv</p>
      </div>
      {error && (
        <p className="rounded-xl border border-error/30 bg-error/8 px-5 py-3 text-sm font-bold text-error">{error}</p>
      )}
    </div>
  );
}

export function FleetQuantityImportClient({ branches, lockedBranchId }: Props) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fallbackBranchId, setFallbackBranchId] = useState("");
  const [templateBranchId, setTemplateBranchId] = useState("");
  const [preview, setPreview] = useState<QuantityPreview | null>(null);
  const [applied, setApplied] = useState<QuantityApplyResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const buildMapping = (): QuantityMapping => {
    const fm: QuantityMapping = {};
    for (const f of FIELDS) {
      const col = mapping[f.key];
      if (col) fm[f.key] = col;
    }
    return fm;
  };

  const reset = () => {
    setParsed(null);
    setMapping({});
    setPreview(null);
    setApplied(null);
  };

  const handleParsed = useCallback((data: ParsedFile) => {
    setParsed(data);
    setMapping(autoDetect(data.headers));
    setPreview(null);
    setApplied(null);
  }, []);

  const runPreview = () => {
    if (!parsed) return;
    startTransition(async () => {
      const r = await previewFleetQuantityImport({
        rows: parsed.rows,
        mapping: buildMapping(),
        fallbackBranchId: fallbackBranchId ? Number(fallbackBranchId) : null,
      });
      setPreview(r);
    });
  };

  const runApply = () => {
    if (!parsed) return;
    startTransition(async () => {
      const r = await applyFleetQuantityImport({
        rows: parsed.rows,
        mapping: buildMapping(),
        fallbackBranchId: fallbackBranchId ? Number(fallbackBranchId) : null,
      });
      setApplied(r);
    });
  };

  // ── النتيجة بعد التطبيق ───────────────────────────────────────────────────
  if (applied) {
    const ok = applied.errors.length === 0;
    return (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {ok ? "✓" : "!"}
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-on-surface">تم تحديث الكميات</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{parsed?.fileName}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="سجل حُدِّث" value={applied.updated} color="text-primary" />
          <StatCard label="سجل جديد في فرع" value={applied.created} color="text-emerald-700" />
          <StatCard label="صف متخطّى" value={applied.errors.length} color={applied.errors.length > 0 ? "text-error" : "text-on-surface"} />
        </div>

        <div className="mb-6">
          <ErrorList errors={applied.errors} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
          >
            رفع ملف آخر
          </button>
          <Link href="/admin/vehicles" className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white">
            عرض المركبات
          </Link>
        </div>
      </div>
    );
  }

  // ── الخطوة الأولى: القالب + الرفع ─────────────────────────────────────────
  if (!parsed) {
    const templateHref =
      lockedBranchId == null && templateBranchId
        ? `/api/admin/fleet/quantities-template?branch=${templateBranchId}`
        : "/api/admin/fleet/quantities-template";

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6">
          <h2 className="font-extrabold text-on-surface">1 · نزّل القالب</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            ملف Excel بكميات الأسطول الحالية: الفرع والماركة والموديل والسنة والكمية. عدّل عمود{" "}
            <span className="font-bold text-on-surface">«{FLEET_QUANTITY_COLUMNS.quantity}»</span>{" "}
            واحفظ الملف — هذا كل المطلوب.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            {lockedBranchId == null && (
              <label className="block text-sm font-medium">
                نطاق القالب
                <select
                  value={templateBranchId}
                  onChange={(e) => setTemplateBranchId(e.target.value)}
                  className="mt-2 w-64 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  <option value="">كل الفروع — السجلات الحالية فقط</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — كل الموديلات
                    </option>
                  ))}
                </select>
              </label>
            )}
            <a
              href={templateHref}
              className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-surface-container"
            >
              تنزيل القالب (xlsx)
            </a>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-on-surface-variant">
            اختيار فرع محدّد يُدرج كل الموديلات في ذلك الفرع (الغائب بكمية 0) — مفيد لإضافة موديل
            للفرع من نفس الملف.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-on-surface">2 · ارفع الملف بعد التعديل</h2>
          <UploadZone onParsed={handleParsed} />
        </div>
      </div>
    );
  }

  // ── الخطوة الثانية: الربط والمعاينة ───────────────────────────────────────
  const usingKey = !!mapping.key;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 shrink-0 text-primary">
          <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{parsed.fileName}</p>
          <p className="text-xs text-on-surface-variant">
            {parsed.rows.length.toLocaleString("en-US")} صف · {parsed.headers.length} عمود
          </p>
        </div>
        <button onClick={reset} className="shrink-0 text-xs font-bold text-on-surface-variant transition-colors hover:text-error">
          تغيير الملف
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <div className="border-b border-outline-variant/30 px-5 py-4">
            <h2 className="font-extrabold text-on-surface">ربط الأعمدة</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {usingKey
                ? "الملف من القالب — المطابقة مضمونة، ولا حاجة لمراجعة باقي الأعمدة."
                : "المطابقة بالاسم — اربط الماركة والموديل والسنة لأدق نتيجة."}
            </p>
          </div>
          <div>
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5 border-b border-outline-variant/20 px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
                <div className="w-44 shrink-0">
                  <p className="text-sm font-bold text-on-surface">{f.label}</p>
                  <p className="text-[11px] leading-snug text-on-surface-variant">{f.hint}</p>
                </div>
                <select
                  value={mapping[f.key] ?? NONE}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMapping((prev) => ({ ...prev, [f.key]: raw === NONE ? "" : raw }));
                    setPreview(null);
                  }}
                  className="flex-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 transition-colors focus:ring-2"
                >
                  <option value={NONE}>— لا يُربط —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {lockedBranchId == null && !usingKey && (
            <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
              <label className="block text-sm font-medium">
                الفرع الافتراضي
                <select
                  value={fallbackBranchId}
                  onChange={(e) => { setFallbackBranchId(e.target.value); setPreview(null); }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  <option value="">— بدون —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                  يُستخدم للصفوف التي لا تحمل اسم فرع.
                </span>
              </label>
            </div>
          )}

          <button
            onClick={runPreview}
            disabled={isPending || !mapping.quantity}
            className="w-full rounded-xl border border-outline-variant px-6 py-3.5 text-sm font-extrabold text-primary transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            {isPending && !preview ? "جاري الفحص…" : "فحص التغييرات"}
          </button>

          {!mapping.quantity && (
            <p className="text-center text-[11px] font-bold text-error">اربط عمود الكمية أولاً.</p>
          )}

          <p className="text-center text-[11px] leading-snug text-on-surface-variant">
            لا تُنشأ موديلات ولا تُمسّ الأسعار — الكمية فقط. أي سجل غير مذكور في الملف يبقى كما هو.
          </p>
        </div>
      </div>

      {preview && (
        <div className="space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <h2 className="text-lg font-extrabold text-on-surface">مراجعة قبل التطبيق</h2>

          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="صفوف الملف" value={preview.totalRows} />
            <StatCard label="ستتغيّر" value={preview.changes.length} color="text-primary" />
            <StatCard label="بلا تغيير" value={preview.unchanged} />
            <StatCard label="متخطّى" value={preview.errors.length + preview.ignored} color={preview.errors.length > 0 ? "text-error" : "text-on-surface"} />
          </div>

          {preview.changes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-surface-container-low">
                    <tr className="border-b border-outline-variant/30 text-xs text-on-surface-variant">
                      <th className="px-4 py-2.5 text-start font-bold">الفرع</th>
                      <th className="px-4 py-2.5 text-start font-bold">السيارة</th>
                      <th className="px-4 py-2.5 text-center font-bold">الحالي</th>
                      <th className="px-4 py-2.5 text-center font-bold">الجديد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changes.map((c) => (
                      <tr key={`${c.modelId}-${c.branchId}`} className="border-b border-outline-variant/15 last:border-0">
                        <td className="px-4 py-2.5 text-on-surface">{c.branchName}</td>
                        <td className="px-4 py-2.5 text-on-surface">
                          {c.carLabel}
                          {c.isNew && <span className="ms-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">جديد بالفرع</span>}
                          {c.mergedRows > 1 && <span className="ms-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">مجموع {c.mergedRows} صفوف</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-on-surface-variant">{c.currentQuantity}</td>
                        <td className={`px-4 py-2.5 text-center font-extrabold tabular-nums ${c.newQuantity > c.currentQuantity ? "text-emerald-700" : "text-error"}`}>
                          {c.newQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ErrorList errors={preview.errors} />

          <button
            onClick={runApply}
            disabled={isPending || preview.changes.length === 0}
            className="gradient-cta w-full rounded-xl px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.4)] transition-opacity disabled:opacity-40"
          >
            {isPending
              ? "جاري التطبيق…"
              : preview.changes.length === 0
                ? "لا توجد تغييرات للتطبيق"
                : `تطبيق ${preview.changes.length} تغيير`}
          </button>
        </div>
      )}
    </div>
  );
}
