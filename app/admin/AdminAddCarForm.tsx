"use client";

import { useActionState } from "react";
import { createFleetVehicle } from "@/app/admin/actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

export type AdminCategoryOption = {
  id: number;
  title: string;
  slug: string;
};

export type AdminBrandOption = {
  id: number;
  name: string;
};

type AdminAddCarFormProps = {
  categories: AdminCategoryOption[];
  brands: AdminBrandOption[];
};

export function AdminAddCarForm({ categories, brands }: AdminAddCarFormProps) {
  const [state, formAction, pending] = useActionState(createFleetVehicle, null);

  if (categories.length === 0) {
    return (
      <div
        className="rounded-2xl border border-outline-variant/30 bg-amber-50/80 p-6 text-on-surface"
        role="alert"
      >
        <p className="font-bold text-primary">لا توجد فئات في قاعدة البيانات.</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          نفّذ من المشروع:{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
            npx prisma db seed
          </code>{" "}
          بعد ضبط <code className="rounded bg-surface-container px-1">DATABASE_URL</code>.
        </p>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div
        className="rounded-2xl border border-outline-variant/30 bg-amber-50/80 p-6 text-on-surface"
        role="alert"
      >
        <p className="font-bold text-primary">لا توجد ماركات في قاعدة البيانات.</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          أضف سجلات في جدول الماركات (Brand) أو نفّذ{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
            npx prisma db seed
          </code>{" "}
          لإدراج بيانات أولية.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        إضافة مركبة للأسطول
      </h2>

      <label className="text-sm font-medium md:col-span-2">
        فئة الأسطول
        <select
          name="categoryId"
          required
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="" disabled>
            اختر الفئة
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-1">
        الماركة
        <select
          name="brandId"
          required
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="" disabled>
            اختر الماركة
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        الموديل
        <input
          name="modelName"
          required
          placeholder="مثال: Taycan Turbo S"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium">
        السنة
        <input
          name="year"
          type="number"
          required
          min={1990}
          max={2035}
          defaultValue={2024}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium">
        عدد المقاعد
        <input
          name="chairs"
          type="number"
          required
          min={1}
          max={50}
          defaultValue={4}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        المحرك / الأداء (يظهر في البطاقة)
        <input
          name="engine"
          required
          placeholder="مثال: 750 حصان"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium">
        ناقل الحركة
        <select
          name="transmission"
          required
          defaultValue="AUTOMATIC"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="AUTOMATIC">أوتوماتيك</option>
          <option value="MANUAL">يدوي</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        نوع الوقود
        <select
          name="fuel"
          required
          defaultValue="ELECTRIC"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="ELECTRIC">كهرباء</option>
          <option value="GASOLINE">بنزين</option>
          <option value="DIESEL">ديزل</option>
          <option value="HYBRID">هجين</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        السعر (ر.س / يوم)
        <input
          name="price"
          type="number"
          required
          min={1}
          placeholder="1200"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium">
        الكمية في الأسطول
        <input
          name="quantity"
          type="number"
          required
          min={1}
          defaultValue={1}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة السيارة (اختياري — المعرض أو الرفع إلى Spaces)"
        fileHelp="بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP أو GIF."
      />
      <label className="text-sm font-medium md:col-span-2">
        وصف الصورة (alt)
        <input
          name="alt"
          placeholder="وصف قصير للصورة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        شارة (مثل: متاح الآن)
        <input
          name="badge"
          placeholder="اختياري"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-8 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ وإظهار في الأسطول"}
        </button>
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تمت الإضافة بنجاح.
          </p>
        ) : null}
        {state?.error ? (
          <p className="text-sm font-bold text-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
