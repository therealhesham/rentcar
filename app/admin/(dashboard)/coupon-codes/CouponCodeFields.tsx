"use client";

import { useState } from "react";

type Defaults = {
  code?: string;
  kind?: "PERCENT" | "FIXED";
  value?: number | "";
  scope?: "RENTAL_ONLY" | "FULL_TOTAL";
  appliesTo?: "DAILY_ONLY" | "DAILY_AND_MONTHLY";
  startsAt?: string;
  endsAt?: string;
  maxUses?: number | "";
  perCustomerLimit?: number | "";
  isActive?: boolean;
};

type Props = {
  defaults?: Defaults;
  /** true عند التعديل — يمنع تغيير الكود بعد الإنشاء لتفادي كسر التتبّع بالكود القديم. */
  lockCode?: boolean;
};

const inputCls =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

export function CouponCodeFields({ defaults, lockCode }: Props) {
  const [kind, setKind] = useState<"PERCENT" | "FIXED">(defaults?.kind ?? "PERCENT");
  const [startsAt, setStartsAt] = useState<string>(defaults?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState<string>(defaults?.endsAt ?? "");

  return (
    <>
      <label className="text-sm font-medium">
        الكود
        <input
          name="code"
          type="text"
          required
          readOnly={lockCode}
          maxLength={32}
          defaultValue={defaults?.code ?? ""}
          placeholder="RAMADAN25"
          className={`${inputCls} font-mono uppercase ${lockCode ? "opacity-70" : ""}`}
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.toUpperCase();
          }}
        />
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          أحرف إنجليزية وأرقام و - و _ فقط (3–32 حرفاً). هذا ما يكتبه العميل عند الدفع.
        </span>
      </label>

      <label className="text-sm font-medium">
        نطاق التطبيق
        <select name="scope" required defaultValue={defaults?.scope ?? "RENTAL_ONLY"} className={inputCls}>
          <option value="RENTAL_ONLY">سعر الإيجار فقط</option>
          <option value="FULL_TOTAL">الإجمالي كامل (إيجار + إضافات + رسوم)</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        نوع التأجير
        <select
          name="appliesTo"
          required
          defaultValue={defaults?.appliesTo ?? "DAILY_ONLY"}
          className={inputCls}
        >
          <option value="DAILY_ONLY">التأجير اليومي فقط</option>
          <option value="DAILY_AND_MONTHLY">اليومي والشهري معاً</option>
        </select>
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          «اليومي فقط» = الكود يُرفض لو العميل حاجز من تبويب «شهري».
        </span>
      </label>

      <label className="text-sm font-medium">
        نوع الخصم
        <select
          name="kind"
          required
          value={kind}
          onChange={(e) => setKind(e.target.value as "PERCENT" | "FIXED")}
          className={inputCls}
        >
          <option value="PERCENT">نسبة مئوية (%)</option>
          <option value="FIXED">مبلغ ثابت (ريال)</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        {kind === "PERCENT" ? "نسبة الخصم (%)" : "مبلغ الخصم (ريال)"}
        <input
          name="value"
          type="number"
          min={1}
          max={kind === "PERCENT" ? 100 : 1_000_000}
          step={1}
          required
          defaultValue={defaults?.value ?? ""}
          placeholder={kind === "PERCENT" ? "10" : "50"}
          className={`${inputCls} font-mono`}
        />
      </label>

      <label className="text-sm font-medium">
        من تاريخ (اختياري)
        <input
          name="startsAt"
          type="date"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="text-sm font-medium">
        إلى تاريخ (اختياري)
        <input
          name="endsAt"
          type="date"
          value={endsAt}
          min={startsAt || undefined}
          onChange={(e) => setEndsAt(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="text-sm font-medium">
        الحد الأقصى لعدد الاستخدامات (اختياري)
        <input
          name="maxUses"
          type="number"
          min={1}
          step={1}
          defaultValue={defaults?.maxUses ?? ""}
          placeholder="بلا حد"
          className={`${inputCls} font-mono`}
        />
      </label>

      <label className="text-sm font-medium">
        الحد الأقصى لكل عميل (اختياري)
        <input
          name="perCustomerLimit"
          type="number"
          min={1}
          step={1}
          defaultValue={defaults?.perCustomerLimit ?? ""}
          placeholder="بلا حد"
          className={`${inputCls} font-mono`}
        />
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          يُحتسب برقم جوال العميل.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={defaults?.isActive ?? true}
          className="size-4 rounded border-outline-variant"
        />
        نشط
      </label>
    </>
  );
}
