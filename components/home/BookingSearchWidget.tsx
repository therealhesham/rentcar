"use client";

import {
  Building2,
  CalendarDays,
  CalendarRange,
  Car,
  CalendarClock,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  Search,
  Send,
  Truck,
  ChevronDown,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { submitCorporateBookingLead } from "@/app/corporate-lead-actions";
import { BranchOutsideHoursModal } from "@/components/fleet/BranchOutsideHoursModal";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import {
  DeliveryOriginCityLabelSuffix,
  useDeliveryOriginCity,
} from "@/components/home/DeliveryOriginCityHint";
import {
  CityBranchSelectPair,
  PickupReturnBranchFields,
} from "@/components/home/PickupReturnBranchFields";
import { SubscriptionPackagesInWidget } from "@/components/subscriptions/SubscriptionPackagesInWidget";
import { DdMmYyDateWithPicker } from "@/components/ui/DdMmYyDateWithPicker";
import { computeBookingDays } from "@/lib/booking-days";
import {
  composeDatetimeLocal,
  computeAutoDropoff,
  computeDaysPreview,
  draftFromDatetimeLocal,
  parseDdMmYyToYmd,
  rentalDropoffHint,
  toDatetimeLocalValue,
  validateRentalMinDays,
  formatYmdAsDdMmYy,
  type ModeTab,
  type RentalTab,
} from "@/lib/booking-search-shared";
import { fleetDatetimesFromSubscriptionPack } from "@/lib/subscription-fleet-bridge";
import {
  MAX_SUBSCRIPTION_DURATION_MONTHS,
  MIN_SUBSCRIPTION_DURATION_MONTHS,
} from "@/lib/subscriptions/duration-options";
import type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";
import { lookupBranchOpeningSchedule } from "@/lib/booking-branch-schedule-lookup";
import { isDateTimeWithinBranchSchedule } from "@/lib/branch-opening-hours";
import type { FleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import { citySlugForBranchSlug } from "@/lib/fleet-search-url-hydrate";
import {
  DEFAULT_BOOKING_WIDGET_TAB_FLAGS,
  type BookingWidgetTabFlags,
} from "@/lib/booking-widget-tabs";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";

type SearchRentalTab = RentalTab | "corporate";

function isRentalTabEnabled(f: BookingWidgetTabFlags, r: SearchRentalTab): boolean {
  switch (r) {
    case "daily":
      return f.rentalDaily;
    case "weekly":
      return f.rentalWeekly;
    case "monthly":
      return f.rentalMonthly;
    case "monthly_packages":
      return f.rentalMonthlyPackages;
    case "corporate":
      return f.rentalCorporate;
    default:
      return true;
  }
}

function todayYmdLocalForPack(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

/** زر تحديد موقع التوصيل — يُستخدم في أكثر من مسار داخل الـ widget */
const DELIVERY_MAP_TRIGGER_CLASS =
  "group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-[#c9a356]/50 bg-gradient-to-l from-white/90 to-[#fdfbf6]/80 px-3 py-2.5 text-start outline-none shadow-sm transition-[border-color,box-shadow,transform,background-color] hover:border-[#dbb878] hover:bg-[#fffdf8] hover:shadow-md active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#dbb878]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf6]";


export function BookingSearchWidget({
  cities,
  initialFromUrl,
  tabFlags,
}: {
  cities: BookingCityBranchesOption[];
  /** من `/fleet?pickup=…` — يُطبَّق بعد التحميل */
  initialFromUrl?: FleetSearchUrlHydrate | null;
  /** من الإدارة — التبويبات المعطّلة لا تُعرض */
  tabFlags?: BookingWidgetTabFlags | null;
}) {
  const router = useRouter();
  const [rental, setRental] = useState<SearchRentalTab>("daily");
  const [mode, setMode] = useState<ModeTab>("pickup");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupBranch, setPickupBranch] = useState("");
  const [returnCity, setReturnCity] = useState("");
  const [returnBranch, setReturnBranch] = useState("");
  const [returnLocationDifferent, setReturnLocationDifferent] = useState(false);
  const [pickupDt, setPickupDt] = useState("");
  const [dropoffDt, setDropoffDt] = useState("");
  const [pickupDateDraft, setPickupDateDraft] = useState("");
  const [pickupTimeDraft, setPickupTimeDraft] = useState("09:00");
  const [dropoffDateDraft, setDropoffDateDraft] = useState("");
  const [dropoffTimeDraft, setDropoffTimeDraft] = useState("09:00");
  const [subPackMonths, setSubPackMonths] = useState(3);
  const [subPackStartYmd, setSubPackStartYmd] = useState(todayYmdLocalForPack);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState("");
  const [deliveryOriginCitySlug, setDeliveryOriginCitySlug] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchHoursNotice, setBranchHoursNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);
  const [corpCompanyName, setCorpCompanyName] = useState("");
  const [corpEmail, setCorpEmail] = useState("");
  const [corpTaxNumber, setCorpTaxNumber] = useState("");
  const [corpDetails, setCorpDetails] = useState("");
  const [corpPhone, setCorpPhone] = useState("");
  const [corpSuccess, setCorpSuccess] = useState(false);
  const [corpPending, startCorpTransition] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<ModeTab>("pickup");
  const uid = useId();

  const tabFlagsEff = useMemo(
    () => tabFlags ?? DEFAULT_BOOKING_WIDGET_TAB_FLAGS,
    [tabFlags],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  /* eslint-disable react-hooks/set-state-in-effect -- مزامنة rental/mode مع إعدادات الإدارة */
  useEffect(() => {
    const f = tabFlagsEff;
    const order: SearchRentalTab[] = [
      "daily",
      "weekly",
      "monthly",
      "monthly_packages",
      "corporate",
    ];
    if (!isRentalTabEnabled(f, rental)) {
      const next = order.find((r) => isRentalTabEnabled(f, r));
      if (next) setRental(next);
      return;
    }
    if (rental === "corporate") return;
    if (mode === "pickup" && !f.modePickup && f.modeDelivery) {
      setMode("delivery");
    } else if (mode === "delivery" && !f.modeDelivery && f.modePickup) {
      setMode("pickup");
    }
  }, [tabFlagsEff, rental, mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mode !== "delivery") {
      setDeliveryAddressText("");
      setDeliveryLat(null);
      setDeliveryLng(null);
    }
  }, [mode]);

  useEffect(() => {
    if (rental !== "corporate") {
      setCorpSuccess(false);
    }
  }, [rental]);

  useEffect(() => {
    if (rental === "daily" || rental === "monthly_packages" || rental === "corporate") return;
    if (!pickupDt.trim()) return;
    const p = new Date(pickupDt);
    if (Number.isNaN(p.getTime())) return;
    const auto = computeAutoDropoff(p, rental);
    if (!auto) return;
    setDropoffDt(toDatetimeLocalValue(auto));
  }, [rental, pickupDt]);

  useEffect(() => {
    const { dateDdMmYy, hm } = draftFromDatetimeLocal(pickupDt);
    setPickupDateDraft(dateDdMmYy);
    setPickupTimeDraft(hm);
  }, [pickupDt]);

  useEffect(() => {
    const { dateDdMmYy, hm } = draftFromDatetimeLocal(dropoffDt);
    setDropoffDateDraft(dateDdMmYy);
    setDropoffTimeDraft(hm);
  }, [dropoffDt]);

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

  const deliveryOriginCity = useDeliveryOriginCity({
    cities: dateCities,
    deliveryLat,
    deliveryLng,
    fallbackCitySlug: returnCityEff || defaultCitySlug,
    detectedSlug: deliveryOriginCitySlug || returnCityEff || defaultCitySlug,
    onDetectedSlugChange: setDeliveryOriginCitySlug,
  });

  const deliveryLocationLabel = (
    <>
      موقع التوصيل
      <DeliveryOriginCityLabelSuffix
        cityName={deliveryOriginCity.cityNameAr}
        show={mode === "delivery" && deliveryOriginCity.showInLabel}
      />
    </>
  );

  const defaultPickupBranchSlug = pickupCityBranches[0]?.slug ?? "";
  const defaultReturnBranchSlug = returnCityBranches[0]?.slug ?? "";

  const fleetHydrateKey = useMemo(
    () => (initialFromUrl ? JSON.stringify(initialFromUrl) : ""),
    [initialFromUrl],
  );

  /* لقطة معاملات `/fleet` من الخادم → حالة النموذج (تهيئة لمرة عند تغيّر المفتاح) */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!initialFromUrl || !fleetHydrateKey) return;

    const u = initialFromUrl;
    const r = u.rental;
    if (r === "daily" || r === "weekly" || r === "monthly" || r === "monthly_packages" || r === "corporate") {
      setRental(r);
    }

    let effectiveMode: ModeTab | undefined;
    if (u.mode === "pickup" || u.mode === "delivery") {
      effectiveMode = u.mode;
    } else if ((u.dlat && u.dlng) || (u.daddr && u.daddr.trim().length > 0)) {
      effectiveMode = "delivery";
    }
    if (effectiveMode) {
      setMode(effectiveMode);
    }
    if (effectiveMode === "pickup") {
      setDeliveryLat(null);
      setDeliveryLng(null);
      setDeliveryAddressText("");
    }

    if (r !== "corporate" && dateCities.length > 0) {
      if (u.pickupBranch) {
        const city = citySlugForBranchSlug(dateCities, u.pickupBranch);
        if (city) {
          setPickupCity(city);
          setPickupBranch(u.pickupBranch);
        }
      } else if (
        effectiveMode === "pickup" &&
        u.pickupCity &&
        dateCities.some((c) => c.slug === u.pickupCity)
      ) {
        setPickupCity(u.pickupCity);
      }

      if (u.returnBranch) {
        const retCity = citySlugForBranchSlug(dateCities, u.returnBranch);
        if (retCity) {
          setReturnCity(retCity);
          setReturnBranch(u.returnBranch);
        }
        const pb = u.pickupBranch?.trim().toLowerCase();
        const rb = u.returnBranch.trim().toLowerCase();
        if (effectiveMode === "pickup" && rb && (!pb || pb !== rb)) {
          setReturnLocationDifferent(true);
        }
      }
    }

    if (effectiveMode === "delivery") {
      if (u.dlat && u.dlng) {
        const lat = Number(u.dlat);
        const lng = Number(u.dlng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setDeliveryLat(lat);
          setDeliveryLng(lng);
        }
      }
      if (u.daddr) setDeliveryAddressText(u.daddr);
      if (u.pickupCity && dateCities.some((c) => c.slug === u.pickupCity)) {
        setDeliveryOriginCitySlug(u.pickupCity);
      }
    }

    if (r !== "corporate") {
      if (u.pickup) setPickupDt(u.pickup);
      if (u.dropoff) setDropoffDt(u.dropoff);
    }
  }, [fleetHydrateKey, initialFromUrl, dateCities]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (prevModeRef.current !== "delivery" && mode === "delivery") {
      const ret = returnCity || defaultCitySlug;
      setDeliveryOriginCitySlug((s) => s || ret || defaultCitySlug);
    }
    prevModeRef.current = mode;
  }, [mode, returnCity, defaultCitySlug]);

  const branchSelectRequired = dateCities.some((c) => c.branches.length > 0);
  const pickupBranchEffective =
    mode === "pickup" ? pickupBranch || defaultPickupBranchSlug : "";
  const returnBranchEffective =
    mode === "pickup" && !returnLocationDifferent
      ? pickupBranchEffective
      : returnBranch || defaultReturnBranchSlug;

  const daysPreview = useMemo(() => {
    if (rental === "corporate") return null;
    if (rental === "monthly_packages") {
      const r = fleetDatetimesFromSubscriptionPack(subPackStartYmd, subPackMonths);
      if (!r) return null;
      return computeDaysPreview(r.pickupDt, r.dropoffDt);
    }
    return computeDaysPreview(pickupDt, dropoffDt);
  }, [rental, subPackStartYmd, subPackMonths, pickupDt, dropoffDt]);

  function handleReturnLocationDifferentChange(checked: boolean) {
    setReturnLocationDifferent(checked);
    if (checked) {
      setReturnCity(pickupCity || defaultCitySlug);
      setReturnBranch(pickupBranch || defaultPickupBranchSlug);
    }
  }

  function handlePickupCityChange(slug: string) {
    setPickupCity(slug);
    const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
    const branch = list[0]?.slug ?? "";
    setPickupBranch(branch);
    if (!returnLocationDifferent) {
      setReturnCity(slug);
      setReturnBranch(branch);
    }
  }

  function handlePickupBranchChange(slug: string) {
    setPickupBranch(slug);
    if (!returnLocationDifferent) {
      setReturnBranch(slug);
    }
  }

  const pickupBranchFieldsProps = {
    uidPrefix: uid,
    dateCities,
    defaultCitySlug,
    branchSelectRequired,
    pickupCity,
    pickupBranch,
    defaultPickupBranchSlug,
    returnCity,
    returnBranch,
    defaultReturnBranchSlug,
    returnLocationDifferent,
    onReturnLocationDifferentChange: handleReturnLocationDifferentChange,
    onPickupCityChange: handlePickupCityChange,
    onPickupBranchChange: handlePickupBranchChange,
    onReturnCityChange: (slug: string) => {
      setReturnCity(slug);
      const list = dateCities.find((c) => c.slug === slug)?.branches ?? [];
      setReturnBranch(list[0]?.slug ?? "");
    },
    onReturnBranchChange: setReturnBranch,
  };

  const returnBranchId = `${uid}-return-branch`;
  const deliveryReturnCityId = `${uid}-delivery-return-city`;
  const pickupDtId = `${uid}-pickup-dt`;
  const pickupTimeId = `${uid}-pickup-time`;
  const dropoffDtId = `${uid}-dropoff-dt`;
  const dropoffTimeId = `${uid}-dropoff-time`;
  const corpNameId = `${uid}-corp-name`;
  const corpEmailId = `${uid}-corp-email`;
  const corpTaxId = `${uid}-corp-tax`;
  const corpDetailsId = `${uid}-corp-details`;
  const corpPhoneId = `${uid}-corp-phone`;

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
    setBranchHoursNotice(null);

    if (rental === "corporate") {
      setCorpSuccess(false);
      const fd = new FormData();
      fd.set("companyName", corpCompanyName);
      fd.set("companyEmail", corpEmail);
      fd.set("taxNumber", corpTaxNumber);
      fd.set("details", corpDetails);
      fd.set("phone", corpPhone);
      startCorpTransition(async () => {
        const res = await submitCorporateBookingLead(null, fd);
        if (!res.ok) {
          setError(res.error ?? "تعذّر إرسال الطلب.");
          return;
        }
        setCorpSuccess(true);
        setCorpCompanyName("");
        setCorpEmail("");
        setCorpTaxNumber("");
        setCorpDetails("");
        setCorpPhone("");
      });
      return;
    }

    let effPickupDt = pickupDt;
    let effDropoffDt = dropoffDt;
    if (rental === "monthly_packages") {
      if (
        !Number.isInteger(subPackMonths) ||
        subPackMonths < MIN_SUBSCRIPTION_DURATION_MONTHS ||
        subPackMonths > MAX_SUBSCRIPTION_DURATION_MONTHS
      ) {
        setError(
          `أدخل عدد أشهر الباقة بين ${MIN_SUBSCRIPTION_DURATION_MONTHS} و${MAX_SUBSCRIPTION_DURATION_MONTHS}.`,
        );
        return;
      }
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
      if (mode === "delivery" || returnLocationDifferent) {
        if (!returnBranchEffective) {
          setError(
            mode === "delivery"
              ? "اختر فرع التسليم (إرجاع المركبة)."
              : "اختر فرع الإرجاع.",
          );
          return;
        }
      }
    }

    if (mode === "delivery") {
      const mapOk = deliveryLat != null && deliveryLng != null;
      if (!mapOk) {
        setError("حدّد موقع التوصيل على الخريطة.");
        return;
      }
    }

    if (mode === "pickup" && pickupBranchEffective) {
      const sch = lookupBranchOpeningSchedule(dateCities, pickupBranchEffective);
      if (!isDateTimeWithinBranchSchedule(pickupDate, sch)) {
        setBranchHoursNotice({
          title: "فرع الاستلام غير متاح",
          message:
            "فرع الاستلام غير متاح في وقت الاستلام المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.",
        });
        return;
      }
    }
    if (returnBranchEffective) {
      const schR = lookupBranchOpeningSchedule(dateCities, returnBranchEffective);
      if (!isDateTimeWithinBranchSchedule(dropoffDate, schR)) {
        setBranchHoursNotice({
          title: "فرع التسليم غير متاح",
          message:
            "فرع التسليم غير متاح في وقت التسليم المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.",
        });
        return;
      }
    }

    const params = new URLSearchParams();
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

    const originCityForFee =
      mode === "pickup"
        ? pickupCityEff
        : deliveryOriginCitySlug || returnCityEff || defaultCitySlug;
    if (originCityForFee) {
      params.set("pickupCity", originCityForFee);
    }

    const pickupDateYmd = effPickupDt.slice(0, 10);

    const deliveryAddrNorm =
      mode === "delivery"
        ? deliveryAddressText.trim().replace(/\s+/g, " ")
        : "";

    const ctx: StoredFleetSearchContext = {
      rental,
      mode,
      pickupBranch: mode === "pickup" ? pickupBranchEffective : undefined,
      returnBranch: returnBranchEffective,
      pickupCitySlug: originCityForFee,
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
        .booking-card {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .booking-field-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
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
          box-shadow: 0 4px 16px -4px rgba(219, 184, 120, 0.45);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -6px rgba(219, 184, 120, 0.55);
        }
        .cta-btn:active {
          transform: translateY(0);
        }
        .cta-shimmer {
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .cta-btn:hover .cta-shimmer {
          opacity: 1;
          animation: shimmer 2.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .booking-card {
            animation: none !important;
          }
          .booking-field-card:hover {
            transform: none;
          }
          .cta-btn {
            box-shadow: 0 2px 8px -2px rgba(219, 184, 120, 0.35);
          }
          .cta-btn:hover {
            transform: none;
          }
          .cta-shimmer {
            display: none;
          }
        }
      `}</style>

      <form
        ref={formRef}
        onSubmit={handleSearch}
        dir="rtl"
        className={`booking-card relative z-0 w-full overflow-visible rounded-2xl bg-white/[0.97] shadow-[0_28px_72px_-20px_rgba(15,61,71,0.18),0_8px_24px_-6px_rgba(15,61,71,0.07)] ring-1 ring-black/[0.03] backdrop-blur-xl ${
          mounted ? "" : "opacity-0"
        }`}
      >
        {/* ═══════════════════════════════════════
            SECTION 1: Tab Header
        ═══════════════════════════════════════ */}
        <div className="relative">
          {/* Subtle gradient background for the tabs */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fdfbf6] to-white" />

          <div className="relative flex flex-col">
            {/* مدة الإيجار + حجز الشركات (بجوار الباقات الشهرية) */}
            <div className="border-b border-[#f0ebe4]">
              <div
                className="flex w-full flex-wrap items-center gap-1 p-2 sm:p-1.5"
                role="tablist"
                aria-label="نوع الحجز"
              >
                {tabFlagsEff.rentalDaily ? (
                  <PillTab
                    active={rental === "daily"}
                    onClick={() => setRental("daily")}
                    icon={<Car className="size-3.5 shrink-0" />}
                    label="يومي"
                  />
                ) : null}
                {tabFlagsEff.rentalWeekly ? (
                  <PillTab
                    active={rental === "weekly"}
                    onClick={() => setRental("weekly")}
                    icon={<CalendarDays className="size-3.5 shrink-0" />}
                    label="أسبوعي"
                  />
                ) : null}
                {tabFlagsEff.rentalMonthly ? (
                  <PillTab
                    active={rental === "monthly"}
                    onClick={() => setRental("monthly")}
                    icon={<CalendarRange className="size-3.5 shrink-0" />}
                    label="شهري"
                  />
                ) : null}
                {tabFlagsEff.rentalMonthlyPackages ? (
                  <PillTab
                    active={rental === "monthly_packages"}
                    onClick={() => setRental("monthly_packages")}
                    icon={<Layers className="size-3.5 shrink-0" />}
                    label="الباقات الشهرية"
                  />
                ) : null}
                {tabFlagsEff.rentalCorporate ? (
                  <PillTab
                    active={rental === "corporate"}
                    onClick={() => setRental("corporate")}
                    icon={<Building2 className="size-3.5 shrink-0" />}
                    label="حجز الشركات"
                  />
                ) : null}
              </div>
            </div>

            {rental !== "corporate" &&
            (tabFlagsEff.modePickup || tabFlagsEff.modeDelivery) ? (
              <div className="border-b border-[#f0ebe4] bg-[#fcfaf7]/40">
                <div
                  className="flex w-full flex-wrap items-center gap-1 p-2 sm:p-1.5"
                  role="tablist"
                  aria-label="طريقة الاستلام"
                >
                  {tabFlagsEff.modePickup ? (
                    <PillTab
                      active={mode === "pickup"}
                      onClick={() => setMode("pickup")}
                      icon={<PackageCheck className="size-3.5 shrink-0" />}
                      label="استلام من الفرع"
                      tone="teal"
                    />
                  ) : null}
                  {tabFlagsEff.modeDelivery ? (
                    <PillTab
                      active={mode === "delivery"}
                      onClick={() => setMode("delivery")}
                      icon={<Truck className="size-3.5 shrink-0" />}
                      label="توصيل لموقعي"
                      tone="teal"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            SECTION 2: Form Fields Grid
        ═══════════════════════════════════════ */}
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          {rental === "corporate" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-[#ebe4d3]/70 bg-[#fdfbf6] p-4"
              role="group"
              aria-label="بيانات حجز الشركات"
            >
              <p className="text-[11px] font-bold leading-relaxed text-[#6b5a3b]">
                املأ البيانات التالية؛ سيتواصل فريقنا معكم بعد مراجعة الطلب.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={corpNameId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    اسم الشركة
                  </label>
                  <input
                    id={corpNameId}
                    name="companyName"
                    value={corpCompanyName}
                    onChange={(ev) => setCorpCompanyName(ev.target.value)}
                    autoComplete="organization"
                    required
                    maxLength={255}
                    className="mt-0.5 w-full rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                    placeholder="مثال: شركة … للتجارة"
                  />
                </div>
                <div>
                  <label
                    htmlFor={corpEmailId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    البريد الإلكتروني للشركة
                  </label>
                  <input
                    id={corpEmailId}
                    name="companyEmail"
                    type="email"
                    inputMode="email"
                    value={corpEmail}
                    onChange={(ev) => setCorpEmail(ev.target.value)}
                    autoComplete="email"
                    required
                    maxLength={255}
                    dir="ltr"
                    className="mt-0.5 w-full rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                    placeholder="info@company.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor={corpTaxId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    الرقم الضريبي
                  </label>
                  <input
                    id={corpTaxId}
                    name="taxNumber"
                    value={corpTaxNumber}
                    onChange={(ev) => setCorpTaxNumber(ev.target.value)}
                    required
                    maxLength={64}
                    dir="ltr"
                    className="mt-0.5 w-full rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                    placeholder="15 رقماً أو حسب السجل"
                  />
                </div>
                <div>
                  <label
                    htmlFor={corpPhoneId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    جوال التواصل
                  </label>
                  <input
                    id={corpPhoneId}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={corpPhone}
                    onChange={(ev) => setCorpPhone(ev.target.value)}
                    autoComplete="tel"
                    required
                    maxLength={32}
                    dir="ltr"
                    className="mt-0.5 w-full rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-semibold text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={corpDetailsId}
                  className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                >
                  تفاصيل الطلب
                </label>
                <textarea
                  id={corpDetailsId}
                  name="details"
                  value={corpDetails}
                  onChange={(ev) => setCorpDetails(ev.target.value)}
                  required
                  rows={4}
                  maxLength={8000}
                  dir="rtl"
                  className="mt-0.5 w-full resize-y rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-medium text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                  placeholder="عدد المركبات، المدة، المدينة، أي متطلبات خاصة…"
                />
                <p className="mt-1 text-[9px] font-medium text-[#8a7752]/90">
                  لا يقل عن 10 أحرف — بحد أقصى 8000 حرف.
                </p>
              </div>
              {corpSuccess ? (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-[12px] font-bold text-emerald-800"
                >
                  تم استلام طلبكم بنجاح. سيتواصل معكم فريق المبيعات قريباً.
                </p>
              ) : null}
            </div>
          ) : rental === "monthly_packages" ? (
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
                  {mode === "pickup" ? "موقع الاستلام" : "التوصيل وموقع الإرجاع"}
                </p>
                {mode === "pickup" ? (
                  <div className="rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3">
                    <PickupReturnBranchFields {...pickupBranchFieldsProps} />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-bold uppercase tracking-wide text-[#003749]/55">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 text-[#dbb878]" aria-hidden />
                          {deliveryLocationLabel}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setMapOpen(true)}
                        className={DELIVERY_MAP_TRIGGER_CLASS}
                        aria-haspopup="dialog"
                        aria-expanded={mapOpen}
                      >
                        <DeliveryMapTriggerContent
                          hasLocation={deliveryLat != null && deliveryLng != null}
                        />
                      </button>
                    </div>
                    <div className="rounded-xl border border-[#ebe4d3]/60 bg-white/50 p-3">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/55">
                        فرع إرجاع المركبة
                      </p>
                      <CityBranchSelectPair
                        cityId={deliveryReturnCityId}
                        branchId={returnBranchId}
                        dateCities={dateCities}
                        citySlug={returnCity}
                        branchSlug={returnBranch}
                        defaultCitySlug={defaultCitySlug}
                        defaultBranchSlug={defaultReturnBranchSlug}
                        branchSelectRequired={branchSelectRequired}
                        onCityChange={pickupBranchFieldsProps.onReturnCityChange}
                        onBranchChange={pickupBranchFieldsProps.onReturnBranchChange}
                      />
                    </div>
                  </>
                )}
              </div>
            </SubscriptionPackagesInWidget>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="col-span-1 flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-stretch lg:col-span-2">
                  {mode === "pickup" ? (
                    <div className="min-w-0 flex-1">
                      <FieldCard
                        groupLabelId={`${uid}-field-pickup`}
                        label="موقع الاستلام"
                        icon={<MapPin className="size-3.5" />}
                      >
                        <PickupReturnBranchFields
                          {...pickupBranchFieldsProps}
                          hidePickupTitle
                        />
                      </FieldCard>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <FieldCard
                          groupLabelId={`${uid}-field-pickup`}
                          label={deliveryLocationLabel}
                          icon={<MapPin className="size-3.5" />}
                        >
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setMapOpen(true)}
                              className={DELIVERY_MAP_TRIGGER_CLASS}
                              aria-haspopup="dialog"
                              aria-expanded={mapOpen}
                            >
                              <DeliveryMapTriggerContent
                                hasLocation={deliveryLat != null && deliveryLng != null}
                              />
                            </button>
                          </div>
                        </FieldCard>
                      </div>
                      <div className="min-w-0 flex-1">
                        <FieldCard
                          groupLabelId={`${uid}-field-return`}
                          label="موقع الإرجاع"
                          icon={<MapPin className="size-3.5" />}
                        >
                          <CityBranchSelectPair
                            cityId={deliveryReturnCityId}
                            branchId={returnBranchId}
                            dateCities={dateCities}
                            citySlug={returnCity}
                            branchSlug={returnBranch}
                            defaultCitySlug={defaultCitySlug}
                            defaultBranchSlug={defaultReturnBranchSlug}
                            branchSelectRequired={branchSelectRequired}
                            onCityChange={pickupBranchFieldsProps.onReturnCityChange}
                            onBranchChange={pickupBranchFieldsProps.onReturnBranchChange}
                          />
                        </FieldCard>
                      </div>
                    </>
                  )}
                </div>

                <FieldCard
                  layout="inline"
                  groupLabelId={`${uid}-field-pickup-dt`}
                  label="تاريخ الاستلام"
                  icon={<CalendarClock className="size-3.5" />}
                  controlHtmlFor={pickupDtId}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <DdMmYyDateWithPicker
                      id={pickupDtId}
                      rowClassName="items-center"
                      value={pickupDateDraft}
                      onChange={(ev) => setPickupDateDraft(ev.target.value)}
                      onBlur={() => {
                        if (!pickupDateDraft.trim()) {
                          setPickupDt("");
                          return;
                        }
                        const ymd = parseDdMmYyToYmd(pickupDateDraft);
                        if (!ymd) {
                          if (pickupDt) {
                            const { dateDdMmYy, hm } = draftFromDatetimeLocal(pickupDt);
                            setPickupDateDraft(dateDdMmYy);
                            setPickupTimeDraft(hm);
                          }
                          return;
                        }
                        setPickupDateDraft(formatYmdAsDdMmYy(ymd));
                        const c = composeDatetimeLocal(ymd, pickupTimeDraft);
                        if (c) setPickupDt(c);
                      }}
                      nativeYmd={pickupDt.length >= 10 ? pickupDt.slice(0, 10) : ""}
                      onCalendarSelect={(ymd) => {
                        setPickupDateDraft(formatYmdAsDdMmYy(ymd));
                        const c = composeDatetimeLocal(ymd, pickupTimeDraft);
                        if (c) setPickupDt(c);
                      }}
                      required
                    />
                    <input
                      id={pickupTimeId}
                      type="time"
                      value={pickupTimeDraft}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        setPickupTimeDraft(v);
                        let ymd = parseDdMmYyToYmd(pickupDateDraft);
                        if (!ymd && pickupDt.length >= 10) ymd = pickupDt.slice(0, 10);
                        if (!ymd) return;
                        const c = composeDatetimeLocal(ymd, v);
                        if (c) setPickupDt(c);
                      }}
                      required
                      dir="ltr"
                      aria-label="وقت الاستلام"
                      className="w-full cursor-pointer rounded-md border border-[#ebe4d3]/80 bg-white/80 px-2 py-1 text-[13px] font-semibold tabular-nums text-[#0f1923] outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]/30"
                    />
                  </div>
                </FieldCard>

                <FieldCard
                  layout="inline"
                  groupLabelId={`${uid}-field-dropoff-dt`}
                  label="تاريخ  التسليم"
                  icon={<Clock className="size-3.5" />}
                  hint={rentalDropoffHint(rental)}
                  controlHtmlFor={dropoffDtId}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <DdMmYyDateWithPicker
                      id={dropoffDtId}
                      rowClassName="items-center"
                      value={dropoffDateDraft}
                      readOnly={rental !== "daily"}
                      onChange={(ev) => setDropoffDateDraft(ev.target.value)}
                      onBlur={() => {
                        if (rental !== "daily") return;
                        if (!dropoffDateDraft.trim()) {
                          setDropoffDt("");
                          return;
                        }
                        const ymd = parseDdMmYyToYmd(dropoffDateDraft);
                        if (!ymd) {
                          if (dropoffDt) {
                            const { dateDdMmYy, hm } = draftFromDatetimeLocal(dropoffDt);
                            setDropoffDateDraft(dateDdMmYy);
                            setDropoffTimeDraft(hm);
                          }
                          return;
                        }
                        setDropoffDateDraft(formatYmdAsDdMmYy(ymd));
                        const c = composeDatetimeLocal(ymd, dropoffTimeDraft);
                        if (c) setDropoffDt(c);
                      }}
                      nativeYmd={dropoffDt.length >= 10 ? dropoffDt.slice(0, 10) : ""}
                      onCalendarSelect={(ymd) => {
                        if (rental !== "daily") return;
                        setDropoffDateDraft(formatYmdAsDdMmYy(ymd));
                        const c = composeDatetimeLocal(ymd, dropoffTimeDraft);
                        if (c) setDropoffDt(c);
                      }}
                      required
                      inputClassName={rental !== "daily" ? "cursor-default" : ""}
                    />
                    <input
                      id={dropoffTimeId}
                      type="time"
                      value={dropoffTimeDraft}
                      readOnly={rental !== "daily"}
                      onChange={(ev) => {
                        if (rental !== "daily") return;
                        const v = ev.target.value;
                        setDropoffTimeDraft(v);
                        let ymd = parseDdMmYyToYmd(dropoffDateDraft);
                        if (!ymd && dropoffDt.length >= 10) ymd = dropoffDt.slice(0, 10);
                        if (!ymd) return;
                        const c = composeDatetimeLocal(ymd, v);
                        if (c) setDropoffDt(c);
                      }}
                      required
                      dir="ltr"
                      aria-label="وقت التسليم"
                      className={`w-full rounded-md border border-[#ebe4d3]/80 bg-white/80 px-2 py-1 text-[13px] font-semibold tabular-nums text-[#0f1923] outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]/30 ${rental !== "daily" ? "cursor-default opacity-90" : "cursor-pointer"}`}
                      aria-readonly={rental !== "daily"}
                    />
                  </div>
                </FieldCard>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            SECTION 3: CTA + Info Footer
        ═══════════════════════════════════════ */}
        <div className="border-t border-[#f0ebe4] bg-gradient-to-b from-[#fdfbf6] to-[#f9f5ee] px-4 py-3 sm:px-5">
          {/* CTA row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Duration badge + helper text */}
            <div className="flex flex-1 items-center gap-3" aria-live="polite">
              {rental === "corporate" ? (
                <span className="text-[11px] font-medium leading-snug text-[#6b5a3b]">
                  لا يُحتسب البحث في الأسطول — طلب تواصل لحجوزات الشركات والعقود.
                </span>
              ) : daysPreview != null ? (
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
                  {rental === "monthly_packages"
                    ? "تُشتق مدة البحث من يوم بدء الباقة ومدة الاشتراك أعلاه"
                    : "حدّد التواريخ لعرض مدة الحجز"}
                </span>
              )}
            </div>

            {/* Search / submit button */}
            <button
              type="submit"
              disabled={
                corpPending || (rental !== "corporate" && dateCities.length === 0)
              }
              className="cta-btn group relative flex min-h-[2.75rem] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-2.5 text-white disabled:pointer-events-none disabled:opacity-45 sm:min-h-0 sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              }}
            >
              {/* shimmer overlay */}
              <span
                className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                aria-hidden
              />
              {rental === "corporate" ? (
                <>
                  <Send className="size-4 shrink-0" aria-hidden />
                  <span className="text-[14px] font-extrabold tracking-wide">
                    {corpPending ? "جاري الإرسال…" : "إرسال طلب التواصل"}
                  </span>
                </>
              ) : (
                <>
                  <Search className="size-4 shrink-0" aria-hidden />
                  <span className="text-[14px] font-extrabold tracking-wide">
                    بحث 
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Bottom info row */}
          <div className="mt-3 flex flex-col gap-2 border-t border-[#ebe4d3]/60 pt-3 sm:mt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-2">
            <p className="text-[10px] leading-relaxed text-[#aaa08e] sm:max-w-[58%]">
              {rental === "corporate"
                ? "البيانات تُستخدم للتواصل فقط — لا يتم تأكيد حجز آلياً من هذه الخطوة."
                : "يُعرض المتوفر للحجز المباشر حسب الفترة المحددة"}
            </p>
            {rental === "corporate" ? (
              <span className="text-[10.5px] font-bold text-[#6b5a3b] sm:text-end">
                فريق المبيعات يتابع الطلبات خلال أوقات العمل
              </span>
            ) : (
            <Link
              href="/fleet"
              className="shrink-0 text-[10.5px] font-bold text-[#003749] underline-offset-4 transition-colors hover:text-[#dbb878] hover:underline sm:text-end"
              style={{ textDecorationColor: GOLD }}
            >
              احجز الآن
            </Link>
            )}
          </div>
        </div>

        {/* No branches */}
        {dateCities.length === 0 && rental !== "corporate" && (
          <div className="border-t border-red-100 bg-red-50/60 px-4 py-2 text-center text-[11px] font-medium text-red-600">
            لا توجد مدن نشطة بفروع مفعّلة. أضف مدناً وفروعاً من لوحة الإدارة.
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="flex items-start gap-2 border-t border-red-200 bg-gradient-to-l from-red-50 to-red-50/50 px-4 py-3 pe-2 text-[12px] font-semibold text-red-800 sm:items-center sm:py-2.5"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mt-0">
              <span className="size-2 rounded-full bg-red-500" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 leading-snug">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-red-600/80 outline-none transition-colors hover:bg-red-100/90 hover:text-red-800 focus-visible:ring-2 focus-visible:ring-red-400/50"
              aria-label="إغلاق التنبيه"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </form>

      <BranchOutsideHoursModal
        open={branchHoursNotice != null}
        title={branchHoursNotice?.title}
        message={branchHoursNotice?.message ?? ""}
        onClose={() => setBranchHoursNotice(null)}
        onChangeTimes={() => {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

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

function DeliveryMapTriggerContent({ hasLocation }: { hasLocation: boolean }) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
        {hasLocation ? (
          <>
            <span className="flex items-center gap-2 text-[13px] font-bold text-[#0f3d47]">
              <span
                className="flex size-5 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200/50"
                aria-hidden
              >
                <span className="size-2 rounded-full bg-emerald-500" />
              </span>
              تم تحديد الموقع
            </span>
            <span className="max-w-[20rem] pe-1 text-[10px] font-medium leading-snug text-[#6b5a3b]">
              اضغط لتعديل الموقع على الخريطة
            </span>
          </>
        ) : (
          <>
            <span className="text-[13px] font-bold text-[#0f1923]">تحديد موقع التوصيل</span>
            <span className="max-w-[20rem] pe-1 text-[10px] font-medium leading-snug text-[#8a7752]">
              افتح الخريطة وحدّد النقطة بدقّة لعرض المركبات المتاحة
            </span>
          </>
        )}
      </div>
      <MapPin
        className="size-5 shrink-0 text-[#dbb878] opacity-85 transition-[transform,opacity] duration-200 group-hover:scale-105 group-hover:opacity-100"
        aria-hidden
      />
    </>
  );
}

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
      className={`flex min-h-[2.75rem] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-bold outline-none transition-[color,transform,box-shadow,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#fdfbf6] sm:min-h-[2.5rem] ${
        isGold
          ? "focus-visible:ring-[#dbb878]/80"
          : "focus-visible:ring-[#003749]/45"
      } ${active ? "" : "hover:bg-black/[0.04] active:scale-[0.99]"}`}
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
  layout = "stacked",
}: {
  groupLabelId: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  controlHtmlFor?: string;
  layout?: "stacked" | "inline";
}) {
  const titleClass =
    "flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55";

  const titleNode = controlHtmlFor ? (
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
  );

  if (layout === "inline") {
    return (
      <div
        role="group"
        aria-labelledby={groupLabelId}
        className="booking-field-card flex h-full min-h-[3.25rem] items-center gap-3 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3 sm:min-h-[3.5rem]"
      >
        <span className="flex shrink-0 flex-col justify-center gap-0.5">
          {titleNode}
          {hint ? (
            <span className="text-[9px] font-medium leading-snug text-[#8a7752]/90">{hint}</span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="booking-field-card flex flex-col gap-1.5 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3"
    >
      <span className="flex flex-col gap-0.5">
        {titleNode}
        {hint ? (
          <span className="text-[9px] font-medium leading-snug text-[#8a7752]/90">{hint}</span>
        ) : null}
      </span>
      <div className="min-h-[1.25rem]">{children}</div>
    </div>
  );
}

