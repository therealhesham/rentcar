"use client";

import { useMemo, useState } from "react";
import type { DiscountAppliesTo } from "@prisma/client";
import {
  DISCOUNT_APPLIES_TO_LABELS_AR,
  DISCOUNT_APPLIES_TO_VALUES,
} from "@/lib/discount-scope";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

export type BrandOpt = { id: number; name: string };
export type ModelOpt = {
  id: number;
  name: string;
  year: number;
  price: number;
  brandId: number;
  brand: { name: string };
};
export type BranchOpt = { id: number; name: string; slug: string };

type Defaults = {
  labelAr?: string;
  kind?: "PERCENT" | "FIXED_DAILY";
  appliesTo?: DiscountAppliesTo;
  value?: number | "";
  startsAt?: string;
  endsAt?: string;
  brandId?: number | null;
  carModelId?: number | null;
  branchId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
};

type Props = {
  brands: BrandOpt[];
  models: ModelOpt[];
  branches: BranchOpt[];
  defaults?: Defaults;
};

const inputCls =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

function formatSar(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function RentalDiscountFields({ brands, models, branches, defaults }: Props) {
  const [kind, setKind] = useState<"PERCENT" | "FIXED_DAILY">(defaults?.kind ?? "PERCENT");
  const [value, setValue] = useState<string>(
    defaults?.value != null && defaults.value !== "" ? String(defaults.value) : "",
  );
  const [brandId, setBrandId] = useState<string>(
    defaults?.brandId != null ? String(defaults.brandId) : "",
  );
  const [carModelId, setCarModelId] = useState<string>(
    defaults?.carModelId != null ? String(defaults.carModelId) : "",
  );
  const [startsAt, setStartsAt] = useState<string>(defaults?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState<string>(defaults?.endsAt ?? "");
  const [sampledPrice, setSampledPrice] = useState<string>("");

  // الموديلات المعروضة: مفلترة حسب الماركة المختارة (إن وُجدت).
  const visibleModels = useMemo(() => {
    const bId = brandId ? Number(brandId) : null;
    if (bId == null) return models;
    return models.filter((m) => m.brandId === bId);
  }, [models, brandId]);

  const selectedModel = useMemo(
    () => (carModelId ? models.find((m) => m.id === Number(carModelId)) ?? null : null),
    [models, carModelId],
  );

  function onBrandChange(next: string) {
    setBrandId(next);
    // لو الموديل المختار لا ينتمي للماركة الجديدة، أعد ضبطه.
    if (carModelId) {
      const m = models.find((x) => x.id === Number(carModelId));
      if (m && next && m.brandId !== Number(next)) {
        setCarModelId("");
      }
    }
  }

  function onModelChange(next: string) {
    setCarModelId(next);
    // اختيار موديل يضبط ماركته تلقائياً ويقفلها على نفس الماركة.
    if (next) {
      const m = models.find((x) => x.id === Number(next));
      if (m) setBrandId(String(m.brandId));
    }
  }

  // سعر مرجعي للمعاينة: من الموديل المحدد أو متوسط الماركة أو إدخال يدوي.
  const referencePrice = useMemo(() => {
    if (selectedModel) return selectedModel.price;
    const manual = Number(sampledPrice);
    if (Number.isFinite(manual) && manual > 0) return Math.round(manual);
    const bId = brandId ? Number(brandId) : null;
    const pool = bId != null ? models.filter((m) => m.brandId === bId) : models;
    if (pool.length === 0) return null;
    const avg = pool.reduce((s, m) => s + m.price, 0) / pool.length;
    return Math.round(avg);
  }, [selectedModel, sampledPrice, brandId, models]);

  const preview = useMemo(() => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 1 || referencePrice == null || referencePrice <= 0) {
      return null;
    }
    let savings = 0;
    if (kind === "PERCENT") {
      const pct = Math.min(100, Math.max(1, Math.round(v)));
      savings = Math.round((referencePrice * pct) / 100);
    } else {
      savings = Math.min(referencePrice, Math.max(0, Math.round(v)));
    }
    if (savings <= 0) return null;
    const discounted = referencePrice - savings;
    const customerLabel =
      kind === "PERCENT"
        ? `خصم ${Math.min(100, Math.max(1, Math.round(v))).toLocaleString("ar-SA")}٪`
        : `وفّرت ${savings.toLocaleString("en-US")} ر.س`;
    return { original: referencePrice, discounted, savings, customerLabel };
  }, [value, kind, referencePrice, selectedModel]);

  const periodError =
    startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()
      ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية."
      : null;

  const scopeSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedModel) {
      parts.push(`${selectedModel.brand.name} ${selectedModel.name} ${selectedModel.year}`);
    } else if (brandId) {
      parts.push(brands.find((b) => b.id === Number(brandId))?.name ?? "ماركة");
    } else {
      parts.push("كل المركبات");
    }
    return parts.join(" · ");
  }, [selectedModel, brandId, brands]);

  return (
    <>
      <label className="text-sm font-medium md:col-span-2">
        الاسم الداخلي (للإدارة)
        <input
          name="labelAr"
          type="text"
          required
          maxLength={255}
          defaultValue={defaults?.labelAr ?? ""}
          placeholder="خصم رمضان — تويوتا"
          className={inputCls}
        />
      </label>

      <label className="text-sm font-medium">
        نوع الخصم
        <select
          name="kind"
          required
          value={kind}
          onChange={(e) => setKind(e.target.value as "PERCENT" | "FIXED_DAILY")}
          className={inputCls}
        >
          <option value="PERCENT">نسبة مئوية (%)</option>
          <option value="FIXED_DAILY">مبلغ ثابت يومي (ريال)</option>
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
          {DISCOUNT_APPLIES_TO_VALUES.map((v) => (
            <option key={v} value={v}>
              {DISCOUNT_APPLIES_TO_LABELS_AR[v]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          الخصم يسري فقط على نوع التأجير المحدَّد هنا.
          {" "}المبلغ الثابت اليومي يُضرب في عدد أيام الشهر عند السريان على الشهري.
        </span>
      </label>

      <label className="text-sm font-medium">
        {kind === "PERCENT" ? "نسبة الخصم (%)" : "مبلغ الخصم اليومي (ريال)"}
        <input
          name="value"
          type="number"
          min={1}
          max={kind === "PERCENT" ? 100 : 1_000_000}
          step={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === "PERCENT" ? "10" : "50"}
          className={`${inputCls} font-mono`}
        />
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          {kind === "PERCENT"
            ? "نسبة من السعر اليومي قبل الضريبة (1–100)."
            : "مبلغ يُخصم من السعر اليومي قبل الضريبة، بحدّ السعر نفسه."}
        </span>
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
        ماركة (اختياري — الكل إن تُرك فارغاً)
        <select
          name="brandId"
          value={brandId}
          onChange={(e) => onBrandChange(e.target.value)}
          className={inputCls}
        >
          <option value="">كل الماركات</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        موديل (اختياري)
        <select
          name="carModelId"
          value={carModelId}
          onChange={(e) => onModelChange(e.target.value)}
          className={inputCls}
        >
          <option value="">{brandId ? "كل موديلات الماركة" : "كل الموديلات"}</option>
          {visibleModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brand.name} {m.name} {m.year} — {formatSar(m.price)} ر.س/يوم
            </option>
          ))}
        </select>
        {brandId && visibleModels.length === 0 ? (
          <span className="mt-1 block text-[11px] font-normal text-error">
            لا توجد موديلات لهذه الماركة.
          </span>
        ) : null}
      </label>

      <label className="text-sm font-medium md:col-span-2">
        فرع (اختياري — كل الفروع إن تُرك فارغاً)
        <select name="branchId" defaultValue={defaults?.branchId ?? ""} className={inputCls}>
          <option value="">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        ترتيب الأولوية
        <input
          name="sortOrder"
          type="number"
          defaultValue={defaults?.sortOrder ?? 0}
          className={inputCls}
        />
        <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
          عند تطابق أكثر من خصم، يُختار الأعلى توفيراً، وعند التساوي يفوز الأقل رقماً هنا.
        </span>
      </label>

      <label className="text-sm font-medium">
        مفعّل
        <select
          name="isActive"
          defaultValue={defaults?.isActive === false ? "false" : "true"}
          className={inputCls}
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>

      {/* معاينة حية لما سيراه العميل */}
      <div className="md:col-span-2 rounded-2xl border border-dashed border-primary/40 bg-primary-container/20 p-5">
        <p className="mb-3 text-sm font-extrabold text-on-surface">معاينة الخصم</p>

        {!selectedModel ? (
          <label className="mb-4 block text-xs font-medium text-on-surface-variant">
            سعر يومي مرجعي للمعاينة (اختياري — يُستخدم متوسط تلقائي إن تُرك فارغاً)
            <input
              type="number"
              min={1}
              value={sampledPrice}
              onChange={(e) => setSampledPrice(e.target.value)}
              placeholder={referencePrice != null ? String(referencePrice) : "200"}
              className={`${inputCls} max-w-xs font-mono`}
            />
          </label>
        ) : null}

        <p className="mb-3 text-xs text-on-surface-variant">
          النطاق: <span className="font-bold text-on-surface">{scopeSummary}</span>
          {startsAt || endsAt ? (
            <>
              {" · "}الفترة:{" "}
              <span className="font-bold text-on-surface">
                {startsAt || "—"} → {endsAt || "—"}
              </span>
            </>
          ) : (
            <> · بدون تقييد زمني</>
          )}
        </p>

        {periodError ? (
          <p className="text-sm font-bold text-error">{periodError}</p>
        ) : preview ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-2" dir="ltr">
              <span className="text-sm font-bold text-on-surface-variant line-through opacity-70">
                {formatSar(preview.original)} <SarCurrencyGlyph />
              </span>
              <span className="text-2xl font-extrabold text-on-surface">
                {formatSar(preview.discounted)} <SarCurrencyGlyph />
              </span>
              <span className="text-xs text-on-surface-variant">/ يوم (قبل الضريبة)</span>
            </div>
            <span className="rounded-md bg-[#c2410c]/10 px-2 py-1 text-xs font-extrabold text-[#c2410c]">
              {preview.customerLabel}
            </span>
            <span className="text-xs text-on-surface-variant">
              يوفّر العميل {formatSar(preview.savings)} ر.س يومياً
            </span>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            أدخل قيمة الخصم لرؤية السعر بعد التطبيق وما سيظهر للعميل.
          </p>
        )}
      </div>
    </>
  );
}
