"use client";

import { useActionState } from "react";
import { updateBranchFleetQuantity } from "@/app/admin/branch-fleet-actions";

type Props = {
  modelId: number;
  branchId: number;
  defaultQuantity: number;
  /** سعر الفرع اليومي دون ضريبة — null = سعر الموديل الأساسي */
  defaultPrice?: number | null;
  /** سعر الموديل الأساسي — يُعرض placeholder عند غياب سعر خاص للفرع */
  basePrice?: number;
  /** سعر الفرع الشهري دون ضريبة — null = السعر الشهري الأساسي للموديل (أو لا يوجد عرض شهري) */
  defaultMonthlyPrice?: number | null;
  /** السعر الشهري الأساسي للموديل — يُعرض placeholder عند غياب سعر خاص للفرع؛ null = لا يوجد عرض شهري */
  baseMonthlyPrice?: number | null;
  /** الحد الأدنى اليومي للفرع دون ضريبة — null = حد الموديل */
  defaultMinPrice?: number | null;
  /** الحد الأدنى اليومي للموديل — placeholder عند غياب حد خاص للفرع؛ null = بلا حد */
  baseMinPrice?: number | null;
  /** الحد الأدنى الشهري للفرع دون ضريبة — null = حد الموديل */
  defaultMinMonthlyPrice?: number | null;
  /** الحد الأدنى الشهري للموديل — placeholder عند غياب حد خاص للفرع؛ null = بلا حد */
  baseMinMonthlyPrice?: number | null;
  /** عرض مضغوط داخل جدول السوبر أدمن */
  compact?: boolean;
};

export function BranchFleetQuantityForm({
  modelId,
  branchId,
  defaultQuantity,
  defaultPrice,
  basePrice,
  defaultMonthlyPrice,
  baseMonthlyPrice,
  defaultMinPrice,
  baseMinPrice,
  defaultMinMonthlyPrice,
  baseMinMonthlyPrice,
  compact = false,
}: Props) {
  const [state, formAction, pending] = useActionState(updateBranchFleetQuantity, null);

  const inputClass = compact
    ? "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-center text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary"
    : "w-20 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary";

  return (
    <form
      action={formAction}
      className={
        compact
          ? "flex w-full max-w-[7.5rem] flex-col items-stretch gap-1"
          : "flex flex-wrap items-center gap-2"
      }
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="branchId" value={branchId} />
      <label className={compact ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
        <span className="text-[9px] font-bold text-on-surface-variant">الكمية</span>
        <input
          type="number"
          name="quantity"
          min={0}
          max={500}
          defaultValue={defaultQuantity}
          className={inputClass}
          dir="ltr"
        />
      </label>
      <label className={compact ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
        <span className="text-[9px] font-bold text-on-surface-variant">سعر اليوم (ر.س)</span>
        <input
          type="number"
          name="branchPrice"
          min={0}
          step="0.01"
          defaultValue={defaultPrice ?? ""}
          placeholder={basePrice != null ? String(basePrice) : "سعر الموديل"}
          title="فارغ = سعر الموديل الأساسي"
          className={inputClass}
          dir="ltr"
        />
      </label>
      <label className={compact ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
        <span className="text-[9px] font-bold text-on-surface-variant">سعر الشهر (ر.س)</span>
        <input
          type="number"
          name="branchMonthlyPrice"
          min={0}
          step="0.01"
          defaultValue={defaultMonthlyPrice ?? ""}
          placeholder={baseMonthlyPrice != null ? String(baseMonthlyPrice) : "لا يوجد"}
          title="فارغ = السعر الشهري الأساسي للموديل (أو لا يوجد عرض شهري)"
          className={inputClass}
          dir="ltr"
        />
      </label>
      <label className={compact ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
        <span className="text-[9px] font-bold text-on-surface-variant">أدنى سعر يوم</span>
        <input
          type="number"
          name="branchMinPrice"
          min={0}
          step="0.01"
          defaultValue={defaultMinPrice ?? ""}
          placeholder={baseMinPrice != null ? String(baseMinPrice) : "بلا حد"}
          title="لا ينزل السعر اليومي بعد الخصم تحت هذا الحد (دون ضريبة). فارغ = حد الموديل."
          className={inputClass}
          dir="ltr"
        />
      </label>
      <label className={compact ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
        <span className="text-[9px] font-bold text-on-surface-variant">أدنى سعر شهر</span>
        <input
          type="number"
          name="branchMinMonthlyPrice"
          min={0}
          step="0.01"
          defaultValue={defaultMinMonthlyPrice ?? ""}
          placeholder={baseMinMonthlyPrice != null ? String(baseMinMonthlyPrice) : "بلا حد"}
          title="لا ينزل إجمالي الشهر بعد الخصم تحت هذا الحد (دون ضريبة). فارغ = حد الموديل."
          className={inputClass}
          dir="ltr"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-on-primary hover:opacity-95 disabled:opacity-60"
            : "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-95 disabled:opacity-60"
        }
      >
        {pending ? "…" : "حفظ"}
      </button>
      {state?.error ? (
        <span className="text-[10px] font-medium leading-tight text-error">{state.error}</span>
      ) : state?.ok ? (
        <span className="text-[10px] font-medium text-primary">تم</span>
      ) : null}
    </form>
  );
}
