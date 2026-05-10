"use client";

import {
  CalendarDays,
  Car,
  CalendarClock,
  Clock,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { computeBookingDays } from "@/lib/booking-days";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";

export type BookingBranchOption = {
  slug: string;
  name: string;
};

type RentalTab = "daily" | "weekly";
type ModeTab = "pickup" | "delivery";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

function validateRentalMinDays(rental: RentalTab, days: number): string | null {
  if (rental === "weekly" && days < 7) {
    return "نوع الأسبوعي يتطلّب مدة لا تقل عن 7 أيام بين الاستلام والتسليم.";
  }
  return null;
}

export function BookingSearchWidget({ branches }: { branches: BookingBranchOption[] }) {
  const router = useRouter();
  const [rental, setRental] = useState<RentalTab>("daily");
  const [mode, setMode] = useState<ModeTab>("pickup");
  const [pickupBranch, setPickupBranch] = useState("");
  const [returnBranch, setReturnBranch] = useState("");
  const [pickupDt, setPickupDt] = useState("");
  const [dropoffDt, setDropoffDt] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchSelectRequired = branches.length > 0;
  const defaultSlug = branches[0]?.slug ?? "";
  const pickupBranchEffective = mode === "pickup" ? pickupBranch || defaultSlug : "";
  const returnBranchEffective = returnBranch || defaultSlug;

  const daysPreview = useMemo(() => {
    if (!pickupDt || !dropoffDt) return null;
    const p = new Date(pickupDt);
    const d = new Date(dropoffDt);
    if (Number.isNaN(p.getTime()) || Number.isNaN(d.getTime())) return null;
    return computeBookingDays(p, d);
  }, [pickupDt, dropoffDt]);

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
      if (deliveryLat == null || deliveryLng == null) {
        setError("حدّد موقع التوصيل على الخريطة.");
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

    const pickupDateYmd = pickupDt.slice(0, 10);

    const ctx: StoredFleetSearchContext = {
      rental,
      mode,
      pickupBranch: mode === "pickup" ? pickupBranchEffective : undefined,
      returnBranch: returnBranchEffective,
      deliveryLat: mode === "delivery" ? deliveryLat ?? undefined : undefined,
      deliveryLng: mode === "delivery" ? deliveryLng ?? undefined : undefined,
      pickupDate: pickupDateYmd,
      days,
    };

    persistAndNavigate(params, ctx);
  }

  return (
    <>
      <form
        onSubmit={handleSearch}
        dir="rtl"
        className="booking-widget w-full overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_-16px_rgba(15,61,71,0.22),0_8px_24px_-8px_rgba(15,61,71,0.10)] ring-1 ring-black/[0.04]"
      >
        {/* ─── Tab Bar ─── */}
        <div className="booking-tabs flex flex-col gap-0 border-b border-[#f0ebe4] sm:flex-row sm:items-stretch">
          {/* Rental type tabs */}
          <div className="flex flex-1 border-b border-[#f0ebe4] sm:border-b-0 sm:border-e sm:border-e-[#f0ebe4]">
            <TabButton
              active={rental === "daily"}
              onClick={() => setRental("daily")}
              icon={<Car className="size-[18px]" />}
              label="إيجار يومي"
              sublabel="أقل من أسبوع"
            />
            <TabButton
              active={rental === "weekly"}
              onClick={() => setRental("weekly")}
              icon={<CalendarDays className="size-[18px]" />}
              label="إيجار أسبوعي"
              sublabel="7 أيام+"
            />
          </div>

          {/* Mode tabs */}
          <div className="flex flex-1">
            <TabButton
              active={mode === "pickup"}
              onClick={() => setMode("pickup")}
              icon={<PackageCheck className="size-[18px]" />}
              label="استلام من الفرع"
              sublabel="اختر الفرع المناسب"
              tone="teal"
            />
            <TabButton
              active={mode === "delivery"}
              onClick={() => setMode("delivery")}
              icon={<Truck className="size-[18px]" />}
              label="توصيل لموقعي"
              sublabel="نصل إليك"
              tone="teal"
            />
          </div>
        </div>

        {/* ─── Fields Row ─── */}
        <div className="booking-fields grid grid-cols-1 divide-y divide-[#f0ebe4] sm:grid-cols-2 sm:divide-x sm:divide-x-reverse sm:divide-y-0 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:divide-y-0">
          {/* Field 1: Pickup / Delivery location */}
          <BookingField
            label={mode === "pickup" ? "موقع الاستلام" : "موقع التوصيل"}
            icon={<MapPin className="size-[17px]" />}
          >
            {mode === "pickup" ? (
              <div className="relative">
                <select
                  value={pickupBranch || defaultSlug}
                  onChange={(ev) => setPickupBranch(ev.target.value)}
                  required={branchSelectRequired}
                  className="w-full appearance-none bg-transparent pe-6 text-[15px] font-semibold text-[#0f1923] outline-none placeholder:text-[#9a8366]"
                >
                  {branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-0 top-1/2 size-4 -translate-y-1/2 text-[#9a8366]" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="w-full text-start text-[15px] font-semibold outline-none"
              >
                {deliveryLat != null && deliveryLng != null ? (
                  <span className="flex items-center gap-1.5 text-[#003749]">
                    <span className="inline-block size-2 rounded-full bg-green-500" />
                    تم تحديد الموقع
                  </span>
                ) : (
                  <span className="text-[#9a8366]">اضغط لتحديد الموقع</span>
                )}
              </button>
            )}
          </BookingField>

          {/* Field 2: Return branch */}
          <BookingField
            label="موقع التسليم (إرجاع)"
            icon={<MapPin className="size-[17px]" />}
          >
            <div className="relative">
              <select
                value={returnBranch || defaultSlug}
                onChange={(ev) => setReturnBranch(ev.target.value)}
                required={branchSelectRequired}
                className="w-full appearance-none bg-transparent pe-6 text-[15px] font-semibold text-[#0f1923] outline-none"
              >
                {branches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-0 top-1/2 size-4 -translate-y-1/2 text-[#9a8366]" />
            </div>
          </BookingField>

          {/* Field 3: Pickup datetime */}
          <BookingField
            label="تاريخ ووقت الاستلام"
            icon={<CalendarClock className="size-[17px]" />}
          >
            <input
              type="datetime-local"
              value={pickupDt}
              onChange={(ev) => setPickupDt(ev.target.value)}
              required
              dir="ltr"
              className="w-full bg-transparent text-[15px] font-semibold text-[#0f1923] outline-none"
            />
          </BookingField>

          {/* Field 4: Dropoff datetime */}
          <BookingField
            label="تاريخ ووقت التسليم"
            icon={<Clock className="size-[17px]" />}
          >
            <input
              type="datetime-local"
              value={dropoffDt}
              onChange={(ev) => setDropoffDt(ev.target.value)}
              required
              dir="ltr"
              className="w-full bg-transparent text-[15px] font-semibold text-[#0f1923] outline-none"
            />
          </BookingField>

          {/* CTA Button */}
          <div className="flex items-stretch p-3 lg:p-3">
            <button
              type="submit"
              className="group relative flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-6 py-3 text-white transition-all duration-300 hover:shadow-[0_8px_24px_-6px_rgba(219,184,120,0.8)] hover:-translate-y-0.5 active:translate-y-0 lg:min-h-[4rem] lg:flex-col"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                boxShadow: "0 4px 16px -4px rgba(219,184,120,0.55)",
              }}
            >
              {/* shimmer */}
              <span
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/25 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
                aria-hidden
              />
              <Search className="size-5 shrink-0" aria-hidden />
              <span className="text-[13px] font-extrabold leading-tight tracking-wide">
                بحث
              </span>
            </button>
          </div>
        </div>

        {/* ─── Footer Bar ─── */}
        <div className="flex flex-col items-start gap-2 border-t border-[#f0ebe4] bg-[#fdfbf6] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Days badge */}
          <div aria-live="polite" className="flex items-center gap-2">
            {daysPreview != null ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
              >
                <CalendarDays className="size-3.5" aria-hidden />
                <span dir="ltr">{daysPreview}</span>
                <span>يوم</span>
              </span>
            ) : (
              <span className="text-[12px] text-[#9a8366]">
                حدّد تواريخ الاستلام والتسليم لعرض المدة
              </span>
            )}
          </div>

          <Link
            href="/fleet"
            className="text-[12px] font-semibold text-[#003749] underline-offset-4 hover:underline"
            style={{ textDecorationColor: GOLD }}
          >
            تصفح الأسطول كاملاً ←
          </Link>
        </div>

        {/* No branches warning */}
        {branches.length === 0 && (
          <p className="border-t border-[#f0ebe4] px-5 py-3 text-center text-xs text-red-600">
            لا توجد فروع مفعّلة. أضف فروعاً من لوحة الإدارة.
          </p>
        )}

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700"
          >
            <span className="inline-block size-2 shrink-0 rounded-full bg-red-500" />
            {error}
          </p>
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

function TabButton({
  active,
  onClick,
  icon,
  label,
  sublabel,
  tone = "gold",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  tone?: "gold" | "teal";
}) {
  const activeColor = tone === "teal" ? TEAL : GOLD_DARK;
  const activeBorderColor = tone === "teal" ? TEAL : GOLD;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="group relative flex flex-1 items-center gap-3 px-5 py-4 text-start transition-colors duration-200 hover:bg-[#fdfbf6] focus-visible:outline-none"
    >
      {/* active indicator line at bottom */}
      <span
        className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full transition-all duration-300"
        style={{
          background: active ? activeBorderColor : "transparent",
        }}
      />
      {/* icon bubble */}
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
        style={{
          background: active ? `${activeColor}18` : "#f4f0ea",
          color: active ? activeColor : "#9a8366",
        }}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span
          className="text-[13.5px] font-bold leading-tight transition-colors duration-200"
          style={{ color: active ? activeColor : "#6b5a3b" }}
        >
          {label}
        </span>
        <span className="text-[11px] text-[#9a8366]">{sublabel}</span>
      </span>
    </button>
  );
}

function BookingField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex cursor-text flex-col gap-2 p-4 transition-colors duration-150 hover:bg-[#fdfbf6] focus-within:bg-[#fffcf7] lg:p-5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: TEAL + "aa" }}>
        <span style={{ color: GOLD }}>{icon}</span>
        {label}
      </span>
      <div>{children}</div>
    </label>
  );
}
