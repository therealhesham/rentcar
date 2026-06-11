"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { createBranch } from "@/app/admin/branch-actions";
import { BranchOpeningHoursFields } from "@/components/admin/BranchOpeningHoursFields";
import { AdminImageField } from "@/components/admin/AdminImageField";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { MapPin } from "lucide-react";

type CityOption = { id: number; name: string };

export function BranchCreateForm({ cities }: { cities: CityOption[] }) {
  const [state, formAction, pending] = useActionState(createBranch, null);
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        إضافة فرع
      </h2>

      <label className="text-sm font-medium md:col-span-2">
        المدينة
        {cities.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-error">
            لا توجد مدن بعد.{" "}
            <Link href="/admin/cities" className="font-bold underline hover:no-underline">
              أضف مدينة
            </Link>{" "}
            ثم ارجع لإضافة الفرع.
          </p>
        ) : (
          <select
            name="cityId"
            required
            defaultValue={cities[0]?.id}
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="text-sm font-medium md:col-span-1">
        اسم الفرع (عربي)
        <input
          name="name"
          required
          placeholder="مثال: جدة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug) — للنماذج والحجز
        <input
          name="slug"
          required
          placeholder="jeddah"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        شعار قصير (اختياري)
        <input
          name="tagline"
          placeholder="فخامة ساحلية"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        رقم الجوال (اختياري)
        <input
          name="phone"
          placeholder="055xxxxxxx"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        العنوان (اختياري)
        <input
          name="address"
          placeholder="المدينة - الحي - الشارع"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        رابط موقع الفرع على الخرائط (https) — اختياري
        <input
          name="mapUrl"
          type="url"
          placeholder="https://maps.google.com/?q=..."
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        خط العرض (Latitude) — اختياري
        <input
          name="latitude"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="24.7136"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1 relative">
        خط الطول (Longitude) — اختياري
        <div className="flex gap-2 mt-2">
          <input
            name="longitude"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="46.6753"
            dir="ltr"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
          />
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition"
            title="تحديد من الخريطة"
          >
            <MapPin className="size-4" />
          </button>
        </div>
      </label>

      <DeliveryMapDialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        initial={typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null}
        onConfirm={(newLat, newLng) => {
          setLat(newLat);
          setLng(newLng);
          setMapOpen(false);
        }}
      />

      <label className="text-sm font-medium md:col-span-2">
        سعر التوصيل لكل كيلومتر (ريال)
        <input
          name="deliveryFeePerKmSar"
          type="number"
          step="any"
          defaultValue={0}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        نشط
        <select
          name="isActive"
          defaultValue="true"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        يظهر في «فروعنا الجديدة» بالرئيسية
        <select
          name="isNew"
          defaultValue="false"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="false">لا</option>
          <option value="true">نعم</option>
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-2">
        رابط صورة خارجي (https) — اختياري إن لم ترفع أو تختار من المعرض
        <input
          name="imageUrl"
          type="url"
          placeholder="https://..."
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        وصف الصورة (alt)
        <input
          name="alt"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة الفرع — من المعرض أو رفع ملف (اختياري)"
        fileHelp="يتطلب مجلد معرض «branches» وضبط Spaces. بحد أقصى 5 ميجابايت."
      />

      <BranchOpeningHoursFields initialOpeningHoursJson={null} />

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || cities.length === 0}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الإضافة…" : "إضافة الفرع"}
        </button>
        {state?.error ? (
          <p className="text-sm font-medium text-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم إنشاء الفرع.
          </p>
        ) : null}
      </div>
    </form>
  );
}
