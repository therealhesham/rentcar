"use client";

import { CalendarDays, Car, Search } from "lucide-react";
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

  const tabBtn =
    "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition sm:text-base";
  const tabInactive = "border border-[#e8e4df] bg-white text-[#1c1b1b]";
  const tabActive = "border border-transparent bg-[#dbb878] text-white shadow-sm";

  return (
    <>
      <div className="relative z-20 mx-auto w-full max-w-6xl">
        <form
          onSubmit={handleSearch}
          className="overflow-hidden rounded-2xl border border-[#ebe8e3] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
          dir="rtl"
        >
          {/* نوع الإيجار */}
          <div className="flex flex-wrap gap-2 border-b border-[#f0ebe4] p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setRental("daily")}
              className={`${tabBtn} ${rental === "daily" ? tabActive : tabInactive}`}
            >
              <Car className="size-5 shrink-0 opacity-90" aria-hidden />
              يومي
            </button>
            <button
              type="button"
              onClick={() => setRental("weekly")}
              className={`${tabBtn} ${rental === "weekly" ? tabActive : tabInactive}`}
            >
              <CalendarDays className="size-5 shrink-0 opacity-90" aria-hidden />
              أسبوعي
            </button>
          </div>

          {/* استلام / توصيل */}
          <div className="flex gap-2 px-4 pt-4">
            <button
              type="button"
              onClick={() => setMode("pickup")}
              className={`rounded-xl px-6 py-2.5 text-sm font-bold transition ${
                mode === "pickup"
                  ? "bg-[#dbb878] text-white"
                  : "border-2 border-[#f97316] bg-white text-[#f97316]"
              }`}
            >
              استلام
            </button>
            <button
              type="button"
              onClick={() => setMode("delivery")}
              className={`rounded-xl px-6 py-2.5 text-sm font-bold transition ${
                mode === "delivery"
                  ? "bg-[#dbb878] text-white"
                  : "border-2 border-[#f97316] bg-white text-[#f97316]"
              }`}
            >
              توصيل
            </button>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-0 lg:divide-x lg:divide-[#ebe8e3] lg:divide-x-reverse">
            {mode === "pickup" ? (
              <label className="flex flex-col gap-1 lg:col-span-3 lg:px-4">
                <span className="text-xs font-bold text-[#775927]">موقع الاستلام</span>
                <select
                  value={pickupBranch || defaultSlug}
                  onChange={(ev) => setPickupBranch(ev.target.value)}
                  required={branchSelectRequired}
                  className="rounded-lg border border-[#ebe8e3] bg-[#faf9f7] px-3 py-3 text-sm font-medium text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#f97316]/40"
                >
                  {branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-on-surface-variant">
                  {/* الاستلام من فرع الشركة */}
                </span>
              </label>
            ) : (
              <div className="flex flex-col gap-2 lg:col-span-3 lg:px-4">
                <span className="text-xs font-bold text-[#775927]">موقع التوصيل</span>
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="rounded-lg border border-dashed border-[#f97316]/60 bg-[#fff7ed] px-3 py-3 text-start text-sm font-bold text-[#c2410c] transition hover:bg-[#ffedd5]"
                >
                  {deliveryLat != null && deliveryLng != null
                    ? `تم تحديد الموقع (${deliveryLat.toFixed(5)}, ${deliveryLng.toFixed(5)})`
                    : "حدّد موقع التوصيل على الخريطة"}
                </button>
                <span className="text-[11px] text-on-surface-variant">
                  {/* خريطة تفاعلية (Google أو OpenStreetMap) — اسحب الدبوس أو انقر */}
                </span>
              </div>
            )}

            <label className="flex flex-col gap-1 lg:col-span-3 lg:px-4">
              <span className="text-xs font-bold text-[#775927]">موقع التسليم (إرجاع المركبة)</span>
              <select
                value={returnBranch || defaultSlug}
                onChange={(ev) => setReturnBranch(ev.target.value)}
                required={branchSelectRequired}
                className="rounded-lg border border-[#ebe8e3] bg-[#faf9f7] px-3 py-3 text-sm font-medium text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#f97316]/40"
              >
                {branches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 lg:col-span-2 lg:px-4">
              <span className="text-xs font-bold text-[#775927]">تاريخ / وقت الاستلام</span>
              <input
                type="datetime-local"
                value={pickupDt}
                onChange={(ev) => setPickupDt(ev.target.value)}
                required
                className="rounded-lg border border-[#ebe8e3] bg-[#faf9f7] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/40"
                dir="ltr"
              />
            </label>

            <label className="flex flex-col gap-1 lg:col-span-2 lg:px-4">
              <span className="text-xs font-bold text-[#775927]">تاريخ / وقت التسليم</span>
              <input
                type="datetime-local"
                value={dropoffDt}
                onChange={(ev) => setDropoffDt(ev.target.value)}
                required
                className="rounded-lg border border-[#ebe8e3] bg-[#faf9f7] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/40"
                dir="ltr"
              />
            </label>

            <div className="flex flex-col gap-2 lg:col-span-2 lg:px-4">
              {daysPreview != null ? (
                <p className="text-[11px] font-semibold text-[#003749]">
                  مدة الحجز:{" "}
                  <span dir="ltr" className="tabular-nums">
                    {daysPreview}
                  </span>{" "}
                  يوماً
                </p>
              ) : (
                <span className="text-[11px] text-transparent">.</span>
              )}
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#dbb878] text-sm font-extrabold text-white shadow-md transition hover:bg-[#ea580c]"
              >
                <Search className="size-5" aria-hidden />
                بحث
              </button>
            </div>
          </div>

          {branches.length === 0 ? (
            <p className="border-t border-[#f0ebe4] px-4 py-3 text-center text-xs text-error">
              لا توجد فروع مفعّلة في النظام. أضف فروعاً من لوحة الإدارة لاستخدام البحث.
            </p>
          ) : null}

          {error ? (
            <p className="border-t border-[#f0ebe4] px-4 py-3 text-center text-sm font-bold text-error">
              {error}
            </p>
          ) : null}

          <p className="border-t border-[#f0ebe4] px-4 py-2 text-center text-[10px] text-on-surface-variant">
            البحث يعرض المركبات المتاحة للحجز المباشر في الفترة المحددة.{" "}
            <Link href="/fleet" className="font-bold text-[#f97316] underline-offset-2 hover:underline">
              تصفح الأسطول كاملاً
            </Link>
          </p>
        </form>
      </div>

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
