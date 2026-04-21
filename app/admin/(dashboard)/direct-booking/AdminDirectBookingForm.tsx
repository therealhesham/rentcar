"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { submitAdminDirectBooking } from "@/app/admin/direct-booking-actions";

export type BrandWithBookableModels = {
  id: number;
  name: string;
  models: { id: number; label: string }[];
};

type AvailabilityState =
  | null
  | { loading: true }
  | {
      loading: false;
      available: boolean;
      fleetUnits: number;
      overlapping: number;
    };

export function AdminDirectBookingForm({ brands }: { brands: BrandWithBookableModels[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(submitAdminDirectBooking, null);
  const [brandId, setBrandId] = useState("");
  const [carModelId, setCarModelId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [days, setDays] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>(null);

  const modelsForBrand = useMemo(() => {
    const b = brands.find((x) => String(x.id) === brandId);
    return b?.models ?? [];
  }, [brands, brandId]);

  useEffect(() => {
    if (!brandId) {
      return;
    }
    if (carModelId && !modelsForBrand.some((m) => String(m.id) === carModelId)) {
      setCarModelId("");
    }
  }, [brandId, carModelId, modelsForBrand]);

  useEffect(() => {
    const id = Number(carModelId);
    if (!Number.isInteger(id) || id < 1 || !pickupDate || !days.trim()) {
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
          carModelId: String(id),
          pickupDate,
          days: String(Math.round(n)),
        });
        const res = await fetch(`/api/bookings/direct?${params}`, { signal: ctrl.signal });
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
  }, [carModelId, pickupDate, days]);

  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );

  if (brands.length === 0) {
    return (
      <p className="rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        لا توجد ماركات بموديلات متاحة في الأسطول. أضف مركبة من «المركبات» ← «إضافة مركبة» أولاً.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="terms" value="on" />

      <div className="space-y-2 md:col-span-2 md:grid md:grid-cols-2 md:gap-4">
        <label className="block text-sm font-medium text-on-surface">
          الماركة
          <select
            required
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setCarModelId("");
              setAvailability(null);
            }}
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— اختر الماركة —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-on-surface">
          الموديل
          <select
            name="carModelId"
            required
            value={carModelId}
            disabled={!brandId}
            onChange={(e) => setCarModelId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {!brandId ? "— اختر الماركة أولاً —" : "— اختر الموديل —"}
            </option>
            {modelsForBrand.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-on-surface">
          الاسم الكامل (كما وصل من العميل)
          <input
            name="name"
            required
            minLength={3}
            placeholder="الاسم الأول والأخير"
            autoComplete="name"
            dir="rtl"
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-on-surface">
          الجوال (9 أرقام بدون 966، يبدأ بـ 5)
        </label>
        <div
          className="mt-2 flex h-12 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary"
          dir="ltr"
        >
          <span className="inline-flex items-center border-e border-outline-variant/30 px-3 text-sm font-bold">
            +966
          </span>
          <input
            name="phone"
            required
            placeholder="5XXXXXXXX"
            type="tel"
            inputMode="numeric"
            pattern="5[0-9]{8}"
            maxLength={9}
            autoComplete="tel-national"
            className="h-full min-w-0 flex-1 border-none bg-transparent px-4 text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-on-surface">
          العمر
          <select
            name="age"
            required
            defaultValue="25-35"
            dir="rtl"
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="25-35">25-35</option>
            <option value="35-50">35-50</option>
            <option value="50+">50+</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-on-surface">
          فرع الاستلام
          <select
            name="branch"
            required
            defaultValue="jeddah"
            dir="rtl"
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="jeddah">جدة</option>
            <option value="madinah">المدينة المنورة</option>
            <option value="tabuk">تبوك</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-on-surface">
          تاريخ بداية الحجز
          <input
            type="date"
            name="pickupDate"
            required
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
            dir="ltr"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-on-surface">
          عدد الأيام
          <input
            type="number"
            name="days"
            min={1}
            max={60}
            required
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="1–60"
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
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
            ? `متاحة في الفترة (${availability.fleetUnits} وحدة أسطول، ${availability.overlapping} حجز متزامن).`
            : `غير متاحة: ${availability.overlapping} حجز متزامن والحد ${availability.fleetUnits} وحدة.`}
        </p>
      ) : null}

      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || slotBlocked || !carModelId || !brandId}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
        >
          {pending ? "جاري التسجيل…" : "تسجيل الحجز المباشر"}
        </button>
        <button
          type="button"
          className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary hover:bg-surface-container"
          onClick={() => {
            formRef.current?.reset();
            setBrandId("");
            setCarModelId("");
            setPickupDate("");
            setDays("");
            setAvailability(null);
          }}
        >
          مسح الحقول
        </button>
      </div>

      {state?.ok ? (
        <p className="md:col-span-2 text-sm font-bold text-primary" role="status">
          تم تسجيل الحجز المباشر بنجاح. سيظهر في «حجوزات السيارات» و«العملاء».
        </p>
      ) : null}
      {state?.error ? (
        <p className="md:col-span-2 text-sm font-bold text-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
