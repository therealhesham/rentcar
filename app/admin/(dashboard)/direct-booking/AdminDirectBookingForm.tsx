"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Loader2,
  Phone,
  RotateCcw,
  Search,
  User,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";
import { ADMIN_OFFICE_PAYMENT_METHODS } from "@/lib/booking-payment-methods";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  submitAdminDirectBooking,
  type AdminDirectBookingActionState,
} from "@/app/admin/direct-booking-actions";
import { addDaysToYmd } from "@/lib/booking-calendar-ymd";

export type BrandWithBookableModels = {
  id: number;
  name: string;
  models: { id: number; label: string }[];
};

export type AdminBranchOption = {
  slug: string;
  name: string;
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

type CustomerLookupFound = {
  fullName: string;
  ageRange: string;
  customerId: number | null;
  source: "account" | "booking";
  email: string | null;
  bookingCount: number;
  lastBookingAt: string | null;
};

type CustomerLookupState =
  | null
  | { status: "searching" }
  | { status: "found"; data: CustomerLookupFound }
  | { status: "not_found" }
  | { status: "error"; message: string };

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm shadow-sm outline-none transition-[box-shadow,border-color] focus:border-primary/50 focus:ring-2 focus:ring-primary/15";

function FormSection({
  step,
  icon: Icon,
  title,
  description,
  children,
  complete,
}: {
  step: number;
  icon: typeof Car;
  title: string;
  description: string;
  children: ReactNode;
  complete?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-12px_rgba(28,27,27,0.1)]">
      <div className="flex items-start gap-4 border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:px-6">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black",
            complete
              ? "bg-[#ecfdf5] text-[#047857]"
              : "bg-[#003749] text-white",
          ].join(" ")}
        >
          {complete ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-base font-extrabold tracking-tight text-[#003749]">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function AvailabilityPanel({ availability }: { availability: AvailabilityState }) {
  if (!availability) return null;

  if (availability.loading) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low/80 px-4 py-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
        <div>
          <p className="text-sm font-bold text-on-surface">جاري التحقق من التوفر</p>
          <p className="text-xs text-on-surface-variant">مقارنة الحجوزات المتزامنة مع أسطول الفرع…</p>
        </div>
      </div>
    );
  }

  const { available, fleetUnits, overlapping } = availability;
  const free = Math.max(0, fleetUnits - overlapping);

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-4 sm:px-5",
        available
          ? "border-[#6ee7b7]/50 bg-[#ecfdf5]"
          : "border-[#fecaca]/60 bg-[#fef2f2]",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start gap-3">
        {available ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-[#047857]" aria-hidden />
        ) : (
          <XCircle className="h-6 w-6 shrink-0 text-[#b91c1c]" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-extrabold ${available ? "text-[#047857]" : "text-[#b91c1c]"}`}>
            {available ? "الفترة متاحة للحجز" : "الفترة غير متاحة"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            {available
              ? `يمكنك تسجيل الحجز الآن. متبقٍ ${free} من ${fleetUnits} وحدة أسطول.`
              : `الحد ${fleetUnits} وحدة و${overlapping} حجزاً متزامناً في نفس الفترة.`}
          </p>
        </div>
        <dl className="flex w-full gap-3 sm:w-auto sm:flex-col sm:gap-2 sm:text-end">
          <div className="flex-1 rounded-xl bg-white/70 px-3 py-2 text-center sm:min-w-[72px]">
            <dt className="text-[10px] font-bold text-on-surface-variant">الأسطول</dt>
            <dd className="text-lg font-black tabular-nums text-[#003749]">{fleetUnits}</dd>
          </div>
          <div className="flex-1 rounded-xl bg-white/70 px-3 py-2 text-center sm:min-w-[72px]">
            <dt className="text-[10px] font-bold text-on-surface-variant">متزامن</dt>
            <dd className="text-lg font-black tabular-nums text-[#003749]">{overlapping}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function AdminDirectBookingForm({
  brands,
  branches,
  lockedBranchSlug = null,
  lockedBranchName = null,
}: {
  brands: BrandWithBookableModels[];
  branches: AdminBranchOption[];
  lockedBranchSlug?: string | null;
  lockedBranchName?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    AdminDirectBookingActionState | null,
    FormData
  >(submitAdminDirectBooking, null);

  const [brandId, setBrandId] = useState("");
  const [carModelId, setCarModelId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [days, setDays] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [ageRange, setAgeRange] = useState("25-35");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerLookup, setCustomerLookup] = useState<CustomerLookupState>(null);
  const [customerLocked, setCustomerLocked] = useState(false);
  const [paymentTiming, setPaymentTiming] = useState<"later" | "now">("now");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [availability, setAvailability] = useState<AvailabilityState>(null);
  const [branchSlug, setBranchSlug] = useState(
    lockedBranchSlug ?? branches[0]?.slug ?? "jeddah",
  );

  const effectiveBranch = (lockedBranchSlug ?? branchSlug).trim().toLowerCase();
  const branchLabel =
    lockedBranchName ??
    branches.find((b) => b.slug === effectiveBranch)?.name ??
    effectiveBranch;

  const modelsForBrand = useMemo(() => {
    const b = brands.find((x) => String(x.id) === brandId);
    return b?.models ?? [];
  }, [brands, brandId]);

  const selectedModelLabel = useMemo(
    () => modelsForBrand.find((m) => String(m.id) === carModelId)?.label ?? null,
    [modelsForBrand, carModelId],
  );

  const rentalEndYmd = useMemo(() => {
    if (!pickupDate || !days.trim()) return null;
    const n = Number(days);
    if (!Number.isFinite(n) || n < 1) return null;
    return addDaysToYmd(pickupDate, n - 1);
  }, [pickupDate, days]);

  const stepCustomer =
    customerLocked && customerName.trim().length >= 3 && /^5\d{8}$/.test(phone);
  const stepVehicle = Boolean(brandId && carModelId);
  const stepSchedule = Boolean(pickupDate && days.trim() && effectiveBranch);
  const progressPct = Math.round(
    (
      [
        stepCustomer,
        stepVehicle,
        stepSchedule,
        availability && !availability.loading && availability.available,
      ] as boolean[]
    ).filter(Boolean).length *
      (100 / 4),
  );

  async function searchCustomerByPhone() {
    if (!/^5\d{8}$/.test(phone)) return;
    setCustomerLookup({ status: "searching" });
    setCustomerLocked(false);
    try {
      const res = await fetch(
        `/api/admin/customers/lookup?phone=${encodeURIComponent(phone)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        found?: boolean;
        error?: string;
        fullName?: string;
        ageRange?: string;
        customerId?: number | null;
        source?: "account" | "booking";
        email?: string | null;
        bookingCount?: number;
        lastBookingAt?: string | null;
      };
      if (!res.ok || !data.ok) {
        setCustomerLookup({
          status: "error",
          message: data.error ?? "تعذّر البحث.",
        });
        return;
      }
      if (data.found && data.fullName) {
        const found: CustomerLookupFound = {
          fullName: data.fullName,
          ageRange: data.ageRange ?? "25-35",
          customerId: data.customerId ?? null,
          source: data.source ?? "booking",
          email: data.email ?? null,
          bookingCount: data.bookingCount ?? 0,
          lastBookingAt: data.lastBookingAt ?? null,
        };
        setCustomerLookup({ status: "found", data: found });
        setCustomerName(found.fullName);
        setAgeRange(found.ageRange);
        setCustomerId(found.customerId);
        setCustomerLocked(true);
        return;
      }
      setCustomerLookup({ status: "not_found" });
      setCustomerName("");
      setCustomerId(null);
      setAgeRange("25-35");
    } catch {
      setCustomerLookup({ status: "error", message: "تعذّر الاتصال. حاول مرة أخرى." });
    }
  }

  function resetCustomerStep() {
    setCustomerLookup(null);
    setCustomerLocked(false);
    setCustomerName("");
    setCustomerId(null);
    setAgeRange("25-35");
    setBrandId("");
    setCarModelId("");
    setPickupDate("");
    setDays("");
    setAvailability(null);
    setPaymentTiming("now");
    setPaymentMethod("CASH");
  }

  function confirmNewCustomer() {
    if (customerName.trim().length < 3) return;
    setCustomerLocked(true);
  }

  useEffect(() => {
    if (!brandId) return;
    if (carModelId && !modelsForBrand.some((m) => String(m.id) === carModelId)) {
      setCarModelId("");
    }
  }, [brandId, carModelId, modelsForBrand]);

  useEffect(() => {
    const id = Number(carModelId);
    if (!Number.isInteger(id) || id < 1 || !pickupDate || !days.trim() || !effectiveBranch) {
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
          branch: effectiveBranch,
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
        if (!ctrl.signal.aborted) setAvailability(null);
      }
    }, 400);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [carModelId, pickupDate, days, effectiveBranch]);

  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );
  const canSubmit =
    !pending &&
    !slotBlocked &&
    stepVehicle &&
    stepSchedule &&
    stepCustomer &&
    availability &&
    !availability.loading &&
    availability.available;

  function resetForm() {
    formRef.current?.reset();
    setPhone("");
    resetCustomerStep();
    if (!lockedBranchSlug) setBranchSlug(branches[0]?.slug ?? "jeddah");
  }

  if (brands.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/50 px-6 py-16 text-center">
        <Car className="h-10 w-10 text-on-surface-variant/50" aria-hidden />
        <p className="mt-4 text-lg font-extrabold text-on-surface">لا توجد مركبات جاهزة للحجز</p>
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">
          أضف مركبة من «المركبات» مع ربطها بالأسطول في فرعك أولاً.
        </p>
        <Link
          href="/admin/vehicles"
          className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary"
        >
          إدارة المركبات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-outline-variant/20 bg-white px-5 py-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-on-surface-variant">
          <span>اكتمال البيانات</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-[#003749] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <form ref={formRef} action={formAction} className="space-y-6">
        <input type="hidden" name="terms" value="on" />
        {customerId != null ? (
          <input type="hidden" name="customerId" value={customerId} />
        ) : null}

        <FormSection
          step={1}
          icon={User}
          title="العميل"
          description="ابحث برقم الجوال — إن وُجد نملأ بياناته، وإلا أدخل الاسم"
          complete={stepCustomer}
        >
          {!customerLocked ? (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-bold text-on-surface">رقم الجوال</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <div
                    className="flex h-[46px] min-w-0 flex-1 overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
                    dir="ltr"
                  >
                    <span className="inline-flex items-center gap-1 border-e border-outline-variant/30 bg-surface-container-low px-3 text-sm font-bold text-on-surface-variant">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      +966
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 9));
                        setCustomerLookup(null);
                      }}
                      placeholder="5XXXXXXXX"
                      type="tel"
                      inputMode="numeric"
                      maxLength={9}
                      autoComplete="tel-national"
                      className="h-full min-w-0 flex-1 border-none bg-transparent px-4 text-sm outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void searchCustomerByPhone();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void searchCustomerByPhone()}
                    disabled={!/^5\d{8}$/.test(phone) || customerLookup?.status === "searching"}
                    className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-[#003749] px-5 text-sm font-bold text-white disabled:opacity-45"
                  >
                    {customerLookup?.status === "searching" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Search className="h-4 w-4" aria-hidden />
                    )}
                    بحث
                  </button>
                </div>
              </div>

              {customerLookup?.status === "error" ? (
                <p className="text-sm font-bold text-[#b91c1c]" role="alert">
                  {customerLookup.message}
                </p>
              ) : null}

              {customerLookup?.status === "not_found" ? (
                <div className="space-y-4 rounded-2xl border border-[#bfdbfe]/50 bg-[#eff6ff] p-4">
                  <div className="flex gap-3">
                    <UserPlus className="h-5 w-5 shrink-0 text-[#1d4ed8]" aria-hidden />
                    <p className="text-sm font-bold text-[#1e3a5f]">
                      رقم جديد — أدخل اسم العميل للمتابعة
                    </p>
                  </div>
                  <label className="block text-sm font-bold text-on-surface">
                    الاسم الكامل
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="الاسم الأول والأخير"
                      autoComplete="name"
                      dir="rtl"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block text-sm font-bold text-on-surface">
                    العمر التقريبي
                    <select
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      dir="rtl"
                      className={INPUT_CLASS}
                    >
                      <option value="25-35">25–35</option>
                      <option value="35-50">35–50</option>
                      <option value="50+">50+</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={confirmNewCustomer}
                    disabled={customerName.trim().length < 3}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-45"
                  >
                    متابعة الحجز
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={[
                  "flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4",
                  customerLookup?.status === "found"
                    ? "border-[#6ee7b7]/50 bg-[#ecfdf5]"
                    : "border-[#bfdbfe]/50 bg-[#eff6ff]",
                ].join(" ")}
              >
                <div>
                  <p className="text-[11px] font-bold text-on-surface-variant">
                    {customerLookup?.status === "found" ? "عميل موجود" : "عميل جديد"}
                  </p>
                  <p className="mt-1 font-mono text-sm tabular-nums text-on-surface-variant" dir="ltr">
                    +966{phone}
                  </p>
                  {customerLookup?.status === "found" ? (
                    <p className="mt-1 text-xs font-bold text-[#047857]">
                      {customerLookup.data.source === "account"
                        ? "حساب مسجّل"
                        : "من سجل الحجوزات"}
                      {customerLookup.data.bookingCount > 0
                        ? ` · ${customerLookup.data.bookingCount} حجز سابق`
                        : ""}
                    </p>
                  ) : null}
                  {customerLookup?.status === "found" && customerLookup.data.email ? (
                    <p className="mt-1 text-xs text-on-surface-variant" dir="ltr">
                      {customerLookup.data.email}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={resetCustomerStep}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  تغيير الرقم
                </button>
              </div>
              <input type="hidden" name="phone" value={phone} />
              <label className="block text-sm font-bold text-on-surface">
                الاسم الكامل
                <input
                  name="name"
                  required
                  minLength={3}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  dir="rtl"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block text-sm font-bold text-on-surface">
                العمر التقريبي
                <select
                  name="age"
                  required
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  dir="rtl"
                  className={INPUT_CLASS}
                >
                  <option value="25-35">25–35</option>
                  <option value="35-50">35–50</option>
                  <option value="50+">50+</option>
                </select>
              </label>
            </div>
          )}
        </FormSection>

        <div
          className={[
            "space-y-6 transition-opacity",
            customerLocked ? "opacity-100" : "pointer-events-none opacity-40",
          ].join(" ")}
          aria-hidden={!customerLocked}
        >
        <FormSection
          step={2}
          icon={Car}
          title="المركبة"
          description="اختر الماركة ثم الموديل من الأسطول المتاح"
          complete={stepVehicle}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-on-surface">
              الماركة
              <select
                required
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setCarModelId("");
                  setAvailability(null);
                }}
                className={INPUT_CLASS}
              >
                <option value="">— اختر الماركة —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-on-surface">
              الموديل
              <select
                name="carModelId"
                required
                value={carModelId}
                disabled={!brandId}
                onChange={(e) => setCarModelId(e.target.value)}
                className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-55`}
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
          {selectedModelLabel ? (
            <p className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface-variant">
              المختار: <span className="text-[#003749]">{selectedModelLabel}</span>
            </p>
          ) : null}
        </FormSection>

        <FormSection
          step={3}
          icon={Calendar}
          title="الموعد والفرع"
          description="تاريخ البداية، مدة التأجير، وفرع الاستلام"
          complete={stepSchedule}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-on-surface">
              فرع الاستلام
              {lockedBranchSlug ? (
                <>
                  <input type="hidden" name="branch" value={lockedBranchSlug} />
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-container/30 px-4 py-3">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden />
                    <span className="font-bold text-[#003749]">{branchLabel}</span>
                  </div>
                </>
              ) : (
                <select
                  name="branch"
                  required
                  value={branchSlug}
                  onChange={(e) => {
                    setBranchSlug(e.target.value);
                    setAvailability(null);
                  }}
                  dir="rtl"
                  className={INPUT_CLASS}
                >
                  {branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block text-sm font-bold text-on-surface">
              تاريخ بداية الحجز
              <input
                type="date"
                name="pickupDate"
                required
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
                dir="ltr"
              />
            </label>

            <label className="block text-sm font-bold text-on-surface">
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
                className={INPUT_CLASS}
              />
            </label>
          </div>

          {rentalEndYmd ? (
            <p className="mt-3 text-xs font-bold text-on-surface-variant">
              نهاية الحجز (شامل):{" "}
              <span className="font-mono tabular-nums text-[#003749]" dir="ltr">
                {pickupDate} → {rentalEndYmd}
              </span>
            </p>
          ) : null}

          <div className="mt-4">
            <AvailabilityPanel availability={availability} />
          </div>
        </FormSection>

        <FormSection
          step={4}
          icon={Wallet}
          title="الدفع"
          description="سجّل الدفع النقدي أو الإلكتروني من المكتب، أو اترك الحجز قيد الدفع"
          complete={customerLocked}
        >
          <fieldset className="space-y-4">
            <legend className="sr-only">توقيت الدفع</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  paymentTiming === "now"
                    ? "border-[#003749] bg-[#003749]/5 ring-2 ring-[#003749]/15"
                    : "border-outline-variant/35 bg-white hover:border-primary/30",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="paymentTiming"
                  value="now"
                  checked={paymentTiming === "now"}
                  onChange={() => setPaymentTiming("now")}
                  className="h-4 w-4 accent-[#003749]"
                />
                <span className="text-sm font-bold text-on-surface">تم الدفع الآن</span>
              </label>
              <label
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  paymentTiming === "later"
                    ? "border-[#003749] bg-[#003749]/5 ring-2 ring-[#003749]/15"
                    : "border-outline-variant/35 bg-white hover:border-primary/30",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="paymentTiming"
                  value="later"
                  checked={paymentTiming === "later"}
                  onChange={() => setPaymentTiming("later")}
                  className="h-4 w-4 accent-[#003749]"
                />
                <span className="text-sm font-bold text-on-surface">دفع لاحقاً</span>
              </label>
            </div>

            {paymentTiming === "now" ? (
              <label className="block text-sm font-bold text-on-surface">
                طريقة الدفع
                <select
                  name="paymentMethod"
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  dir="rtl"
                  className={INPUT_CLASS}
                >
                  {ADMIN_OFFICE_PAYMENT_METHODS.map((code) => (
                    <option key={code} value={code}>
                      {bookingPaymentMethodLabelAr(code)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-xl bg-surface-container-low px-4 py-3 text-xs font-bold text-on-surface-variant">
                يُسجَّل الحجز بحالة «قيد الدفع» — يمكن للعميل إتمام الدفع لاحقاً من الموقع.
              </p>
            )}
          </fieldset>
        </FormSection>
        </div>

        {!customerLocked ? (
          <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/60 px-4 py-3 text-center text-sm font-bold text-on-surface-variant">
            ابحث عن العميل بالجوال أولاً لإكمال بيانات المركبة والموعد
          </p>
        ) : null}

        {state?.error ? (
          <div
            className="flex gap-3 rounded-2xl border border-[#fecaca]/60 bg-[#fef2f2] px-4 py-4"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-[#b91c1c]" aria-hidden />
            <p className="text-sm font-bold text-[#b91c1c]">{state.error}</p>
          </div>
        ) : null}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant/25 bg-white/95 p-4 shadow-[0_8px_32px_-8px_rgba(28,27,27,0.2)] backdrop-blur-sm sm:bottom-6">
          <button
            type="submit"
            disabled={!canSubmit || !customerLocked}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#003749] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[200px]"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                جاري التسجيل…
              </>
            ) : (
              "تسجيل الحجز المباشر"
            )}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-outline-variant/40 px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container-low"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            مسح
          </button>
        </div>
      </form>
    </div>
  );
}
