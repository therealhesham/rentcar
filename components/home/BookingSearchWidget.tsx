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
        className="w-full overflow-hidden rounded-3xl border border-[#e7e1d3] bg-white/95 shadow-[0_24px_60px_-20px_rgba(15,61,71,0.25),0_8px_24px_-12px_rgba(15,61,71,0.12)] backdrop-blur-sm"
        dir="rtl"
      >
        {/* رأس الـ widget — تبويبات نوع الإيجار + استلام/توصيل */}
        <div className="flex flex-col gap-3 border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* segmented: نوع الإيجار */}
          <div
            role="tablist"
            aria-label="نوع الإيجار"
            className="inline-flex w-full rounded-full border border-[#ebe4d3] bg-[#fbf6ec] p-1 text-sm font-bold sm:w-auto"
          >
            <SegBtn
              active={rental === "daily"}
              onClick={() => setRental("daily")}
              icon={<Car className="size-4" aria-hidden />}
              label="يومي"
            />
            <SegBtn
              active={rental === "weekly"}
              onClick={() => setRental("weekly")}
              icon={<CalendarDays className="size-4" aria-hidden />}
              label="أسبوعي"
            />
          </div>

          {/* segmented: استلام / توصيل */}
          <div
            role="tablist"
            aria-label="طريقة الاستلام"
            className="inline-flex w-full rounded-full border border-[#dce4ea] bg-[#f4f7fa] p-1 text-sm font-bold sm:w-auto"
          >
            <SegBtn
              active={mode === "pickup"}
              onClick={() => setMode("pickup")}
              icon={<PackageCheck className="size-4" aria-hidden />}
              label="استلام من الفرع"
              tone="teal"
            />
            <SegBtn
              active={mode === "delivery"}
              onClick={() => setMode("delivery")}
              icon={<Truck className="size-4" aria-hidden />}
              label="توصيل لموقعي"
              tone="teal"
            />
          </div>
        </div>

        {/* الحقول */}
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-12 lg:items-stretch lg:gap-0 lg:p-0">
          {/* الموقع (استلام أو توصيل) */}
          <Field
            label={mode === "pickup" ? "موقع الاستلام" : "موقع التوصيل"}
            icon={<MapPin className="size-4" aria-hidden />}
            className="lg:col-span-3"
          >
            {mode === "pickup" ? (
              <select
                value={pickupBranch || defaultSlug}
                onChange={(ev) => setPickupBranch(ev.target.value)}
                required={branchSelectRequired}
                className="w-full bg-transparent text-sm font-semibold text-[#1c1b1b] outline-none"
              >
                {branches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="w-full text-start text-sm font-semibold text-[#1c1b1b] outline-none"
              >
                {deliveryLat != null && deliveryLng != null ? (
                  <span className="block">
                    تم تحديد الموقع{" "}
                    <span dir="ltr" className="text-xs font-mono text-on-surface-variant">
                      ({deliveryLat.toFixed(4)}, {deliveryLng.toFixed(4)})
                    </span>
                  </span>
                ) : (
                  <span className="text-[#9a8366]">اضغط لتحديد الموقع على الخريطة</span>
                )}
              </button>
            )}
          </Field>

          {/* فرع الإرجاع */}
          <Field
            label="موقع التسليم (إرجاع المركبة)"
            icon={<MapPin className="size-4" aria-hidden />}
            className="lg:col-span-3"
            withBorderStart
          >
            <select
              value={returnBranch || defaultSlug}
              onChange={(ev) => setReturnBranch(ev.target.value)}
              required={branchSelectRequired}
              className="w-full bg-transparent text-sm font-semibold text-[#1c1b1b] outline-none"
            >
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          {/* تاريخ ووقت الاستلام */}
          <Field
            label="تاريخ ووقت الاستلام"
            icon={<CalendarClock className="size-4" aria-hidden />}
            className="lg:col-span-3"
            withBorderStart
          >
            <input
              type="datetime-local"
              value={pickupDt}
              onChange={(ev) => setPickupDt(ev.target.value)}
              required
              dir="ltr"
              className="w-full bg-transparent text-sm font-semibold text-[#1c1b1b] outline-none"
            />
          </Field>

          {/* تاريخ ووقت التسليم */}
          <Field
            label="تاريخ ووقت التسليم"
            icon={<Clock className="size-4" aria-hidden />}
            className="lg:col-span-3"
            withBorderStart
          >
            <input
              type="datetime-local"
              value={dropoffDt}
              onChange={(ev) => setDropoffDt(ev.target.value)}
              required
              dir="ltr"
              className="w-full bg-transparent text-sm font-semibold text-[#1c1b1b] outline-none"
            />
          </Field>
        </div>

        {/* شريط الأكشن السفلي */}
        <div className="flex flex-col gap-3 border-t border-[#f0ebe4] bg-[#fbf6ec]/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p
            className="text-xs font-semibold text-[#6b5a3b]"
            aria-live="polite"
          >
            {daysPreview != null ? (
              <>
                مدة الحجز:{" "}
                <span dir="ltr" className="tabular-nums text-[#003749]">
                  {daysPreview}
                </span>{" "}
                يوماً
              </>
            ) : (
              <span className="text-[#9a8366]">حدّد تواريخ الاستلام والتسليم لعرض المدة</span>
            )}
          </p>

          <button
            type="submit"
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full px-8 text-sm font-extrabold text-white shadow-[0_8px_20px_-6px_rgba(219,184,120,0.7)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
            }}
          >
            <span
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/30 to-white/0 transition-transform duration-700 group-hover:translate-x-full"
              aria-hidden
            />
            <Search className="size-5" aria-hidden />
            <span>بحث المركبات المتاحة</span>
          </button>
        </div>

        {branches.length === 0 ? (
          <p className="border-t border-[#f0ebe4] px-4 py-3 text-center text-xs text-error">
            لا توجد فروع مفعّلة في النظام. أضف فروعاً من لوحة الإدارة لاستخدام البحث.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="border-t border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-center text-sm font-bold text-[#b91c1c]"
          >
            {error}
          </p>
        ) : null}

        <p className="border-t border-[#f0ebe4] px-4 py-2.5 text-center text-[11px] text-on-surface-variant">
          البحث يعرض المركبات المتاحة للحجز المباشر في الفترة المحددة.{" "}
          <Link
            href="/fleet"
            className="font-bold text-[#003749] underline-offset-4 hover:underline"
            style={{ textDecorationColor: GOLD }}
          >
            تصفح الأسطول كاملاً
          </Link>
        </p>
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

/* ---------- Subcomponents ---------- */

function SegBtn({
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
  const activeBg =
    tone === "teal"
      ? "bg-[#003749] text-white shadow-[0_4px_14px_-4px_rgba(0,55,73,0.5)]"
      : "bg-[#dbb878] text-white shadow-[0_4px_14px_-4px_rgba(219,184,120,0.7)]";
  const inactive =
    tone === "teal"
      ? "text-[#003749]/70 hover:text-[#003749]"
      : "text-[#6b5a3b] hover:text-[#003749]";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 transition-all duration-200 ${
        active ? activeBg : inactive
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Field({
  label,
  icon,
  className = "",
  withBorderStart = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  className?: string;
  withBorderStart?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`group flex cursor-text flex-col gap-1 rounded-2xl border border-[#ebe4d3] bg-[#fdfbf6] p-3 transition-colors hover:border-[#dbb878]/60 focus-within:border-[#dbb878] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#dbb878]/30 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-5 lg:hover:border-0 lg:focus-within:bg-[#fdfbf6]/40 lg:focus-within:ring-0 ${
        withBorderStart ? "lg:border-s lg:border-s-[#f0ebe4]" : ""
      } ${className}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#003749]/70">
        <span className="text-[#dbb878]">{icon}</span>
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
