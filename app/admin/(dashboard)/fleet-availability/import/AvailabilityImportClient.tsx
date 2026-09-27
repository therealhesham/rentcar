"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import Link from "next/link";
import type {
  AvailabilityBlockFieldMapping,
  AvailabilityImportResult,
  AvailabilityValueReview,
  ValueOption,
  ValueReviewItem,
} from "@/app/admin/availability-import-actions";
import {
  importAvailabilityBlocksFromExcel,
  reviewAvailabilityImportValues,
} from "@/app/admin/availability-import-actions";
import {
  AUTO_SUGGEST_MIN_SCORE,
  branchValueKey,
  modelValueKey,
  type AvailabilityValueOverrides,
} from "@/lib/availability-import-values";
import {
  parseSpreadsheetFile,
  cellToPlainStringWithTime,
  type ImportRow,
} from "@/lib/vehicle-import-excel";
import { previewDateCell, previewTimeCell } from "@/lib/availability-block-time";

type ParsedFile = {
  fileName: string;
  headers: string[];
  rows: ImportRow[];
  totalRows: number;
};

const NONE = "__none__";

/** route تنزيل (ملف xlsx) لا صفحة — لذلك `<a>` عادي لا `<Link>`. */
const TEMPLATE_HREF = "/api/admin/fleet/availability-template";

const IMPORT_FIELDS: {
  key: keyof AvailabilityBlockFieldMapping;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
    { key: "brand", label: "الماركة", hint: "تويوتا / Toyota…" },
    { key: "modelName", label: "اسم الموديل", hint: "كامري / يارس… — مطلوب هو أو الماركة", required: true },
    { key: "year", label: "سنة الصنع", hint: "للتمييز عند تكرار الموديل" },
    { key: "branch", label: "الفرع", hint: "بالاسم العربي أو المدينة", required: true },
    { key: "pickupDate", label: "تاريخ الاستلام", hint: "مطلوب · yyyy-mm-dd أو dd/mm/yyyy", required: true },
    { key: "pickupTime", label: "توقيت الاستلام", hint: "مطلوب · HH:mm مثل 14:30", required: true },
    { key: "returnDate", label: "تاريخ الإرجاع", hint: "مطلوب", required: true },
    { key: "returnTime", label: "توقيت الإرجاع", hint: "مطلوب · HH:mm مثل 18:00", required: true },
    { key: "reason", label: "السبب", hint: "صيانة / تأجير خارجي… (اختياري)" },
    {
      key: "fullName",
      label: "اسم العميل",
      hint: "اختياري — لو اتربط مع الجوال يُنشأ/يُربط حساب عميل حقيقي (تأجير خارجي) بدل حجب مجهول",
    },
    { key: "phone", label: "جوال العميل", hint: "اختياري · 05xxxxxxxx — لازم يترافق مع الاسم" },
  ];

function autoDetect(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()[\]]/g, "");

  const patterns: [keyof AvailabilityBlockFieldMapping, string[]][] = [
    ["brand", ["الماركة", "ماركة", "brand", "make", "manufacturer", "العلامة"]],
    ["modelName", ["الموديل", "موديل", "model", "نوعالسيارة", "السيارة", "car", "vehicle", "العربية"]],
    ["year", ["سنةالصنع", "السنة", "سنة", "year", "modelyear"]],
    ["branch", ["الفرع", "فرع", "branch", "location", "المعرض"]],
    ["pickupDate", ["تاريخالاستلام", "تاريخالبداية", "منتاريخ", "pickupdate", "startdate", "datefrom", "fromdate"]],
    ["pickupTime", ["توقيتالاستلام", "وقتالاستلام", "pickuptime", "starttime", "timefrom"]],
    ["returnDate", ["تاريخالارجاع", "تاريخالإرجاع", "تاريخالنهاية", "الىتاريخ", "إلىتاريخ", "returndate", "enddate", "dateto", "todate"]],
    ["returnTime", ["توقيتالارجاع", "توقيتالإرجاع", "وقتالارجاع", "returntime", "endtime", "timeto"]],
    ["reason", ["السبب", "سبب", "reason", "ملاحظات", "notes"]],
    ["fullName", ["اسمالعميل", "العميل", "الاسم", "customer", "customername", "name", "client"]],
    ["phone", ["الجوال", "جوال", "الهاتف", "هاتف", "phone", "mobile", "الموبايل", "رقمالجوال"]],
  ];

  for (const [field, keywords] of patterns) {
    for (const h of headers) {
      if (keywords.some((kw) => norm(h).includes(norm(kw)))) {
        result[field] = h;
        break;
      }
    }
  }

  return result;
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────

function UploadZone({ onParsed }: { onParsed: (data: ParsedFile) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parse = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        // cellToPlainStringWithTime تحافظ على وقت اليوم لخلايا التاريخ/الوقت — لازمة
        // لعمودي التوقيت هنا (Excel يحوّل تلقائياً أي نص شبه-وقت لخلية Time).
        const { headers, rows } = await parseSpreadsheetFile(file, {
          cellToString: cellToPlainStringWithTime,
        });
        onParsed({ fileName: file.name, headers, rows, totalRows: rows.length });
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
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) parse(f);
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/50 p-12 text-center transition-colors hover:border-primary/40 hover:bg-surface-container/70"
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) parse(f);
        }}
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
          {loading ? "جاري تحليل الملف…" : "ارفع ملف الاكسل"}
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
  required,
  value,
  headers,
  onChange,
}: {
  label: string;
  hint: string;
  required?: boolean;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
}) {
  const missing = required && value === NONE;
  return (
    <div className="flex flex-col gap-1.5 border-b border-outline-variant/20 px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-44 shrink-0">
        <p className="text-sm font-bold text-on-surface">
          {label}
          {required && <span className="text-error"> *</span>}
        </p>
        <p className="text-[11px] leading-snug text-on-surface-variant">{hint}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 rounded-xl border bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 transition-colors focus:ring-2 ${missing ? "border-error/60" : "border-outline-variant"
          }`}
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

// ─── Value review (typos) ─────────────────────────────────────────────────────

type ValueChoices = { branch: Record<string, number | null>; model: Record<string, number | null> };

/** الاختيار المبدئي: المطابقة الحرفية، وإلا أقرب اقتراح لو قريب كفاية، وإلا لا شيء. */
function initialChoice(item: ValueReviewItem): number | null {
  if (item.matchedId !== null) return item.matchedId;
  const top = item.suggestions[0];
  return top && top.score >= AUTO_SUGGEST_MIN_SCORE ? top.id : null;
}

/** القيم المميزة لعمودي الفرع والموديل في الملف مع عدد تكرار كل قيمة. */
function collectDistinctValues(rows: ImportRow[], mapping: Record<string, string>) {
  const get = (row: ImportRow, col?: string) => (col ? (row[col] ?? "").trim() : "");
  const branches = new Map<string, number>();
  const models = new Map<string, { brand: string; model: string; year: string; count: number }>();
  for (const row of rows) {
    const branch = get(row, mapping.branch);
    if (branch) branches.set(branchValueKey(branch), (branches.get(branchValueKey(branch)) ?? 0) + 1);

    const brand = get(row, mapping.brand);
    const model = get(row, mapping.modelName);
    const year = get(row, mapping.year);
    if (brand || model) {
      const key = modelValueKey(brand, model, year);
      const hit = models.get(key);
      if (hit) hit.count++;
      else models.set(key, { brand, model, year, count: 1 });
    }
  }
  return {
    branches: [...branches].map(([raw, count]) => ({ raw, count })),
    models: [...models.values()],
  };
}

function ValueReviewRow({
  item,
  options,
  value,
  onChange,
}: {
  item: ValueReviewItem;
  options: ValueOption[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const labelById = new Map(options.map((o) => [o.id, o.label]));
  const status =
    value === null
      ? { text: "غير مطابق — اختر", cls: "bg-error/10 text-error" }
      : item.matchedId === value
        ? { text: "مطابق", cls: "bg-emerald-100 text-emerald-700" }
        : item.matchedId === null && value === initialChoice(item)
          ? { text: "اقتراح — راجعه", cls: "bg-amber-100 text-amber-800" }
          : { text: "تم التعديل", cls: "bg-primary/10 text-primary" };

  return (
    <div className="flex flex-col gap-1.5 border-b border-outline-variant/20 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-64 sm:shrink-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-on-surface">
          <span className="truncate" dir="auto">«{item.raw}»</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.text}</span>
        </p>
        <p className="text-[11px] leading-snug text-on-surface-variant">
          {item.count.toLocaleString("en-US")} صف
          {item.matchedId === null && item.issue ? ` · ${item.issue}` : ""}
        </p>
      </div>
      <select
        value={value === null ? NONE : String(value)}
        onChange={(e) => onChange(e.target.value === NONE ? null : Number(e.target.value))}
        className={`min-w-0 flex-1 rounded-xl border bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 transition-colors focus:ring-2 ${value === null ? "border-error/60" : "border-outline-variant"
          }`}
      >
        <option value={NONE}>— بدون (الصفوف دي هتترفض) —</option>
        {item.suggestions.length > 0 && (
          <optgroup label="أقرب اقتراحات">
            {item.suggestions.map((s) => (
              <option key={`s-${s.id}`} value={s.id}>
                {labelById.get(s.id) ?? s.id} · {Math.round(s.score * 100)}%
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="الكل">
          {options
            .filter((o) => !item.suggestions.some((s) => s.id === o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </optgroup>
      </select>
    </div>
  );
}

function ValueReviewSection({
  title,
  items,
  options,
  choices,
  onChange,
}: {
  title: string;
  items: ValueReviewItem[];
  options: ValueOption[];
  choices: Record<string, number | null>;
  onChange: (key: string, v: number | null) => void;
}) {
  if (items.length === 0) return null;
  // غير المطابق أولاً — هو اللي محتاج قرار
  const sorted = [...items].sort(
    (a, b) => Number(a.matchedId !== null) - Number(b.matchedId !== null) || b.count - a.count,
  );
  const unmatched = items.filter((i) => i.matchedId === null).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
      <div className="border-b border-outline-variant/30 px-5 py-3">
        <p className="text-sm font-extrabold text-on-surface">
          {title} · {items.length} قيمة
          {unmatched > 0 && <span className="text-amber-700"> ({unmatched} غير مطابقة حرفياً)</span>}
        </p>
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {sorted.map((item) => (
          <ValueReviewRow
            key={item.key}
            item={item}
            options={options}
            value={choices[item.key] ?? null}
            onChange={(v) => onChange(item.key, v)}
          />
        ))}
      </div>
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
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-center">
      <p className={`text-2xl font-extrabold tabular-nums ${color}`}>
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </p>
      <p className="mt-1 text-xs font-bold text-on-surface-variant">{label}</p>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { row: number; message: string }[];
  tone: "error" | "warn";
}) {
  if (issues.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <div className="border-b border-outline-variant/30 px-4 py-3">
        <p className={`text-sm font-bold ${tone === "error" ? "text-error" : "text-amber-700"}`}>
          {title} ({issues.length})
        </p>
      </div>
      <div className="max-h-60 divide-y divide-outline-variant/20 overflow-y-auto">
        {issues.map((e, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span className="mt-px shrink-0 font-bold tabular-nums text-on-surface-variant">
              {e.row > 0 ? `صف ${e.row}` : "عام"}
            </span>
            <span className={tone === "error" ? "text-error" : "text-amber-800"}>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AvailabilityImportClient() {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  /** نتيجة الفحص بلا حفظ — بوابة إلزامية قبل الكتابة. */
  const [preview, setPreview] = useState<AvailabilityImportResult | null>(null);
  const [result, setResult] = useState<AvailabilityImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  /** مراجعة قيم الفرع/الموديل (أخطاء إملائية) + اختيار المستخدم أمام كل قيمة. */
  const [review, setReview] = useState<AvailabilityValueReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ValueChoices>({ branch: {}, model: {} });

  const handleParsed = useCallback((data: ParsedFile) => {
    setParsed(data);
    setMapping(autoDetect(data.headers));
    setPreview(null);
    setResult(null);
    setReview(null);
  }, []);

  // المراجعة تُعاد عند تغيّر الملف أو ربط أعمدة الفرع/الماركة/الموديل/السنة فقط
  const reviewCols = [mapping.branch, mapping.brand, mapping.modelName, mapping.year];
  const reviewDeps = reviewCols.join("\u0000");
  useEffect(() => {
    if (!parsed) return;
    const { branches, models } = collectDistinctValues(parsed.rows, mapping);
    if (branches.length === 0 && models.length === 0) {
      setReview(null);
      setChoices({ branch: {}, model: {} });
      return;
    }
    let cancelled = false;
    setReviewLoading(true);
    setReviewError(null);
    reviewAvailabilityImportValues({ branches, models })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setReviewError(r.error);
          setReview(null);
          return;
        }
        setReview(r.review);
        setChoices({
          branch: Object.fromEntries(r.review.branches.map((i) => [i.key, initialChoice(i)])),
          model: Object.fromEntries(r.review.models.map((i) => [i.key, initialChoice(i)])),
        });
        setPreview(null);
      })
      .catch(() => {
        if (!cancelled) setReviewError("تعذّرت مراجعة القيم — أعد المحاولة.");
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, reviewDeps]);

  /** أي تغيير في الربط يُبطل الفحص — وإلا حُفظ شيء غير الذي عاينه المستخدم. */
  const invalidatePreview = () => setPreview(null);

  const setField = (field: string, raw: string) => {
    setMapping((prev) => ({ ...prev, [field]: raw === NONE ? "" : raw }));
    invalidatePreview();
  };

  const setChoice = (kind: keyof ValueChoices, key: string, v: number | null) => {
    setChoices((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: v } }));
    invalidatePreview();
  };

  const buildOverrides = (): AvailabilityValueOverrides => {
    const pick = (m: Record<string, number | null>) =>
      Object.fromEntries(Object.entries(m).filter((e): e is [string, number] => e[1] !== null));
    return { branch: pick(choices.branch), model: pick(choices.model) };
  };

  const unresolvedValues = review
    ? [...review.branches.filter((i) => choices.branch[i.key] == null),
      ...review.models.filter((i) => choices.model[i.key] == null)]
    : [];
  const unresolvedRows = unresolvedValues.reduce((n, i) => n + i.count, 0);

  const buildMapping = (): AvailabilityBlockFieldMapping => {
    const fm: AvailabilityBlockFieldMapping = {};
    for (const f of IMPORT_FIELDS) {
      const col = mapping[f.key];
      if (col) fm[f.key] = col;
    }
    return fm;
  };

  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);

  const run = (dryRun: boolean) => {
    if (!parsed) return;
    startTransition(async () => {
      const r = await importAvailabilityBlocksFromExcel({
        rows: parsed.rows,
        mapping: buildMapping(),
        dryRun,
        overrides: buildOverrides(),
      });
      if (dryRun) setPreview(r);
      else setResult(r);
    });
  };

  // ── Final result ─────────────────────────────────────────────────────────────

  if (result) {
    const allOk = result.errors.length === 0;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${allOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
            >
              {allOk ? "✓" : "!"}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">تم تحديث الاتاحة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {parsed?.fileName} · {result.total} صف في الملف
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="حُجبت" value={result.created} color="text-emerald-700" />
            <StatCard label="مكررة (محجوبة سلفاً)" value={result.duplicates} color="text-primary" />
            <StatCard label="تم تخطيه" value={result.skipped} color={result.skipped > 0 ? "text-error" : "text-on-surface"} />
          </div>

          {result.customersMatched + result.customersToCreate > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <StatCard label="عملاء موجودون (رُبطوا)" value={result.customersMatched} color="text-primary" />
              <StatCard label="عملاء جدد (أُنشئوا)" value={result.customersToCreate} color="text-primary" />
            </div>
          )}

          <div className="space-y-4">
            <IssueList title="الأخطاء" issues={result.errors} tone="error" />
            <IssueList title="تنبيهات" issues={result.warnings} tone="warn" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setResult(null);
                setPreview(null);
                setParsed(null);
                setMapping({});
              }}
              className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
            >
              رفع ملف آخر
            </button>
            <Link
              href="/admin/fleet-availability"
              className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white"
            >
              عرض التوفر
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  if (!parsed) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6">
          <h2 className="font-extrabold text-on-surface">1 · نزّل ملف الاكسل</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            قالب فارغ بالأعمدة المطلوبة، وأعمدة الفرع والماركة والموديل فيها قائمة منسدلة بالأسماء
            المسجّلة في النظام (ورقة «القوائم») — املأه واحفظه ثم ارفعه.
          </p>
          <a
            href={TEMPLATE_HREF}
            download
            className="mt-4 inline-block rounded-xl border border-outline-variant px-6 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-surface-container"
          >
            تنزيل ملف الاكسل (xlsx)
          </a>
        </div>

        <div>
          <h2 className="mb-3 font-extrabold text-on-surface">2 · ارفع الملف</h2>
          <UploadZone onParsed={handleParsed} />
        </div>
      </div>
    );
  }

  // ── Mapping + dry run ────────────────────────────────────────────────────────

  const previewRows = parsed.rows.slice(0, 5);
  const willImport = preview ? preview.total - preview.skipped : 0;

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
          onClick={() => {
            setParsed(null);
            setMapping({});
            setPreview(null);
          }}
          className="shrink-0 text-xs font-bold text-on-surface-variant transition-colors hover:text-error"
        >
          تغيير الملف
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Mapping table */}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <div className="border-b border-outline-variant/30 px-5 py-4">
            <h2 className="font-extrabold text-on-surface">ربط أعمدة Excel بحقول الحجب</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              الحقول المعلَّمة <span className="font-bold text-error">*</span> إلزامية · الاكتشاف
              التلقائي يحاول مطابقة أسماء الأعمدة فراجعه
            </p>
          </div>
          <div>
            {IMPORT_FIELDS.map((f) => (
              <MappingRow
                key={f.key}
                label={f.label}
                hint={f.hint}
                required={f.required}
                value={mapping[f.key] ?? NONE}
                headers={parsed.headers}
                onChange={(v) => setField(f.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {missingRequired.length > 0 ? (
            <p className="rounded-xl border border-error/30 bg-error/8 px-4 py-3 text-xs font-bold text-error">
              اربط الحقول الإلزامية أولاً: {missingRequired.map((f) => f.label).join("، ")}
            </p>
          ) : (
            <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[11px] leading-snug text-amber-900">
              <span className="font-bold">تنبيه:</span> صف بنفس الموديل والفرع والتوقيت
              (استلام+إرجاع) محجوب سلفاً هيُتجاهَل تلقائياً — مش هيتكرر ولا يُستبدل.
            </p>
          )}

          {unresolvedRows > 0 && !reviewLoading && (
            <p className="rounded-xl border border-error/30 bg-error/8 px-4 py-3 text-[11px] font-bold leading-snug text-error">
              {unresolvedValues.length} قيمة بدون اختيار في «مراجعة القيم» —{" "}
              {unresolvedRows.toLocaleString("en-US")} صف هيترفض لو كمّلت كده.
            </p>
          )}

          <button
            onClick={() => run(true)}
            disabled={isPending || reviewLoading || missingRequired.length > 0}
            className="w-full rounded-xl border border-primary px-6 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-primary/5 disabled:opacity-40"
          >
            {isPending && !preview ? "جاري الفحص…" : "١ · فحص بدون حفظ"}
          </button>

          <button
            onClick={() => run(false)}
            disabled={isPending || !preview || willImport === 0}
            className="gradient-cta w-full rounded-xl px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.4)] transition-opacity disabled:opacity-40"
          >
            {isPending && preview
              ? "جاري الحفظ…"
              : preview
                ? `٢ · تأكيد وحجب ${willImport.toLocaleString("en-US")} عربية`
                : "٢ · الحفظ (بعد الفحص)"}
          </button>

          {!preview && (
            <p className="text-center text-[11px] text-on-surface-variant">
              الحفظ مقفول لحد ما تعمل فحص أولاً
            </p>
          )}
        </div>
      </div>

      {/* Value review — قائمة اختيار أمام كل فرع/موديل لتصحيح الأخطاء الإملائية */}
      {(review || reviewLoading || reviewError) && (
        <div className="space-y-4">
          <div>
            <h2 className="font-extrabold text-on-surface">مراجعة القيم</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              كل فرع وموديل مكتوب في الملف وقدامه اختيار من النظام. لو الاسم ناقص حرف أو مكتوب
              بشكل مختلف، اختار الصح من القائمة — الاختيار يتطبّق على كل الصفوف اللي فيها نفس القيمة.
            </p>
          </div>
          {reviewLoading && (
            <p className="text-sm text-on-surface-variant">جاري مطابقة القيم…</p>
          )}
          {reviewError && (
            <p className="rounded-xl border border-error/30 bg-error/8 px-4 py-3 text-sm font-bold text-error">
              {reviewError}
            </p>
          )}
          {review && !reviewLoading && (
            <>
              <ValueReviewSection
                title="الفروع"
                items={review.branches}
                options={review.branchOptions}
                choices={choices.branch}
                onChange={(k, v) => setChoice("branch", k, v)}
              />
              <ValueReviewSection
                title="الموديلات"
                items={review.models}
                options={review.modelOptions}
                choices={choices.model}
                onChange={(k, v) => setChoice("model", k, v)}
              />
            </>
          )}
        </div>
      )}

      {/* Dry run report */}
      {preview && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="mb-1 text-lg font-extrabold text-on-surface">نتيجة الفحص — لم يُحفظ شيء</h2>
          <p className="mb-5 text-xs text-on-surface-variant">
            راجع الأرقام والأخطاء ثم اضغط «تأكيد وحجب». أي تغيير في الربط يلغي الفحص.
          </p>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="صفوف الملف" value={preview.total} />
            <StatCard label="سيُحجب" value={willImport} color="text-emerald-700" />
            <StatCard label="مكرر / متخطى" value={preview.skipped} color={preview.skipped > 0 ? "text-amber-700" : "text-on-surface"} />
          </div>

          {preview.customersMatched + preview.customersToCreate > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <StatCard label="عملاء موجودون (سيُربطون)" value={preview.customersMatched} color="text-primary" />
              <StatCard label="عملاء جدد (سيُنشؤون)" value={preview.customersToCreate} color="text-primary" />
            </div>
          )}

          <div className="space-y-4">
            <IssueList title="صفوف مرفوضة" issues={preview.errors} tone="error" />
            <IssueList title="تنبيهات" issues={preview.warnings} tone="warn" />
          </div>
        </div>
      )}

      {/* Column preview */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <div className="border-b border-outline-variant/30 px-5 py-4">
          <h2 className="font-extrabold text-on-surface">
            معاينة الأعمدة · أول {previewRows.length} صفوف
          </h2>
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
                    const raw = (row[col] ?? "").trim();
                    // خلايا Excel الحقيقية للتاريخ/الوقت تصل كـISO كامل (لحفظ الوقت من
                    // خلية Time — راجع cellToPlainStringWithTime) فتبدو نصاً غريباً بلا
                    // تنسيق؛ هنا عرض فقط، التحقق الفعلي يحصل وقت «فحص بدون حفظ».
                    const val =
                      f.key === "pickupTime" || f.key === "returnTime"
                        ? previewTimeCell(raw)
                        : f.key === "pickupDate" || f.key === "returnDate"
                          ? previewDateCell(raw)
                          : raw;
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
