"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { updateBranch } from "@/app/admin/branch-actions";
import { BranchOpeningHoursFields } from "@/components/admin/BranchOpeningHoursFields";
import { AdminImageField } from "@/components/admin/AdminImageField";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { MapPin } from "lucide-react";

type Branch = {
  id: number;
  cityId: number;
  slug: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  mapUrl: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  alt: string | null;
  sortOrder: number;
  isActive: boolean;
  isNew: boolean;
  openingHoursJson: string | null;
};

type CityOption = { id: number; name: string };

type Props = {
  branch: Branch;
  cities: CityOption[];
};

export function BranchEditForm({ branch, cities }: Props) {
  const [state, formAction, pending] = useActionState(updateBranch, null);
  const [lat, setLat] = useState<number | "">(branch.latitude ?? "");
  const [lng, setLng] = useState<number | "">(branch.longitude ?? "");
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={branch.id} />
      <input type="hidden" name="currentImage" value={branch.image ?? ""} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        تعديل الفرع
      </h2>

      <label className="text-sm font-medium md:col-span-2">
        المدينة
        <select
          name="cityId"
          required
          defaultValue={branch.cityId}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-1">
        اسم الفرع
        <input
          name="name"
          required
          defaultValue={branch.name}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug)
        <input
          name="slug"
          required
          defaultValue={branch.slug}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        شعار قصير
        <input
          name="tagline"
          defaultValue={branch.tagline ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        رقم الجوال
        <input
          name="phone"
          defaultValue={branch.phone ?? ""}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        العنوان
        <input
          name="address"
          defaultValue={branch.address ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        رابط الخرائط (https)
        <input
          name="mapUrl"
          type="url"
          defaultValue={branch.mapUrl ?? ""}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        خط العرض (Latitude)
        <input
          name="latitude"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value === "" ? "" : Number(e.target.value))}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1 relative">
        خط الطول (Longitude)
        <div className="flex gap-2 mt-2">
          <input
            name="longitude"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value === "" ? "" : Number(e.target.value))}
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
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={branch.sortOrder}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        نشط
        <select
          name="isActive"
          defaultValue={branch.isActive ? "true" : "false"}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        «فروعنا الجديدة» بالرئيسية
        <select
          name="isNew"
          defaultValue={branch.isNew ? "true" : "false"}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="false">لا</option>
          <option value="true">نعم</option>
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-2">
        رابط صورة خارجي (https) — يُستخدم إن لم تختر معرضًا أو ملفًا
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
          defaultValue={branch.alt ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة الفرع — استبدال من المعرض أو رفع ملف (اختياري)"
        currentImageUrl={branch.image}
        fileHelp="اترك الحقول فارغة للإبقاء على الصورة الحالية أو الرابط المحفوظ."
      />

      <BranchOpeningHoursFields initialOpeningHoursJson={branch.openingHoursJson} />

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        <Link
          href="/admin/branches"
          className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary hover:bg-surface-container"
        >
          رجوع للقائمة
        </Link>
        {state?.error ? (
          <p className="text-sm font-medium text-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم الحفظ.
          </p>
        ) : null}
      </div>
    </form>
  );
}
