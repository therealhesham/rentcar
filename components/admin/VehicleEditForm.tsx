"use client";

import { useActionState, useRef, useState, useId, type DragEvent } from "react";
import {
  Car,
  Fuel,
  DollarSign,
  Image as ImageIcon,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Layers,
  ChevronDown,
} from "lucide-react";
import { updateFleetVehicle } from "@/app/admin/actions";
import { ImageGalleryModal } from "@/components/admin/ImageGalleryModal";
import type { AdminFleetVehicleEditPayload } from "@/lib/fleet-vehicle-admin-data";

type Props = {
  vehicle: AdminFleetVehicleEditPayload;
};

const FUEL_LABELS: Record<string, string> = {
  ELECTRIC: "كهرباء ⚡",
  GASOLINE: "بنزين",
  DIESEL: "ديزل",
  HYBRID: "هجين 🌿",
};

const TRANSMISSION_LABELS: Record<string, string> = {
  AUTOMATIC: "أوتوماتيك",
  MANUAL: "يدوي",
};

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#775927]/10 text-[#775927]">
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-extrabold tracking-tight text-[#1c1b1b]">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[#4e453a]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  help,
  children,
  className = "",
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-[#4e453a]">
        {label}
      </span>
      {children}
      {help && (
        <span className="text-[11px] leading-snug text-[#807568]">{help}</span>
      )}
    </label>
  );
}

// ─── Text input ───────────────────────────────────────────────────────────────
const inputCls =
  "rounded-xl border border-[#d2c4b5] bg-white px-4 py-2.5 text-sm text-[#1c1b1b] outline-none ring-[#775927]/25 transition-shadow placeholder:text-[#807568]/60 focus:ring-2 focus:border-[#775927]/50";

// ─── Select ───────────────────────────────────────────────────────────────────
function Select({
  name,
  defaultValue,
  options,
  required,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full appearance-none rounded-xl border border-[#d2c4b5] bg-white px-4 py-2.5 text-sm text-[#1c1b1b] outline-none ring-[#775927]/25 transition-shadow focus:ring-2 focus:border-[#775927]/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#807568]"
        aria-hidden
      />
    </div>
  );
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────
function ImageUploadZone({
  currentImageUrl,
}: {
  currentImageUrl: string | null | undefined;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileReset, setFileReset] = useState(0);

  const activePreview = filePreview || galleryUrl || currentImageUrl || null;
  const hasNewImage = Boolean(filePreview || galleryUrl);

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setGalleryUrl("");
    const url = URL.createObjectURL(file);
    setFilePreview(url);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFileChange(e.dataTransfer.files);
    if (fileRef.current) {
      // sync file input if possible
    }
  };

  const clearImage = () => {
    setGalleryUrl("");
    setFilePreview(null);
    setFileReset((n) => n + 1);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="galleryImageUrl" value={galleryUrl} />

      {/* Preview */}
      {activePreview ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#d2c4b5] bg-[#f6f3f2] shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activePreview}
            alt=""
            className="h-56 w-full object-cover"
          />
          {/* overlay badge */}
          <div className="absolute inset-0 flex items-end">
            <div className="w-full bg-gradient-to-t from-black/50 to-transparent px-4 pb-3 pt-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[#1c1b1b]">
                {hasNewImage ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    صورة جديدة
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#775927]" />
                    الصورة الحالية
                  </>
                )}
              </span>
            </div>
          </div>
          {/* remove button */}
          {hasNewImage && (
            <button
              type="button"
              onClick={clearImage}
              className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label="إزالة الصورة"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors ${
            dragging
              ? "border-[#775927] bg-[#775927]/5"
              : "border-[#d2c4b5] bg-[#f6f3f2] hover:border-[#775927]/50 hover:bg-[#f6f3f2]/80"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#775927]/10 text-[#775927]">
            <Upload className="h-5 w-5" />
          </span>
          <div className="text-center">
            <p className="text-sm font-bold text-[#1c1b1b]">
              اسحب صورة هنا أو انقر للاختيار
            </p>
            <p className="mt-1 text-xs text-[#807568]">
              JPEG · PNG · WebP · GIF · SVG — حد أقصى 5 MB
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        key={fileReset}
        ref={fileRef}
        id={`${id}-file`}
        name="imageFile"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(e) => handleFileChange(e.target.files)}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#d2c4b5] bg-white px-4 py-2 text-sm font-bold text-[#1c1b1b] transition-colors hover:bg-[#f6f3f2]"
        >
          <Upload className="h-4 w-4 text-[#775927]" aria-hidden />
          رفع من الجهاز
        </button>
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#d2c4b5] bg-white px-4 py-2 text-sm font-bold text-[#1c1b1b] transition-colors hover:bg-[#f6f3f2]"
        >
          <ImageIcon className="h-4 w-4 text-[#775927]" aria-hidden />
          اختيار من المعرض
        </button>
        {hasNewImage && (
          <button
            type="button"
            onClick={clearImage}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
          >
            <X className="h-4 w-4" aria-hidden />
            إزالة
          </button>
        )}
      </div>

      <ImageGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(url) => {
          setGalleryUrl(url);
          setFilePreview(null);
          setFileReset((n) => n + 1);
        }}
      />
    </div>
  );
}

// ─── Branch fleet table ───────────────────────────────────────────────────────
function BranchFleetTable({
  branchFleet,
}: {
  branchFleet: AdminFleetVehicleEditPayload["branchFleet"];
}) {
  if (branchFleet.length === 0) {
    return (
      <p className="rounded-xl bg-[#f6f3f2] px-4 py-3 text-sm text-[#807568]">
        لا يوجد مخزون فرعي بعد — أضف من صفحة أسطول الفرع.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d2c4b5]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#d2c4b5] bg-[#f6f3f2]">
            <th className="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider text-[#4e453a]">
              الفرع
            </th>
            <th className="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider text-[#4e453a]">
              الكمية
            </th>
          </tr>
        </thead>
        <tbody>
          {branchFleet.map((bf, i) => (
            <tr
              key={bf.branchId}
              className="border-b border-[#d2c4b5]/50 last:border-0 transition-colors hover:bg-[#f6f3f2]/50"
            >
              <td className="px-4 py-2.5 font-medium text-[#1c1b1b]">
                {bf.branchName}
              </td>
              <td className="px-4 py-2.5">
                <input type="hidden" name="fleetBranchId" value={bf.branchId} />
                <input
                  name={i === 0 ? "quantity" : `quantity_${bf.branchId}`}
                  type="number"
                  min={0}
                  defaultValue={bf.quantity}
                  dir="ltr"
                  className="w-24 rounded-lg border border-[#d2c4b5] bg-white px-3 py-1.5 text-sm font-bold text-[#1c1b1b] tabular-nums outline-none ring-[#775927]/25 focus:ring-2"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#d2c4b5]/50 px-4 py-2 text-[11px] text-[#807568]">
        يُحفظ صف الفرع الأول تلقائياً — لباقي الفروع استخدم «أسطول الفرع».
      </p>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export function VehicleEditForm({ vehicle }: Props) {
  const [state, formAction, pending] = useActionState(updateFleetVehicle, null);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="modelId" value={vehicle.id} />

      {/* ── Status banner ── */}
      {state?.ok && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800">
            تم حفظ التعديلات بنجاح وتنعكس على صفحة الأسطول.
          </p>
        </div>
      )}
      {state && !state.ok && state.error && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm font-bold text-red-800">{state.error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Two-column layout: left = form sections, right = image + badge
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Section 1: Identity (read-only) */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={Car}
              title="بيانات المركبة"
              subtitle="المعلومات الثابتة المرتبطة بقاعدة البيانات"
            />
            <div className="rounded-xl bg-[#f6f3f2] px-4 py-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#807568]">
                الماركة · الفئة · السنة
              </p>
              <p className="mt-1 font-extrabold text-[#1c1b1b]">
                {vehicle.brandName} &mdash; {vehicle.categoryTitle} &mdash;{" "}
                {vehicle.year}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="اسم الموديل (عربي)">
                <input
                  name="modelName"
                  required
                  defaultValue={vehicle.name}
                  className={inputCls}
                  placeholder="مثال: كامري"
                />
              </Field>
              <Field label="اسم الموديل (إنجليزي)" help="يظهر للزائر عند تصفح الموقع باللغة الإنجليزية">
                <input
                  name="nameEn"
                  defaultValue={vehicle.nameEn ?? ""}
                  className={inputCls}
                  placeholder="مثال: Camry"
                  dir="ltr"
                />
              </Field>
              <Field label="عدد المقاعد">
                <input
                  name="chairs"
                  type="number"
                  required
                  min={1}
                  max={50}
                  defaultValue={vehicle.chairs}
                  className={inputCls}
                  dir="ltr"
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Performance */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={Settings2}
              title="الأداء والمواصفات"
              subtitle="محرك · ناقل الحركة · نوع الوقود"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="المحرك / الأداء" className="sm:col-span-2">
                <input
                  name="engine"
                  required
                  defaultValue={vehicle.engine}
                  placeholder="مثال: 750 حصان"
                  className={inputCls}
                />
              </Field>
              <Field label="ناقل الحركة">
                <Select
                  name="transmission"
                  defaultValue={vehicle.transmission}
                  required
                  options={Object.entries(TRANSMISSION_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Field>
              <Field label="نوع الوقود">
                <Select
                  name="fuel"
                  defaultValue={vehicle.fuel}
                  required
                  options={Object.entries(FUEL_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Field>
            </div>
          </div>

          {/* Section 3: Pricing */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={DollarSign}
              title="التسعير"
              subtitle="يُسجَّل السعر بدون ضريبة ويُعرض للعميل كذلك"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="السعر / يوم (ر.س)"
                help="السعر قبل ضريبة القيمة المضافة"
              >
                <input
                  name="price"
                  type="number"
                  required
                  min={1}
                  defaultValue={vehicle.price}
                  className={inputCls}
                  dir="ltr"
                />
              </Field>
              <Field
                label="نسبة ضريبة القيمة المضافة %"
                help="تُستخدم للفوترة الداخلية"
              >
                <input
                  name="vatRatePercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={vehicle.vatRatePercent}
                  className={inputCls}
                  dir="ltr"
                />
              </Field>
            </div>
          </div>

          {/* Section 4: Fleet quantities */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={Layers}
              title="الكمية في الفروع"
              subtitle="التوفر عند الحجز يُحسب من مخزون فرع الإرجاع"
            />
            <BranchFleetTable branchFleet={vehicle.branchFleet} />
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Section 5: Image */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={ImageIcon}
              title="صورة المركبة"
              subtitle="اترك فارغاً للإبقاء على الصورة الحالية"
            />
            <ImageUploadZone currentImageUrl={vehicle.image} />
          </div>

          {/* Section 6: Meta */}
          <div className="rounded-2xl border border-[#d2c4b5]/60 bg-white p-6 shadow-sm">
            <SectionHeader
              icon={Fuel}
              title="بيانات إضافية"
              subtitle="وصف الصورة والشارة على البطاقة"
            />
            <div className="flex flex-col gap-4">
              <Field
                label="وصف الصورة (alt)"
                help="نص بديل للوصول والـ SEO"
              >
                <input
                  name="alt"
                  defaultValue={vehicle.alt ?? ""}
                  placeholder="وصف قصير للصورة"
                  className={inputCls}
                />
              </Field>
              <Field
                label="شارة البطاقة (عربي)"
                help="تظهر كلصاقة فوق بطاقة السيارة (اختياري)"
              >
                <input
                  name="badge"
                  defaultValue={vehicle.badge ?? ""}
                  placeholder="مثال: الأكثر طلباً"
                  className={inputCls}
                />
              </Field>
              <Field
                label="شارة البطاقة (إنجليزي)"
                help="Badge text for English site (Optional)"
              >
                <input
                  name="badgeEn"
                  defaultValue={vehicle.badgeEn ?? ""}
                  placeholder="e.g. Most Popular"
                  className={inputCls}
                  dir="ltr"
                />
              </Field>
            </div>
          </div>

          {/* Save button — sticky on larger screens */}
          <div className="sticky top-6 rounded-2xl border border-[#d2c4b5]/60 bg-white p-5 shadow-sm">
            <button
              type="submit"
              disabled={pending}
              className="gradient-cta w-full rounded-xl px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.45)] transition-opacity disabled:opacity-60"
            >
              {pending ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  جاري الحفظ…
                </span>
              ) : (
                "حفظ التعديلات"
              )}
            </button>
            <p className="mt-3 text-center text-[11px] text-[#807568]">
              التغييرات تنعكس فوراً على صفحة الأسطول
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
