"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Ban, ChevronDown, UserPlus, Users } from "lucide-react";
import { addManualBlacklist, type ManualBlacklistState } from "@/app/admin/customer-blacklist-actions";

type Mode = "single" | "bulk";

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  name,
  placeholder,
  dir,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  dir?: "ltr";
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <input name={name} placeholder={placeholder} dir={dir} className={inputClass} />
      {hint ? <span className="text-[11px] text-on-surface-variant">{hint}</span> : null}
    </label>
  );
}

/** إضافة عميل (أو مجموعة) للقائمة السوداء قبل أن يحجز — يُرفض أي حجز لاحق بالمطابقة. */
export function ManualBlacklistForm() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [state, formAction, pending] = useActionState(
    addManualBlacklist,
    null as ManualBlacklistState | null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

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
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant">عميل في كل سطر</span>
                <textarea
                  name="lines"
                  rows={7}
                  dir="auto"
                  placeholder={"0501234567, محمد أحمد\n0559876543\n1023456789, خالد\nname@example.com"}
                  className={`${inputClass} font-mono leading-relaxed`}
                />
                <span className="text-[11px] leading-relaxed text-on-surface-variant">
                  في كل سطر: جوال و/أو رقم هوية (10 أرقام) و/أو بريد، مع اسم اختياري — مفصولة بفاصلة.
                  حتى 500 سطر. يمكنك اللصق مباشرة من Excel.
                </span>
              </label>
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
                disabled={pending}
                onClick={(e) => {
                  if (!confirm("تأكيد إضافة العميل/العملاء للقائمة السوداء؟ لن يتمكنوا من الحجز.")) {
                    e.preventDefault();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
              >
                <Ban className="h-4 w-4" aria-hidden />
                {pending ? "جارٍ الحظر…" : "حظر"}
              </button>

              {state && !state.ok ? (
                <p className="text-sm font-bold text-error">{state.error}</p>
              ) : null}
              {state?.ok ? (
                <p className="text-sm font-bold text-emerald-700">
                  تم حظر {state.added ?? 0}
                  {state.already ? ` — ${state.already} محظور مسبقاً` : ""}
                  {state.invalid?.length ? ` — ${state.invalid.length} سطر غير مفهوم` : ""}
                </p>
              ) : null}
            </div>

            {state?.ok && state.invalid?.length ? (
              <div className="rounded-xl border border-error/30 bg-error/5 px-3.5 py-2.5 text-xs">
                <p className="font-bold text-error">أسطر لم يُعثر فيها على جوال أو بريد أو هوية صالحة:</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 font-mono text-on-surface" dir="auto">
                  {state.invalid.slice(0, 20).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
