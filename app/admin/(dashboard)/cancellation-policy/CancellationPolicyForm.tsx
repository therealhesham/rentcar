"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CancellationDeductTier } from "@/lib/cancellation-deduct";
import {
  updateCustomerCancellationPolicy,
  type CancellationPolicyFormState,
} from "@/app/admin/cancellation-policy-actions";

type Props = {
  policyAr: string;
  minHoursBeforePickup: number;
  deductTiers: CancellationDeductTier[];
};

function tiersSignature(tiers: CancellationDeductTier[]): string {
  return JSON.stringify(
    tiers.map((t) => ({ maxHoursBeforePickup: t.maxHoursBeforePickup, deductDays: t.deductDays })),
  );
}

export function CancellationPolicyForm(props: Props) {
  return <CancellationPolicyFormInner key={tiersSignature(props.deductTiers)} {...props} />;
}

function CancellationPolicyFormInner({
  policyAr,
  minHoursBeforePickup,
  deductTiers,
}: Props) {
  const uid = useId();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateCustomerCancellationPolicy,
    null as CancellationPolicyFormState,
  );

  const [tiers, setTiers] = useState<CancellationDeductTier[]>(() => [...deductTiers]);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  const deductTiersJson = useMemo(() => JSON.stringify(tiers), [tiers]);

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <input type="hidden" name="deductTiersJson" value={deductTiersJson} readOnly />

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-hours`} className="block text-sm font-bold text-on-surface">
          مهلة الإلغاء الذاتي (بالساعات قبل موعد الاستلام)
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          إذا وضعت مثلاً «٢»، لا يستطيع العميل إلغاء الحجز من حسابه إلا قبل موعد الاستلام بأكثر من
          ساعتين. القيمة «٠» تعني عدم تطبيق أي تقييد زمني من الموقع.
        </p>
        <input
          id={`${uid}-hours`}
          name="minHoursBeforePickup"
          type="number"
          min={0}
          max={720}
          step={1}
          defaultValue={minHoursBeforePickup}
          className="mt-3 w-full max-w-xs rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary"
          dir="ltr"
        />
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-on-surface">خصم أيام عند الإلغاء الذاتي</p>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              أضف شرائح بالترتيب من الأقرب للاستلام: إذا كان الوقت المتبقي قبل الاستلام أقل من أو
              يساوي «الساعات» في الصف، يُخصم من مدة الإيجار «عدد الأيام» المحدد (يمكن كسر يوم مثل
              ٠٫٥). أول شريحة تنطبق تُنفَّذ فقط. إن لم تُطابق أي شريحة (إلغاء مبكر جداً) لا يُخصم
              شيء آلياً.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setTiers((prev) => [
                ...prev,
                { maxHoursBeforePickup: 24, deductDays: 1 },
              ])
            }
            className="shrink-0 rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-extrabold text-on-surface shadow-sm hover:bg-surface-container-high"
          >
            + شريحة
          </button>
        </div>

        {tiers.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-on-surface-variant">
            لا توجد شرائح — لن يُسجَّل خصم أيام تلقائياً عند الإلغاء (ما عدا ما تذكره في النص).
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tiers.map((row, i) => (
              <li
                key={i}
                className="flex flex-wrap items-end gap-3 rounded-xl border border-outline-variant/50 bg-white/80 p-4"
              >
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-bold text-on-surface-variant">
                    ساعات أو أقل قبل الاستلام
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    step={1}
                    value={row.maxHoursBeforePickup}
                    onChange={(e) => {
                      const v = Number.parseInt(e.target.value, 10);
                      setTiers((prev) => {
                        const next = [...prev];
                        const cur = next[i];
                        if (!cur) return prev;
                        next[i] = {
                          ...cur,
                          maxHoursBeforePickup:
                            Number.isFinite(v) && v >= 1 ? v : cur.maxHoursBeforePickup,
                        };
                        return next;
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs font-bold text-on-surface-variant">
                    خصم (يوم)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    step={0.25}
                    value={row.deductDays}
                    onChange={(e) => {
                      const v = Number.parseFloat(e.target.value);
                      setTiers((prev) => {
                        const next = [...prev];
                        const cur = next[i];
                        if (!cur) return prev;
                        next[i] = {
                          ...cur,
                          deductDays: Number.isFinite(v) && v >= 0 ? v : cur.deductDays,
                        };
                        return next;
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-900 hover:bg-red-100"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-on-surface-variant">
          مثال: صف واحد — الساعات ٦، الخصم ٠٫٥ — يعني إذا ألغى العميل والمتبقي ٦ ساعات أو أقل قبل
          الاستلام يُسجَّل نصف يوم خصم (بحد أقصى أيام الحجز الفعلية).
        </p>
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-policy`} className="block text-sm font-bold text-on-surface">
          نص سياسات الإلغاء للعميل
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          يُعرض في نافذة تأكيد «إزالة الحجز» في صفحة حساب العميل (اختياري).
        </p>
        <textarea
          id={`${uid}-policy`}
          name="policyAr"
          rows={8}
          defaultValue={policyAr}
          maxLength={8000}
          className="mt-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
          placeholder="مثال: يمكن الإلغاء مجاناً قبل موعد الاستلام بـ ٢٤ ساعة…"
        />
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تم حفظ الإعدادات.
        </p>
      ) : null}
      {state?.ok === false && state.error ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
