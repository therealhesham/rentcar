"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitDirectBookingRequest } from "@/app/booking-actions";
import { SpecIcon } from "@/components/icons";
import type { FleetCar } from "@/lib/fleet-types";

function DirectBookingForm({
  car,
  dialogRef,
}: {
  car: FleetCar;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [state, formAction, pending] = useActionState(
    submitDirectBookingRequest,
    null,
  );

  useEffect(() => {
    if (!state?.ok) {
      return;
    }
    const t = window.setTimeout(() => {
      dialogRef.current?.close();
    }, 1800);
    return () => window.clearTimeout(t);
  }, [state?.ok, dialogRef]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <input type="hidden" name="carModelId" value={car.modelId} />

      <div className="md:col-span-2 rounded-xl bg-surface-container-low px-4 py-3 text-start">
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          السيارة المختارة
        </p>
        <p className="mt-1 font-bold text-on-surface">{car.name}</p>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          الاسم الكامل
        </label>
        <input
          className="h-12 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 text-start text-sm outline-none focus:ring-2 focus:ring-primary-container"
          placeholder="الاسم الأول والأخير"
          type="text"
          name="name"
          autoComplete="name"
          dir="rtl"
          required
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          الجوال
        </label>
        <div
          className="flex h-12 w-full overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary-container"
          dir="ltr"
        >
          <span className="inline-flex items-center border-e border-outline-variant/20 px-3 text-sm font-bold text-on-surface">
            +966
          </span>
          <input
            className="h-full w-full border-none bg-transparent px-4 text-start text-sm outline-none"
            placeholder="5XXXXXXXX"
            type="tel"
            name="phone"
            autoComplete="tel-national"
            dir="ltr"
            inputMode="numeric"
            pattern="5[0-9]{8}"
            maxLength={9}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          العمر
        </label>
        <select
          className="h-12 w-full appearance-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 text-start text-sm outline-none focus:ring-2 focus:ring-primary-container"
          name="age"
          defaultValue="25-35"
          dir="rtl"
          required
        >
          <option value="25-35">25-35</option>
          <option value="35-50">35-50</option>
          <option value="50+">50+</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          فرع الاستلام
        </label>
        <select
          className="h-12 w-full appearance-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 text-start text-sm outline-none focus:ring-2 focus:ring-primary-container"
          name="branch"
          defaultValue="jeddah"
          dir="rtl"
          required
        >
          <option value="jeddah">جدة</option>
          <option value="madinah">المدينة المنورة</option>
          <option value="tabuk">تبوك</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          تاريخ بداية الحجز
        </label>
        <input
          className="h-12 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 text-start text-sm outline-none focus:ring-2 focus:ring-primary-container"
          type="date"
          name="pickupDate"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          عدد الأيام
        </label>
        <input
          className="h-12 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 text-start text-sm outline-none focus:ring-2 focus:ring-primary-container"
          type="number"
          min={1}
          max={60}
          name="days"
          placeholder="عدد الأيام"
          required
        />
      </div>

      <label className="md:col-span-2 flex items-center justify-end gap-2 text-sm text-on-surface-variant">
        <span>أوافق على الشروط والأحكام</span>
        <input type="checkbox" name="terms" required />
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-xl border border-outline-variant px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
          onClick={() => dialogRef.current?.close()}
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-8 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الإرسال..." : "تأكيد الحجز المباشر"}
        </button>
      </div>

      {state?.ok ? (
        <p
          className="md:col-span-2 text-center text-sm font-bold text-primary"
          role="status"
        >
          تم استلام طلب الحجز المباشر، سيتواصل معك فريقنا قريبًا.
        </p>
      ) : null}
      {state?.error ? (
        <p
          className="md:col-span-2 text-center text-sm font-bold text-error"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function FleetCarCard({ car }: { car: FleetCar }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  const openBooking = () => {
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  };

  return (
    <div className="group">
      <div className="editorial-shadow relative mb-6 aspect-[16/10] overflow-hidden rounded-xl bg-surface-container">
        {/* eslint-disable-next-line @next/next/no-img-element -- روابط صور ديناميكية من الإدارة */}
        <img
          src={car.image}
          alt={car.alt}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        {car.badge ? (
          <div className="absolute start-4 top-4 rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-primary-fixed">
            {car.badge}
          </div>
        ) : null}
      </div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 text-start">
          <h3 className="text-2xl font-bold tracking-tight text-on-surface">
            {car.name}
          </h3>
          <p className="font-medium text-on-surface-variant">{car.subtitle}</p>
        </div>
        <div className="shrink-0 text-end">
          <span
            className="text-2xl font-extrabold leading-none tracking-tighter text-primary"
            dir="ltr"
          >
            {car.price} ر.س
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            في اليوم
          </p>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-6 border-y border-outline-variant/20 py-4">
        {car.specs.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <SpecIcon
              name={s.icon}
              className="size-5 shrink-0 text-primary"
            />
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          className="rounded-lg border border-outline-variant py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
        >
          عرض التفاصيل
        </button>
        <button
          type="button"
          onClick={openBooking}
          className="gradient-cta rounded-lg py-3 text-sm font-bold text-white"
        >
          احجز الآن
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="z-50 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-on-surface shadow-2xl backdrop:bg-black/60"
        dir="rtl"
      >
        <h3 className="mb-4 text-xl font-extrabold text-primary">
          حجز مباشر
        </h3>
        <DirectBookingForm key={formKey} car={car} dialogRef={dialogRef} />
      </dialog>
    </div>
  );
}
