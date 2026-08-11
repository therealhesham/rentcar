"use client";

import {
  Building2,
  CalendarDays,
  CalendarRange,
  Car,
  CalendarCheck2,
  CalendarClock,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  Search,
  Send,
  Truck,
  ChevronDown,
  Check,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { LocationPickerPopover } from "@/components/home/LocationPickerPopover";
import { DatePickerPopover } from "@/components/home/DatePickerPopover";
import { DateRangePickerPopover } from "@/components/home/DateRangePickerPopover";
import { TimePickerPopover } from "@/components/home/TimePickerPopover";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { submitCorporateBookingLead } from "@/app/corporate-lead-actions";
import { BranchOutsideHoursModal } from "@/components/fleet/BranchOutsideHoursModal";
import { DeliveryMapDialog } from "@/components/home/DeliveryMapDialog";
import {
  DeliveryOriginCityLabelSuffix,
  useDeliveryOriginCity,
} from "@/components/home/DeliveryOriginCityHint";
import { resolveCityCenter } from "@/lib/delivery-origin-city";
import { GroupedBranchSelect } from "@/components/home/GroupedBranchSelect";
import { PickupReturnBranchFields } from "@/components/home/PickupReturnBranchFields";
import { SubscriptionPackagesInWidget } from "@/components/subscriptions/SubscriptionPackagesInWidget";
import { DdMmYyDateWithPicker } from "@/components/ui/DdMmYyDateWithPicker";
import { TimeInput24h } from "@/components/ui/TimeInput24h";
import {
  computeBookingDays,
  DROPOFF_AFTER_PICKUP_ERROR_AR,
  isDropoffAfterPickup,
} from "@/lib/booking-days";
import {
  composeDatetimeLocal,
  computeAutoDropoff,
  computeDaysPreview,
  computeDailyDurationPreview,
  draftFromDatetimeLocal,
  parseDdMmYyToYmd,
  rentalDropoffHint,
  resolveDropoffTimeHm,
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

/** أقصى عدد أيام يُزحزح بها تاريخ التسليم المحسوب بحثاً عن يوم عمل للفرع */
const MAX_DROPOFF_SHIFT_DAYS = 14;

/**
 * تاريخ التسليم المحسوب تلقائياً (أسبوعي/شهري) قد يقع في يوم إجازة للفرع، فيُزاح
 * إلى أقرب يوم عمل — الأقرب زمنياً أولاً وقبله الأبكر عند التساوي، حتى لا تطول
 * المدة بلا داعٍ، مع البقاء فوق الحد الأدنى لأيام التبويب.
 * إن لم يوجد يوم مناسب خلال أسبوعين يعود الموعد الأصلي كما هو.
 */
function nearestDropoffWithinSchedule(
  pickup: Date,
  at: Date,
  rental: RentalTab,
  schedule: Parameters<typeof isDateTimeWithinBranchSchedule>[1],
): Date {
  for (let step = 0; step <= MAX_DROPOFF_SHIFT_DAYS; step += 1) {
    for (const offset of step === 0 ? [0] : [-step, step]) {
      const candidate = new Date(at.getTime());
      candidate.setDate(candidate.getDate() + offset);
      if (!isDropoffAfterPickup(pickup, candidate)) continue;
      if (validateRentalMinDays(rental, computeBookingDays(pickup, candidate))) continue;
      if (isDateTimeWithinBranchSchedule(candidate, schedule)) return candidate;
    }
  }
  return at;
}

function todayYmdLocalForPack(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function branchLineAr(cities: BookingCityBranchesOption[], branchSlug: string): string {
  const s = branchSlug.trim().toLowerCase();
  for (const c of cities) {
    const b = c.branches.find((x) => x.slug.toLowerCase() === s);
    if (b) return `${c.name}، ${b.name}`;
  }
  return branchSlug;
}

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

export type BookingSearchWidgetVariant = "search" | "checkout";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

/** مهلة قصيرة بعد آخر تعديل قبل تشغيل البحث التلقائي */
const AUTO_SEARCH_DEBOUNCE_MS = 500;

/** المعاملات التي تُحدِّد نتيجة البحث — لمقارنة الحالة الحالية بالرابط */
const FLEET_SEARCH_SIGNATURE_KEYS = [
  "pickup",
  "dropoff",
  "rental",
  "mode",
  "days",
  "pickupBranch",
  "returnBranch",
  "dlat",
  "dlng",
  "daddr",
  "pickupCity",
] as const;

function fleetSearchSignature(sp: { get(name: string): string | null }): string {
  return FLEET_SEARCH_SIGNATURE_KEYS.map((k) => `${k}=${sp.get(k) ?? ""}`).join("&");
}


export function BookingSearchWidget({
  cities,
  initialFromUrl,
  tabFlags,
  variant = "search",
  checkoutModelId,
  combinedPanel = false,
}: {
  cities: BookingCityBranchesOption[];
  /** من `/fleet?pickup=…` — يُطبَّق بعد التحميل */
  initialFromUrl?: FleetSearchUrlHydrate | null;
  /** من الإدارة — التبويبات المعطّلة لا تُعرض */
  tabFlags?: BookingWidgetTabFlags | null;
  variant?: "search" | "checkout";
  /** مطلوب عند variant=checkout */
  checkoutModelId?: number;
  /** بطاقة `/fleet` الموحّدة مع الفلاتر */
  combinedPanel?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("ReservationForm");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const urlSp = useSearchParams();
  const isCheckout = variant === "checkout";
  const prefillBookingRequestIdRaw = isCheckout
    ? urlSp.get("prefillBookingRequestId")?.trim() ?? ""
    : "";
  const excludeBookingRequestIdRaw = isCheckout
    ? urlSp.get("excludeBookingRequestId")?.trim() ?? ""
    : "";
  const isFreshRebookFlow =
    isCheckout &&
    urlSp.get("rebook") === "1" &&
    /^\d+$/.test(prefillBookingRequestIdRaw) &&
    !/^\d+$/.test(excludeBookingRequestIdRaw);
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

  // ── Popover open states ──
  const [pickupLocOpen, setPickupLocOpen] = useState(false);
  const [returnLocOpen, setReturnLocOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateRangeAnchor, setDateRangeAnchor] = useState<"pickup" | "dropoff">("pickup");
  const [pickupDateOpen, setPickupDateOpen] = useState(false);
  const [pickupTimeOpen, setPickupTimeOpen] = useState(false);
  const [dropoffTimeOpen, setDropoffTimeOpen] = useState(false);

  // ── Anchor refs for popover positioning ──
  const pickupLocRef = useRef<HTMLDivElement>(null);
  const returnLocRef = useRef<HTMLDivElement>(null);
  const pickupDateRef = useRef<HTMLButtonElement>(null);
  const dropoffDateRef = useRef<HTMLButtonElement>(null);
  const pickupTimeRef = useRef<HTMLButtonElement>(null);
  const dropoffTimeRef = useRef<HTMLButtonElement>(null);

  const tabFlagsEff = useMemo(() => {
    const base = tabFlags ?? DEFAULT_BOOKING_WIDGET_TAB_FLAGS;
    if (isCheckout) {
      return { ...base, rentalCorporate: false };
    }
    return base;
  }, [tabFlags, isCheckout]);

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

  const deliverySelected = deliveryLat != null && deliveryLng != null;
  const deliveryAddressSnippet = deliveryAddressText.trim();

  /** مركز افتتاح الخريطة عند غياب موقع محدَّد — مدينة الفرع بدل مركز الرياض دائماً. */
  const deliveryFallbackCenter = useMemo(() => {
    const slug = deliveryOriginCitySlug || returnCityEff || defaultCitySlug;
    const city = dateCities.find((c) => c.slug === slug);
    return city ? resolveCityCenter(city) : null;
  }, [dateCities, deliveryOriginCitySlug, returnCityEff, defaultCitySlug]);

  const deliveryLocationLabel = (
    <>
      {t("deliveryLocation")}
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
  const pickupBranchEffective = pickupBranch;
  const returnBranchEffective =
    !returnLocationDifferent
      ? pickupBranchEffective
      : returnBranch;

  /* مواعيد الفرع — لعرض الأوقات المسموح بها فقط في منتقي الوقت */
  const pickupTimeBranchSchedule = useMemo(
    () =>
      mode === "pickup" && pickupBranchEffective
        ? lookupBranchOpeningSchedule(dateCities, pickupBranchEffective)
        : null,
    [mode, pickupBranchEffective, dateCities],
  );
  const dropoffTimeBranchSchedule = useMemo(
    () =>
      returnBranchEffective
        ? lookupBranchOpeningSchedule(dateCities, returnBranchEffective)
        : null,
    [returnBranchEffective, dateCities],
  );

  /* أسبوعي/شهري: تاريخ التسليم محسوب من تاريخ الاستلام، ويُزحزح للأمام إن وقع
     خارج مواعيد فرع الإرجاع — وإلا يفشل التحقق ولا يعمل البحث التلقائي إطلاقاً. */
  useEffect(() => {
    if (rental === "daily" || rental === "monthly_packages" || rental === "corporate") return;
    if (!pickupDt.trim()) return;
    const p = new Date(pickupDt);
    if (Number.isNaN(p.getTime())) return;
    const auto = computeAutoDropoff(p, rental);
    if (!auto) return;
    setDropoffDt(
      toDatetimeLocalValue(
        tabFlagsEff.allowHolidayBooking
          ? auto
          : nearestDropoffWithinSchedule(p, auto, rental, dropoffTimeBranchSchedule),
      ),
    );
  }, [rental, pickupDt, dropoffTimeBranchSchedule, tabFlagsEff.allowHolidayBooking]);

  const freshRebookLocationSummaryAr = useMemo(() => {
    if (!isFreshRebookFlow) return "";
    if (mode === "delivery") {
      const addr = deliveryAddressText.trim();
      const mapOk = deliveryLat != null && deliveryLng != null;
      const ret = returnBranchEffective
        ? `إرجاع المركبة: ${branchLineAr(dateCities, returnBranchEffective)}`
        : "";
      if (mapOk && addr) {
        const short = addr.length > 140 ? `${addr.slice(0, 140)}…` : addr;
        return `توصيل (تم تحديد الموقع على الخريطة). ${short}${ret ? ` — ${ret}` : ""}`;
      }
      if (mapOk) return `توصيل (موقع على الخريطة)${ret ? ` — ${ret}` : ""}`;
      if (addr) {
        const short = addr.length > 160 ? `${addr.slice(0, 160)}…` : addr;
        return `توصيل: ${short}${ret ? ` — ${ret}` : ""}`;
      }
      return ret || "توصيل";
    }
    const pick = pickupBranchEffective
      ? `الاستلام: ${branchLineAr(dateCities, pickupBranchEffective)}`
      : "الاستلام من الفرع";
    const ret = returnBranchEffective
      ? `الإرجاع: ${branchLineAr(dateCities, returnBranchEffective)}`
      : "";
    return ret ? `${pick} — ${ret}` : pick;
  }, [
    isFreshRebookFlow,
    mode,
    dateCities,
    deliveryAddressText,
    deliveryLat,
    deliveryLng,
    returnBranchEffective,
    pickupBranchEffective,
  ]);

  function closeSchedulePopovers() {
    setDateRangeOpen(false);
    setPickupDateOpen(false);
    setPickupTimeOpen(false);
    setDropoffTimeOpen(false);
  }

  function applyPickupDateFromDraft(dateDdMmYy: string) {
    const ymd = parseDdMmYyToYmd(dateDdMmYy);
    if (!ymd) return;
    const c = composeDatetimeLocal(ymd, pickupTimeDraft);
    if (c) setPickupDt(c);
  }

  function applyDateRange(startDdMmYy: string, endDdMmYy: string) {
    const startYmd = parseDdMmYyToYmd(startDdMmYy);
    const endYmd = parseDdMmYyToYmd(endDdMmYy);
    if (!startYmd || !endYmd) return;
    // تسليم في نفس يوم الاستلام ⇒ ادفع الوقت للأمام حتى لا يتطابق الموعدان
    const dropoffHm = resolveDropoffTimeHm(startYmd, endYmd, pickupTimeDraft, dropoffTimeDraft);
    if (dropoffHm !== dropoffTimeDraft) setDropoffTimeDraft(dropoffHm);
    const pickup = composeDatetimeLocal(startYmd, pickupTimeDraft);
    const dropoff = composeDatetimeLocal(endYmd, dropoffHm);
    if (pickup) setPickupDt(pickup);
    if (dropoff) setDropoffDt(dropoff);
  }

  function applyPickupDateOnly(dateDdMmYy: string) {
    applyPickupDateFromDraft(dateDdMmYy);
    if (rental !== "daily") {
      const startYmd = parseDdMmYyToYmd(dateDdMmYy);
      const endYmd = dropoffDt.slice(0, 10);
      if (startYmd && endYmd && endYmd < startYmd) {
        setDropoffDt("");
      }
      return;
    }
    // اختيار تاريخ الذهاب يُعيد بدء النطاق ⇒ يُختار تاريخ الإياب من جديد،
    // والتقويم ينتقل أسفل حقل «تاريخ التسليم» حتى لا يلتبس على المستخدم
    setDropoffDt("");
    setDateRangeAnchor("dropoff");
  }

  function toggleDateRange(anchor: "pickup" | "dropoff") {
    setPickupLocOpen(false);
    setReturnLocOpen(false);
    setPickupDateOpen(false);
    setPickupTimeOpen(false);
    setDropoffTimeOpen(false);
    if (dateRangeOpen && dateRangeAnchor === anchor) {
      setDateRangeOpen(false);
      return;
    }
    setDateRangeAnchor(anchor);
    setDateRangeOpen(true);
  }

  const dateRangeActiveRef = dateRangeAnchor === "pickup" ? pickupDateRef : dropoffDateRef;

  function applyPickupTime(hm: string) {
    setPickupTimeDraft(hm);
    const ymd = pickupDt.slice(0, 10);
    if (ymd) {
      const c = composeDatetimeLocal(ymd, hm);
      if (c) setPickupDt(c);
    }
    // تغيير وقت الاستلام قد يجعله مطابقاً/لاحقاً لوقت التسليم في نفس اليوم
    const dropYmd = dropoffDt.slice(0, 10);
    const nextDropoffHm = resolveDropoffTimeHm(
      ymd || pickupDt.slice(0, 10),
      dropYmd,
      hm,
      dropoffTimeDraft,
    );
    if (nextDropoffHm !== dropoffTimeDraft) {
      setDropoffTimeDraft(nextDropoffHm);
      const c = composeDatetimeLocal(dropYmd, nextDropoffHm);
      if (c) setDropoffDt(c);
    }
  }

  function applyDropoffTime(hm: string) {
    setDropoffTimeDraft(hm);
    const ymd = dropoffDt.slice(0, 10);
    if (ymd) {
      const c = composeDatetimeLocal(ymd, hm);
      if (c) setDropoffDt(c);
    }
  }

  /* التسليم في نفس يوم الاستلام ⇒ لا تُعرض أوقات تسبق وقت الاستلام أو تطابقه */
  const dropoffMinExclusiveHm =
    pickupDt.slice(0, 10) && pickupDt.slice(0, 10) === dropoffDt.slice(0, 10)
      ? pickupTimeDraft
      : null;

  const durationBadgeLabel = useMemo(() => {
    if (rental === "corporate") return null;
    if (rental === "monthly_packages") {
      const r = fleetDatetimesFromSubscriptionPack(subPackStartYmd, subPackMonths);
      if (!r) return null;
      const n = computeDaysPreview(r.pickupDt, r.dropoffDt);
      return n != null ? `${n} يوم` : null;
    }
    if (rental === "daily") {
      return computeDailyDurationPreview(pickupDt, dropoffDt);
    }
    const n = computeDaysPreview(pickupDt, dropoffDt);
    return n != null ? `${n} يوم` : null;
  }, [rental, subPackStartYmd, subPackMonths, pickupDt, dropoffDt]);

  function handleReturnLocationDifferentChange(checked: boolean) {
    setReturnLocationDifferent(checked);
    if (checked) {
      setReturnCity(pickupCity || defaultCitySlug);
      setReturnBranch(pickupBranch);
      setTimeout(() => {
        returnLocRef.current?.focus();
        setReturnLocOpen(true);
      }, 150);
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

  function handleDeliveryReturnBranch(branch: string, city: string | null) {
    if (city) setReturnCity(city);
    setReturnBranch(branch);
  }

  const returnBranchId = `${uid}-return-branch`;
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
    if (isCheckout && checkoutModelId != null && checkoutModelId >= 1) {
      search.set("modelId", String(checkoutModelId));
      const exId = urlSp.get("excludeBookingRequestId")?.trim();
      if (exId && /^\d+$/.test(exId)) {
        search.set("excludeBookingRequestId", exId);
      }
      const prefillId = urlSp.get("prefillBookingRequestId")?.trim();
      if (prefillId && /^\d+$/.test(prefillId)) {
        search.set("prefillBookingRequestId", prefillId);
      }
      if (urlSp.get("rebook") === "1") {
        search.set("rebook", "1");
      }
      router.replace(`/fleet/checkout?${search.toString()}`);
      return;
    }
    router.push(`/fleet?${search.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBranchHoursNotice(null);

    if (rental === "corporate") {
      if (isCheckout) {
        setError("نوع الإيجار غير متاح في صفحة إتمام الحجز.");
        return;
      }
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

    const built = buildFleetSearch();
    if (!built.ok) {
      if (built.error) setError(built.error);
      if (built.notice) setBranchHoursNotice(built.notice);
      return;
    }

    persistAndNavigate(built.params, built.ctx);
  }

  type BuiltFleetSearch =
    | { ok: true; params: URLSearchParams; ctx: StoredFleetSearchContext }
    | { ok: false; error?: string; notice?: { title: string; message: string } };

  /** التحقق من النموذج وبناء معاملات البحث — يشترك فيه زر البحث والبحث التلقائي. */
  function buildFleetSearch(): BuiltFleetSearch {
    if (rental === "corporate") return { ok: false };
    let effPickupDt = pickupDt;
    let effDropoffDt = dropoffDt;
    if (rental === "monthly_packages") {
      if (
        !Number.isInteger(subPackMonths) ||
        subPackMonths < MIN_SUBSCRIPTION_DURATION_MONTHS ||
        subPackMonths > MAX_SUBSCRIPTION_DURATION_MONTHS
      ) {
        return {
          ok: false,
          error: `أدخل عدد أشهر الباقة بين ${MIN_SUBSCRIPTION_DURATION_MONTHS} و${MAX_SUBSCRIPTION_DURATION_MONTHS}.`,
        };
      }
      const r = fleetDatetimesFromSubscriptionPack(subPackStartYmd, subPackMonths);
      if (!r) {
        return { ok: false, error: "يوم بدء الباقة غير صالح." };
      }
      effPickupDt = r.pickupDt;
      effDropoffDt = r.dropoffDt;
    }

    if (!effPickupDt.trim() || !effDropoffDt.trim()) {
      return {
        ok: false,
        error:
          rental === "monthly_packages"
            ? "تعذّر احتساب التواريخ من يوم بدء الباقة — راجع التاريخ أعلاه."
            : "يرجى تحديد تاريخ ووقت الاستلام والتسليم.",
      };
    }

    const pickupDate = new Date(effPickupDt);
    const dropoffDate = new Date(effDropoffDt);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(dropoffDate.getTime())) {
      return { ok: false, error: "صيغة التاريخ غير صالحة." };
    }
    if (!isDropoffAfterPickup(pickupDate, dropoffDate)) {
      return { ok: false, error: DROPOFF_AFTER_PICKUP_ERROR_AR };
    }

    const days = computeBookingDays(pickupDate, dropoffDate);
    const rentalErr = validateRentalMinDays(rental, days);
    if (rentalErr) {
      return { ok: false, error: rentalErr };
    }

    if (branchSelectRequired) {
      if (!pickupBranchEffective) {
        return {
          ok: false,
          error: mode === "delivery" ? "اختر فرع التوصيل." : "اختر فرع الاستلام.",
        };
      }
      if (returnLocationDifferent && !returnBranchEffective) {
        return { ok: false, error: "اختر فرع الإرجاع." };
      }
    }

    if (mode === "delivery") {
      const mapOk = deliveryLat != null && deliveryLng != null;
      if (!mapOk) {
        return { ok: false, error: "حدّد موقع التوصيل على الخريطة." };
      }
    }

    if (!tabFlagsEff.allowHolidayBooking && mode === "pickup" && pickupBranchEffective) {
      const sch = lookupBranchOpeningSchedule(dateCities, pickupBranchEffective);
      if (!isDateTimeWithinBranchSchedule(pickupDate, sch)) {
        return {
          ok: false,
          notice: {
            title: "فرع الاستلام غير متاح",
            message:
              "فرع الاستلام غير متاح في وقت الاستلام المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.",
          },
        };
      }
    }
    if (!tabFlagsEff.allowHolidayBooking && returnBranchEffective) {
      const schR = lookupBranchOpeningSchedule(dateCities, returnBranchEffective);
      if (!isDateTimeWithinBranchSchedule(dropoffDate, schR)) {
        return {
          ok: false,
          notice: {
            title: "فرع التسليم غير متاح",
            message:
              "فرع التسليم غير متاح في وقت التسليم المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.",
          },
        };
      }
    }

    const params = new URLSearchParams();
    params.set("pickup", effPickupDt);
    params.set("dropoff", effDropoffDt);
    params.set("rental", rental);
    params.set("mode", mode);
    params.set("days", String(days));
    if (pickupBranchEffective) {
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

    return { ok: true, params, ctx };
  }

  /* بحث تلقائي بعد اكتمال البيانات — في بطاقة `/fleet` وصفحة إتمام الحجز فقط،
     والزر يبقى كما هو لمن يفضّل الضغط عليه. */
  const autoSearchEnabled = combinedPanel || isCheckout;
  const lastAutoSearchSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoSearchEnabled || !mounted || rental === "corporate") return;
    const built = buildFleetSearch();
    if (!built.ok) return;
    const sig = fleetSearchSignature(built.params);
    // النتيجة المعروضة حالياً هي نفسها ⇒ لا حاجة لإعادة البحث
    if (sig === lastAutoSearchSigRef.current || sig === fleetSearchSignature(urlSp)) {
      lastAutoSearchSigRef.current = sig;
      return;
    }
    const timer = setTimeout(() => {
      lastAutoSearchSigRef.current = sig;
      setError(null);
      setBranchHoursNotice(null);
      persistAndNavigate(built.params, built.ctx);
    }, AUTO_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoSearchEnabled,
    mounted,
    rental,
    mode,
    pickupDt,
    dropoffDt,
    subPackMonths,
    subPackStartYmd,
    pickupBranchEffective,
    returnBranchEffective,
    returnLocationDifferent,
    deliveryLat,
    deliveryLng,
    deliveryAddressText,
    deliveryOriginCitySlug,
    pickupCityEff,
    returnCityEff,
    urlSp,
  ]);

  // Resolve label for a branch slug
  function branchLabel(slug: string): string {
    for (const city of dateCities) {
      const found = city.branches.find((b) => b.slug === slug);
      if (found) return found.name;
    }
    return "";
  }

  // Resolve map URL for a branch slug
  function branchMapUrl(slug: string): string | null {
    for (const city of dateCities) {
      const found = city.branches.find((b) => b.slug === slug);
      if (found) {
        if (found.mapUrl) return found.mapUrl;
        if (found.lat != null && found.lng != null) {
          return `https://www.google.com/maps/search/?api=1&query=${found.lat},${found.lng}`;
        }
      }
    }
    return null;
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
        /* trigger field button */
        .field-trigger {
          transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
        }
        .field-trigger:hover {
          background: #fffdf8;
          border-color: rgba(219,184,120,0.55);
        }
        .field-trigger[aria-expanded="true"] {
          border-color: #dbb878;
          box-shadow: 0 0 0 3px rgba(219,184,120,0.18);
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
          .search-pill .field-trigger,
          .search-pill .field-trigger:active {
            transform: none !important;
          }
        }
        /* Swipeable rental tabs on mobile — hide the scrollbar */
        .tabs-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .tabs-scroll::-webkit-scrollbar {
          display: none;
        }
        /* ─── Mobile (<640px): elegant grouped field cards ─── */
        @media (max-width: 1279.98px) {
          .search-pill .field-trigger {
            background-color: #ffffff;
            border: 1px solid #efe7d6;
            border-radius: 1rem;
            box-shadow:
              0 1px 2px rgba(0, 55, 73, 0.04),
              0 6px 16px -10px rgba(0, 55, 73, 0.14);
            transition:
              transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.22s ease,
              border-color 0.2s ease,
              background-color 0.2s ease;
            -webkit-tap-highlight-color: transparent;
          }
          .search-pill .field-trigger:active {
            transform: scale(0.98);
            box-shadow: 0 1px 2px rgba(0, 55, 73, 0.05);
            background-color: #fffdf8;
          }
          .search-pill .field-trigger[aria-expanded="true"] {
            border-color: #dbb878;
            box-shadow:
              0 0 0 3px rgba(219, 184, 120, 0.16),
              0 10px 24px -12px rgba(219, 184, 120, 0.45);
            background-color: #fffef9;
          }
          .search-pill .field-trigger:disabled {
            box-shadow: none;
            opacity: 0.6;
          }
        }
        /* ─── Sixt-style elegant pill (desktop only) ───
           Tabs above keep their cream tone; the search bar itself
           becomes a clean white capsule with hair-line dividers. */
        @media (min-width: 1280px) {
          .search-pill {
            background: #ffffff;
            border-radius: 9999px;
            border: 1px solid #ece5d4;
            box-shadow:
              0 18px 44px -16px rgba(0, 55, 73, 0.22),
              0 4px 12px -4px rgba(0, 55, 73, 0.08);
            overflow: hidden;
          }
          /* Strip cream backgrounds from segments + buttons inside the pill */
          .search-pill > div,
          .search-pill > div > div,
          .search-pill .field-trigger {
            background-color: transparent;
          }
          /* Refined hover/active states for the pill segments */
          .search-pill .field-trigger {
            transition:
              background-color 0.2s ease,
              box-shadow 0.2s ease;
          }
          .search-pill .field-trigger:hover {
            background-color: #faf6ec;
            border-color: #ebe4d3;
            box-shadow: none;
          }
          .search-pill .field-trigger[aria-expanded="true"] {
            background-color: #fbf7ea;
            border-color: #ebe4d3;
            box-shadow: inset 0 -2px 0 0 #dbb878;
          }
          /* Slightly more breathing room inside each segment */
          .search-pill .pill-cell {
            padding: 18px 22px;
          }
        }
      `}</style>

      <form
        ref={formRef}
        onSubmit={handleSearch}
        dir={isRtl ? "rtl" : "ltr"}
        className={`booking-card w-full overflow-visible ${
          /* Sticky to viewport on the home search page, EXCEPT in monthly_packages
             & corporate flows (those expand the form and need full scroll access). */
          !combinedPanel &&
          !isCheckout &&
          rental !== "monthly_packages" &&
          rental !== "corporate"
            ? "sticky top-[4.5rem] z-30 sm:top-24"
            : "relative z-0"
        } ${
          combinedPanel
            ? ""
            : "rounded-[1.75rem] bg-gradient-to-br from-[#fdfbf6] via-white to-[#fbf6ea] p-1 shadow-[0_36px_88px_-24px_rgba(0,55,73,0.22),0_12px_28px_-8px_rgba(0,55,73,0.08)] ring-1 ring-[#dbb878]/20 sm:p-2"
        } ${mounted ? "" : "opacity-0"}`}
      >
        {/* Decorative gold hairline at the very top — adds a luxury accent */}
        {!combinedPanel ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-[#dbb878]/60 to-transparent"
            />
            {/* Soft inner glow at the top edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-[1.75rem] bg-gradient-to-b from-white/70 to-transparent"
            />
          </>
        ) : null}

        {/* ═══════════════════════════════════════
            SECTION 1: Quiet options strip (rental type + mode)
            Subtle text-tabs on the right, compact toggle on the left,
            so the pill below remains the visual hero.
        ═══════════════════════════════════════ */}
        {!isFreshRebookFlow ? (
          <div className="flex flex-col gap-2.5 px-3 pt-3 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:px-5 sm:pt-4 sm:pb-4">
            <div
              role="tablist"
              aria-label="نوع الحجز"
              className="tabs-scroll -mx-3 flex items-center gap-x-1 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:gap-x-1.5 sm:gap-y-1 sm:overflow-visible sm:px-0"
            >
              {tabFlagsEff.rentalDaily ? (
                <QuietTab
                  active={rental === "daily"}
                  onClick={() => setRental("daily")}
                  icon={<Car className="size-3 shrink-0" />}
                  label={t("daily")}
                />
              ) : null}
              {tabFlagsEff.rentalWeekly ? (
                <QuietTab
                  active={rental === "weekly"}
                  onClick={() => setRental("weekly")}
                  icon={<CalendarDays className="size-3 shrink-0" />}
                  label={t("weekly")}
                />
              ) : null}
              {tabFlagsEff.rentalMonthly ? (
                <QuietTab
                  active={rental === "monthly"}
                  onClick={() => setRental("monthly")}
                  icon={<CalendarRange className="size-3 shrink-0" />}
                  label={t("monthly")}
                />
              ) : null}
              {tabFlagsEff.rentalMonthlyPackages ? (
                <QuietTab
                  active={rental === "monthly_packages"}
                  onClick={() => setRental("monthly_packages")}
                  icon={<Layers className="size-3 shrink-0" />}
                  label={t("monthlyPackages")}
                />
              ) : null}
              {tabFlagsEff.rentalCorporate ? (
                <QuietTab
                  active={rental === "corporate"}
                  onClick={() => setRental("corporate")}
                  icon={<Building2 className="size-3 shrink-0" />}
                  label={t("corporate")}
                />
              ) : null}
            </div>

            {rental !== "corporate" &&
            (tabFlagsEff.modePickup || tabFlagsEff.modeDelivery) ? (
              <div
                role="tablist"
                aria-label="طريقة الاستلام"
                className="flex items-center gap-0.5 self-start rounded-full border border-[#ebe4d3] bg-white/90 p-0.5 shadow-[0_1px_4px_-1px_rgba(0,55,73,0.08)] sm:self-auto"
              >
                {tabFlagsEff.modePickup ? (
                  <ModeChip
                    active={mode === "pickup"}
                    onClick={() => setMode("pickup")}
                    icon={<PackageCheck className="size-3 shrink-0" />}
                    label={t("pickUp")}
                  />
                ) : null}
                {tabFlagsEff.modeDelivery ? (
                  <ModeChip
                    active={mode === "delivery"}
                    onClick={() => setMode("delivery")}
                    icon={<Truck className="size-3 shrink-0" />}
                    label={t("delivery")}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ═══════════════════════════════════════
            SECTION 2: Form Fields
        ═══════════════════════════════════════ */}
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          {isFreshRebookFlow ? (
            <div className="space-y-4">
              {freshRebookLocationSummaryAr ? (
                <div className="rounded-2xl border border-[#dbb878]/30 bg-gradient-to-br from-[#fffdf9] via-white to-[#fdfbf6] px-4 py-3.5 shadow-sm ring-1 ring-[#dbb878]/10">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#003749]/45">
                    {t("pickupLocation")}
                  </p>
                  <p className="text-[13px] font-bold leading-relaxed text-[#2d4a52]">
                    {freshRebookLocationSummaryAr}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3">
                <div className="relative min-w-0">
                  <button
                    ref={pickupDateRef}
                    type="button"
                    aria-expanded={dateRangeOpen && dateRangeAnchor === "pickup"}
                    aria-haspopup="dialog"
                    onClick={() => toggleDateRange("pickup")}
                    className={`field-trigger relative flex w-full flex-col gap-1 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start focus:outline-none ${dateRangeOpen && dateRangeAnchor === "pickup" ? "ring-2 ring-[#dbb878]/40" : ""}`}
                  >
                    <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                      <CalendarClock className="size-3 text-[#dbb878]" aria-hidden />
                      {t("pickupDate")}
                    </span>
                    {pickupDateDraft ? (
                      <span className="text-[13px] font-bold text-[#0f1923]">{pickupDateDraft}</span>
                    ) : (
                      <span className="text-[13px] font-medium text-[#aaa08e]">{t("selectDate")}</span>
                    )}
                    <ChevronDown
                      className={`absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dateRangeOpen && dateRangeAnchor === "pickup" ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="relative min-w-0">
                  <button
                    ref={pickupTimeRef}
                    type="button"
                    aria-expanded={pickupTimeOpen}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setPickupTimeOpen((v) => !v);
                      setDateRangeOpen(false);
                      setDropoffTimeOpen(false);
                    }}
                    className="field-trigger relative flex w-full flex-col gap-1 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-right focus:outline-none"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                      <Clock className="size-3 text-[#dbb878]" aria-hidden />
                      {t("pickUpTime")}
                    </span>
                    <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                      {pickupTimeDraft}
                    </span>
                    <ChevronDown
                      className={`absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${pickupTimeOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  <TimePickerPopover
                    isOpen={pickupTimeOpen}
                    onClose={() => setPickupTimeOpen(false)}
                    label={t("pickUpTime")}
                    time={pickupTimeDraft}
                    schedule={pickupTimeBranchSchedule}
                    dateDdMmYy={pickupDateDraft}
                    onConfirm={(hm) => {
                      applyPickupTime(hm);
                      setPickupTimeOpen(false);
                      setTimeout(() => {
                        if (rental === "daily" && !dropoffDateDraft) {
                          dropoffDateRef.current?.focus();
                          toggleDateRange("dropoff");
                        } else {
                          dropoffTimeRef.current?.focus();
                          setDropoffTimeOpen(true);
                        }
                      }, 150);
                    }}
                    anchorRef={pickupTimeRef}
                  />
                </div>
                <div className="relative min-w-0">
                  <button
                    ref={dropoffDateRef}
                    type="button"
                    aria-expanded={dateRangeOpen && dateRangeAnchor === "dropoff"}
                    aria-haspopup="dialog"
                    onClick={() => toggleDateRange("dropoff")}
                    className={`field-trigger relative flex w-full flex-col gap-1 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start focus:outline-none ${dateRangeOpen && dateRangeAnchor === "dropoff" ? "ring-2 ring-[#dbb878]/40" : ""}`}
                  >
                    <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                      <CalendarRange className="size-3 text-[#dbb878]" aria-hidden />
                      {t("returnDate")}
                    </span>
                    {dropoffDateDraft ? (
                      <span className="text-[13px] font-bold text-[#0f1923]">{dropoffDateDraft}</span>
                    ) : (
                      <span className="text-[13px] font-medium text-[#aaa08e]">{t("selectDate")}</span>
                    )}
                    <ChevronDown
                      className={`absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dateRangeOpen && dateRangeAnchor === "dropoff" ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
                <DateRangePickerPopover
                  key={dateRangeAnchor}
                  isOpen={dateRangeOpen}
                  onClose={() => setDateRangeOpen(false)}
                  startDateDdMmYy={pickupDateDraft}
                  endDateDdMmYy={dropoffDateDraft}
                  schedule={pickupTimeBranchSchedule}
                  allowHolidayBooking={tabFlagsEff.allowHolidayBooking}
                  onStartChange={applyPickupDateOnly}
                  onRangeChange={(start, end) => {
                    applyDateRange(start, end);
                    setDateRangeOpen(false);
                    setTimeout(() => {
                      pickupTimeRef.current?.focus();
                      setPickupTimeOpen(true);
                    }, 150);
                  }}
                  anchorRef={dateRangeActiveRef}
                  extraAnchorRefs={[pickupDateRef, dropoffDateRef]}
                />
                <div className="relative min-w-0">
                  <button
                    ref={dropoffTimeRef}
                    type="button"
                    aria-expanded={dropoffTimeOpen}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setDropoffTimeOpen((v) => !v);
                      setDateRangeOpen(false);
                      setPickupTimeOpen(false);
                    }}
                    className="field-trigger relative flex w-full flex-col gap-1 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start focus:outline-none"
                  >
                    <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                      <Clock className="size-3 text-[#dbb878]" aria-hidden />
                      {t("deliveryTime")}
                    </span>
                    <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                      {dropoffTimeDraft}
                    </span>
                    <ChevronDown
                      className={`absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dropoffTimeOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  <TimePickerPopover
                    isOpen={dropoffTimeOpen}
                    onClose={() => setDropoffTimeOpen(false)}
                    label="وقت التسليم"
                    time={dropoffTimeDraft}
                    schedule={dropoffTimeBranchSchedule}
                    dateDdMmYy={dropoffDateDraft}
                    minExclusiveHm={dropoffMinExclusiveHm}
                    onConfirm={applyDropoffTime}
                    anchorRef={dropoffTimeRef}
                  />
                </div>
              </div>
            </div>
          ) : rental === "corporate" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-[#ebe4d3]/70 bg-[#fdfbf6] p-4"
              role="group"
              aria-label={t("corporateSection.corporateBookingDetails")}
            >
              <p className="text-[11px] font-bold leading-relaxed text-[#6b5a3b]">
                {t("corporateSection.fillDetails")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={corpNameId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    {t("corporateSection.companyName")}
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
                    placeholder={t("corporateSection.companyNamePlaceholder")}
                  />
                </div>
                <div>
                  <label
                    htmlFor={corpEmailId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    {t("corporateSection.companyEmail")}
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
                    {t("corporateSection.taxNumber")}
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
                    placeholder={t("corporateSection.taxNumberPlaceholder")}
                  />
                </div>
                <div>
                  <label
                    htmlFor={corpPhoneId}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    {t("corporateSection.contactMobile")}
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
                  {t("corporateSection.requestDetails")}
                </label>
                <textarea
                  id={corpDetailsId}
                  name="details"
                  value={corpDetails}
                  onChange={(ev) => setCorpDetails(ev.target.value)}
                  required
                  rows={4}
                  maxLength={8000}
                  dir={isRtl ? "rtl" : "ltr"}
                  className="mt-0.5 w-full resize-y rounded-lg border border-[#ebe4d3]/70 bg-white/90 px-2.5 py-2 text-[13px] font-medium text-[#0f1923] outline-none focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25"
                  placeholder={t("corporateSection.requestDetailsPlaceholder")}
                />
                <p className="mt-1 text-[9px] font-medium text-[#8a7752]/90">
                  {t("corporateSection.requestDetailsHelp")}
                </p>
              </div>
              {corpSuccess && mounted ? createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f1923]/40 p-4 backdrop-blur-sm transition-all duration-300 animate-in fade-in" dir={isRtl ? "rtl" : "ltr"}>
                  <div 
                    className="w-full max-w-sm flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center justify-center bg-emerald-500 p-8 text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
                      <div className="rounded-full bg-white p-4 shadow-lg mb-2 relative z-10">
                        <Check className="size-10 text-emerald-500" strokeWidth={3} />
                      </div>
                      <h3 className="text-xl font-bold mt-2 relative z-10">{t("corporateSection.requestReceivedTitle")}</h3>
                    </div>
                    
                    <div className="flex flex-col items-center gap-4 p-8 text-center bg-[#fdfbf6]">
                      <p className="text-[15px] font-semibold leading-relaxed text-[#003749]">
                        {t("corporateSection.requestReceivedSuccess")}
                      </p>
                      <p className="text-[13px] font-medium text-[#6b5a3b] max-w-[250px]">
                        {t("corporateSection.requestReceivedMessage")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCorpSuccess(false)}
                        className="mt-2 w-full rounded-xl bg-[#dbb878] px-5 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:bg-[#c9a356] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                      >
                        {t("corporateSection.okayUnderstood")}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
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
                  {mode === "pickup" ? t("pickupLocation") : t("deliveryAndReturnLocation")}
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
                        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[#c9a356]/55 bg-white/60 px-2.5 py-2 text-start text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,background-color,box-shadow] hover:border-[#dbb878] hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
                      >
                        {deliverySelected ? (
                          <span className="flex min-w-0 items-center gap-2 text-[#0f3d47]">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                              <span className="size-2 rounded-full bg-emerald-500" />
                            </span>
                            <span className="truncate">
                              {deliveryAddressSnippet || t("locationSelected")}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#6b5a3b]">{t("selectOnMap")}</span>
                        )}
                        <MapPin className="size-4 shrink-0 text-[#dbb878] opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
                      </button>
                    </div>
                    <div className="rounded-xl border border-[#ebe4d3]/60 bg-white/50 p-3">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/55">
                        {t("returnBranch")}
                      </p>
                      <GroupedBranchSelect
                        id={returnBranchId}
                        dateCities={dateCities}
                        branchSlug={returnBranch}
                        defaultBranchSlug=""
                        required={branchSelectRequired}
                        onBranchSelect={handleDeliveryReturnBranch}
                      />
                    </div>
                  </>
                )}
              </div>
            </SubscriptionPackagesInWidget>
          ) : (
            /* ═══ SIXT-STYLE ELEGANT PILL ═══ */
            <div className="search-pill flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0">

              {/* ── 1. موقع الاستلام ── */}
              {/* في وضع التوصيل يحمل اسم فرع فقط، فيتنازل عن مساحته لحقل عنوان التوصيل */}
              <div
                className={`relative flex-1 min-w-0 ${mode === "delivery" ? "xl:flex-[1.35]" : "xl:flex-[1.8]"}`}
              >
                <div
                  ref={pickupLocRef}
                  role="button"
                  tabIndex={0}
                  aria-expanded={pickupLocOpen}
                  aria-haspopup="dialog"
                  onClick={() => { setPickupLocOpen((v) => !v); setReturnLocOpen(false); closeSchedulePopovers(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPickupLocOpen((v) => !v);
                      setReturnLocOpen(false);
                      closeSchedulePopovers();
                    }
                  }}
                  className="field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none cursor-pointer"
                >
                  <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                    <MapPin className="size-3 text-[#dbb878]" aria-hidden />
                    {mode === "pickup" ? t("pickupLocation") : t("branch")}
                  </span>
                  <span className="flex items-center gap-2 truncate text-[13px] font-bold text-[#0f1923]">
                    <span className="truncate">
                      {branchLabel(pickupBranchEffective) || <span className="font-medium text-[#aaa08e]">{dateCities.length === 0 ? t("noBranches") : t("selectBranch")}</span>}
                    </span>
                    {pickupBranchEffective && branchMapUrl(pickupBranchEffective) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = branchMapUrl(pickupBranchEffective);
                          if (url) window.open(url, "_blank", "noopener,noreferrer");
                        }}
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#dbb878]/10 text-[#dbb878] hover:bg-[#dbb878] hover:text-white transition-colors focus:outline-none"
                        title={isRtl ? "عرض الموقع على الخريطة" : "View on map"}
                      >
                        <MapPin className="size-3" />
                      </button>
                    )}
                  </span>
                  <ChevronDown className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${pickupLocOpen ? "rotate-180" : ""}`} aria-hidden />
                </div>
                <LocationPickerPopover
                  isOpen={pickupLocOpen}
                  onClose={() => setPickupLocOpen(false)}
                  dateCities={dateCities}
                  selectedBranchSlug={pickupBranch}
                  defaultBranchSlug={defaultPickupBranchSlug}
                  onBranchSelect={(branch, city) => {
                    handlePickupCityChange(city);
                    handlePickupBranchChange(branch);
                    setTimeout(() => {
                      if (returnLocationDifferent) {
                        returnLocRef.current?.focus();
                        setReturnLocOpen(true);
                      } else {
                        pickupDateRef.current?.focus();
                        if (rental === "daily") {
                          toggleDateRange("pickup");
                        } else {
                          setPickupDateOpen(true);
                        }
                      }
                    }, 150);
                  }}
                  anchorRef={pickupLocRef as any}
                  containerRef={formRef}
                  label={mode === "pickup" ? t("pickupLocation") : t("branch")}
                />
              </div>

              {/* ── 1.5. موقع التوصيل (delivery mode only) ── */}
              {mode === "delivery" && (
                /* يعرض عنواناً كاملاً، فيأخذ أوسع نصيب في الشريط */
                <div className="relative xl:flex-[2.4] flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMapOpen(true)}
                    className="field-trigger relative flex h-full w-full flex-col justify-center gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none overflow-hidden"
                  >
                    <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                      <MapPin className="size-3 shrink-0 text-[#dbb878]" aria-hidden />
                      <span className="truncate">{deliveryLocationLabel}</span>
                    </span>
                    {deliverySelected ? (
                      <span className="flex w-full items-center gap-2 text-[13px] font-bold text-[#0f3d47]">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                        </span>
                        <span className="truncate">
                          {deliveryAddressSnippet || t("locationSelected")}
                        </span>
                      </span>
                    ) : (
                      <span className="truncate w-full text-[13px] font-medium text-[#aaa08e]">{t("selectOnMap")}</span>
                    )}
                  </button>
                </div>
              )}

              {/* ── 2. موقع الإرجاع (delivery mode only / or return-diff) ── */}
              {returnLocationDifferent && (
                <div className="relative xl:flex-[1.5] flex-1 min-w-0">
                  <div
                    ref={returnLocRef}
                    role="button"
                    tabIndex={0}
                    aria-expanded={returnLocOpen}
                    aria-haspopup="dialog"
                    onClick={() => { setReturnLocOpen((v) => !v); setPickupLocOpen(false); closeSchedulePopovers(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setReturnLocOpen((v) => !v);
                        setPickupLocOpen(false);
                        closeSchedulePopovers();
                      }
                    }}
                    className="field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none cursor-pointer"
                  >
                    <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                      <MapPin className="size-3 text-[#dbb878]" aria-hidden />
                      {t("returnLocation")}
                    </span>
                    <span className="flex items-center gap-2 truncate text-[13px] font-bold text-[#0f1923]">
                      <span className="truncate">
                        {branchLabel(returnBranchEffective) || <span className="font-medium text-[#aaa08e]">{t("selectBranch")}</span>}
                      </span>
                      {returnBranchEffective && branchMapUrl(returnBranchEffective) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = branchMapUrl(returnBranchEffective);
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#dbb878]/10 text-[#dbb878] hover:bg-[#dbb878] hover:text-white transition-colors focus:outline-none"
                          title={isRtl ? "عرض الموقع على الخريطة" : "View on map"}
                        >
                          <MapPin className="size-3" />
                        </button>
                      )}
                    </span>
                    <ChevronDown className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${returnLocOpen ? "rotate-180" : ""}`} aria-hidden />
                  </div>
                  <LocationPickerPopover
                    isOpen={returnLocOpen}
                    onClose={() => setReturnLocOpen(false)}
                    dateCities={dateCities}
                    selectedBranchSlug={returnBranch}
                    defaultBranchSlug={defaultReturnBranchSlug}
                    onBranchSelect={(branch, city) => {
                      handleDeliveryReturnBranch(branch, city);
                      setTimeout(() => {
                        pickupDateRef.current?.focus();
                        if (rental === "daily") {
                          toggleDateRange("pickup");
                        } else {
                          setPickupDateOpen(true);
                        }
                      }, 150);
                    }}
                    anchorRef={returnLocRef as any}
                    containerRef={formRef}
                    label={t("returnLocation")}
                  />
                </div>
              )}

              {/* show "return different" toggle inside the bar */}
              {!returnLocationDifferent && (
                <div className="flex w-full items-center rounded-2xl border border-[#efe7d6] bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,55,73,0.04),0_6px_16px_-10px_rgba(0,55,73,0.14)] xl:w-auto xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] xl:bg-transparent xl:py-0 xl:shadow-none">
                  <label className="flex cursor-pointer items-center gap-2 py-2 text-[11px] font-semibold text-[#6b5a3b] whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={returnLocationDifferent}
                      onChange={(ev) => handleReturnLocationDifferentChange(ev.target.checked)}
                      className="size-3.5 shrink-0 cursor-pointer rounded border-[#c9a356]/60 text-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
                    />
                    {t("returnDifferent")}
                  </label>
                </div>
              )}

              {/* ── 3+4. التاريخ والوقت — يقترنان في صف واحد على الجوال ── */}
              <div className="grid grid-cols-2 gap-2.5 xl:contents">
              {/* ── 3. تاريخ الاستلام ── */}
              <div className="relative flex-1 min-w-0 xl:flex-[1.15]">
                <button
                  ref={pickupDateRef}
                  type="button"
                  aria-expanded={rental === "daily" ? dateRangeOpen && dateRangeAnchor === "pickup" : pickupDateOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    if (rental === "daily") {
                      toggleDateRange("pickup");
                      return;
                    }
                    setPickupLocOpen(false);
                    setReturnLocOpen(false);
                    setDateRangeOpen(false);
                    setPickupTimeOpen(false);
                    setDropoffTimeOpen(false);
                    setPickupDateOpen((v) => !v);
                  }}
                  className={`field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none ${rental === "daily" && dateRangeOpen && dateRangeAnchor === "pickup" ? "ring-2 ring-[#dbb878]/40" : ""}`}
                >
                  <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                    <CalendarClock className="size-3 text-[#dbb878]" aria-hidden />
                    {t("pickupDate")}
                  </span>
                  {pickupDateDraft ? (
                    <span className="text-[13px] font-bold text-[#0f1923]">{pickupDateDraft}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-[#aaa08e]">{t("selectDate")}</span>
                  )}
                  <ChevronDown
                    className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${(rental === "daily" ? dateRangeOpen && dateRangeAnchor === "pickup" : pickupDateOpen) ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {rental !== "daily" ? (
                  <DatePickerPopover
                    isOpen={pickupDateOpen}
                    onClose={() => setPickupDateOpen(false)}
                    label={t("pickupDate")}
                    dateDdMmYy={pickupDateDraft}
                    schedule={pickupTimeBranchSchedule}
                    allowHolidayBooking={tabFlagsEff.allowHolidayBooking}
                    onConfirm={(dateDdMmYy) => {
                      applyPickupDateFromDraft(dateDdMmYy);
                      setPickupDateOpen(false);
                      setTimeout(() => {
                        pickupTimeRef.current?.focus();
                        setPickupTimeOpen(true);
                      }, 150);
                    }}
                    anchorRef={pickupDateRef}
                  />
                ) : null}
              </div>

              {/* ── 4. وقت الاستلام ── */}
              {/* «09:00» لا يحتاج عرض التاريخ */}
              <div className="relative flex-1 min-w-0 xl:flex-[0.8]">
                <button
                  ref={pickupTimeRef}
                  type="button"
                  aria-expanded={pickupTimeOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setPickupTimeOpen((v) => !v);
                    setDateRangeOpen(false);
                    setPickupDateOpen(false);
                    setDropoffTimeOpen(false);
                    setPickupLocOpen(false);
                    setReturnLocOpen(false);
                  }}
                  className="field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none"
                >
                  <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                    <Clock className="size-3 text-[#dbb878]" aria-hidden />
                    {t("pickUpTime")}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                    {pickupTimeDraft}
                  </span>
                  <ChevronDown
                    className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${pickupTimeOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <TimePickerPopover
                  isOpen={pickupTimeOpen}
                  onClose={() => setPickupTimeOpen(false)}
                  label={t("pickUpTime")}
                  time={pickupTimeDraft}
                  schedule={pickupTimeBranchSchedule}
                  dateDdMmYy={pickupDateDraft}
                  onConfirm={(hm) => {
                    applyPickupTime(hm);
                    setPickupTimeOpen(false);
                    setTimeout(() => {
                      if (rental === "daily" && !dropoffDateDraft) {
                        dropoffDateRef.current?.focus();
                        toggleDateRange("dropoff");
                      } else {
                        dropoffTimeRef.current?.focus();
                        setDropoffTimeOpen(true);
                      }
                    }, 150);
                  }}
                  anchorRef={pickupTimeRef}
                />
              </div>
              </div>

              {/* ── 5+6. التاريخ والوقت — يقترنان في صف واحد على الجوال ── */}
              <div className="grid grid-cols-2 gap-2.5 xl:contents">
              {/* ── 5. تاريخ التسليم ── */}
              <div className="relative flex-1 min-w-0 xl:flex-[1.15]">
                <button
                  ref={dropoffDateRef}
                  type="button"
                  aria-expanded={rental === "daily" ? dateRangeOpen && dateRangeAnchor === "dropoff" : false}
                  aria-haspopup="dialog"
                  disabled={rental !== "daily"}
                  onClick={() => {
                    if (rental !== "daily") return;
                    toggleDateRange("dropoff");
                  }}
                  className={`field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none disabled:opacity-60 ${rental === "daily" && dateRangeOpen && dateRangeAnchor === "dropoff" ? "ring-2 ring-[#dbb878]/40" : ""}`}
                >
                  <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                    <CalendarRange className="size-3 text-[#dbb878]" aria-hidden />
                    {t("returnDate")}
                    {rental !== "daily" ? (
                      <span className="text-[9px] font-medium text-[#8a7752]/70"></span>
                    ) : null}
                  </span>
                  {dropoffDateDraft ? (
                    <span className="text-[13px] font-bold text-[#0f1923]">{dropoffDateDraft}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-[#aaa08e]">{t("selectDate")}</span>
                  )}
                  <ChevronDown
                    className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${dateRangeOpen && dateRangeAnchor === "dropoff" ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {rental === "daily" ? (
                  <DateRangePickerPopover
                    key={dateRangeAnchor}
                    isOpen={dateRangeOpen}
                    onClose={() => setDateRangeOpen(false)}
                    startDateDdMmYy={pickupDateDraft}
                    endDateDdMmYy={dropoffDateDraft}
                    schedule={pickupTimeBranchSchedule}
                    allowHolidayBooking={tabFlagsEff.allowHolidayBooking}
                    onStartChange={applyPickupDateOnly}
                    onRangeChange={(start, end) => {
                      applyDateRange(start, end);
                      setDateRangeOpen(false);
                      setTimeout(() => {
                        pickupTimeRef.current?.focus();
                        setPickupTimeOpen(true);
                      }, 150);
                    }}
                    anchorRef={dateRangeActiveRef}
                    extraAnchorRefs={[pickupDateRef, dropoffDateRef]}
                  />
                ) : null}
              </div>

              {/* ── 6. وقت التسليم ── */}
              <div className="relative flex-1 min-w-0 xl:flex-[0.8]">
                <button
                  ref={dropoffTimeRef}
                  type="button"
                  aria-expanded={dropoffTimeOpen}
                  aria-haspopup="dialog"
                  disabled={rental !== "daily"}
                  onClick={() => {
                    if (rental !== "daily") return;
                    setDropoffTimeOpen((v) => !v);
                    setDateRangeOpen(false);
                    setPickupDateOpen(false);
                    setPickupTimeOpen(false);
                    setPickupLocOpen(false);
                    setReturnLocOpen(false);
                  }}
                  className="field-trigger relative flex h-full w-full flex-col gap-1 border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 pe-9 text-start rounded-xl xl:rounded-none xl:border-0 xl:border-e xl:border-[#ebe4d3] focus:outline-none disabled:opacity-60"
                >
                  <span className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55 truncate">
                    <Clock className="size-3 text-[#dbb878]" aria-hidden />
                    {t("deliveryTime")}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                    {dropoffTimeDraft}
                  </span>
                  <ChevronDown
                    className={`absolute end-3 top-1/2 -translate-y-1/2 size-3.5 text-[#dbb878] transition-transform ${dropoffTimeOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <TimePickerPopover
                  isOpen={dropoffTimeOpen}
                  onClose={() => setDropoffTimeOpen(false)}
                  label={t("deliveryTime")}
                  time={dropoffTimeDraft}
                  readOnly={rental !== "daily"}
                  schedule={dropoffTimeBranchSchedule}
                  dateDdMmYy={dropoffDateDraft}
                  minExclusiveHm={dropoffMinExclusiveHm}
                  onConfirm={applyDropoffTime}
                  anchorRef={dropoffTimeRef}
                />
              </div>
              </div>

              {/* ── 7. زر البحث ── */}
              <div className="flex items-stretch">
                <button
                  type="submit"
                  disabled={dateCities.length === 0}
                  className="cta-btn group relative mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-4 text-white disabled:pointer-events-none disabled:opacity-45 xl:mt-0 xl:min-h-0 xl:rounded-none xl:rounded-l-full xl:px-9 xl:py-4 xl:text-[15px]"
                  style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                >
                  <span
                    className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                    aria-hidden
                  />
                  {isCheckout ? (
                    <CalendarCheck2 className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Search className="size-4 shrink-0" aria-hidden />
                  )}
                  <span className="text-[14px] font-extrabold tracking-wide">
                    {isCheckout ? t("continue") : t("searchCars")}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            SECTION 3: CTA + Info Footer
            Hidden entirely in the default home search case (no badge yet);
            no cement-tinted background — flows naturally on the form's white.
        ═══════════════════════════════════════ */}
        {isFreshRebookFlow ||
        rental === "corporate" ||
        rental === "monthly_packages" ||
        durationBadgeLabel != null ? (
        <div className="px-3 py-3 sm:px-5">
          {/* CTA row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Duration badge + helper text */}
            <div className="flex flex-1 items-center gap-3" aria-live="polite">
              {isFreshRebookFlow ? (
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {durationBadgeLabel != null ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.5)]"
                        style={{
                          background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                        }}
                      >
                        <CalendarDays className="size-3" aria-hidden />
                        <span className="tabular-nums">{durationBadgeLabel}</span>
                      </span>
                      <span className="text-[11px] font-medium text-[#6b5a3b]">مدة الحجز</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#aaa08e]">حدّد التواريخ لعرض المدة</span>
                  )}
                  <button
                    type="submit"
                    className="cta-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-2.5 text-white sm:w-auto"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                    }}
                  >
                    <span
                      className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                      aria-hidden
                    />
                    <CalendarCheck2 className="size-4 shrink-0" aria-hidden />
                    <span className="text-[14px] font-extrabold tracking-wide">
                      {isCheckout ? t("continue") : t("searchCars")}
                    </span>
                  </button>
                </div>
              ) : rental === "corporate" ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] font-medium leading-snug text-[#6b5a3b]">
                    {t("corporateSection.fleetSearchNotCalculated")}
                  </span>
                  <button
                    type="submit"
                    disabled={corpPending}
                    className="cta-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-2.5 text-white disabled:pointer-events-none disabled:opacity-45 sm:w-auto"
                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                  >
                    <span className="cta-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" aria-hidden />
                    <Send className="size-4 shrink-0" aria-hidden />
                    <span className="text-[14px] font-extrabold tracking-wide">
                      {corpPending ? t("corporateSection.sending") : t("corporateSection.sendContactRequest")}
                    </span>
                  </button>
                </div>
              ) : durationBadgeLabel != null ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.5)]"
                    style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
                  >
                    <CalendarDays className="size-3" aria-hidden />
                    <span className="tabular-nums">{durationBadgeLabel}</span>
                  </span>
                  <span className="text-[11px] font-medium text-[#6b5a3b]">مدة الحجز</span>
                </div>
              ) : rental === "monthly_packages" ? (
                <span className="flex items-center gap-1.5 text-[11px] text-[#aaa08e]">
                  تُشتق مدة البحث من يوم بدء الباقة ومدة الاشتراك أعلاه
                </span>
              ) : null}
            </div>
          </div>

          {/* Bottom info row — hidden in the default home search case */}
          {rental === "corporate" || isCheckout ? (
            <div className="mt-2 flex flex-col gap-2 border-t border-[#ebe4d3]/60 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="text-[10px] leading-relaxed text-[#aaa08e]">
                {rental === "corporate"
                  ? t("corporateSection.dataUsedForCommunicationOnly")
                  : "يُحدّث السعر والتوفر بعد تطبيق التواريخ على هذا الحجز"}
              </p>
              {rental === "corporate" ? (
                <span className="text-[10.5px] font-bold text-[#6b5a3b]">
                  {t("corporateSection.salesTeamMonitors")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}

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
            className="flex items-center gap-2 border-t border-red-200 bg-gradient-to-l from-red-50 to-red-50/50 px-4 py-2 text-[12px] font-semibold text-red-700"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <span className="size-2 rounded-full bg-red-500" />
            </span>
            {error}
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
        fallbackCenter={deliveryFallbackCenter}
        addressField
        initialAddress={deliveryAddressText}
        onConfirm={(lat, lng, addr) => {
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          setDeliveryAddressText(addr);
          setMapOpen(false);
        }}
      />
    </>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

/** Sixt-style filled pill tab — solid teal when active, transparent w/ hover otherwise. */
function QuietTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#dbb878]/40 sm:px-4 sm:py-2 sm:text-[12.5px] ${
        active ? "" : "hover:bg-[#003749]/[0.05] hover:text-[#003749]"
      }`}
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${TEAL} 0%, #004d63 100%)`,
              color: "#ffffff",
              boxShadow: "0 6px 18px -6px rgba(0,55,73,0.45)",
            }
          : {
              background: "transparent",
              color: "#5a6b75",
            }
      }
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Compact rounded-full chip toggle (pickup vs delivery). */
function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#dbb878]/40"
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${TEAL} 0%, #004d63 100%)`,
              color: "#fff",
              boxShadow: "0 2px 8px -2px rgba(0,55,73,0.35)",
            }
          : {
              background: "transparent",
              color: "#4a7a8a",
            }
      }
    >
      <span aria-hidden>{icon}</span>
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
        className="booking-field-card flex h-full min-h-[3.25rem] items-center gap-3 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3"
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

