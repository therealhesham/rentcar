"use client";

import {
  Baby,
  CircleHelp,
  Gauge,
  Info,
  KeyRound,
  Shield,
  CheckCircle2,
  CalendarDays,
  MapPin,
  CreditCard,
  Check,
  ChevronDown,
  FileImage,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { FleetCheckoutBookingPanel } from "@/components/fleet/FleetCheckoutBookingPanel";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { CarUnavailableModal } from "@/components/fleet/CarUnavailableModal";
import { isDirectBookingCapacityMessage } from "@/lib/direct-booking-user-messages";
import { lastInclusiveBookingDayYmd } from "@/lib/booking-calendar-ymd";
import {
  computeCheckoutTotals,
  formatSarAmount,
} from "@/lib/booking-checkout-pricing";
import { computeBookingDays } from "@/lib/booking-days";
import type { CheckoutCarDTO } from "@/lib/checkout-car-data";
import { dailyRentalInclTaxSar, type RentalPriceDisplayMode } from "@/lib/pricing";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";
import { DELIVERY_ADDRESS_MIN_CHARS } from "@/lib/delivery-address";
import { citySlugForBranchSlug, lookupInterCityFeeSar } from "@/lib/inter-city-shipping-client";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { RentalAddonDTO } from "@/lib/rental-addon-data";
import { sumCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

function AddonVisual({ iconKey }: { iconKey: string | null }) {
  const cls = "size-7";
  switch (iconKey) {
    case "key":
      return <KeyRound className={cls} aria-hidden />;
    case "key-plus":
      return <Shield className={cls} aria-hidden />;
    case "child":
      return <Baby className={cls} aria-hidden />;
    case "gauge":
      return <Gauge className={cls} aria-hidden />;
    default:
      return <CircleHelp className={cls} aria-hidden />;
  }
}

function fmtWhen(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("ar-SA", { year: "numeric", month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
  };
}

function cityArName(slug: string | undefined, cities: BookingCityBranchesOption[]) {
  if (!slug) return "";
  const c = cities.find((x) => x.slug.toLowerCase() === slug.toLowerCase());
  return c?.name ?? slug;
}

type Props = {
  car: CheckoutCarDTO;
  addons: RentalAddonDTO[];
  branchBySlug: Record<string, string>;
  bookingCities: BookingCityBranchesOption[];
  interCityShippingRules: Array<{ fromSlug: string; toSlug: string; feeExclVatSar: number }>;
  checkoutOneTimeFees: Array<{ slug: string; labelAr: string; feeExclVatSar: number }>;
  sessionCustomer: { name: string; phoneLocal: string; email: string } | null;
  rentalPriceDisplayMode: RentalPriceDisplayMode;
};

export function FleetCheckoutClient({
  car,
  addons,
  branchBySlug,
  bookingCities,
  interCityShippingRules,
  checkoutOneTimeFees,
  sessionCustomer,
  rentalPriceDisplayMode,
}: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const [ctxStore, setCtxStore] = useState<StoredFleetSearchContext | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    | null
    | { loading: true }
    | { loading: false; available: boolean; fleetUnits: number; overlapping: number }
  >(null);
  const [mounted, setMounted] = useState(false);
  const [unavailableDismissed, setUnavailableDismissed] = useState(false);
  const [postCapacityModal, setPostCapacityModal] = useState(false);

  type IdDocKind = "CITIZEN" | "RESIDENT_VISITOR";
  const [idDocKind, setIdDocKind] = useState<IdDocKind>("CITIZEN");
  const [nationalId, setNationalId] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiryYmd, setLicenseExpiryYmd] = useState("");
  const [idCardUrl, setIdCardUrl] = useState<string | null>(null);
  const [licenseDocUrl, setLicenseDocUrl] = useState<string | null>(null);
  const [kycFieldError, setKycFieldError] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState<"id" | "license" | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLEET_SEARCH_STORAGE_KEY);
      if (raw) setCtxStore(JSON.parse(raw) as StoredFleetSearchContext);
    } catch {
      /* ignore */
    }
  }, []);

  const trip = useMemo(() => {
    const pickupUrl = sp.get("pickup")?.trim() || null;
    const dropoffUrl = sp.get("dropoff")?.trim() || null;
    const daysNum = Number(sp.get("days"));
    const mode =
      sp.get("mode") === "delivery" ? ("delivery" as const) : ("pickup" as const);
    const pickupBranch =
      sp.get("pickupBranch")?.trim() || ctxStore?.pickupBranch || undefined;
    const returnBranch =
      sp.get("returnBranch")?.trim() || ctxStore?.returnBranch || undefined;
    const dlatRaw = sp.get("dlat");
    const dlngRaw = sp.get("dlng");
    const daddrFromUrl = (sp.get("daddr") ?? "").trim();

    const ctxLat = ctxStore?.deliveryLat;
    const ctxLng = ctxStore?.deliveryLng;
    const ctxAddrRaw =
      typeof ctxStore?.deliveryAddress === "string" ? ctxStore.deliveryAddress.trim() : "";

    function coordFromSearchOrCtx(
      raw: string | null,
      ctxVal: number | undefined,
    ): number | undefined {
      if (raw != null && raw.trim() !== "") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      }
      return typeof ctxVal === "number" && Number.isFinite(ctxVal) ? ctxVal : undefined;
    }

    const deliveryLat =
      mode === "delivery" ? coordFromSearchOrCtx(dlatRaw, ctxLat) : undefined;
    const deliveryLng =
      mode === "delivery" ? coordFromSearchOrCtx(dlngRaw, ctxLng) : undefined;

    const deliveryAddressMerged =
      mode === "delivery" ? (daddrFromUrl || ctxAddrRaw).trim() : "";

    let pickupIso = pickupUrl;
    if (!pickupIso && ctxStore?.pickupDate) {
      pickupIso = `${ctxStore.pickupDate}T12:00:00`;
    }

    let days =
      Number.isFinite(daysNum) && daysNum >= 1 && daysNum <= 60
        ? Math.round(daysNum)
        : ctxStore?.days ?? 1;

    let dropoffIso = dropoffUrl;
    if (pickupIso && !dropoffIso) {
      const p = new Date(pickupIso);
      if (!Number.isNaN(p.getTime())) {
        const end = new Date(p);
        end.setDate(end.getDate() + days);
        dropoffIso = end.toISOString();
      }
    }

    let computedDays = days;
    if (pickupIso && dropoffIso) {
      const p = new Date(pickupIso);
      const d = new Date(dropoffIso);
      if (!Number.isNaN(p.getTime()) && !Number.isNaN(d.getTime()) && d >= p) {
        computedDays = computeBookingDays(p, d);
      }
    }

    const coordsOk =
      deliveryLat !== undefined &&
      deliveryLng !== undefined &&
      Number.isFinite(deliveryLat) &&
      Number.isFinite(deliveryLng);

    const branchSlug =
      returnBranch?.trim().toLowerCase() ||
      ctxStore?.returnBranch?.trim().toLowerCase() ||
      Object.keys(branchBySlug)[0] ||
      "jeddah";

    const pickupCityFromUrl = sp.get("pickupCity")?.trim().toLowerCase() || undefined;
    const pickupCitySlug =
      pickupCityFromUrl ||
      (typeof ctxStore?.pickupCitySlug === "string"
        ? ctxStore.pickupCitySlug.trim().toLowerCase()
        : undefined);

    const returnCitySlug = citySlugForBranchSlug(branchSlug, bookingCities);

    const pickupLabel =
      mode === "delivery"
        ? (() => {
            const parts: string[] = [];
            if (deliveryAddressMerged.length > 0) {
              parts.push(deliveryAddressMerged);
            }
            if (coordsOk) {
              parts.push(
                `${(deliveryLat as number).toFixed(4)}, ${(deliveryLng as number).toFixed(4)}`,
              );
            }
            return parts.length > 0 ? `توصيل — ${parts.join(" · ")}` : "توصيل";
          })()
        : pickupBranch
          ? (branchBySlug[pickupBranch] ?? pickupBranch)
          : (branchBySlug[branchSlug] ?? branchSlug);

    const returnLabel = branchBySlug[branchSlug] ?? branchSlug;

    const deliveryAddressForTrip =
      mode === "delivery" && deliveryAddressMerged.length > 0
        ? deliveryAddressMerged
        : undefined;

    return {
      pickupIso,
      dropoffIso,
      days: computedDays,
      mode,
      pickupLabel,
      returnLabel,
      branchSlug,
      deliveryLat:
        typeof deliveryLat === "number" && Number.isFinite(deliveryLat)
          ? deliveryLat
          : undefined,
      deliveryLng:
        typeof deliveryLng === "number" && Number.isFinite(deliveryLng)
          ? deliveryLng
          : undefined,
      deliveryAddress: deliveryAddressForTrip,
      pickupCitySlug,
      returnCitySlug,
    };
  }, [sp, ctxStore, branchBySlug, bookingCities]);

  const rentalLastDayYmdForLicense = useMemo(() => {
    if (!trip.pickupIso) return null;
    const p = new Date(trip.pickupIso);
    if (Number.isNaN(p.getTime())) return null;
    return lastInclusiveBookingDayYmd(p, trip.days);
  }, [trip.pickupIso, trip.days]);

  useEffect(() => {
    setUnavailableDismissed(false);
    setPostCapacityModal(false);
  }, [trip.pickupIso, trip.days, car.modelId]);

  const branchOptions = useMemo(
    () => Object.entries(branchBySlug).map(([slug, name]) => ({ slug, name })),
    [branchBySlug],
  );

  const selectedRows = useMemo(
    () => addons.filter((a) => selected.has(a.id)),
    [addons, selected],
  );

  const interCityShippingFeeSar = useMemo(
    () =>
      lookupInterCityFeeSar(
        interCityShippingRules,
        trip.pickupCitySlug,
        trip.returnCitySlug,
      ),
    [interCityShippingRules, trip.pickupCitySlug, trip.returnCitySlug],
  );

  const interCityShippingLabelAr = useMemo(() => {
    if (interCityShippingFeeSar <= 0) return null;
    const a = cityArName(trip.pickupCitySlug, bookingCities);
    const b = cityArName(trip.returnCitySlug, bookingCities);
    return `رسوم شحن بين المدن (${a} → ${b})`;
  }, [interCityShippingFeeSar, trip.pickupCitySlug, trip.returnCitySlug, bookingCities]);

  const checkoutFeesSumExclTax = useMemo(
    () => sumCheckoutOneTimeFees(checkoutOneTimeFees),
    [checkoutOneTimeFees],
  );

  const totals = computeCheckoutTotals(
    car.pricePerDayExclTax,
    trip.days,
    car.vatRatePercent,
    selectedRows.map((a) => ({ pricePerDay: a.pricePerDay })),
    { oneTimeFeesExclTax: interCityShippingFeeSar + checkoutFeesSumExclTax },
  );

  useEffect(() => {
    if (!trip.pickupIso) {
      setAvailability(null);
      return;
    }
    const pickupDate = trip.pickupIso.slice(0, 10);
    const ctrl = new AbortController();
    setAvailability({ loading: true });
    void (async () => {
      try {
        const params = new URLSearchParams({
          carModelId: String(car.modelId),
          pickupDate,
          days: String(trip.days),
        });
        const res = await fetch(`/api/bookings/direct?${params}`, {
          signal: ctrl.signal,
          credentials: "include",
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
        if (!ctrl.signal.aborted) setAvailability(null);
      }
    })();
    return () => ctrl.abort();
  }, [car.modelId, trip.pickupIso, trip.days]);

  function toggleAddon(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadKycImage(file: File, slot: "id" | "license") {
    setKycFieldError(null);
    setUploadingKyc(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/bookings/kyc-upload", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        throw new Error(data.error ?? "تعذّر رفع الملف.");
      }
      if (slot === "id") setIdCardUrl(data.url);
      else setLicenseDocUrl(data.url);
    } catch (err) {
      setKycFieldError(err instanceof Error ? err.message : "تعذّر رفع الملف.");
    } finally {
      setUploadingKyc(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!trip.pickupIso) {
      setError("لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (slotBlocked) {
      return;
    }

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "")
      .replace(/\s+/g, "")
      .trim();
    const age = String(fd.get("age") ?? "");
    const email = String(fd.get("email") ?? "").trim();
    const terms = fd.get("terms") === "on";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("أدخل بريداً إلكترونياً صالحاً لإرسال الفاتورة بعد الدفع.");
      return;
    }

    setKycFieldError(null);
    if (!idCardUrl) {
      setError("يرجى رفع صورة الهوية الوطنية أو الجواز (إلزامي).");
      return;
    }
    const lic = licenseNumber.trim();
    if (lic.length < 4 || lic.length > 64) {
      setError("أدخل رقم الرخصة (4–64 حرفاً).");
      return;
    }
    const exp = licenseExpiryYmd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      setError("اختر تاريخ انتهاء الرخصة.");
      return;
    }
    if (!rentalLastDayYmdForLicense) {
      setError("لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (exp < rentalLastDayYmdForLicense) {
      setError(
        `يجب أن يكون تاريخ انتهاء الرخصة في أو بعد آخر يوم من الإيجار (${rentalLastDayYmdForLicense}).`,
      );
      return;
    }
    if (idDocKind === "CITIZEN") {
      const nid = nationalId.replace(/\D/g, "");
      if (!/^\d{10}$/.test(nid)) {
        setError("رقم الهوية الوطنية يجب أن يكون 10 أرقاماً.");
        return;
      }
    } else {
      const p = passportNumber.trim().toUpperCase();
      if (p.length < 6 || p.length > 24) {
        setError("أدخل رقم الجواز (6–24 حرفاً).");
        return;
      }
      if (!/^[A-Z0-9\-]+$/.test(p)) {
        setError("رقم الجواز: أحرف إنجليزية وأرقام وشرطة فقط.");
        return;
      }
    }

    const pickupMode: "BRANCH" | "DELIVERY" =
      trip.mode === "delivery" &&
      (((trip.deliveryLat != null &&
        trip.deliveryLng != null &&
        Number.isFinite(trip.deliveryLat) &&
        Number.isFinite(trip.deliveryLng)) ||
        (trip.deliveryAddress?.trim().length ?? 0) >= DELIVERY_ADDRESS_MIN_CHARS))
        ? "DELIVERY"
        : "BRANCH";

    const body: Record<string, unknown> = {
      carModelId: car.modelId,
      name,
      phone,
      age,
      branch: trip.branchSlug,
      pickupDate: trip.pickupIso,
      days: trip.days,
      terms,
      pickupMode,
      addonIds: [...selected],
      email,
      idDocumentKind: idDocKind,
      nationalIdNumber: idDocKind === "CITIZEN" ? nationalId.replace(/\D/g, "") : "",
      passportNumber: idDocKind === "RESIDENT_VISITOR" ? passportNumber.trim().toUpperCase() : "",
      licenseNumber: lic,
      licenseExpiryDate: exp,
      idCardImageUrl: idCardUrl,
      ...(licenseDocUrl ? { driverLicenseImageUrl: licenseDocUrl } : {}),
    };
    if (pickupMode === "DELIVERY") {
      if (
        trip.deliveryLat != null &&
        trip.deliveryLng != null &&
        Number.isFinite(trip.deliveryLat) &&
        Number.isFinite(trip.deliveryLng)
      ) {
        body.deliveryLat = trip.deliveryLat;
        body.deliveryLng = trip.deliveryLng;
      }
      const addr = trip.deliveryAddress?.trim();
      if (addr) {
        body.deliveryAddress = addr;
      }
    }
    if (trip.pickupCitySlug) {
      body.pickupCity = trip.pickupCitySlug;
    }

    setPending(true);
    try {
      const res = await fetch("/api/bookings/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        bookingRequestId?: number;
      };
      if (data.ok && data.bookingRequestId) {
        router.push(`/fleet/payment/${data.bookingRequestId}`);
        return;
      }
      if (isDirectBookingCapacityMessage(data.error)) {
        setPostCapacityModal(true);
        return;
      }
      setError(data.error ?? "تعذّر إرسال الطلب.");
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setPending(false);
    }
  }

  const pu = fmtWhen(trip.pickupIso);
  const du = fmtWhen(trip.dropoffIso);
  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );

  const showCarUnavailableModal =
    (slotBlocked && !unavailableDismissed) || postCapacityModal;

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="fleet" />
      <div className={`pt-24 pb-20 transition-opacity duration-500 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-[13px] font-semibold text-[#aaa08e]">
            <Link href="/fleet" className="transition-colors hover:text-[#dbb878]">
              الأسطول
            </Link>
            <span>/</span>
            <span className="text-[#003749]">إتمام الحجز</span>
          </nav>

          {!trip.pickupIso ? (
            <div className="mb-10">
              <FleetCheckoutBookingPanel modelId={car.modelId} cities={bookingCities} />
            </div>
          ) : null}

          {/* Core Layout */}
          <div dir="rtl" className="grid gap-8 lg:grid-cols-[1fr_360px] xl:gap-12">
            {/* ─── Main Content (Left side in LTR, Right side in RTL) ─── */}
            <div className="order-2 space-y-8 lg:order-1">
              {/* Header Title */}
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">
                  مراجعة الحجز 
                </h1>
                <p className="mt-2 text-[14px] text-[#6b5a3b]">
                  ارفعوا مستندات الهوية والرخصة، ثم راجعوا الإضافات وبيانات التواصل. تُرسل الفاتورة إلى بريدكم
                  بعد الدفع.
                </p>
              </div>

              {/* KYC — هوية / جواز + رخصة */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#f4f0ea] text-[#dbb878]">
                    1
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">الهوية والرخصة</h2>
                </div>
                <p className="text-[13px] font-semibold leading-relaxed text-[#6b5a3b]">
                  صورة بطاقة الهوية أو الجواز <span className="text-red-600">إلزامية</span> — صورة الرخصة اختيارية.
                </p>

                <div className="rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIdDocKind("CITIZEN");
                        setKycFieldError(null);
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${
                        idDocKind === "CITIZEN"
                          ? "bg-[#003749] text-white ring-2 ring-[#dbb878]/50"
                          : "border border-[#ebe4d3] bg-[#fdfbf6] text-[#003749] hover:border-[#dbb878]/40"
                      }`}
                    >
                      مواطن سعودي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIdDocKind("RESIDENT_VISITOR");
                        setKycFieldError(null);
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${
                        idDocKind === "RESIDENT_VISITOR"
                          ? "bg-[#003749] text-white ring-2 ring-[#dbb878]/50"
                          : "border border-[#ebe4d3] bg-[#fdfbf6] text-[#003749] hover:border-[#dbb878]/40"
                      }`}
                    >
                      مقيم / زائر
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {idDocKind === "CITIZEN" ? (
                      <div className="group relative sm:col-span-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={10}
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          id="checkout-national-id"
                          className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                          placeholder=" "
                          dir="ltr"
                        />
                        <label
                          htmlFor="checkout-national-id"
                          className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                        >
                          رقم الهوية الوطنية (10 أرقام)
                        </label>
                      </div>
                    ) : (
                      <div className="group relative sm:col-span-2">
                        <input
                          type="text"
                          autoComplete="off"
                          value={passportNumber}
                          onChange={(e) =>
                            setPassportNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 24))
                          }
                          id="checkout-passport"
                          className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                          placeholder=" "
                          dir="ltr"
                        />
                        <label
                          htmlFor="checkout-passport"
                          className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                        >
                          رقم الجواز
                        </label>
                      </div>
                    )}

                    <div className="group relative sm:col-span-2">
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value.slice(0, 64))}
                        id="checkout-license-no"
                        className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                        placeholder=" "
                        dir="ltr"
                      />
                      <label
                        htmlFor="checkout-license-no"
                        className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                      >
                        {idDocKind === "CITIZEN" ? "رقم رخصة القيادة" : "رقم الرخصة الدولية"}
                      </label>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="checkout-license-expiry"
                        className="mb-1.5 block text-[13px] font-bold text-[#003749]"
                      >
                        تاريخ انتهاء الرخصة
                        <span className="text-red-600"> *</span>
                      </label>
                      <input
                        id="checkout-license-expiry"
                        type="date"
                        required
                        value={licenseExpiryYmd}
                        onChange={(e) => setLicenseExpiryYmd(e.target.value)}
                        min={rentalLastDayYmdForLicense ?? undefined}
                        className="w-full rounded-xl border border-[#ebe4d3] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#ebe4d3] bg-[#fdfbf6] p-4">
                      <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[#003749]">
                        <UserRound className="size-4 text-[#dbb878]" aria-hidden />
                        صورة الهوية أو الجواز
                        <span className="text-red-600">*</span>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="block w-full text-[12px] font-semibold text-[#6b5a3b] file:me-3 file:rounded-lg file:border-0 file:bg-[#003749] file:px-3 file:py-2 file:text-[12px] file:font-bold file:text-white"
                        disabled={uploadingKyc !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void uploadKycImage(f, "id");
                        }}
                      />
                      {uploadingKyc === "id" ? (
                        <p className="mt-2 text-[11px] font-bold text-[#aaa08e]">جاري الرفع…</p>
                      ) : null}
                      {idCardUrl ? (
                        <div className="relative mt-3 aspect-[16/10] w-full max-w-[220px] overflow-hidden rounded-lg border border-[#ebe4d3] bg-white">
                          <Image src={idCardUrl} alt="" fill className="object-cover" sizes="220px" unoptimized />
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-dashed border-[#dbb878]/50 bg-[#fffdf9] p-4">
                      <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[#003749]">
                        <FileImage className="size-4 text-[#dbb878]" aria-hidden />
                        صورة الرخصة
                        <span className="text-[11px] font-bold text-[#aaa08e]">(اختياري)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="block w-full text-[12px] font-semibold text-[#6b5a3b] file:me-3 file:rounded-lg file:border-0 file:bg-[#003749]/90 file:px-3 file:py-2 file:text-[12px] file:font-bold file:text-white"
                        disabled={uploadingKyc !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void uploadKycImage(f, "license");
                        }}
                      />
                      {uploadingKyc === "license" ? (
                        <p className="mt-2 text-[11px] font-bold text-[#aaa08e]">جاري الرفع…</p>
                      ) : null}
                      {licenseDocUrl ? (
                        <div className="relative mt-3 aspect-[16/10] w-full max-w-[220px] overflow-hidden rounded-lg border border-[#ebe4d3] bg-white">
                          <Image src={licenseDocUrl} alt="" fill className="object-cover" sizes="220px" unoptimized />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {kycFieldError ? (
                    <p className="mt-4 text-[13px] font-bold text-red-600" role="alert">
                      {kycFieldError}
                    </p>
                  ) : null}
                </div>
              </section>

              {/* Addons Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#f4f0ea] text-[#dbb878]">
                    2
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">إضافات وتأمين (اختياري)</h2>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {addons.length === 0 ? (
                    <div className="col-span-2 rounded-2xl border border-dashed border-[#ebe4d3] bg-white p-8 text-center">
                      <p className="text-[14px] font-semibold text-[#aaa08e]">لا توجد إضافات متاحة لهذه المركبة.</p>
                    </div>
                  ) : (
                    addons.map((a) => {
                      const on = selected.has(a.id);
                      return (
                        <label
                          key={a.id}
                          className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_8px_24px_-10px_rgba(219,184,120,0.25)] ${
                            on
                              ? "border-[#dbb878] bg-[#fefdfb] shadow-[0_0_0_1px_rgba(219,184,120,0.5)]"
                              : "border-[#ebe4d3] bg-white hover:border-[#dbb878]/50"
                          }`}
                        >
                          {/* Native hidden checkbox to make label click work */}
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => toggleAddon(a.id)}
                          />

                          {/* Selection indicator */}
                          <div
                            className={`absolute start-4 top-4 flex size-5 items-center justify-center rounded border transition-colors ${
                              on ? `border-[${GOLD}] bg-[${GOLD}]` : "border-[#d1ccbf] bg-white group-hover:border-[#dbb878]"
                            }`}
                            style={{ backgroundColor: on ? GOLD : undefined, borderColor: on ? GOLD : undefined }}
                          >
                            {on && <Check className="size-3.5 text-white stroke-[3]" />}
                          </div>

                          <div className="mb-4 ps-8">
                            <div className="mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-[#f4f0ea]/60 text-[#003749] transition-colors group-hover:bg-[#f4f0ea]">
                              <AddonVisual iconKey={a.iconKey} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-extrabold text-[#003749]">{a.titleAr}</span>
                              {a.descriptionAr && (
                                <div className="group/tooltip relative">
                                  <CircleHelp className="size-4 text-[#aaa08e] hover:text-[#dbb878]" />
                                  <div className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-lg bg-[#003749] p-2 text-center text-[11px] leading-tight text-white opacity-0 transition-opacity duration-200 group-hover/tooltip:opacity-100">
                                    {a.descriptionAr}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-auto flex items-end justify-between border-t border-[#f0ebe4] pt-4">
                            <div className="flex flex-col">
                              <span className="text-[16px] font-extrabold tracking-wide text-[#003749] tabular-nums" dir="ltr">
                                {formatSarAmount(a.pricePerDay)} <SarCurrencyGlyph />
                              </span>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaa08e]">
                                يومياً
                              </span>
                            </div>
                            <div
                              className={`text-[12px] font-bold transition-colors ${
                                on ? "text-[#dbb878]" : "text-[#aaa08e] group-hover:text-[#003749]"
                              }`}
                            >
                              {on ? "تم الإختيار" : "إضافة"}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Installment Options Banner */}
              <section className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-[#ebe4d3] bg-white p-4 shadow-sm">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#f4f0ea] text-[#003749]">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-[#003749]">قسّمها على 4 دفعات</h3>
                    <p className="text-[11px] font-semibold text-[#aaa08e]">متوفر عبر تابي وتمارا بدون فوائد</p>
                  </div>
                </div>
              </section>

              {/* Customer Details Form */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#f4f0ea] text-[#dbb878]">
                    3
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">بيانات التواصل</h2>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-sm sm:p-8"
                >
                  {sessionCustomer ? (
                    <div className="mb-8 rounded-2xl border border-[#ebe4d3] bg-[#fdfbf6] p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#dbb878]/20 text-[#dbb878]">
                          <CheckCircle2 className="size-6" />
                        </div>
                        <div>
                          <p className="text-[15px] font-extrabold text-[#003749]">{sessionCustomer.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-[#8a7752]">
                            <span dir="ltr">+966 {sessionCustomer.phoneLocal}</span>
                            <span className="hidden opacity-40 sm:inline">•</span>
                            <span dir="ltr">{sessionCustomer.email}</span>
                          </div>
                        </div>
                      </div>
                      <input type="hidden" name="name" value={sessionCustomer.name} />
                      <input type="hidden" name="phone" value={sessionCustomer.phoneLocal} />
                      <input type="hidden" name="age" value="25-35" />
                      <input type="hidden" name="email" value={sessionCustomer.email} />
                    </div>
                  ) : (
                    <div className="mb-8 grid gap-5 sm:grid-cols-2">
                       {/* Name Field */}
                      <div className="group relative">
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          minLength={3}
                          autoComplete="name"
                          className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                          placeholder=" "
                        />
                        <label
                          htmlFor="name"
                          className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                        >
                          الاسم الكامل
                        </label>
                      </div>

                      {/* Phone Field */}
                      <div className="group relative">
                        <div className="flex w-full overflow-hidden rounded-xl border border-[#ebe4d3] transition-all focus-within:border-[#dbb878] focus-within:ring-1 focus-within:ring-[#dbb878]">
                          <span className="flex items-center bg-[#fdfbf6] px-3 border-e border-[#ebe4d3] text-[13px] font-bold text-[#003749]" dir="ltr">
                            +966
                          </span>
                          <div className="relative flex-1">
                            <input
                              type="tel"
                              name="phone"
                              id="phone"
                              required
                              pattern="5[0-9]{8}"
                              maxLength={9}
                              inputMode="numeric"
                              autoComplete="tel-national"
                              className="peer w-full bg-transparent px-4 pb-2 pt-6 text-[14px] font-semibold text-[#003749] outline-none"
                              placeholder=" "
                              dir="ltr"
                            />
                            <label
                              htmlFor="phone"
                              className="absolute end-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                            >
                              رقم الجوال (5XXXXXXXX)
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Age Field */}
                      <div className="group relative sm:col-span-2">
                         <select
                          name="age"
                          id="age"
                          required
                          defaultValue="25-35"
                          className="peer w-full appearance-none rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                        >
                          <option value="25-35">25-35 سنة</option>
                          <option value="35-50">35-50 سنة</option>
                          <option value="50+">أكبر من 50 سنة</option>
                        </select>
                        <label
                          htmlFor="age"
                          className="absolute start-4 top-1 text-[10px] font-bold text-[#aaa08e] transition-all peer-focus:text-[#dbb878]"
                        >
                          الفئة العمرية
                        </label>
                        <ChevronDown className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-[#aaa08e]" />
                      </div>

                      <div className="group relative sm:col-span-2">
                        <input
                          type="email"
                          name="email"
                          id="checkout-email"
                          required
                          autoComplete="email"
                          className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                          placeholder=" "
                          dir="ltr"
                        />
                        <label
                          htmlFor="checkout-email"
                          className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                        >
                          البريد الإلكتروني (لإرسال الفاتورة)
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Terms Checkbox */}
                  <div className="mb-8 flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        name="terms"
                        id="terms"
                        required
                        className="peer size-5 cursor-pointer appearance-none rounded border-2 border-[#ebe4d3] bg-white transition-colors checked:border-[#dbb878] checked:bg-[#dbb878]"
                      />
                      <Check className="pointer-events-none absolute size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                    </div>
                    <label htmlFor="terms" className="cursor-pointer text-[13px] font-semibold text-[#6b5a3b] select-none">
                      أوافق على <Link href="/terms" className="text-[#dbb878] hover:underline" target="_blank">الشروط والأحكام</Link> وسياسة التأجير.
                    </label>
                  </div>

                  {/* Status Messages */}
                  {availability?.loading && (
                    <div className="mb-6 text-[13px] font-bold text-[#aaa08e]">
                      جاري التحقق من التوفر في الأسطول...
                    </div>
                  )}
                  {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] font-bold text-red-700" role="alert">
                      {error}
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={pending || slotBlocked || !trip.pickupIso || uploadingKyc !== null}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                      boxShadow: "0 8px 24px -6px rgba(219,184,120,0.5)",
                    }}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
                    <span className="text-[15px] font-extrabold text-white tracking-wide">
                      {pending ? "جاري المعالجة..." : "تأكيد الطلب والدفع"}
                    </span>
                  </button>
                </form>
              </section>
            </div>

            {/* ─── Sidebar (Checkout Summary) ─── */}
            <aside className="order-1 lg:order-2">
              <div className="sticky top-24 overflow-hidden rounded-3xl border border-[#ebe4d3] bg-white shadow-[0_24px_60px_-20px_rgba(15,61,71,0.12)]">
                {/* Car Image Area */}
                <div className="relative aspect-[16/10] bg-gradient-to-br from-[#fdfbf6] to-[#f4f0ea]">
                  <Image
                    src={car.image}
                    alt={car.alt}
                    fill
                    className="object-contain p-6 drop-shadow-xl"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                  <div className="absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#003749] backdrop-blur-sm shadow-sm ring-1 ring-black/5">
                    {car.categoryTitle}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-6">
                  <h2 className="text-xl font-extrabold leading-tight text-[#003749]">
                    {car.fullTitle}
                  </h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#8a7752]">أو مركبة مشابهة من نفس الفئة</p>

                  <div className="mt-3 rounded-xl border border-[#ebe4d3] bg-[#fdfbf6] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-[#5c4d38]">
                    {rentalPriceDisplayMode === "INCLUSIVE" ? (
                      <p dir="ltr" className="text-end">
                        السعر اليومي المرجعي:{" "}
                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(
                            dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                          )}{" "}
                          <SarCurrencyGlyph />
                        </span>{" "}
                        <span className="text-[#8a7752]">(شامل الضريبة {car.vatRatePercent}%)</span>
                      </p>
                    ) : rentalPriceDisplayMode === "SPLIT" ? (
                      <div className="space-y-1.5" dir="ltr">
                        <p className="text-end">
                          قبل الضريبة:{" "}
                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                          </span>
                        </p>
                        <p className="text-end">
                          بعد الضريبة ({car.vatRatePercent}%):{" "}
                          <span className="font-extrabold text-[#003749]">
                            {formatSarAmount(
                              dailyRentalInclTaxSar(car.pricePerDayExclTax, car.vatRatePercent),
                            )}{" "}
                            <SarCurrencyGlyph />
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p dir="ltr" className="text-end">
                        السعر اليومي المرجعي:{" "}
                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                        </span>{" "}
                        <span className="text-[#8a7752]">(غير شامل الضريبة)</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-6 space-y-5">
                    {/* Dates block */}
                    <div className="relative ps-5">
                      <div className="absolute bottom-1.5 start-1.5 top-1.5 w-0.5 rounded-full bg-gradient-to-b from-[#dbb878] to-[#003749]/20" />
                      
                      <div className="relative mb-4">
                        <div className="absolute -start-[23px] top-1 size-2.5 rounded-full border-2 border-[#dbb878] bg-white ring-4 ring-white" />
                        <p className="text-[11px] font-bold uppercase text-[#aaa08e]">الاستلام</p>
                        <p className="font-extrabold text-[#003749]">{trip.pickupLabel}</p>
                        <p className="text-[12px] font-semibold text-[#8a7752]" dir="ltr">
                          {pu.date} {pu.time ? `• ${pu.time}` : ""}
                        </p>
                      </div>

                      <div className="relative">
                        <div className="absolute -start-[23px] top-1 size-2.5 rounded-full border-2 border-[#003749] bg-white ring-4 ring-white" />
                        <p className="text-[11px] font-bold uppercase text-[#aaa08e]">التسليم</p>
                        <p className="font-extrabold text-[#003749]">{trip.returnLabel}</p>
                        <p className="text-[12px] font-semibold text-[#8a7752]" dir="ltr">
                          {du.date} {du.time ? `• ${du.time}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="my-6 border-t border-dashed border-[#ebe4d3]" />

                    {/* Pricing Breakdown */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-semibold text-[#6b5a3b]">
                          الإيجار ({trip.days} أيام)
                        </span>
                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.rentalExclTax)} <SarCurrencyGlyph />
                        </span>
                      </div>
                      
                      {selectedRows.length > 0 && (
                        <div className="flex justify-between text-[13px]">
                          <span className="font-semibold text-[#6b5a3b]">
                            الإضافات ({trip.days} أيام)
                          </span>
                          <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(totals.addonsExclTax)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      )}

                      {interCityShippingFeeSar > 0 && interCityShippingLabelAr ? (
                        <div className="flex justify-between text-[13px]">
                          <span className="max-w-[60%] text-end text-[12px] font-semibold leading-snug text-[#6b5a3b]">
                            {interCityShippingLabelAr}
                          </span>
                          <span className="shrink-0 font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(interCityShippingFeeSar)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ) : null}

                      {checkoutOneTimeFees.map((f) => (
                        <div key={f.slug} className="flex justify-between text-[13px]">
                          <span className="max-w-[60%] text-end text-[12px] font-semibold leading-snug text-[#6b5a3b]">
                            {f.labelAr}
                          </span>
                          <span className="shrink-0 font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(f.feeExclVatSar)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ))}

                      <div className="flex justify-between text-[13px]">
                        <span className="font-semibold text-[#6b5a3b]">ضريبة القيمة المضافة ({car.vatRatePercent}%)</span>
                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.vatAmount)} <SarCurrencyGlyph />
                        </span>
                      </div>
                    </div>

                    {/* Total Row */}
                    <div className="mt-4 rounded-2xl bg-[#003749] p-5 text-white shadow-inner">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">المجموع النهائي</p>
                          <p className="text-[11px] text-white/50">شامل الضريبة</p>
                        </div>
                        <div className="text-end">
                          <p
                            className="text-2xl font-extrabold tabular-nums tracking-tight"
                            dir="ltr"
                            aria-label={`${formatSarAmount(totals.totalInclTax)} ريال سعودي`}
                          >
                            {formatSarAmount(totals.totalInclTax)}{" "}
                            <span className="text-[#dbb878]" aria-hidden>
                              <SarCurrencyGlyph />
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
      <SiteFooter />

      <CarUnavailableModal
        open={showCarUnavailableModal}
        onClose={() => {
          setUnavailableDismissed(true);
          setPostCapacityModal(false);
        }}
        onChangeDates={() => {
          router.replace(`/fleet/checkout?modelId=${car.modelId}`);
        }}
      />
    </div>
  );
}
