"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SpecIcon } from "@/components/icons";
import type { FleetCar } from "@/lib/fleet-types";

type AvailabilityState =
  | null
  | { loading: true }
  | {
      loading: false;
      available: boolean;
      fleetUnits: number;
      overlapping: number;
    };

function DirectBookingForm({
  car,
  dialogRef,
}: {
  car: FleetCar;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [pickupDate, setPickupDate] = useState("");
  const [days, setDays] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>(null);
  const [submitState, setSubmitState] = useState<{ ok?: boolean; error?: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pickupDate || !days.trim()) {
      setAvailability(null);
      return;
    }
    const n = Number(days);
    if (!Number.isFinite(n) || n < 1 || n > 60) {
      setAvailability(null);
      return;
    }

    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setAvailability({ loading: true });
      try {
        const params = new URLSearchParams({
          carModelId: String(car.modelId),
          pickupDate,
          days: String(Math.round(n)),
        });
        const res = await fetch(`/api/bookings/direct?${params}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          available?: boolean;
          fleetUnits?: number;
          overlapping?: number;
        };
        if (!data.ok || data.available === undefined || data.fleetUnits === undefined) {
          setAvailability(null);
          return;
        }
        setAvailability({
          loading: false,
          available: data.available,
          fleetUnits: data.fleetUnits,
          overlapping: data.overlapping ?? 0,
        });
      } catch {
        if (!ctrl.signal.aborted) {
          setAvailability(null);
        }
      }
    }, 400);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [pickupDate, days, car.modelId]);

  useEffect(() => {
    if (!submitState?.ok) {
      return;
    }
    const timer = window.setTimeout(() => {
      dialogRef.current?.close();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [submitState?.ok, dialogRef]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState(null);
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const localPhone = String(fd.get("phone") ?? "")
      .replace(/\s+/g, "")
      .trim();
    const body = {
      carModelId: car.modelId,
      name: String(fd.get("name") ?? "").trim(),
      phone: localPhone,
      age: String(fd.get("age") ?? ""),
      branch: String(fd.get("branch") ?? ""),
      pickupDate: String(fd.get("pickupDate") ?? ""),
      days: Number(fd.get("days")),
      terms: true,
    };

    try {
      const res = await fetch("/api/bookings/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSubmitState({ ok: true });
      } else {
        setSubmitState({ ok: false, error: data.error ?? "تعذّر إرسال الطلب." });
      }
    } catch {
      setSubmitState({ ok: false, error: "تعذّر الاتصال بالخادم." });
    } finally {
      setPending(false);
    }
  }

  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">

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
          value={pickupDate}
          onChange={(ev) => setPickupDate(ev.target.value)}
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
          value={days}
          onChange={(ev) => setDays(ev.target.value)}
          placeholder="عدد الأيام"
          required
        />
      </div>

      {availability?.loading ? (
        <p className="md:col-span-2 text-xs text-on-surface-variant">جاري التحقق من التوفر…</p>
      ) : null}
      {availability && !availability.loading ? (
        <p
          className={`md:col-span-2 text-sm font-bold ${
            availability.available ? "text-primary" : "text-error"
          }`}
          role="status"
        >
          {availability.available
            ? `متاحة في هذه الفترة (${availability.fleetUnits} وحدة في الأسطول، ${availability.overlapping} حجز متزامن).`
            : `غير متاحة في هذه الفترة: ${availability.overlapping} حجز متزامن والحد ${availability.fleetUnits} وحدة.`}
        </p>
      ) : null}

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
          disabled={pending || slotBlocked}
          className="gradient-cta rounded-xl px-8 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الإرسال..." : "تأكيد الحجز "}
        </button>
      </div>

      {submitState?.ok ? (
        <p
          className="md:col-span-2 text-center text-sm font-bold text-primary"
          role="status"
        >
          تم استلام طلب الحجز ، سيتواصل معك فريقنا قريبًا.
        </p>
      ) : null}
      {submitState?.error ? (
        <p
          className="md:col-span-2 text-center text-sm font-bold text-error"
          role="alert"
        >
          {submitState.error}
        </p>
      ) : null}
    </form>
  );
}

export function FleetCarCard({ car }: { car: FleetCar }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const openBooking = () => {
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  };

  const bookingModal =
    portalReady &&
    createPortal(
      <dialog
        ref={dialogRef}
        className="fixed inset-0 z-[200] m-0 flex h-dvh w-full max-w-none flex-col items-center justify-center border-0 bg-transparent p-3 shadow-none backdrop:bg-black/60 open:flex sm:p-4"
      >
        {/* لا تضع dir=rtl على dialog: في المتصفحات يصبح left/transform منطقيين فيزحف المودال. */}
        <div
          className="w-full max-w-lg max-h-[min(90dvh,920px)] overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-on-surface shadow-2xl"
          dir="rtl"
        >
          <h3 className="mb-4 text-xl font-extrabold text-primary">حجز مباشر</h3>
          <DirectBookingForm key={formKey} car={car} dialogRef={dialogRef} />
        </div>
      </dialog>,
      document.body,
    );

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

      {bookingModal}
    </div>
  );
}
