"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Ban, ChevronDown, ClipboardPaste, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { addManualBlacklist, type ManualBlacklistState } from "@/app/admin/customer-blacklist-actions";
import {
  isBlankRow,
  parsePastedLine,
  validateBlacklistRow,
  type BlacklistRowInput,
} from "@/lib/blacklist-input";

type Mode = "single" | "bulk";
type RowField = keyof BlacklistRowInput;
type Row = BlacklistRowInput & { key: number };

const INITIAL_ROWS = 3;
const MAX_ROWS = 500;

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const cellInputClass =
  "w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition focus:ring-2";

let nextKey = 1;
function blankRow(): Row {
  return { key: nextKey++, phone: "", name: "", nationalIdNumber: "" };
}
function blankRows(n: number): Row[] {
  return Array.from({ length: n }, blankRow);
}

function Field({
  label,
  name,
  placeholder,
  dir,
}: {
  label: string;
  name: string;
  placeholder?: string;
  dir?: "ltr";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <input name={name} placeholder={placeholder} dir={dir} className={inputClass} />
    </label>
  );
}

/** جدول «مجموعة عملاء»: صف لكل عميل، تحقق فوري، ولصق مباشر من Excel. */
function BulkRows({
  rows,
  setRows,
}: {
  rows: Row[];
  setRows: (update: (rows: Row[]) => Row[]) => void;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const focusTarget = useRef<{ row: number; field: RowField } | null>(null);

  useEffect(() => {
    const t = focusTarget.current;
    if (!t) return;
    focusTarget.current = null;
    tableRef.current
      ?.querySelector<HTMLInputElement>(`input[data-row="${t.row}"][data-field="${t.field}"]`)
      ?.focus();
  });

  const update = (key: number, field: RowField, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow = (focusIndex?: number) => {
    setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, blankRow()]));
    if (focusIndex != null) focusTarget.current = { row: focusIndex, field: "phone" };
  };

  const removeRow = (key: number) =>
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((r) => r.key !== key)));

  // Enter ينقل لنفس الخانة في الصف التالي (ويضيف صفاً في النهاية) بدل إرسال النموذج.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number, field: RowField) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${index + 1}"][data-field="${field}"]`,
    );
    if (next) {
      next.focus();
    } else {
      addRow();
      focusTarget.current = { row: index + 1, field };
    }
  };

  // لصق عدة أسطر/خلايا (من Excel أو قائمة) يوزّعها على الصفوف تلقائياً بدءاً من الصف الحالي.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n\t]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map(parsePastedLine).filter((r): r is BlacklistRowInput => r != null);
    const skipped = lines.length - parsed.length;
    setRows((rs) => {
      const before = rs.slice(0, index);
      const after = rs.slice(index).filter((r) => !isBlankRow(r));
      const pasted = parsed.map((p) => ({ ...p, key: nextKey++ }));
      const merged = [...before, ...pasted, ...after].slice(0, MAX_ROWS);
      return merged.length ? [...merged, blankRow()] : [blankRow()];
    });
    setPasteNote(
      `تم لصق ${parsed.length} عميل` + (skipped ? ` — تم تجاهل ${skipped} سطر بلا جوال أو هوية` : ""),
    );
  };

  return (
    <div ref={tableRef} className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-[#eff6ff] px-3.5 py-2.5 text-xs leading-relaxed text-[#1e3a8a]">
        <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          اكتب كل عميل في صف — يكفي الجوال <b>أو</b> رقم الهوية. عندك قائمة في Excel؟ انسخ الأعمدة والصقها
          في أي خانة وستتوزّع على الصفوف تلقائياً.
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-container-low/60 text-[11px] font-bold text-on-surface-variant">
            <tr>
              <th className="w-10 px-2 py-2.5 text-center">#</th>
              <th className="px-2 py-2.5 text-start">الجوال</th>
              <th className="px-2 py-2.5 text-start">الاسم (اختياري)</th>
              <th className="px-2 py-2.5 text-start">رقم الهوية / الإقامة</th>
              <th className="w-12 px-2 py-2.5" aria-label="حذف" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {rows.map((row, i) => {
              const check = isBlankRow(row) ? null : validateBlacklistRow(row);
              const errorField = check && !check.ok ? check.field : null;
              const cell = (field: RowField, props: { placeholder: string; dir?: "ltr"; inputMode?: "tel" | "numeric" }) => (
                <input
                  value={row[field]}
                  onChange={(e) => update(row.key, field, e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, i, field)}
                  onPaste={(e) => onPaste(e, i)}
                  data-row={i}
                  data-field={field}
                  aria-invalid={errorField === field || undefined}
                  className={`${cellInputClass} ${
                    errorField === field
                      ? "border-error/60 bg-error/5 focus:ring-error/20"
                      : "border-outline-variant/40 focus:border-primary focus:ring-primary/20"
                  }`}
                  {...props}
                />
              );
              return (
                <tr key={row.key} className="align-top">
                  <td className="px-2 py-2.5 text-center text-xs font-bold tabular-nums text-on-surface-variant">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2">
                    {cell("phone", { placeholder: "05xxxxxxxx", dir: "ltr", inputMode: "tel" })}
                    {errorField === "phone" && check && !check.ok ? (
                      <p className="mt-1 text-[11px] font-bold text-error">{check.error}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{cell("name", { placeholder: "اسم العميل" })}</td>
                  <td className="px-2 py-2">
                    {cell("nationalIdNumber", { placeholder: "1xxxxxxxxx", dir: "ltr", inputMode: "numeric" })}
                    {errorField === "nationalIdNumber" && check && !check.ok ? (
                      <p className="mt-1 text-[11px] font-bold text-error">{check.error}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`حذف الصف ${i + 1}`}
                      className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => addRow(rows.length)}
          disabled={rows.length >= MAX_ROWS}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-outline-variant/60 px-3.5 py-2 text-sm font-bold text-on-surface transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          إضافة صف
        </button>
        {pasteNote ? <p className="text-xs font-bold text-[#1d4ed8]">{pasteNote}</p> : null}
      </div>
    </div>
  );
}

/** إضافة عميل (أو مجموعة) للقائمة السوداء قبل أن يحجز — يُرفض أي حجز لاحق بالمطابقة. */
export function ManualBlacklistForm() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [rows, setRows] = useState<Row[]>(() => blankRows(INITIAL_ROWS));
  const [state, formAction, pending] = useActionState(
    addManualBlacklist,
    null as ManualBlacklistState | null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // بعد نجاح الحظر: تفريغ الجدول (حالة React) والحقول غير المتحكَّم بها (DOM).
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setRows(blankRows(INITIAL_ROWS));
  }
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const filledRows = rows.filter((r) => !isBlankRow(r));
  const invalidCount = filledRows.filter((r) => !validateBlacklistRow(r).ok).length;
  const bulkBlocked = mode === "bulk" && (filledRows.length === 0 || invalidCount > 0);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-900/15 bg-white shadow-[0_4px_24px_-12px_rgba(28,27,27,0.12)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition hover:bg-surface-container-low/50 sm:px-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Ban className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-extrabold tracking-tight text-[#003749]">
              إضافة للقائمة السوداء
            </span>
            <span className="block text-xs text-on-surface-variant sm:text-sm">
              احظر عميلاً أو مجموعة عملاء مسبقاً — حتى لو لم يحجزوا من قبل.
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-outline-variant/20 px-5 py-5 sm:px-6">
          <div
            role="tablist"
            className="mb-5 inline-flex rounded-xl border border-outline-variant/40 bg-surface-container-low/60 p-1"
          >
            {(
              [
                { id: "single", label: "عميل واحد", icon: UserPlus },
                { id: "bulk", label: "مجموعة عملاء", icon: Users },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={mode === t.id}
                onClick={() => setMode(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
                  mode === t.id
                    ? "bg-white text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>

          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="mode" value={mode} />

            {mode === "single" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="الجوال" name="phone" placeholder="05xxxxxxxx" dir="ltr" />
                <Field label="الاسم (اختياري)" name="name" placeholder="اسم العميل" />
                <Field label="البريد (اختياري)" name="email" placeholder="name@example.com" dir="ltr" />
                <Field label="رقم الهوية / الإقامة" name="nationalIdNumber" dir="ltr" />
                <Field label="رقم الجواز" name="passportNumber" dir="ltr" />
                <Field label="رقم الرخصة" name="licenseNumber" dir="ltr" />
              </div>
            ) : (
              <>
                <input
                  type="hidden"
                  name="rows"
                  value={JSON.stringify(
                    filledRows.map((r) => ({
                      phone: r.phone,
                      name: r.name,
                      nationalIdNumber: r.nationalIdNumber,
                    })),
                  )}
                />
                <BulkRows rows={rows} setRows={setRows} />
              </>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-on-surface-variant">
                سبب الحظر (ملاحظة داخلية — لا تظهر للعميل)
              </span>
              <input name="reason" maxLength={500} placeholder="مثال: عدم سداد مستحقات" className={inputClass} />
            </label>

            <p className="rounded-xl bg-surface-container-low/70 px-3.5 py-2.5 text-xs leading-relaxed text-on-surface-variant">
              يُرفض أي حجز أو اشتراك جديد يطابق الجوال أو البريد أو رقم الهوية/الجواز/الرخصة، برسالة عامة لا
              تذكر السبب. أدخل أكبر قدر من البيانات لإغلاق الثغرات (مثل تغيير رقم الجوال).
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending || bulkBlocked}
                onClick={(e) => {
                  const who = mode === "bulk" ? `${filledRows.length} عميل` : "العميل";
                  if (!confirm(`تأكيد إضافة ${who} للقائمة السوداء؟ لن يتمكنوا من الحجز.`)) {
                    e.preventDefault();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban className="h-4 w-4" aria-hidden />
                {pending
                  ? "جارٍ الحظر…"
                  : mode === "bulk" && filledRows.length > 0
                    ? `حظر ${filledRows.length} عميل`
                    : "حظر"}
              </button>

              {mode === "bulk" && invalidCount > 0 ? (
                <p className="text-sm font-bold text-error">صحّح {invalidCount} صف باللون الأحمر أولاً</p>
              ) : null}
              {state && !state.ok ? <p className="text-sm font-bold text-error">{state.error}</p> : null}
              {state?.ok ? (
                <p className="text-sm font-bold text-emerald-700">
                  تم حظر {state.added ?? 0}
                  {state.already ? ` — ${state.already} محظور مسبقاً` : ""}
                </p>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
