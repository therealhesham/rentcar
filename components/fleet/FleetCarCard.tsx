"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SpecIcon } from "@/components/icons";
import type { FleetCar } from "@/lib/fleet-types";
import { FLEET_CARD_TAX_LINE_AR } from "@/lib/pricing";

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
        <p className="mt-1 font-bold text-on-surface">{car.fullTitle}</p>
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
        className="fixed inset-0 z-[200] m-0 h-dvh w-full max-w-none border-0 bg-transparent p-3 shadow-none backdrop:bg-black/60 sm:p-4 [&:not([open])]:hidden [&[open]]:flex [&[open]]:flex-col [&[open]]:items-center [&[open]]:justify-center"
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
    <article className="group overflow-hidden rounded-[18px] border border-outline-variant/50 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[5/3] bg-surface-container-lowest px-4 pt-6 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- روابط صور ديناميكية من الإدارة */}
        <img
          src={car.image}
          alt={car.alt}
          className="mx-auto h-full max-h-[200px] w-full object-contain object-bottom transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {car.badge ? (
          <div className="absolute start-4 top-4 rounded-md rounded-es-none bg-primary-fixed px-3 py-1.5 text-xs font-bold text-on-primary-fixed shadow-sm">
            {car.badge}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 bg-surface-container-low px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-start text-lg font-extrabold leading-snug text-on-primary-container">
            <span className="text-on-primary-container">{car.brand}</span>
            <span className="mx-1.5 font-bold text-on-primary-container/50" aria-hidden>
              |
            </span>
            <span className="text-on-primary-container">{car.name}</span>
          </h3>
          <p className="shrink-0 pt-0.5 text-base font-semibold text-on-surface tabular-nums">
            {car.year}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-1 justify-start gap-6 sm:gap-8">
            {car.specs.map((s, i) => (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span className="text-primary-fixed-dim" aria-hidden>
                  <SpecIcon name={s.icon} className="size-7 shrink-0" />
                </span>
                <span className="text-sm font-bold tabular-nums text-on-surface">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="shrink-0 text-end" dir="ltr">
            <span className="text-2xl font-extrabold tracking-tight text-on-surface">
              {car.price}
            </span>
            <span className="me-1 text-lg font-bold text-on-primary-container">ر.س</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={openBooking}
            className="w-full rounded-xl bg-primary-fixed py-3.5 text-center text-sm font-extrabold text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim"
          >
            احجز الآن
          </button>
          <p className="text-center text-[11px] font-semibold leading-relaxed text-on-primary-container">
            {FLEET_CARD_TAX_LINE_AR}
          </p>
        </div>
      </div>

      {bookingModal}
    </article>
  );
}
