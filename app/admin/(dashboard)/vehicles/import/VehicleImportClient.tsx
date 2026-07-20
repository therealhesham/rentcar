"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import type { ImportResult, FieldMapping } from "@/app/admin/vehicle-import-actions";
import { importVehiclesFromExcel } from "@/app/admin/vehicle-import-actions";
import { parseSpreadsheetFile, type ImportRow } from "@/lib/vehicle-import-excel";

export type CategoryOption = { id: number; title: string };
export type BranchOption = { id: number; name: string };

type Props = {
  categories: CategoryOption[];
  branches: BranchOption[];
};

type ParsedFile = {
  fileName: string;
  headers: string[];
  rows: ImportRow[];
  totalRows: number;
};

const NONE = "__none__";

const IMPORT_FIELDS: { key: keyof FieldMapping; label: string; hint: string }[] = [
  { key: "brand",          label: "الماركة",            hint: "Toyota / تويوتا…" },
  { key: "modelName",      label: "اسم الموديل",         hint: "Camry / يارس…" },
  { key: "year",           label: "سنة الصنع",           hint: "افتراضي: السنة الحالية" },
  { key: "chairs",         label: "عدد المقاعد",         hint: "افتراضي: 5" },
  { key: "engine",         label: "المحرك / الأداء",     hint: "افتراضي: غير محدد" },
  { key: "transmission",   label: "ناقل الحركة",         hint: "افتراضي: أوتوماتيك" },
  { key: "fuel",           label: "نوع الوقود",          hint: "افتراضي: بنزين" },
  { key: "price",          label: "السعر/يوم (ريال)",    hint: "مطلوب لإنشاء السجل" },
  { key: "vatRatePercent", label: "نسبة الضريبة %",      hint: "افتراضي: 15" },
  { key: "quantity",       label: "الكمية في الفرع",     hint: "افتراضي: كل صف = وحدة" },
  { key: "branch",         label: "الفرع (لكل صف)",       hint: "يفعّل تسعير الفروع" },
  { key: "alt",            label: "وصف الصورة (alt)",    hint: "اختياري" },
  { key: "badge",          label: "شارة (badge)",         hint: "اختياري" },
  { key: "image",          label: "رابط الصورة",         hint: "URL اختياري" },
];

function autoDetect(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()[\]]/g, "");

  const patterns: [keyof FieldMapping, string[]][] = [
    ["brand",          ["brand", "ماركة", "الماركة", "الطراز", "make", "manufacturer", "الشركة", "العلامة"]],
    ["modelName",      ["model", "موديل", "الموديل", "النوع", "modelname", "carmodel", "اسم"]],
    ["year",           ["year", "سنة", "السنة", "yr", "سنةالصنع", "modelyear"]],
    ["chairs",         ["chairs", "seats", "مقاعد", "كراسي", "عددالمقاعد", "seatcount"]],
    ["engine",         ["engine", "محرك", "المحرك", "motor", "enginespec", "الأداء"]],
    ["transmission",   ["transmission", "ناقل", "ناقلالحركة", "gear", "gearbox", "geartype"]],
    ["fuel",           ["fuel", "وقود", "الوقود", "fueltype", "نوعالوقود"]],
    ["price",          ["price", "سعر", "السعر", "rate", "pricepd", "سعراليوم", "dailyprice"]],
    ["vatRatePercent", ["vat", "ضريبة", "tax", "vatrate", "نسبةالضريبة"]],
    ["quantity",       ["quantity", "كمية", "الكمية", "qty", "stock", "count"]],
    ["branch",         ["branch", "فرع", "الفرع", "location", "site", "معرض"]],
    ["alt",            ["alt", "alttext", "imagealt", "وصفالصورة"]],
    ["badge",          ["badge", "شارة", "tag", "label"]],
    ["image",          ["image", "img", "photo", "صورة", "الصورة", "imageurl", "imgurl", "url"]],
  ];

  for (const [field, keywords] of patterns) {
    for (const h of headers) {
      if (keywords.some(kw => norm(h).includes(norm(kw)))) {
        result[field] = h;
        break;
      }
    }
  }

  return result;
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────

function UploadZone({
  onParsed,
}: {
  onParsed: (data: ParsedFile) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parse = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const { headers, rows } = await parseSpreadsheetFile(file);
        onParsed({
          fileName: file.name,
          headers,
          rows,
          totalRows: rows.length,
        });
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
      className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/50 p-12 text-center transition-colors hover:border-primary/40 hover:bg-surface-container/70"
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
          {loading ? "جاري تحليل الملف…" : "ارفع ملف Excel"}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          اسحب وأفلت أو انقر للاختيار · xlsx / csv
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error/8 px-5 py-3 text-sm font-bold text-error">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Single mapping row ───────────────────────────────────────────────────────

function MappingRow({
  label,
  hint,
  value,
  headers,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-outline-variant/20 px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-44 shrink-0">
        <p className="text-sm font-bold text-on-surface">{label}</p>
        <p className="text-[11px] leading-snug text-on-surface-variant">{hint}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 transition-colors focus:ring-2"
      >
        <option value={NONE}>— لا يُربط —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "text-on-surface",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-center">
      <p className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-on-surface-variant">{label}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VehicleImportClient({ categories, branches }: Props) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [categoryId, setCategoryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleParsed = useCallback((data: ParsedFile) => {
    setParsed(data);
    setMapping(autoDetect(data.headers));
    setResult(null);
  }, []);

  const setField = (field: string, raw: string) => {
    setMapping((prev) => ({ ...prev, [field]: raw === NONE ? "" : raw }));
  };

  const canImport = !isPending && !!parsed;

  const handleImport = () => {
    if (!parsed || !canImport) return;

    const fm: FieldMapping = {};
    for (const f of IMPORT_FIELDS) {
      const col = mapping[f.key];
      if (col) fm[f.key] = col;
    }

    startTransition(async () => {
      const r = await importVehiclesFromExcel({
        rows: parsed.rows,
        mapping: fm,
        categoryId: categoryId ? Number(categoryId) : null,
        branchId: branchId ? Number(branchId) : null,
      });
      setResult(r);
    });
  };

  // ── Results ──────────────────────────────────────────────────────────────────

  if (result) {
    const allOk = result.skipped === 0;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${allOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
            >
              {allOk ? "✓" : "!"}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">نتائج الاستيراد</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {parsed?.fileName} · {result.total} صف إجمالاً
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <StatCard label="إجمالي الصفوف"  value={result.total}   />
            <StatCard label="تمت إضافته"     value={result.created} color="text-emerald-700" />
            <StatCard label="تم تحديثه"      value={result.updated} color="text-primary"     />
            <StatCard label="تم تخطيه"       value={result.skipped} color={result.skipped > 0 ? "text-error" : "text-on-surface"} />
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
              <div className="border-b border-outline-variant/30 px-4 py-3">
                <p className="text-sm font-bold text-error">
                  الأخطاء ({result.errors.length})
                </p>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant/20">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className="mt-px shrink-0 font-bold tabular-nums text-on-surface-variant">
                      صف {e.row}
                    </span>
                    <span className="text-error">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { setResult(null); setParsed(null); setMapping({}); }}
              className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
            >
              استيراد ملف آخر
            </button>
            <Link
              href="/admin/vehicles"
              className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white"
            >
              عرض المركبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  if (!parsed) {
    return <UploadZone onParsed={handleParsed} />;
  }

  // ── Mapping + preview ─────────────────────────────────────────────────────────

  const previewRows = parsed.rows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* File info bar */}
      <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 shrink-0 text-primary">
          <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{parsed.fileName}</p>
          <p className="text-xs text-on-surface-variant">
            {parsed.totalRows.toLocaleString("en-US")} صف · {parsed.headers.length} عمود
          </p>
        </div>
        <button
          onClick={() => { setParsed(null); setMapping({}); }}
          className="shrink-0 text-xs font-bold text-on-surface-variant transition-colors hover:text-error"
        >
          تغيير الملف
        </button>
      </div>

      {/* Mapping + side panel */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

        {/* Mapping table */}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <div className="border-b border-outline-variant/30 px-5 py-4">
            <h2 className="font-extrabold text-on-surface">ربط أعمدة Excel بحقول قاعدة البيانات</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              الاكتشاف التلقائي يحاول مطابقة أسماء الأعمدة — راجع وعدّل يدوياً عند الحاجة
            </p>
          </div>

          <div>
            {IMPORT_FIELDS.map((f) => (
              <MappingRow
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={mapping[f.key] ?? NONE}
                headers={parsed.headers}
                onChange={(v) => setField(f.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/30 px-5 py-4">
              <h2 className="font-extrabold text-on-surface">إعدادات الاستيراد</h2>
            </div>
            <div className="p-5 space-y-5">
              <label className="block text-sm font-medium">
                فئة الأسطول
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  <option value="">— بدون تغيير / لا تُطبَّق —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                  اختياري: عند التحديث لا تُغيَّر الفئة؛ عند إضافة موديل جديد تكون الفئة مطلوبة
                </span>
              </label>

              {mapping.branch ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="text-sm font-bold text-primary">وضع تسعير الفروع مُفعَّل</p>
                  <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">
                    عمود «الفرع» مربوط — كل صف يُسجَّل في فرعه بسعره الخاص. السعر الأساسي
                    للموديل = الأكثر تكراراً، وأي فرع يختلف سعره يُحفظ كتجاوز. الصفوف بفرع غير
                    معروف (ورشة/تأمين) تُتخطّى.
                  </p>
                </div>
              ) : (
                <label className="block text-sm font-medium">
                  الفرع (للكميات)
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                  >
                    <option value="">— بدون تسجيل كمية في فرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                    اختياري: بدون اختيار لن تُسجَّل كميات في أي فرع. لتسعير مختلف لكل فرع اربط
                    عمود «الفرع» في جدول الربط.
                  </span>
                </label>
              )}
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={!canImport}
            className="gradient-cta w-full rounded-xl px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.4)] transition-opacity disabled:opacity-40"
          >
            {isPending
              ? "جاري الاستيراد…"
              : `استيراد ${parsed.totalRows.toLocaleString("en-US")} سجل`}
          </button>

          <p className="text-center text-[11px] text-on-surface-variant">
            الماركة تُنشأ تلقائياً إن لم تكن موجودة · الموديل المكرر يُحدَّث لا يُكرَّر
          </p>
        </div>
      </div>

      {/* Preview table */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <div className="border-b border-outline-variant/30 px-5 py-4">
          <h2 className="font-extrabold text-on-surface">
            معاينة · أول {previewRows.length} صفوف
          </h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            البيانات المعروضة تعتمد على الربط المختار أعلاه
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low">
                {IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                  <th key={f.key} className="px-3 py-2.5 text-start font-bold text-on-surface-variant">
                    {f.label}
                    <span className="block font-normal opacity-55">{mapping[f.key]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-outline-variant/15 last:border-0 hover:bg-surface-container-low/40">
                  {IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => {
                    const col = mapping[f.key]!;
                    const val = (row[col] ?? "").trim();
                    return (
                      <td key={f.key} className="px-3 py-2.5 text-on-surface">
                        {val || <span className="text-on-surface-variant/50">فارغ</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
