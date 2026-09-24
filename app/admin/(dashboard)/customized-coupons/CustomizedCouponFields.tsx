"use client";

import { useState } from "react";

type Defaults = {
  code?: string;
  customerPhone?: string;
  kind?: "PERCENT" | "FIXED";
  value?: number | "";
  scope?: "RENTAL_ONLY" | "FULL_TOTAL";
  canBypassMinPrice?: boolean;
  endsAt?: string;
  isActive?: boolean;
};

type Props = {
  defaults?: Defaults;
  /** true عند التعديل — يمنع تغيير الكود ورقم الجوال بعد الإنشاء (يمثّلان هوية الكود). */
  lockIdentity?: boolean;
};

const inputCls =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

export function CustomizedCouponFields({ defaults, lockIdentity }: Props) {
  const [kind, setKind] = useState<"PERCENT" | "FIXED">(defaults?.kind ?? "PERCENT");
  const [endsAt, setEndsAt] = useState<string>(defaults?.endsAt ?? "");

  return (
    <>
      <label className="text-sm font-medium">
        الكود
        <input
          name="code"
          type="text"
          required
          readOnly={lockIdentity}
          maxLength={32}
          defaultValue={defaults?.code ?? ""}
          placeholder="VIP-SALEM"
          className={`${inputCls} font-mono uppercase ${lockIdentity ? "opacity-70" : ""}`}
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.toUpperCase();
          }}
        />
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          أحرف إنجليزية وأرقام و - و _ فقط (3–32 حرفاً). هذا ما يكتبه العميل عند الدفع.
        </span>
      </label>

      <label className="text-sm font-medium">
        رقم جوال العميل المخصَّص له الكود
        <div className="mt-2 flex overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <span className="flex items-center bg-surface-container px-3 text-sm font-bold text-on-surface-variant" dir="ltr">
            +966
          </span>
          <input
            name="customerPhone"
            type="tel"
            required
            readOnly={lockIdentity}
            dir="ltr"
            maxLength={9}
            defaultValue={defaults?.customerPhone ?? ""}
            placeholder="5xxxxxxxx"
            className={`w-full px-4 py-2.5 font-mono text-on-surface outline-none ${lockIdentity ? "opacity-70" : ""}`}
          />
        </div>
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          هذا الكود لن يعمل إلا لهذا الرقم بالذات. لو العميل جرّبه برقم آخر، النظام يكمل البحث في
          أكواد الخصم العامة كالمعتاد.
        </span>
      </label>

      <label className="text-sm font-medium">
        نطاق التطبيق
        <select name="scope" required defaultValue={defaults?.scope ?? "RENTAL_ONLY"} className={inputCls}>
          <option value="RENTAL_ONLY">سعر الإيجار فقط</option>
          <option value="FULL_TOTAL">الإجمالي كامل (إيجار + إضافات + رسوم)</option>
        </select>
      </label>

      <label className="flex items-start gap-2 text-sm font-medium md:col-span-2">
        <input
          name="canBypassMinPrice"
          type="checkbox"
          defaultChecked={defaults?.canBypassMinPrice ?? false}
          className="mt-0.5 size-4 rounded border-outline-variant"
        />
        <span>
          يُسمح لهذا الكود بالنزول تحت الحد الأدنى للسعر
          <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
            افتراضياً الحد الأدنى المسجّل يقصّ الخصم فيبقى بلا أثر لو السعر
            أصلاً عليه. فعّل الخيار ده للعروض الاستثنائية المعتمدة لهذا
            العميل بالذات — الخصم وقتها هيُطبَّق بالكامل مهما نزل السعر.
          </span>
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
        ينتهي في (اختياري)
        <input
          name="endsAt"
          type="date"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className={inputCls}
        />
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

      <p className="text-[11px] font-normal text-on-surface-variant md:col-span-2">
        نسخة مبسّطة من أكواد الخصم العامة: يسري على التأجير اليومي والشهري معاً، يحترم الحد الأدنى
        للسعر دائماً، واستخدام واحد فقط — يُقفل الكود تلقائياً بعد أول حجز يستخدمه.
      </p>
    </>
  );
}
