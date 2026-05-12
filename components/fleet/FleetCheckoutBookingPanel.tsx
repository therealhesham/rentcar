"use client";

import {
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Car,
  ChevronDown,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  Truck,
  CalendarCheck2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { SubscriptionPackagesInWidget } from "@/components/subscriptions/SubscriptionPackagesInWidget";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  DELIVERY_ADDRESS_MAX_CHARS,
  DELIVERY_ADDRESS_MIN_CHARS,
} from "@/lib/delivery-address";
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
import { fleetDatetimesFromSubscriptionPack } from "@/lib/subscription-fleet-bridge";
import type { SubscriptionPackMonths } from "@/lib/subscription-fleet-bridge";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";

function todayYmdLocalCo(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  modelId: number;
  cities: BookingCityBranchesOption[];
};

export function FleetCheckoutBookingPanel({ modelId, cities }: Props) {
  const router = useRouter();
  const coUid = useId();
  const [rental, setRental] = useState<RentalTab>("daily");
  const [mode, setMode] = useState<ModeTab>("pickup");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupBranch, setPickupBranch] = useState("");
  const [returnCity, setReturnCity] = useState("");
  const [returnBranch, setReturnBranch] = useState("");
  const [pickupDt, setPickupDt] = useState("");
  const [dropoffDt, setDropoffDt] = useState("");
  const [subPackMonths, setSubPackMonths] = useState<SubscriptionPackMonths>(3);
  const [subPackStartYmd, setSubPackStartYmd] = useState(todayYmdLocalCo);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mode !== "delivery") {
      setDeliveryAddressText("");
      setDeliveryLat(null);
      setDeliveryLng(null);
    }
  }, [mode]);

  useEffect(() => {
    if (rental === "daily" || rental === "monthly_packages") return;
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

  const daysPreview = useMemo(() => {
    if (rental === "monthly_packages") {
      const r = fleetDatetimesFromSubscriptionPack(subPackStartYmd, subPackMonths);
      if (!r) return null;
      return computeDaysPreview(r.pickupDt, r.dropoffDt);
    }
    return computeDaysPreview(pickupDt, dropoffDt);
  }, [rental, subPackStartYmd, subPackMonths, pickupDt, dropoffDt]);

  function applyDates(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let effPickupDt = pickupDt;
    let effDropoffDt = dropoffDt;
    if (rental === "monthly_packages") {
      const r = fleetDatetimesFromSubscriptionPack(subPackStartYmd, subPackMonths);
      if (!r) {
        setError("يوم بدء الباقة غير صالح.");
        return;
      }
      effPickupDt = r.pickupDt;
      effDropoffDt = r.dropoffDt;
    }

    if (!effPickupDt.trim() || !effDropoffDt.trim()) {
      setError(
        rental === "monthly_packages"
          ? "تعذّر احتساب التواريخ من يوم بدء الباقة — راجع التاريخ أعلاه."
          : "يرجى تحديد تاريخ ووقت الاستلام والتسليم.",
      );
      return;
    }

    const pickupDate = new Date(effPickupDt);
    const dropoffDate = new Date(effDropoffDt);
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
          `حدّد الموقع على الخريطة، أو اكتب عنوان التوصيل كاملاً (على الأقل ${DELIVERY_ADDRESS_MIN_CHARS} أحرف).`,
        );
        return;
      }
    }

    const params = new URLSearchParams();
    params.set("modelId", String(modelId));
    params.set("pickup", effPickupDt);
    params.set("dropoff", effDropoffDt);
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
      pickupDate: effPickupDt.slice(0, 10),
      days,
    };

    try {
      sessionStorage.setItem(FLEET_SEARCH_STORAGE_KEY, JSON.stringify(ctx));
    } catch {
      /* ignore */
    }

    router.replace(`/fleet/checkout?${params.toString()}`);
  }

  return (
    <>
      <style jsx>{`
        @keyframes checkoutBarFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkoutShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .checkout-bar-card {
          animation: checkoutBarFade 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .checkout-field-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .checkout-field-card:hover {
          background: #fffdf8;
          border-color: #dbb87866;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px -4px rgba(219, 184, 120, 0.15);
        }
        .checkout-field-card:focus-within {
          border-color: #dbb878;
          box-shadow: 0 0 0 3px rgba(219, 184, 120, 0.15), 0 4px 12px -4px rgba(219, 184, 120, 0.2);
          background: #fffef9;
        }
        .checkout-cta-shimmer {
          animation: checkoutShimmer 3s ease-in-out infinite;
        }
      `}</style>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#f4f0ea] text-[#dbb878]">
            <CalendarClock className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-[#003749]">تواريخ الاستلام والتسليم</h2>
            <p className="text-[13px] font-semibold text-[#8a7752]">
              اختر نوع الإيجار والفروع والتوقيت كما في الصفحة الرئيسية، ثم طبّق على هذا الحجز.
            </p>
          </div>
        </div>

        <form
          onSubmit={applyDates}
          dir="rtl"
          className={`checkout-bar-card w-full overflow-hidden rounded-3xl bg-white/[0.98] shadow-[0_28px_80px_-28px_rgba(15,61,71,0.18),0_10px_28px_-8px_rgba(15,61,71,0.08)] ring-1 ring-black/[0.04] ${
            mounted ? "" : "opacity-0"
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#fdfbf6] to-white" />
            <div className="relative flex flex-col sm:flex-row sm:items-stretch">
              <div className="flex flex-1 items-center border-b border-[#f0ebe4] sm:border-b-0 sm:border-e sm:border-e-[#f0ebe4]">
                <div className="flex w-full flex-wrap items-center gap-1 p-2">
                  <CoPillTab
                    active={rental === "daily"}
                    onClick={() => setRental("daily")}
                    icon={<Car className="size-[15px]" />}
                    label="يومي"
                  />
                  <CoPillTab
                    active={rental === "weekly"}
                    onClick={() => setRental("weekly")}
                    icon={<CalendarDays className="size-[15px]" />}
                    label="أسبوعي"
                  />
                  <CoPillTab
                    active={rental === "monthly"}
                    onClick={() => setRental("monthly")}
                    icon={<CalendarRange className="size-[15px]" />}
                    label="شهري"
                  />
                  <CoPillTab
                    active={rental === "monthly_packages"}
                    onClick={() => setRental("monthly_packages")}
                    icon={<Layers className="size-[15px]" />}
                    label="الباقات الشهرية"
                  />
                </div>
              </div>
              <div className="flex flex-1 items-center">
                <div className="flex w-full items-center gap-1 p-2">
                  <CoPillTab
                    active={mode === "pickup"}
                    onClick={() => setMode("pickup")}
                    icon={<PackageCheck className="size-[15px]" />}
                    label="استلام من الفرع"
                    tone="teal"
                  />
                  <CoPillTab
                    active={mode === "delivery"}
                    onClick={() => setMode("delivery")}
                    icon={<Truck className="size-[15px]" />}
                    label="توصيل لموقعي"
                    tone="teal"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            {rental === "monthly_packages" ? (
              <SubscriptionPackagesInWidget
                months={subPackMonths}
                startYmd={subPackStartYmd}
                onMonthsChange={setSubPackMonths}
                onStartYmdChange={setSubPackStartYmd}
              >
                <div
                  className="flex flex-col gap-4"
                  role="group"
                  aria-label="مواقع الاستلام والإرجاع"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#003749]/65">
                    {mode === "pickup" ? "مواقع الاستلام والإرجاع" : "التوصيل وموقع الإرجاع"}
                  </p>
                  {mode === "pickup" ? (
                    <>
                      <div>
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/45">
                          استلام المركبة
                        </p>
                        <div className="flex flex-col gap-2.5">
                          <div className="relative">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              المدينة
                            </span>
                            <select
                              value={pickupCity || defaultCitySlug}
                              onChange={(ev) => {
                                const slug = ev.target.value;
                                setPickupCity(slug);
                                const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                                setPickupBranch(list[0]?.slug ?? "");
                              }}
                              required={branchSelectRequired}
                              className="w-full appearance-none rounded-lg border border-transparent bg-transparent py-0.5 pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                            >
                              {dateCities.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                          <div className="relative border-t border-[#ebe4d3]/60 pt-2">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              الفرع
                            </span>
                            <select
                              value={pickupBranch || defaultPickupBranchSlug}
                              onChange={(ev) => setPickupBranch(ev.target.value)}
                              required={branchSelectRequired}
                              disabled={pickupCityBranches.length === 0}
                              className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none disabled:opacity-50"
                            >
                              {pickupCityBranches.map((b) => (
                                <option key={b.slug} value={b.slug}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#ebe4d3]/60 bg-white/50 p-3">
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/45">
                          إرجاع المركبة
                        </p>
                        <div className="flex flex-col gap-2.5">
                          <div className="relative">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              المدينة
                            </span>
                            <select
                              value={returnCity || defaultCitySlug}
                              onChange={(ev) => {
                                const slug = ev.target.value;
                                setReturnCity(slug);
                                const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                                setReturnBranch(list[0]?.slug ?? "");
                              }}
                              required={branchSelectRequired}
                              className="w-full appearance-none rounded-lg border border-transparent bg-transparent py-0.5 pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                            >
                              {dateCities.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                          <div className="relative border-t border-[#ebe4d3]/60 pt-2">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              الفرع
                            </span>
                            <select
                              value={returnBranch || defaultReturnBranchSlug}
                              onChange={(ev) => setReturnBranch(ev.target.value)}
                              required={branchSelectRequired}
                              disabled={returnCityBranches.length === 0}
                              className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none disabled:opacity-50"
                            >
                              {returnCityBranches.map((b) => (
                                <option key={b.slug} value={b.slug}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setMapOpen(true)}
                          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[#c9a356]/55 bg-white/60 px-2.5 py-2 text-start text-[14px] font-semibold text-[#0f1923] outline-none transition-[border-color,background-color] hover:border-[#dbb878] hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
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
                          <MapPin className="size-4 shrink-0 text-[#dbb878]" aria-hidden />
                        </button>
                        <div>
                          <label
                            htmlFor={`${coUid}-co-delivery-addr`}
                            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45"
                          >
                            أو اكتب عنوان التوصيل
                          </label>
                          <textarea
                            id={`${coUid}-co-delivery-addr`}
                            value={deliveryAddressText}
                            onChange={(ev) => setDeliveryAddressText(ev.target.value)}
                            dir="rtl"
                            rows={2}
                            maxLength={DELIVERY_ADDRESS_MAX_CHARS}
                            placeholder={`المدينة، الحي، الشارع… (${DELIVERY_ADDRESS_MIN_CHARS} أحرف على الأقل بدون خريطة)`}
                            className="mt-0.5 w-full resize-y rounded-lg border border-[#ebe4d3]/70 bg-white/80 px-2.5 py-2 text-[13px] outline-none placeholder:text-[#aaa08e] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#ebe4d3]/60 bg-white/50 p-3">
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/45">
                          فرع إرجاع المركبة
                        </p>
                        <div className="flex flex-col gap-2.5">
                          <div className="relative">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              المدينة
                            </span>
                            <select
                              value={returnCity || defaultCitySlug}
                              onChange={(ev) => {
                                const slug = ev.target.value;
                                setReturnCity(slug);
                                const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                                setReturnBranch(list[0]?.slug ?? "");
                              }}
                              required={branchSelectRequired}
                              className="w-full appearance-none rounded-lg border border-transparent bg-transparent py-0.5 pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                            >
                              {dateCities.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                          <div className="relative border-t border-[#ebe4d3]/60 pt-2">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                              الفرع
                            </span>
                            <select
                              value={returnBranch || defaultReturnBranchSlug}
                              onChange={(ev) => setReturnBranch(ev.target.value)}
                              required={branchSelectRequired}
                              disabled={returnCityBranches.length === 0}
                              className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none disabled:opacity-50"
                            >
                              {returnCityBranches.map((b) => (
                                <option key={b.slug} value={b.slug}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </SubscriptionPackagesInWidget>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <>
              <CoFieldCard
                label={mode === "pickup" ? "موقع الاستلام" : "موقع التوصيل"}
                icon={<MapPin className="size-[15px]" />}
              >
                {mode === "pickup" ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="relative">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                        المدينة
                      </span>
                      <select
                        value={pickupCity || defaultCitySlug}
                        onChange={(ev) => {
                          const slug = ev.target.value;
                          setPickupCity(slug);
                          const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                          setPickupBranch(list[0]?.slug ?? "");
                        }}
                        required={branchSelectRequired}
                        className="w-full appearance-none rounded-lg border border-transparent bg-transparent py-0.5 pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                      >
                        {dateCities.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                    </div>
                    <div className="relative border-t border-[#ebe4d3]/60 pt-2">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                        الفرع
                      </span>
                      <select
                        value={pickupBranch || defaultPickupBranchSlug}
                        onChange={(ev) => setPickupBranch(ev.target.value)}
                        required={branchSelectRequired}
                        disabled={pickupCityBranches.length === 0}
                        className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none disabled:opacity-50"
                      >
                        {pickupCityBranches.map((b) => (
                          <option key={b.slug} value={b.slug}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMapOpen(true)}
                      className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[#c9a356]/55 bg-white/60 px-2.5 py-2 text-start text-[14px] font-semibold text-[#0f1923] outline-none transition-[border-color,background-color] hover:border-[#dbb878] hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
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
                      <MapPin className="size-4 shrink-0 text-[#dbb878]" aria-hidden />
                    </button>
                    <div>
                      <label
                        htmlFor={`${coUid}-co-delivery-addr`}
                        className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45"
                      >
                        أو اكتب عنوان التوصيل
                      </label>
                      <textarea
                        id={`${coUid}-co-delivery-addr`}
                        value={deliveryAddressText}
                        onChange={(ev) => setDeliveryAddressText(ev.target.value)}
                        dir="rtl"
                        rows={2}
                        maxLength={DELIVERY_ADDRESS_MAX_CHARS}
                        placeholder={`المدينة، الحي، الشارع… (${DELIVERY_ADDRESS_MIN_CHARS} أحرف على الأقل بدون خريطة)`}
                        className="mt-0.5 w-full resize-y rounded-lg border border-[#ebe4d3]/70 bg-white/80 px-2.5 py-2 text-[13px] outline-none placeholder:text-[#aaa08e] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                      />
                    </div>
                  </div>
                )}
              </CoFieldCard>

              <CoFieldCard label="موقع الإرجاع" icon={<MapPin className="size-[15px]" />}>
                <div className="flex flex-col gap-2.5">
                  <div className="relative">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                      المدينة
                    </span>
                    <select
                      value={returnCity || defaultCitySlug}
                      onChange={(ev) => {
                        const slug = ev.target.value;
                        setReturnCity(slug);
                        const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
                        setReturnBranch(list[0]?.slug ?? "");
                      }}
                      required={branchSelectRequired}
                      className="w-full appearance-none rounded-lg border border-transparent bg-transparent py-0.5 pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                    >
                      {dateCities.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                  </div>
                  <div className="relative border-t border-[#ebe4d3]/60 pt-2">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/45">
                      الفرع
                    </span>
                    <select
                      value={returnBranch || defaultReturnBranchSlug}
                      onChange={(ev) => setReturnBranch(ev.target.value)}
                      required={branchSelectRequired}
                      disabled={returnCityBranches.length === 0}
                      className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none disabled:opacity-50"
                    >
                      {returnCityBranches.map((b) => (
                        <option key={b.slug} value={b.slug}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-0 top-[calc(50%+6px)] size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                  </div>
                </div>
              </CoFieldCard>

              <CoFieldCard label="تاريخ ووقت الاستلام" icon={<CalendarClock className="size-[15px]" />}>
                <input
                  type="datetime-local"
                  value={pickupDt}
                  onChange={(ev) => setPickupDt(ev.target.value)}
                  required
                  dir="ltr"
                  className="w-full bg-transparent text-[14px] font-semibold text-[#0f1923] outline-none"
                />
              </CoFieldCard>

              <CoFieldCard
                label="تاريخ ووقت التسليم"
                icon={<Clock className="size-[15px]" />}
                hint={rentalDropoffHint(rental)}
              >
                <input
                  type="datetime-local"
                  value={dropoffDt}
                  onChange={(ev) => setDropoffDt(ev.target.value)}
                  readOnly={rental !== "daily"}
                  required
                  dir="ltr"
                  className={`w-full bg-transparent text-[14px] font-semibold text-[#0f1923] outline-none ${rental !== "daily" ? "cursor-default opacity-90" : ""}`}
                  aria-readonly={rental !== "daily"}
                />
              </CoFieldCard>
                </>
            </div>
              )}
          </div>
          <div className="border-t border-[#f0ebe4] bg-gradient-to-b from-[#fdfbf6] to-[#f9f5ee] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-1 items-center gap-3" aria-live="polite">
                {daysPreview != null ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.5)]"
                      style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                    >
                      <CalendarDays className="size-3.5" aria-hidden />
                      <span dir="ltr" className="tabular-nums">
                        {daysPreview}
                      </span>
                      يوم
                    </span>
                    <span className="text-[12px] font-medium text-[#6b5a3b]">مدة الحجز</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12px] text-[#aaa08e]">
                    <CalendarCheck2 className="size-3.5" aria-hidden />
                    {rental === "monthly_packages"
                      ? "تُشتق المدة من يوم بدء الباقة ومدة الاشتراك أعلاه"
                      : "حدّد التواريخ لعرض المدة"}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-8 py-4 text-white shadow-[0_10px_28px_-10px_rgba(219,184,120,0.55)] transition-transform hover:-translate-y-0.5 sm:w-auto"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                }}
              >
                <span
                  className="checkout-cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/22 to-white/0"
                  aria-hidden
                />
                <CalendarCheck2 className="size-[18px] shrink-0" aria-hidden />
                <span className="text-[15px] font-extrabold tracking-wide">تطبيق التواريخ على الحجز</span>
              </button>
            </div>
          </div>

          {dateCities.length === 0 && (
            <div className="border-t border-red-100 bg-red-50/60 px-5 py-3 text-center text-[12px] font-medium text-red-600">
              لا توجد مدن نشطة بفروع مفعّلة. أضف مدناً وفروعاً من لوحة الإدارة.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2.5 border-t border-red-200 bg-gradient-to-l from-red-50 to-red-50/50 px-5 py-3 text-[13px] font-semibold text-red-700"
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
      </section>
    </>
  );
}

function CoPillTab({
  active,
  onClick,
  icon,
  label,
  tone = "gold",
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
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
      className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition-all duration-200 sm:px-4 sm:text-[13px]"
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

function CoFieldCard({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="checkout-field-card flex cursor-text flex-col gap-2 rounded-2xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-4">
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#003749]/55">
          <span className="text-[#dbb878]">{icon}</span>
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] font-medium leading-snug text-[#8a7752]/90">{hint}</span>
        ) : null}
      </span>
      <div className="min-h-[1.5rem]">{children}</div>
    </label>
  );
}
