"use client";

import {
  CalendarDays,
  CalendarRange,
  Car,
  CalendarClock,
  Clock,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import { computeBookingDays } from "@/lib/booking-days";
import {
  computeAutoDropoff,
  computeDaysPreview,
  toDatetimeLocalValue,
  validateRentalMinDays,
  type ModeTab,
  type RentalTab,
} from "@/lib/booking-search-shared";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";

export type BookingBranchOption = {
  slug: string;
  name: string;
};

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (rental === "daily") return;
    if (!pickupDt.trim()) return;
    const p = new Date(pickupDt);
    if (Number.isNaN(p.getTime())) return;
    const auto = computeAutoDropoff(p, rental);
    if (!auto) return;
    setDropoffDt(toDatetimeLocalValue(auto));
  }, [rental, pickupDt]);

  const branchSelectRequired = branches.length > 0;
  const defaultSlug = branches[0]?.slug ?? "";
  const pickupBranchEffective = mode === "pickup" ? pickupBranch || defaultSlug : "";
  const returnBranchEffective = returnBranch || defaultSlug;

  const daysPreview = useMemo(
    () => computeDaysPreview(pickupDt, dropoffDt),
    [pickupDt, dropoffDt],
  );

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
      `}</style>

      <form
        onSubmit={handleSearch}
        dir="rtl"
        className={`booking-card w-full overflow-hidden rounded-3xl bg-white/[0.97] shadow-[0_40px_100px_-24px_rgba(15,61,71,0.2),0_12px_32px_-8px_rgba(15,61,71,0.08)] ring-1 ring-black/[0.03] backdrop-blur-xl ${
          mounted ? "" : "opacity-0"
        }`}
      >
        {/* ═══════════════════════════════════════
            SECTION 1: Tab Header
        ═══════════════════════════════════════ */}
        <div className="relative">
          {/* Subtle gradient background for the tabs */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fdfbf6] to-white" />

          <div className="relative flex flex-col sm:flex-row sm:items-stretch">
            {/* Rental type group */}
            <div className="flex flex-1 items-center border-b border-[#f0ebe4] sm:border-b-0 sm:border-e sm:border-e-[#f0ebe4]">
              <div className="flex w-full flex-wrap items-center gap-1 p-2">
                <PillTab
                  active={rental === "daily"}
                  onClick={() => setRental("daily")}
                  icon={<Car className="size-[15px]" />}
                  label="يومي"
                />
                <PillTab
                  active={rental === "weekly"}
                  onClick={() => setRental("weekly")}
                  icon={<CalendarDays className="size-[15px]" />}
                  label="أسبوعي"
                />
                <PillTab
                  active={rental === "monthly"}
                  onClick={() => setRental("monthly")}
                  icon={<CalendarRange className="size-[15px]" />}
                  label="شهري"
                />
              </div>
            </div>

            {/* Mode group */}
            <div className="flex flex-1 items-center">
              <div className="flex w-full items-center gap-1 p-2">
                <PillTab
                  active={mode === "pickup"}
                  onClick={() => setMode("pickup")}
                  icon={<PackageCheck className="size-[15px]" />}
                  label="استلام من الفرع"
                  tone="teal"
                />
                <PillTab
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

        {/* ═══════════════════════════════════════
            SECTION 2: Form Fields Grid
        ═══════════════════════════════════════ */}
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Field 1: Pickup / Delivery location */}
            <FieldCard
              label={mode === "pickup" ? "موقع الاستلام" : "موقع التوصيل"}
              icon={<MapPin className="size-[15px]" />}
            >
              {mode === "pickup" ? (
                <div className="relative">
                  <select
                    value={pickupBranch || defaultSlug}
                    onChange={(ev) => setPickupBranch(ev.target.value)}
                    required={branchSelectRequired}
                    className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-0 top-1/2 size-3.5 -translate-y-1/2 text-[#aaa08e]" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="w-full text-start text-[14px] font-semibold outline-none"
                >
                  {deliveryLat != null && deliveryLng != null ? (
                    <span className="flex items-center gap-2 text-[#0f3d47]">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100">
                        <span className="size-2 rounded-full bg-emerald-500" />
                      </span>
                      تم تحديد الموقع
                    </span>
                  ) : (
                    <span className="text-[#aaa08e]">اضغط لتحديد الموقع ↗</span>
                  )}
                </button>
              )}
            </FieldCard>

            {/* Field 2: Return branch */}
            <FieldCard
              label="موقع الإرجاع"
              icon={<MapPin className="size-[15px]" />}
            >
              <div className="relative">
                <select
                  value={returnBranch || defaultSlug}
                  onChange={(ev) => setReturnBranch(ev.target.value)}
                  required={branchSelectRequired}
                  className="w-full appearance-none bg-transparent pe-5 text-[14px] font-semibold text-[#0f1923] outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-0 top-1/2 size-3.5 -translate-y-1/2 text-[#aaa08e]" />
              </div>
            </FieldCard>

            {/* Field 3: Pickup date/time */}
            <FieldCard
              label="تاريخ ووقت الاستلام"
              icon={<CalendarClock className="size-[15px]" />}
            >
              <input
                type="datetime-local"
                value={pickupDt}
                onChange={(ev) => setPickupDt(ev.target.value)}
                required
                dir="ltr"
                className="w-full bg-transparent text-[14px] font-semibold text-[#0f1923] outline-none"
              />
            </FieldCard>

            {/* Field 4: Dropoff date/time */}
            <FieldCard
              label="تاريخ ووقت التسليم"
              icon={<Clock className="size-[15px]" />}
              // hint={
              //   rental === "weekly"
              //     ? "يُحسب تلقائياً (+٧ أيام من الاستلام)"
              //     : rental === "monthly"
              //       ? "يُحسب تلقائياً (+شهر تقويمي من الاستلام)"
              //       : undefined
              // }
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
            </FieldCard>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            SECTION 3: CTA + Info Footer
        ═══════════════════════════════════════ */}
        <div className="border-t border-[#f0ebe4] bg-gradient-to-b from-[#fdfbf6] to-[#f9f5ee] px-5 py-4 sm:px-6">
          {/* CTA row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Duration badge + helper text */}
            <div className="flex flex-1 items-center gap-3" aria-live="polite">
              {daysPreview != null ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.5)]"
                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                  >
                    <CalendarDays className="size-3.5" aria-hidden />
                    <span dir="ltr" className="tabular-nums">{daysPreview}</span>
                    يوم
                  </span>
                  <span className="text-[12px] font-medium text-[#6b5a3b]">مدة الحجز</span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-[12px] text-[#aaa08e]">
                  حدّد التواريخ لعرض مدة الحجز
                </span>
              )}
            </div>

            {/* Search button */}
            <button
              type="submit"
              className="cta-btn group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-10 py-4 text-white sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              }}
            >
              {/* shimmer overlay */}
              <span
                className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                aria-hidden
              />
              <Search className="size-[18px] shrink-0" aria-hidden />
              <span className="text-[15px] font-extrabold tracking-wide">
                بحث المركبات المتاحة
              </span>
            </button>
          </div>

          {/* Bottom info row */}
          <div className="mt-3 flex items-center justify-between border-t border-[#ebe4d3]/60 pt-3">
            <p className="text-[11px] text-[#aaa08e]">
              يُعرض المتوفر للحجز المباشر حسب الفترة المحددة
            </p>
            <Link
              href="/fleet"
              className="text-[11.5px] font-bold text-[#003749] underline-offset-4 transition-colors hover:text-[#dbb878] hover:underline"
              style={{ textDecorationColor: GOLD }}
            >
              تصفح الأسطول ←
            </Link>
          </div>
        </div>

        {/* No branches */}
        {branches.length === 0 && (
          <div className="border-t border-red-100 bg-red-50/60 px-5 py-3 text-center text-[12px] font-medium text-red-600">
            لا توجد فروع مفعّلة. أضف فروعاً من لوحة الإدارة.
          </div>
        )}

        {/* Error */}
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
      className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-250"
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
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="booking-field-card flex cursor-text flex-col gap-2 rounded-2xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-4">
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
