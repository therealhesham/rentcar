"use client";

import {
  CalendarDays,
  CalendarRange,
  Car,
  CalendarClock,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { computeBookingDays } from "@/lib/booking-days";
import {
  computeAutoDropoff,
  computeDaysPreview,
  rentalDropoffHint,
  toDatetimeLocalValue,
  validateRentalMinDays,
  type ModeTab,
  type RentalTab,
} from "@/lib/booking-search-shared";
import type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  DELIVERY_ADDRESS_MAX_CHARS,
  DELIVERY_ADDRESS_MIN_CHARS,
} from "@/lib/delivery-address";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

function CityBranchSelects({
  dateCities,
  citySlug,
  branchSlug,
  branchOptions,
  defaultBranchSlug,
  branchSelectRequired,
  cityInputId,
  branchInputId,
  onCityChange,
  onBranchChange,
}: {
  dateCities: BookingCityBranchesOption[];
  citySlug: string;
  branchSlug: string;
  branchOptions: BookingBranchOption[];
  defaultBranchSlug: string;
  branchSelectRequired: boolean;
  cityInputId: string;
  branchInputId: string;
  onCityChange: (slug: string) => void;
  onBranchChange: (slug: string) => void;
}) {
  return (
    <div className="flex flex-row flex-wrap items-end gap-x-2 gap-y-1.5">
      <div className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
        <label
          htmlFor={cityInputId}
          className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
        >
          المدينة
        </label>
        <div className="relative mt-0.5">
          <select
            id={cityInputId}
            value={citySlug}
            onChange={(ev) => onCityChange(ev.target.value)}
            required={branchSelectRequired}
            className="w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/70 py-2 pe-8 ps-2.5 text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow,background-color] hover:bg-white focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
          >
            {dateCities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
            aria-hidden
          />
        </div>
      </div>
      <div className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
        <label
          htmlFor={branchInputId}
          className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
        >
          الفرع
        </label>
        <div className="relative mt-0.5">
          <select
            id={branchInputId}
            value={branchSlug || defaultBranchSlug}
            onChange={(ev) => onBranchChange(ev.target.value)}
            required={branchSelectRequired}
            disabled={branchOptions.length === 0}
            className="w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/70 py-2 pe-8 ps-2.5 text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow,background-color] hover:bg-white focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {branchOptions.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export function BookingSearchWidget({ cities }: { cities: BookingCityBranchesOption[] }) {
  const router = useRouter();
  const [rental, setRental] = useState<RentalTab>("daily");
  const [mode, setMode] = useState<ModeTab>("pickup");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupBranch, setPickupBranch] = useState("");
  const [returnCity, setReturnCity] = useState("");
  const [returnBranch, setReturnBranch] = useState("");
  const [pickupDt, setPickupDt] = useState("");
  const [dropoffDt, setDropoffDt] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  useEffect(() => {
    if (mode !== "delivery") {
      setDeliveryAddressText("");
      setDeliveryLat(null);
      setDeliveryLng(null);
    }
  }, [mode]);

  useEffect(() => {
    if (rental === "daily") return;
    if (!pickupDt.trim()) return;
    const p = new Date(pickupDt);
    if (Number.isNaN(p.getTime())) return;
    const auto = computeAutoDropoff(p, rental);
    if (!auto) return;
    setDropoffDt(toDatetimeLocalValue(auto));
  }, [rental, pickupDt]);

  const dateCities = useMemo(
    () => cities.filter((c) => c.branches.length > 0),
    [cities],
  );
  const defaultCitySlug = dateCities[0]?.slug ?? "";
  const pickupCityEff = pickupCity || defaultCitySlug;
  const returnCityEff = returnCity || defaultCitySlug;

  const pickupCityBranches = useMemo(
    () => dateCities.find((c) => c.slug === pickupCityEff)?.branches ?? [],
    [dateCities, pickupCityEff],
  );
  const returnCityBranches = useMemo(
    () => dateCities.find((c) => c.slug === returnCityEff)?.branches ?? [],
    [dateCities, returnCityEff],
  );

  const defaultPickupBranchSlug = pickupCityBranches[0]?.slug ?? "";
  const defaultReturnBranchSlug = returnCityBranches[0]?.slug ?? "";

  const branchSelectRequired = dateCities.some((c) => c.branches.length > 0);
  const pickupBranchEffective =
    mode === "pickup" ? pickupBranch || defaultPickupBranchSlug : "";
  const returnBranchEffective = returnBranch || defaultReturnBranchSlug;

  const daysPreview = useMemo(
    () => computeDaysPreview(pickupDt, dropoffDt),
    [pickupDt, dropoffDt],
  );

  const pickupCityId = `${uid}-pickup-city`;
  const pickupBranchId = `${uid}-pickup-branch`;
  const returnCityId = `${uid}-return-city`;
  const returnBranchId = `${uid}-return-branch`;
  const pickupDtId = `${uid}-pickup-dt`;
  const dropoffDtId = `${uid}-dropoff-dt`;
  const deliveryAddrId = `${uid}-delivery-addr`;

  function syncReturnToPickup() {
    setReturnCity(pickupCityEff);
    setReturnBranch(pickupBranch || defaultPickupBranchSlug);
  }

  function persistAndNavigate(search: URLSearchParams, ctx: StoredFleetSearchContext) {
    try {
      sessionStorage.setItem(FLEET_SEARCH_STORAGE_KEY, JSON.stringify(ctx));
    } catch {
      /* ignore */
    }
    router.push(`/fleet?${search.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pickupDt.trim() || !dropoffDt.trim()) {
      setError("يرجى تحديد تاريخ ووقت الاستلام والتسليم.");
      return;
    }

    const pickupDate = new Date(pickupDt);
    const dropoffDate = new Date(dropoffDt);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(dropoffDate.getTime())) {
      setError("صيغة التاريخ غير صالحة.");
      return;
    }
    if (dropoffDate.getTime() < pickupDate.getTime()) {
      setError("تاريخ التسليم يجب أن يكون بعد أو يطابق وقت الاستلام.");
      return;
    }

    const days = computeBookingDays(pickupDate, dropoffDate);
    const rentalErr = validateRentalMinDays(rental, days);
    if (rentalErr) {
      setError(rentalErr);
      return;
    }

    if (branchSelectRequired) {
      if (mode === "pickup" && !pickupBranchEffective) {
        setError("اختر فرع الاستلام.");
        return;
      }
      if (!returnBranchEffective) {
        setError("اختر فرع التسليم (إرجاع المركبة).");
        return;
      }
    }

    if (mode === "delivery") {
      const addrNorm = deliveryAddressText.trim().replace(/\s+/g, " ");
      const mapOk = deliveryLat != null && deliveryLng != null;
      const addrOk = addrNorm.length >= DELIVERY_ADDRESS_MIN_CHARS;
      if (addrNorm.length > DELIVERY_ADDRESS_MAX_CHARS) {
        setError(
          `عنوان التوصيل طويل جداً (بحد أقصى ${DELIVERY_ADDRESS_MAX_CHARS} حرفاً).`,
        );
        return;
      }
      if (!mapOk && !addrOk) {
        setError(
          `حدّد الموقع على الخريطة، أو اكتب عنوان التوصيل كاملاً (على الأقل ${DELIVERY_ADDRESS_MIN_CHARS} أحرف: المدينة، الحي، الشارع…).`,
        );
        return;
      }
    }

    const params = new URLSearchParams();
    params.set("pickup", pickupDt);
    params.set("dropoff", dropoffDt);
    params.set("rental", rental);
    params.set("mode", mode);
    params.set("days", String(days));
    if (mode === "pickup" && pickupBranchEffective) {
      params.set("pickupBranch", pickupBranchEffective);
    }
    if (returnBranchEffective) {
      params.set("returnBranch", returnBranchEffective);
    }
    if (mode === "delivery" && deliveryLat != null && deliveryLng != null) {
      params.set("dlat", String(deliveryLat));
      params.set("dlng", String(deliveryLng));
    }
    if (mode === "delivery") {
      const addrNorm = deliveryAddressText.trim().replace(/\s+/g, " ");
      if (addrNorm.length > 0) {
        params.set("daddr", addrNorm);
      }
    }

    const pickupDateYmd = pickupDt.slice(0, 10);

    const deliveryAddrNorm =
      mode === "delivery"
        ? deliveryAddressText.trim().replace(/\s+/g, " ")
        : "";

    const ctx: StoredFleetSearchContext = {
      rental,
      mode,
      pickupBranch: mode === "pickup" ? pickupBranchEffective : undefined,
      returnBranch: returnBranchEffective,
      deliveryLat: mode === "delivery" ? deliveryLat ?? undefined : undefined,
      deliveryLng: mode === "delivery" ? deliveryLng ?? undefined : undefined,
      deliveryAddress:
        mode === "delivery" && deliveryAddrNorm.length > 0
          ? deliveryAddrNorm
          : undefined,
      pickupDate: pickupDateYmd,
      days,
    };

    persistAndNavigate(params, ctx);
  }

  return (
    <>
      {/* ─── CSS for animations ─── */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(219, 184, 120, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(219, 184, 120, 0); }
        }
        .booking-card {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .booking-field-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .booking-field-card:hover {
          background: #fffdf8;
          border-color: #dbb87866;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px -4px rgba(219, 184, 120, 0.15);
        }
        .booking-field-card:focus-within {
          border-color: #dbb878;
          box-shadow: 0 0 0 3px rgba(219, 184, 120, 0.15), 0 4px 12px -4px rgba(219, 184, 120, 0.2);
          background: #fffef9;
        }
        .cta-btn {
          animation: pulseGlow 2.5s ease-in-out infinite;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cta-btn:hover {
          animation: none;
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -6px rgba(219, 184, 120, 0.7);
        }
        .cta-btn:active {
          transform: translateY(0);
        }
        .cta-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .booking-card,
          .cta-btn,
          .cta-shimmer {
            animation: none !important;
          }
          .cta-btn {
            box-shadow: none;
          }
        }
      `}</style>

      <form
        onSubmit={handleSearch}
        dir="rtl"
        className={`booking-card w-full overflow-hidden rounded-2xl bg-white/[0.97] shadow-[0_28px_72px_-20px_rgba(15,61,71,0.18),0_8px_24px_-6px_rgba(15,61,71,0.07)] ring-1 ring-black/[0.03] backdrop-blur-xl ${
          mounted ? "" : "opacity-0"
        }`}
      >
        {/* ═══════════════════════════════════════
            SECTION 1: Tab Header
        ═══════════════════════════════════════ */}
        <div className="relative">
          {/* Subtle gradient background for the tabs */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fdfbf6] to-white" />

          <div className="relative flex flex-col sm:flex-row sm:items-stretch" role="tablist" aria-label="نوع الإيجار وطريقة الاستلام">
            {/* Rental type group */}
            <div className="flex flex-1 items-center border-b border-[#f0ebe4] sm:border-b-0 sm:border-e sm:border-e-[#f0ebe4]">
              <div className="flex w-full flex-wrap items-center gap-0.5 p-1.5">
                <PillTab
                  active={rental === "daily"}
                  onClick={() => setRental("daily")}
                  icon={<Car className="size-3.5 shrink-0" />}
                  label="يومي"
                />
                <PillTab
                  active={rental === "weekly"}
                  onClick={() => setRental("weekly")}
                  icon={<CalendarDays className="size-3.5 shrink-0" />}
                  label="أسبوعي"
                />
                <PillTab
                  active={rental === "monthly"}
                  onClick={() => setRental("monthly")}
                  icon={<CalendarRange className="size-3.5 shrink-0" />}
                  label="شهري"
                />
                <PillTab
                  active={rental === "monthly_packages"}
                  onClick={() => setRental("monthly_packages")}
                  icon={<Layers className="size-3.5 shrink-0" />}
                  label="الباقات الشهرية"
                />
              </div>
            </div>

            {/* Mode group */}
            <div className="flex flex-1 items-center">
              <div className="flex w-full items-center gap-0.5 p-1.5">
                <PillTab
                  active={mode === "pickup"}
                  onClick={() => setMode("pickup")}
                  icon={<PackageCheck className="size-3.5 shrink-0" />}
                  label="استلام من الفرع"
                  tone="teal"
                />
                <PillTab
                  active={mode === "delivery"}
                  onClick={() => setMode("delivery")}
                  icon={<Truck className="size-3.5 shrink-0" />}
                  label="توصيل لموقعي"
                  tone="teal"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            SECTION 2: Form Fields Grid
        ═══════════════════════════════════════ */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Field 1: Pickup / Delivery location */}
            <FieldCard
              groupLabelId={`${uid}-field-pickup`}
              label={mode === "pickup" ? "موقع الاستلام" : "موقع التوصيل"}
              icon={<MapPin className="size-3.5" />}
            >
              {mode === "pickup" ? (
                <CityBranchSelects
                  dateCities={dateCities}
                  citySlug={pickupCity || defaultCitySlug}
                  branchSlug={pickupBranch || defaultPickupBranchSlug}
                  branchOptions={pickupCityBranches}
                  defaultBranchSlug={defaultPickupBranchSlug}
                  branchSelectRequired={branchSelectRequired}
                  cityInputId={pickupCityId}
                  branchInputId={pickupBranchId}
                  onCityChange={(slug) => {
                    setPickupCity(slug);
                    const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                    setPickupBranch(list[0]?.slug ?? "");
                  }}
                  onBranchChange={setPickupBranch}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMapOpen(true)}
                    className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[#c9a356]/55 bg-white/60 px-2.5 py-2 text-start text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,background-color,box-shadow] hover:border-[#dbb878] hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
                  >
                    {deliveryLat != null && deliveryLng != null ? (
                      <span className="flex items-center gap-2 text-[#0f3d47]">
                        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100">
                          <span className="size-2 rounded-full bg-emerald-500" />
                        </span>
                        تم تحديد الموقع على الخريطة
                      </span>
                    ) : (
                      <span className="text-[#6b5a3b]">تحديد على الخريطة (اختياري)</span>
                    )}
                    <MapPin className="size-4 shrink-0 text-[#dbb878] opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
                  </button>
                  <div>
                    <label
                      htmlFor={deliveryAddrId}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                    >
                      أو اكتب عنوان التوصيل
                    </label>
                    <textarea
                      id={deliveryAddrId}
                      value={deliveryAddressText}
                      onChange={(ev) => setDeliveryAddressText(ev.target.value)}
                      dir="rtl"
                      rows={2}
                      maxLength={DELIVERY_ADDRESS_MAX_CHARS}
                      placeholder={`مثال: الرياض، حي النرجس، شارع… (${DELIVERY_ADDRESS_MIN_CHARS} أحرف على الأقل إن لم تستخدم الخريطة)`}
                      className="mt-0.5 w-full resize-y rounded-lg border border-[#ebe4d3]/70 bg-white/80 px-2.5 py-2 text-[13px] font-medium text-[#0f1923] outline-none placeholder:text-[#aaa08e]/90 focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                    />
                    <p className="mt-1 text-[9px] font-medium leading-snug text-[#8a7752]/90">
                      يكفي عنوان واضح أو الخريطة — أو كلاهما. بحد أقصى{" "}
                      {DELIVERY_ADDRESS_MAX_CHARS} حرفاً.
                    </p>
                  </div>
                </div>
              )}
            </FieldCard>

            {/* Field 2: Return branch */}
            <FieldCard
              groupLabelId={`${uid}-field-return`}
              label="موقع الإرجاع"
              icon={<MapPin className="size-3.5" />}
            >
              <CityBranchSelects
                dateCities={dateCities}
                citySlug={returnCity || defaultCitySlug}
                branchSlug={returnBranch || defaultReturnBranchSlug}
                branchOptions={returnCityBranches}
                defaultBranchSlug={defaultReturnBranchSlug}
                branchSelectRequired={branchSelectRequired}
                cityInputId={returnCityId}
                branchInputId={returnBranchId}
                onCityChange={(slug) => {
                  setReturnCity(slug);
                  const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                  setReturnBranch(list[0]?.slug ?? "");
                }}
                onBranchChange={setReturnBranch}
              />
              {/* {mode === "pickup" && dateCities.length > 0 ? (
                <button
                  type="button"
                  onClick={syncReturnToPickup}
                  className="mt-1.5 w-full rounded-md border border-[#003749]/12 bg-[#003749]/5 py-1.5 text-[11px] font-bold text-[#003749] outline-none transition-colors hover:bg-[#003749]/10 focus-visible:ring-2 focus-visible:ring-[#dbb878]/40"
                >
                  جعل الإرجاع مطابقاً لموقع الاستلام
                </button>
              ) : null} */}
            </FieldCard>

            {/* Field 3: Pickup date/time */}
            <FieldCard
              groupLabelId={`${uid}-field-pickup-dt`}
              label="تاريخ ووقت الاستلام"
              icon={<CalendarClock className="size-3.5" />}
              controlHtmlFor={pickupDtId}
            >
              <input
                id={pickupDtId}
                type="datetime-local"
                value={pickupDt}
                onChange={(ev) => setPickupDt(ev.target.value)}
                required
                dir="ltr"
                className="w-full cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]/30"
              />
            </FieldCard>

            {/* Field 4: Dropoff date/time */}
            <FieldCard
              groupLabelId={`${uid}-field-dropoff-dt`}
              label="تاريخ ووقت التسليم"
              icon={<Clock className="size-3.5" />}
              hint={rentalDropoffHint(rental)}
              controlHtmlFor={dropoffDtId}
            >
              <input
                id={dropoffDtId}
                type="datetime-local"
                value={dropoffDt}
                onChange={(ev) => setDropoffDt(ev.target.value)}
                readOnly={rental !== "daily"}
                required
                dir="ltr"
                className={`w-full rounded-md border border-transparent bg-transparent py-0.5 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]/30 ${rental !== "daily" ? "cursor-default opacity-90" : "cursor-pointer"}`}
                aria-readonly={rental !== "daily"}
              />
            </FieldCard>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            SECTION 3: CTA + Info Footer
        ═══════════════════════════════════════ */}
        <div className="border-t border-[#f0ebe4] bg-gradient-to-b from-[#fdfbf6] to-[#f9f5ee] px-4 py-3 sm:px-5">
          {/* CTA row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Duration badge + helper text */}
            <div className="flex flex-1 items-center gap-3" aria-live="polite">
              {daysPreview != null ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.5)]"
                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                  >
                    <CalendarDays className="size-3" aria-hidden />
                    <span dir="ltr" className="tabular-nums">{daysPreview}</span>
                    يوم
                  </span>
                  <span className="text-[11px] font-medium text-[#6b5a3b]">مدة الحجز</span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-[#aaa08e]">
                  حدّد التواريخ لعرض مدة الحجز
                </span>
              )}
            </div>

            {/* Search button */}
            <button
              type="submit"
              disabled={dateCities.length === 0}
              className="cta-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-2.5 text-white disabled:pointer-events-none disabled:opacity-45 sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              }}
            >
              {/* shimmer overlay */}
              <span
                className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                aria-hidden
              />
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="text-[14px] font-extrabold tracking-wide">
                بحث المركبات المتاحة
              </span>
            </button>
          </div>

          {/* Bottom info row */}
          <div className="mt-2 flex items-center justify-between border-t border-[#ebe4d3]/60 pt-2">
            <p className="text-[10px] text-[#aaa08e]">
              يُعرض المتوفر للحجز المباشر حسب الفترة المحددة
            </p>
            <Link
              href="/fleet"
              className="text-[10.5px] font-bold text-[#003749] underline-offset-4 transition-colors hover:text-[#dbb878] hover:underline"
              style={{ textDecorationColor: GOLD }}
            >
              تصفح الأسطول ←
            </Link>
          </div>
        </div>

        {/* No branches */}
        {dateCities.length === 0 && (
          <div className="border-t border-red-100 bg-red-50/60 px-4 py-2 text-center text-[11px] font-medium text-red-600">
            لا توجد مدن نشطة بفروع مفعّلة. أضف مدناً وفروعاً من لوحة الإدارة.
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="flex items-center gap-2 border-t border-red-200 bg-gradient-to-l from-red-50 to-red-50/50 px-4 py-2 text-[12px] font-semibold text-red-700"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <span className="size-2 rounded-full bg-red-500" />
            </span>
            {error}
          </div>
        )}
      </form>

      <DeliveryMapDialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        initial={
          deliveryLat != null && deliveryLng != null
            ? { lat: deliveryLat, lng: deliveryLng }
            : null
        }
        onConfirm={(lat, lng) => {
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          setMapOpen(false);
        }}
      />
    </>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

function PillTab({
  active,
  onClick,
  icon,
  label,
  tone = "gold",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: "gold" | "teal";
}) {
  const isGold = tone === "gold";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold outline-none transition-all duration-250 focus-visible:ring-2 focus-visible:ring-[#dbb878] focus-visible:ring-offset-1 focus-visible:ring-offset-[#fdfbf6]"
      style={
        active
          ? {
              background: isGold
                ? `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`
                : `linear-gradient(135deg, ${TEAL} 0%, #004d63 100%)`,
              color: "#fff",
              boxShadow: isGold
                ? "0 4px 14px -4px rgba(219,184,120,0.5)"
                : "0 4px 14px -4px rgba(0,55,73,0.4)",
            }
          : {
              background: "transparent",
              color: isGold ? "#8a7752" : "#4a7a8a",
            }
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FieldCard({
  groupLabelId,
  label,
  icon,
  hint,
  children,
  controlHtmlFor,
}: {
  groupLabelId: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  controlHtmlFor?: string;
}) {
  const titleClass =
    "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55";

  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="booking-field-card flex flex-col gap-1.5 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3"
    >
      <span className="flex flex-col gap-0.5">
        {controlHtmlFor ? (
          <label
            id={groupLabelId}
            htmlFor={controlHtmlFor}
            className={`${titleClass} cursor-pointer`}
          >
            <span className="text-[#dbb878]" aria-hidden>
              {icon}
            </span>
            {label}
          </label>
        ) : (
          <span id={groupLabelId} className={titleClass}>
            <span className="text-[#dbb878]" aria-hidden>
              {icon}
            </span>
            {label}
          </span>
        )}
        {hint ? (
          <span className="text-[9px] font-medium leading-snug text-[#8a7752]/90">{hint}</span>
        ) : null}
      </span>
      <div className="min-h-[1.25rem]">{children}</div>
    </div>
  );
}
