"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import type {
  BookingFieldMapping,
  BookingImportResult,
} from "@/app/admin/booking-import-actions";
import { importBookingsFromExcel } from "@/app/admin/booking-import-actions";
import { parseSpreadsheetFile, type ImportRow } from "@/lib/vehicle-import-excel";

export type BranchOption = { id: number; name: string };
export type ModelOption = { id: number; label: string };

type Props = {
  branches: BranchOption[];
  models: ModelOption[];
};

type ParsedFile = {
  fileName: string;
  headers: string[];
  rows: ImportRow[];
  totalRows: number;
};

const NONE = "__none__";

/** حالات الحجز المسموح اختيارها كافتراضي للملف. */
const STATUS_OPTIONS: { value: string; label: string; closed: boolean }[] = [
  { value: "RETURNED", label: "مرتجع — الحجز انتهى ورجعت السيارة", closed: true },
  { value: "COMPLETED", label: "مكتمل", closed: true },
  { value: "CANCELLED", label: "ملغي", closed: true },
  { value: "REJECTED", label: "مرفوض", closed: true },
  { value: "PICKED_UP", label: "مستلم — حجز ما زال جارياً", closed: false },
  { value: "CONFIRMED", label: "مؤكد — لم يُستلم بعد", closed: false },
];

const IMPORT_FIELDS: {
  key: keyof BookingFieldMapping;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  { key: "legacyRef",     label: "رقم العقد القديم",  hint: "مفتاح منع التكرار — مهم جداً" },
  { key: "fullName",      label: "اسم العميل",         hint: "مطلوب", required: true },
  { key: "phone",         label: "جوال العميل",        hint: "مطلوب · 05xxxxxxxx", required: true },
  { key: "email",         label: "البريد الإلكتروني",   hint: "اختياري — يُولَّد تلقائياً إن غاب" },
  { key: "brand",         label: "الماركة",            hint: "تويوتا / Toyota…" },
  { key: "modelName",     label: "اسم الموديل",         hint: "كامري / يارس…" },
  { key: "year",          label: "سنة الصنع",           hint: "للتمييز عند تكرار الموديل" },
  { key: "branch",        label: "فرع الاستلام",        hint: "بالاسم العربي أو المدينة" },
  { key: "returnBranch",  label: "فرع الإرجاع",         hint: "افتراضي: نفس فرع الاستلام" },
  { key: "pickupDate",    label: "تاريخ الاستلام",      hint: "مطلوب · yyyy-mm-dd أو dd/mm/yyyy", required: true },
  { key: "numberOfDays",  label: "عدد الأيام",          hint: "أو اربط تاريخ الإرجاع" },
  { key: "dropoffDate",   label: "تاريخ الإرجاع",       hint: "تُشتق منه المدة إن غابت" },
  { key: "totalAmount",   label: "الإجمالي (شامل الضريبة)", hint: "يُحفظ كما هو بلا إعادة حساب" },
  { key: "paidAmount",    label: "المبلغ المدفوع",       hint: "اختياري" },
  { key: "paymentStatus", label: "حالة الدفع",          hint: "مدفوع / غير مدفوع" },
  { key: "paymentMethod", label: "طريقة الدفع",         hint: "نقدي / مدى / تحويل…" },
  { key: "status",        label: "حالة الحجز",          hint: "افتراضي من الإعدادات جانباً" },
  { key: "plateNumber",   label: "رقم اللوحة",          hint: "اختياري" },
  { key: "notes",         label: "ملاحظات",             hint: "تُحفظ كملاحظات إدارية" },
];

function autoDetect(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()[\]]/g, "");

  const patterns: [keyof BookingFieldMapping, string[]][] = [
    ["legacyRef",     ["رقمالعقد", "العقد", "contract", "رقمالحجز", "bookingno", "refno", "المرجع", "رقمالفاتورة", "invoiceno"]],
    ["fullName",      ["اسمالعميل", "العميل", "الاسم", "customer", "customername", "name", "client"]],
    ["phone",         ["الجوال", "جوال", "الهاتف", "هاتف", "phone", "mobile", "الموبايل", "رقمالجوال"]],
    ["email",         ["البريد", "الايميل", "الإيميل", "email", "mail"]],
    ["brand",         ["الماركة", "ماركة", "brand", "make", "manufacturer", "العلامة"]],
    ["modelName",     ["الموديل", "موديل", "model", "نوعالسيارة", "السيارة", "car", "vehicle"]],
    ["year",          ["سنةالصنع", "السنة", "سنة", "year", "modelyear"]],
    ["branch",        ["فرعالاستلام", "الفرع", "فرع", "branch", "location", "المعرض"]],
    ["returnBranch",  ["فرعالارجاع", "فرعالإرجاع", "فرعالتسليم", "returnbranch", "dropoffbranch"]],
    ["pickupDate",    ["تاريخالاستلام", "تاريخالبداية", "منتاريخ", "pickupdate", "startdate", "datefrom", "fromdate"]],
    ["numberOfDays",  ["عددالايام", "عددالأيام", "الايام", "الأيام", "المدة", "days", "duration", "numberofdays"]],
    ["dropoffDate",   ["تاريخالارجاع", "تاريخالإرجاع", "تاريخالنهاية", "الىتاريخ", "إلىتاريخ", "dropoffdate", "returndate", "enddate", "dateto", "todate"]],
    ["totalAmount",   ["الاجمالي", "الإجمالي", "اجمالي", "المجموع", "total", "totalamount", "grandtotal", "القيمة"]],
    ["paidAmount",    ["المدفوع", "المبلغالمدفوع", "مدفوع", "paid", "paidamount", "المحصل"]],
    ["paymentStatus", ["حالةالدفع", "الدفع", "paymentstatus", "paystatus", "السداد"]],
    ["paymentMethod", ["طريقةالدفع", "وسيلةالدفع", "paymentmethod", "paymenttype", "نوعالدفع"]],
    ["status",        ["حالةالحجز", "الحالة", "status", "bookingstatus", "state"]],
    ["plateNumber",   ["اللوحة", "رقماللوحة", "لوحة", "plate", "platenumber", "plateno"]],
    ["notes",         ["ملاحظات", "الملاحظات", "notes", "note", "remarks", "comment"]],
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
        const { headers, rows } = await parseSpreadsheetFile(file);
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
          {loading ? "جاري تحليل الملف…" : "ارفع ملف الحجوزات"}
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
        className={`flex-1 rounded-xl border bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 transition-colors focus:ring-2 ${
          missing ? "border-error/60" : "border-outline-variant"
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

export function BookingImportClient({ branches, models }: Props) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultStatus, setDefaultStatus] = useState("RETURNED");
  const [branchId, setBranchId] = useState("");
  const [carModelId, setCarModelId] = useState("");
  /** نتيجة الفحص بلا حفظ — بوابة إلزامية قبل الكتابة. */
  const [preview, setPreview] = useState<BookingImportResult | null>(null);
  const [result, setResult] = useState<BookingImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleParsed = useCallback((data: ParsedFile) => {
    setParsed(data);
    setMapping(autoDetect(data.headers));
    setPreview(null);
    setResult(null);
  }, []);

  /** أي تغيير في الربط أو الإعدادات يُبطل الفحص — وإلا حُفظ شيء غير الذي عاينه المستخدم. */
  const invalidatePreview = () => setPreview(null);

  const setField = (field: string, raw: string) => {
    setMapping((prev) => ({ ...prev, [field]: raw === NONE ? "" : raw }));
    invalidatePreview();
  };

  const buildMapping = (): BookingFieldMapping => {
    const fm: BookingFieldMapping = {};
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
      const r = await importBookingsFromExcel({
        rows: parsed.rows,
        mapping: buildMapping(),
        dryRun,
        defaultStatus,
        defaultCarModelId: carModelId ? Number(carModelId) : null,
        defaultBranchId: branchId ? Number(branchId) : null,
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
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                allOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {allOk ? "✓" : "!"}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">تم الترحيل</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {parsed?.fileName} · {result.total} صف في الملف
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <StatCard label="حجوزات أُنشئت" value={result.created} color="text-emerald-700" />
            <StatCard label="مكررة (مُرحَّلة سابقاً)" value={result.duplicates} color="text-primary" />
            <StatCard label="تم تخطيه" value={result.skipped} color={result.skipped > 0 ? "text-error" : "text-on-surface"} />
            <StatCard label="إجمالي المبالغ" value={`${result.totalAmountSar.toLocaleString("en-US")} ر.س`} />
          </div>

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
              ترحيل ملف آخر
            </button>
            <Link
              href="/admin/car-bookings"
              className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white"
            >
              عرض الحجوزات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  if (!parsed) {
    return <UploadZone onParsed={handleParsed} />;
  }

  // ── Mapping + dry run ────────────────────────────────────────────────────────

  const previewRows = parsed.rows.slice(0, 5);
  const willImport = preview ? preview.total - preview.skipped : 0;
  const selectedStatusOpen = STATUS_OPTIONS.find((s) => s.value === defaultStatus)?.closed === false;

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

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Mapping table */}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <div className="border-b border-outline-variant/30 px-5 py-4">
            <h2 className="font-extrabold text-on-surface">ربط أعمدة Excel بحقول الحجز</h2>
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
          <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/30 px-5 py-4">
              <h2 className="font-extrabold text-on-surface">إعدادات الترحيل</h2>
            </div>
            <div className="space-y-5 p-5">
              <label className="block text-sm font-medium">
                حالة الحجز الافتراضية
                <select
                  value={defaultStatus}
                  onChange={(e) => {
                    setDefaultStatus(e.target.value);
                    invalidatePreview();
                  }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                  تُستخدم للصفوف بلا عمود حالة
                </span>
              </label>

              {selectedStatusOpen && (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-900">حالة مفتوحة</p>
                  <p className="mt-1 text-[11px] leading-snug text-amber-900/85">
                    الحجوزات هتظهر في لوحة الإدارة كطلبات قائمة وهتحجب وحدات من الأسطول. للترحيل
                    التاريخي اختر «مرتجع» أو «مكتمل».
                  </p>
                </div>
              )}

              <label className="block text-sm font-medium">
                الفرع الافتراضي
                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    invalidatePreview();
                  }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  <option value="">— بلا فرع —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                  للصفوف التي لا يُعرَف فرعها من الملف
                </span>
              </label>

              <label className="block text-sm font-medium">
                الموديل الافتراضي
                <select
                  value={carModelId}
                  onChange={(e) => {
                    setCarModelId(e.target.value);
                    invalidatePreview();
                  }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
                >
                  <option value="">— من أعمدة الملف —</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] leading-snug text-on-surface-variant">
                  يُستخدم فقط لو الملف بلا أعمدة ماركة/موديل
                </span>
              </label>
            </div>
          </div>

          {missingRequired.length > 0 ? (
            <p className="rounded-xl border border-error/30 bg-error/8 px-4 py-3 text-xs font-bold text-error">
              اربط الحقول الإلزامية أولاً: {missingRequired.map((f) => f.label).join("، ")}
            </p>
          ) : !mapping.legacyRef ? (
            <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[11px] leading-snug text-amber-900">
              <span className="font-bold">بلا رقم عقد قديم:</span> إعادة رفع نفس الملف هتنشئ
              حجوزات مكررة. اربط عمود رقم العقد لو موجود.
            </p>
          ) : null}

          <button
            onClick={() => run(true)}
            disabled={isPending || missingRequired.length > 0}
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
                ? `٢ · تأكيد وحفظ ${willImport.toLocaleString("en-US")} حجز`
                : "٢ · الحفظ (بعد الفحص)"}
          </button>

          {!preview && (
            <p className="text-center text-[11px] text-on-surface-variant">
              الحفظ مقفول لحد ما تعمل فحص — التراجع عن ترحيل جماعي مكلف
            </p>
          )}
        </div>
      </div>

      {/* Dry run report */}
      {preview && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="mb-1 text-lg font-extrabold text-on-surface">نتيجة الفحص — لم يُحفظ شيء</h2>
          <p className="mb-5 text-xs text-on-surface-variant">
            راجع الأرقام والأخطاء ثم اضغط «تأكيد وحفظ». أي تغيير في الربط يلغي الفحص.
          </p>

          <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="صفوف الملف" value={preview.total} />
            <StatCard label="سيُنشأ" value={willImport} color="text-emerald-700" />
            <StatCard label="مكرر / متخطى" value={preview.skipped} color={preview.skipped > 0 ? "text-amber-700" : "text-on-surface"} />
            <StatCard label="عملاء موجودون" value={preview.customersMatched} color="text-primary" />
            <StatCard label="عملاء جدد" value={preview.customersToCreate} color="text-primary" />
            <StatCard label="إجمالي المبالغ" value={`${preview.totalAmountSar.toLocaleString("en-US")} ر.س`} />
          </div>

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
