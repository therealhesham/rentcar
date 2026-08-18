"use client";

import {
  Baby,
  CircleHelp,
  Gauge,
  Info,
  KeyRound,
  Loader2,
  Shield,
  CheckCircle2,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { BookingWidget } from "@/components/home/BookingWidget";
import type { FleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { CarUnavailableModal } from "@/components/fleet/CarUnavailableModal";
import { BranchOutsideHoursModal } from "@/components/fleet/BranchOutsideHoursModal";
import { RentalTermsModal } from "@/components/fleet/RentalTermsModal";
import type { RentalTermDTO } from "@/lib/rental-terms-data";
import {
  isBranchOutsideHoursBookingError,
  isDirectBookingCapacityMessage,
  stripBranchHoursErrorCodeForDisplay,
} from "@/lib/direct-booking-user-messages";
import { isDateTimeWithinBranchSchedule } from "@/lib/branch-opening-hours";
import { lookupBranchOpeningSchedule } from "@/lib/booking-branch-schedule-lookup";
import { lastInclusiveBookingDayYmd } from "@/lib/booking-calendar-ymd";
import {
  computeCheckoutTotals,
  formatSarAmount,
} from "@/lib/booking-checkout-pricing";
import { computeBookingDays } from "@/lib/booking-days";
import { computeDelayPenaltySnap } from "@/lib/booking-delay-penalty";
import { formatDailyBookingDurationFromIso } from "@/lib/booking-duration-display";
import type { CheckoutCarDTO } from "@/lib/checkout-car-data";
import { dailyRentalInclTaxSar, type RentalPriceDisplayMode } from "@/lib/pricing";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";
import { DELIVERY_ADDRESS_MIN_CHARS } from "@/lib/delivery-address";
import { citySlugForBranchSlug, lookupInterCityFeeSar } from "@/lib/inter-city-shipping-client";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { RentalAddonDTO } from "@/lib/rental-addon-data";
import { sumCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";
import type { FleetCheckoutEditPrefill } from "@/lib/fleet-checkout-edit-prefill";
import { DdMmYyDateWithPicker } from "@/components/ui/DdMmYyDateWithPicker";
import { BookingStepper } from "@/components/fleet/BookingStepper";
import { trackEvent } from "@/lib/track-event";
import {
  formatYmdAsDdMmYy,
  parseDdMmYyToYmd,
  WEEKLY_TAB_DAYS,
} from "@/lib/booking-search-shared";
import { getDistanceKM } from "@/lib/geo-distance";

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

/**
 * تاريخ ميلادي مختصر لتنبيه فشل النموذج. `fmtWhen` يعرض بالتقويم الهجري لأنه
 * موجَّه للزائر، أما التنبيه فيقرأه المطوّر ويقارنه بسجلّات الخادم الميلادية.
 */
function fmtWhenForAlert(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  checkoutOneTimeFees: Array<{ slug: string; label: string; feeExclVatSar: number }>;
  sessionCustomer:
  | {
    name: string;
    phoneLocal: string;
    email: string;
    idDocumentKind: string | null;
    nationalIdNumber: string | null;
    passportNumber: string | null;
    licenseNumber: string | null;
    licenseExpiryYmd: string | null;
    idCardImageUrl: string | null;
    driverLicenseImageUrl: string | null;
  }
  | null;
  rentalPriceDisplayMode: RentalPriceDisplayMode;
  /** بيانات حجز قائم عند «تعديل الحجز» — لملء الحقول بعد التحقق من الخادم */
  editPrefill: FleetCheckoutEditPrefill | null;
  tabFlags?: BookingWidgetTabFlags | null;
  fleetUrlHydrate?: FleetSearchUrlHydrate | null;
  /** الشروط والأحكام من قاعدة البيانات — تُعرض داخل نافذة منبثقة عند الضغط على الرابط */
  rentalTerms?: RentalTermDTO[];
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
  editPrefill,
  tabFlags,
  fleetUrlHydrate,
  rentalTerms = [],
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
  const [branchHoursOpen, setBranchHoursOpen] = useState(false);
  const [branchHoursMessage, setBranchHoursMessage] = useState("");
  const [openAddonInfoId, setOpenAddonInfoId] = useState<number | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<
    | null
    | {
        code: string;
        scope: "RENTAL_ONLY" | "FULL_TOTAL";
        discountedPricePerDayExclTax: number;
        discountExclTax: number;
        labelAr: string;
      }
  >(null);

  /** واجهة: زرّان فقط (مواطن/مقيم معاً) + زائر؛ القيم المُرسَلة للخادم CITIZEN | RESIDENT تُشتق من أول رقم. */
  type IdDocUiKind = "SAUDI_ID" | "VISITOR";
  const sessionIdDocKind =
    sessionCustomer?.idDocumentKind === "VISITOR" ||
      sessionCustomer?.idDocumentKind === "RESIDENT_VISITOR"
      ? ("VISITOR" as const)
      : ("SAUDI_ID" as const);
  const [idDocKind, setIdDocKind] = useState<IdDocUiKind>(sessionIdDocKind);
  const [nationalId, setNationalId] = useState(
    sessionIdDocKind === "SAUDI_ID"
      ? (sessionCustomer?.nationalIdNumber ?? "").replace(/\D/g, "").slice(0, 10)
      : "",
  );
  const [passportNumber, setPassportNumber] = useState(
    sessionIdDocKind === "VISITOR"
      ? (sessionCustomer?.passportNumber ?? "").trim().toUpperCase().slice(0, 24)
      : "",
  );
  const [licenseNumber, setLicenseNumber] = useState(
    (sessionCustomer?.licenseNumber ?? "").replace(/\D/g, "").slice(0, 10),
  );
  const [licenseExpiryDdmmyy, setLicenseExpiryDdmmyy] = useState(
    sessionCustomer?.licenseExpiryYmd ? formatYmdAsDdMmYy(sessionCustomer.licenseExpiryYmd) : "",
  );
  const [idCardUrl, setIdCardUrl] = useState<string | null>(sessionCustomer?.idCardImageUrl ?? null);
  const [licenseDocUrl, setLicenseDocUrl] = useState<string | null>(
    sessionCustomer?.driverLicenseImageUrl ?? null,
  );
  const [kycFieldError, setKycFieldError] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState<"id" | "license" | null>(null);
  const prefillBookingIdRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  /** ضُغط زر التأكيد ولو مرة — عندها الانسحاب مغطّى بـ CHECKOUT_SUBMIT/ERROR. */
  const submitAttemptedRef = useRef(false);
  const abandonSentRef = useRef(false);
  const openedAtRef = useRef(Date.now());
  /**
   * منتقي الملفات مفتوح أو الرفع جارٍ. على الجوال يفتح المنتقي الكاميرا أو
   * الاستوديو فتُخفى الصفحة — وهذا ليس انسحاباً. بدون هذا العلم يتحوّل كل من
   * حاول رفع رخصته إلى «منسحب عند رفع الصورة»، وهي بالضبط الفرضية التي نقيسها.
   */
  const uploadingRef = useRef(false);
  /** المنتقي فُتح ولم يُختر منه ملف بعد — يُصفَّر عند عودة الصفحة للظهور. */
  const pickerOpenRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLEET_SEARCH_STORAGE_KEY);
      if (raw) setCtxStore(JSON.parse(raw) as StoredFleetSearchContext);
    } catch {
      /* ignore */
    }
  }, []);

  const rentalTab = sp.get("rental")?.trim().toLowerCase() || "daily";

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

    const days =
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

    const pickupBranchNorm = pickupBranch?.trim().toLowerCase() || undefined;
    const pickupBranchSlugForHours = pickupBranchNorm || branchSlug;

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
          if (deliveryAddressMerged.length > 0) {
            return `توصيل — ${deliveryAddressMerged}`;
          }
          if (coordsOk) {
            return "توصيل (تم التحديد على الخريطة)";
          }
          return "توصيل";
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
      pickupBranchSlugForHours,
    };
  }, [sp, ctxStore, branchBySlug, bookingCities]);

  useEffect(() => {
    if (!editPrefill) {
      prefillBookingIdRef.current = null;
      return;
    }
    if (prefillBookingIdRef.current === editPrefill.bookingRequestId) return;
    prefillBookingIdRef.current = editPrefill.bookingRequestId;

    if (
      editPrefill.idDocumentKind === "VISITOR" ||
      editPrefill.idDocumentKind === "RESIDENT_VISITOR"
    ) {
      setIdDocKind("VISITOR");
      setPassportNumber(editPrefill.passportNumber);
      setNationalId("");
    } else {
      setIdDocKind("SAUDI_ID");
      setNationalId(editPrefill.nationalIdNumber);
      setPassportNumber("");
    }
    setLicenseNumber(editPrefill.licenseNumber);
    if (editPrefill.licenseExpiryYmd) {
      setLicenseExpiryDdmmyy(formatYmdAsDdMmYy(editPrefill.licenseExpiryYmd));
    }
    if (editPrefill.idCardImageUrl) setIdCardUrl(editPrefill.idCardImageUrl);
    if (editPrefill.driverLicenseImageUrl) setLicenseDocUrl(editPrefill.driverLicenseImageUrl);
    const validAddonIds = editPrefill.addonIds.filter((id) => addons.some((a) => a.id === id));
    if (validAddonIds.length > 0) setSelected(new Set(validAddonIds));
  }, [editPrefill, addons]);

  const excludeBookingRequestIdFromUrl = useMemo(() => {
    const raw = sp.get("excludeBookingRequestId")?.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 ? n : undefined;
  }, [sp]);

  const rentalLastDayYmdForLicense = useMemo(() => {
    if (!trip.pickupIso) return null;
    const p = new Date(trip.pickupIso);
    if (Number.isNaN(p.getTime())) return null;
    return lastInclusiveBookingDayYmd(p, trip.days);
  }, [trip.pickupIso, trip.days]);

  const licenseExpiryNativeYmd = useMemo(
    () => parseDdMmYyToYmd(licenseExpiryDdmmyy.trim()) ?? "",
    [licenseExpiryDdmmyy],
  );

  useEffect(() => {
    setUnavailableDismissed(false);
    setPostCapacityModal(false);
    setBranchHoursOpen(false);
    setBranchHoursMessage("");
  }, [trip.pickupIso, trip.days, trip.branchSlug, car.modelId]);

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

  const deliveryDistanceKm = useMemo(() => {
    if (
      trip.mode !== "delivery" ||
      trip.deliveryLat == null ||
      trip.deliveryLng == null ||
      !trip.pickupBranchSlugForHours
    ) {
      return null;
    }
    const branch = bookingCities
      .flatMap((c) => c.branches)
      .find((b) => b.slug === trip.pickupBranchSlugForHours);

    if (branch && branch.lat != null && branch.lng != null) {
      return getDistanceKM(branch.lat, branch.lng, trip.deliveryLat, trip.deliveryLng);
    }
    return null;
  }, [trip, bookingCities]);

  const deliveryFeeSar = useMemo(() => {
    if (deliveryDistanceKm == null) return 0;
    const branch = bookingCities
      .flatMap((c) => c.branches)
      .find((b) => b.slug === trip.pickupBranchSlugForHours);
    if (!branch || !branch.deliveryFeePerKmSar) return 0;
    return Math.round(deliveryDistanceKm * branch.deliveryFeePerKmSar);
  }, [deliveryDistanceKm, trip.pickupBranchSlugForHours, bookingCities]);

  const checkoutFeesSumExclTax = useMemo(
    () => sumCheckoutOneTimeFees(checkoutOneTimeFees),
    [checkoutOneTimeFees],
  );

  const delayPenalty = useMemo(() => {
    if (!trip.pickupIso || !trip.dropoffIso) return null;
    const pickup = new Date(trip.pickupIso);
    const dropoff = new Date(trip.dropoffIso);
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) return null;
    return computeDelayPenaltySnap({
      rentalTab,
      pricePerDayExclTax: car.pricePerDayExclTax,
      pickupDate: pickup,
      numberOfDays: trip.days,
      actualDropoffDate: dropoff,
    });
  }, [
    rentalTab,
    car.pricePerDayExclTax,
    trip.pickupIso,
    trip.dropoffIso,
    trip.days,
  ]);

  const delayPenaltyExclTax = delayPenalty?.feeExclVatSar ?? 0;

  const rentalDurationLabel = useMemo(() => {
    if (rentalTab !== "daily" || !trip.pickupIso || !trip.dropoffIso) {
      const d = trip.days;
      return d === 1 ? "يوم واحد" : d === 2 ? "يومين" : `${d} أيام`;
    }
    return (
      formatDailyBookingDurationFromIso(trip.pickupIso, trip.dropoffIso) ??
      `${trip.days} أيام`
    );
  }, [rentalTab, trip.pickupIso, trip.dropoffIso, trip.days]);

  // تبويب «شهري»: سعر شهري ثابت — يُحوَّل لسعر يومي مكافئ (السعر الشهري ÷ الأيام)
  // بحيث يطابق الإجمالي المعروض هنا ما سيُحتسب فعلياً عند إنشاء الحجز.
  const effectiveRentalPricePerDay =
    rentalTab === "monthly" && car.pricePerMonthExclTax != null
      ? car.pricePerMonthExclTax / trip.days
      : appliedCoupon?.scope === "RENTAL_ONLY"
        ? appliedCoupon.discountedPricePerDayExclTax
        : car.pricePerDayExclTax;

  const totals = computeCheckoutTotals(
    effectiveRentalPricePerDay,
    trip.days,
    car.vatRatePercent,
    selectedRows.map((a) => ({ pricePerDay: a.pricePerDay })),
    {
      oneTimeFeesExclTax:
        interCityShippingFeeSar + deliveryFeeSar + checkoutFeesSumExclTax + delayPenaltyExclTax,
      discountExclTax: appliedCoupon?.scope === "FULL_TOTAL" ? appliedCoupon.discountExclTax : 0,
    },
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
          branch: trip.branchSlug,
        });
        if (excludeBookingRequestIdFromUrl != null) {
          params.set("excludeBookingRequestId", String(excludeBookingRequestIdFromUrl));
        }
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
  }, [car.modelId, trip.pickupIso, trip.days, trip.branchSlug, excludeBookingRequestIdFromUrl]);

  function toggleAddon(id: number) {
    const addon = addons.find((a) => a.id === id);
    const group = addon?.exclusiveGroup?.trim();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (group) {
        for (const a of addons) {
          if (a.id !== id && a.exclusiveGroup?.trim() === group) {
            next.delete(a.id);
          }
        }
      }
      next.add(id);
      return next;
    });
  }

  async function uploadKycImage(file: File, slot: "id" | "license") {
    setKycFieldError(null);
    setUploadingKyc(slot);
    uploadingRef.current = true;
    // حجم الملف بالميجابايت مقرَّباً — صور الجوال قد تتجاوز حدّ الخادم، وبدون
    // الحجم لا نعرف هل الفشل بسبب الملف أم بسبب الشبكة.
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const startedAt = Date.now();
    trackEvent("KYC_UPLOAD_START", { carModelId: car.modelId, detail: `${slot}:${sizeMb}mb` });
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
      trackEvent("KYC_UPLOAD_OK", {
        carModelId: car.modelId,
        detail: `${slot}:${sizeMb}mb:${Math.round((Date.now() - startedAt) / 1000)}s`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذّر رفع الملف.";
      setKycFieldError(message);
      trackEvent("KYC_UPLOAD_FAIL", {
        carModelId: car.modelId,
        detail: `${slot}:${sizeMb}mb:${message}`.slice(0, 255),
        context: failureContext({
          uploadSlot: slot === "id" ? "صورة الهوية" : "صورة الرخصة",
          uploadSize: `${sizeMb} ميجابايت`,
        }),
      });
    } finally {
      uploadingRef.current = false;
      setUploadingKyc(null);
    }
  }

  /** يتحقق من كود الخصم سيرفر-سايد ويعرض معاينة الخصم — التحقق الملزم يتكرر عند تأكيد الحجز. */
  async function handleApplyCoupon() {
    const code = couponInput.trim();
    setCouponError(null);
    if (!code) {
      setCouponError("أدخل كود الخصم.");
      return;
    }
    // زرّ الكوبون داخل الشريط الجانبي (aside) وليس داخل <form> بيانات الهوية، فلازم نقرأ
    // الجوال من جلسة العميل المسجَّل أو من حقل الفورم مباشرة بدل الاعتماد على closest("form").
    const phoneRaw =
      sessionCustomer?.phoneLocal ??
      (document.getElementById("phone") as HTMLInputElement | null)?.value ??
      "";
    const phone = phoneRaw.replace(/\s+/g, "").trim();
    if (!/^5\d{8}$/.test(phone)) {
      setCouponError("أدخل رقم الجوال أولاً.");
      return;
    }

    setCouponChecking(true);
    try {
      const res = await fetch("/api/bookings/direct/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          phone,
          carModelId: car.modelId,
          branchSlug: trip.branchSlug,
          numberOfDays: trip.days,
          addonIds: [...selected],
          // نوع التأجير يحدّد صلاحية الكود (يومي فقط أم شهري كذلك) وأرضية السعر
          // المطبَّقة — لازم يطابق ما يحسبه الخادم وقت الحجز.
          rentalTab,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; scope: "RENTAL_ONLY" | "FULL_TOTAL"; discountedPricePerDayExclTax: number; discountExclTax: number; labelAr: string }
        | { ok: false; error: string };
      if (!data.ok) {
        setAppliedCoupon(null);
        setCouponError(data.error);
        return;
      }
      setAppliedCoupon({
        code: code.toUpperCase(),
        scope: data.scope,
        discountedPricePerDayExclTax: data.discountedPricePerDayExclTax,
        discountExclTax: data.discountExclTax,
        labelAr: data.labelAr,
      });
    } catch {
      setAppliedCoupon(null);
      setCouponError("تعذّر التحقق من الكود الآن، حاول مرة أخرى.");
    } finally {
      setCouponChecking(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  }

  /** يمنع إرسال النموذج بالضغط على Enter من حقول الإدخال النصية بالخطأ (السلوك الافتراضي للمتصفح). */
  function handleCheckoutFormKeyDown(ev: React.KeyboardEvent<HTMLFormElement>) {
    if (ev.key !== "Enter") return;
    const t = ev.target as HTMLElement;
    if (t.tagName !== "INPUT") return;
    const inp = t as HTMLInputElement;
    if (
      inp.type === "submit" ||
      inp.type === "button" ||
      inp.type === "checkbox" ||
      inp.type === "radio" ||
      inp.type === "file"
    ) {
      return;
    }
    ev.preventDefault();
  }

  /**
   * لقطة ما كتبه الزائر لحظة الفشل — تُرفَق بحدث الخطأ لتغذية تنبيه الواتساب.
   * عند فشل التحقق لا يُرسَل الطلب إلى الخادم إطلاقاً، فهذه هي الفرصة الوحيدة
   * لمعرفة *من* تعثّر وبأي بيانات، لا مجرد *كم* عددهم.
   */
  function failureContext(extra?: Record<string, string | null | undefined>) {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const field = (key: string) => String(fd?.get(key) ?? "").trim() || undefined;
    return {
      name: field("name"),
      phone: field("phone") ?? sessionCustomer?.phoneLocal,
      email: field("email") ?? sessionCustomer?.email,
      age: field("age"),
      carTitle: car.fullTitle,
      pickup: trip.pickupIso ? `${trip.pickupLabel} — ${fmtWhenForAlert(trip.pickupIso)}` : undefined,
      dropoff: trip.dropoffIso
        ? `${trip.returnLabel} — ${fmtWhenForAlert(trip.dropoffIso)}`
        : undefined,
      days: trip.pickupIso ? `${trip.days} يوم` : undefined,
      rental: rentalTab,
      idKind: idDocKind === "SAUDI_ID" ? "هوية/إقامة" : "جواز سفر",
      idNumber: (idDocKind === "SAUDI_ID" ? nationalId : passportNumber).trim() || undefined,
      licenseNo: licenseNumber.trim() || undefined,
      licenseExpiry: licenseExpiryDdmmyy.trim() || undefined,
      idImage: idCardUrl ? "مرفوعة" : "لم تُرفع",
      licenseImage: licenseDocUrl ? "مرفوعة" : "لم تُرفع",
      coupon: appliedCoupon?.code,
      editingBooking:
        excludeBookingRequestIdFromUrl != null ? String(excludeBookingRequestIdFromUrl) : undefined,
      ...extra,
    };
  }

  /**
   * يعرض الخطأ للزائر **ويسجّل سببه** في سجل النشاط. بدون التسجيل لا نعرف عند أي
   * حقل ينسحب الزوّار — وهو أهم ما نريد قياسه في نموذج الحجز.
   */
  function failWith(code: string, message: string, extra?: Record<string, string | undefined>) {
    trackEvent("CHECKOUT_ERROR", {
      carModelId: car.modelId,
      detail: code,
      context: failureContext(extra),
    });
    setError(message);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    submitAttemptedRef.current = true;
    trackEvent("CHECKOUT_SUBMIT", { carModelId: car.modelId });
    if (!trip.pickupIso) {
      failWith("NO_DATES", "لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (slotBlocked) {
      // كان يخرج صامتاً: الزائر يضغط فلا يحدث شيء ولا تظهر رسالة — وهو المسار
      // الوحيد في هذا المعالج الذي كان يترك الزرّ يبدو معطّلاً بلا سبب.
      failWith("SLOT_BLOCKED", "السيارة غير متاحة في الفترة المحددة. غيّر تواريخ الحجز للمتابعة.");
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

    if (name.trim().split(/\s+/).filter(Boolean).length < 3) {
      failWith("NAME_INCOMPLETE", "رجاء كتابة الاسم بالكامل");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      failWith("EMAIL_INVALID", "أدخل بريداً إلكترونياً صالحاً لإرسال الفاتورة بعد الدفع.");
      return;
    }

    setKycFieldError(null);
    if (!licenseDocUrl) {
      failWith("LICENSE_IMAGE_MISSING", "يرجى رفع صورة الرخصة (إلزامي).");
      return;
    }
    const lic = licenseNumber.trim();
    if (!/^\d{10}$/.test(lic)) {
      failWith("LICENSE_NUMBER_INVALID", "رقم الرخصة يجب أن يتكوّن من 10 أرقام فقط.");
      return;
    }
    const expYmd = parseDdMmYyToYmd(licenseExpiryDdmmyy);
    if (!expYmd) {
      failWith("LICENSE_EXPIRY_FORMAT", "أدخل تاريخ انتهاء الرخصة بصيغة يوم-شهر-سنة (DD-MM-YY).");
      return;
    }
    if (!rentalLastDayYmdForLicense) {
      failWith("NO_DATES", "لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (expYmd < rentalLastDayYmdForLicense) {
      failWith(
        "LICENSE_EXPIRED_BEFORE_RENTAL",
        `يجب أن يكون تاريخ انتهاء الرخصة في أو بعد آخر يوم من الإيجار (أقل تاريخ صالح: ${formatYmdAsDdMmYy(rentalLastDayYmdForLicense)}).`,
      );
      return;
    }
    let idDocumentKindForApi: "CITIZEN" | "RESIDENT" | "VISITOR";
    if (idDocKind === "SAUDI_ID") {
      const nid = nationalId.replace(/\D/g, "");
      if (!/^1\d{9}$/.test(nid) && !/^2\d{9}$/.test(nid)) {
        failWith("NATIONAL_ID_INVALID", "رقم الهوية أو الإقامة: 10 أرقام؛ يبدأ بـ 1 للمواطن أو بـ 2 للمقيم.");
        return;
      }
      idDocumentKindForApi = nid.startsWith("1") ? "CITIZEN" : "RESIDENT";
    } else {
      const p = passportNumber.trim().toUpperCase();
      if (p.length < 6 || p.length > 24) {
        failWith("PASSPORT_LENGTH", "أدخل رقم الجواز (6–24 حرفاً).");
        return;
      }
      if (!/^[A-Z0-9\-]+$/.test(p)) {
        failWith("PASSPORT_CHARS", "رقم الجواز: أحرف إنجليزية وأرقام وشرطة فقط.");
        return;
      }
      idDocumentKindForApi = "VISITOR";
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

    if (pickupMode === "BRANCH" && trip.pickupIso && !tabFlags?.allowHolidayBooking) {
      const sch = lookupBranchOpeningSchedule(bookingCities, trip.pickupBranchSlugForHours);
      if (!isDateTimeWithinBranchSchedule(new Date(trip.pickupIso), sch)) {
        trackEvent("CHECKOUT_ERROR", {
          carModelId: car.modelId,
          detail: "BRANCH_HOURS_PICKUP",
          context: failureContext(),
        });
        setBranchHoursMessage(
          `${trip.pickupLabel}: الفرع غير متاح في الوقت المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.`,
        );
        setBranchHoursOpen(true);
        return;
      }
    }
    if (trip.dropoffIso && trip.branchSlug && !tabFlags?.allowHolidayBooking) {
      const schR = lookupBranchOpeningSchedule(bookingCities, trip.branchSlug);
      if (!isDateTimeWithinBranchSchedule(new Date(trip.dropoffIso), schR)) {
        trackEvent("CHECKOUT_ERROR", {
          carModelId: car.modelId,
          detail: "BRANCH_HOURS_RETURN",
          context: failureContext(),
        });
        setBranchHoursMessage(
          `${trip.returnLabel}: الفرع غير متاح في وقت التسليم المحدّد. عدّل الموعد أو الفرع.`,
        );
        setBranchHoursOpen(true);
        return;
      }
    }

    const body: Record<string, unknown> = {
      carModelId: car.modelId,
      name,
      phone,
      age,
      branch: trip.branchSlug,
      pickupDate: trip.pickupIso,
      days: trip.days,
      rental: rentalTab,
      ...(trip.dropoffIso ? { dropoffDate: trip.dropoffIso } : {}),
      terms,
      pickupMode,
      addonIds: [...selected],
      ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      email,
      idDocumentKind: idDocumentKindForApi,
      nationalIdNumber: idDocKind === "SAUDI_ID" ? nationalId.replace(/\D/g, "") : "",
      passportNumber: idDocKind === "VISITOR" ? passportNumber.trim().toUpperCase() : "",
      licenseNumber: lic,
      licenseExpiryDate: expYmd,
      ...(idCardUrl ? { idCardImageUrl: idCardUrl } : {}),
      driverLicenseImageUrl: licenseDocUrl,
    };
    if (excludeBookingRequestIdFromUrl != null) {
      body.excludeBookingRequestId = excludeBookingRequestIdFromUrl;
    }
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
    if (pickupMode === "BRANCH") {
      body.pickupBranch = trip.pickupBranchSlugForHours;
    }

    setPending(true);
    try {
      const res = await fetch("/api/bookings/direct/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        bookingRequestId?: number;
        draftToken?: string;
        retryAfterSec?: number;
      };
      if (data.ok && data.bookingRequestId) {
        router.push(`/fleet/payment/${data.bookingRequestId}`);
        return;
      }
      if (data.ok && data.draftToken) {
        router.push(
          `/fleet/checkout/otp?token=${encodeURIComponent(data.draftToken)}&modelId=${encodeURIComponent(String(car.modelId))}`,
        );
        return;
      }
      if (isDirectBookingCapacityMessage(data.error)) {
        trackEvent("CHECKOUT_ERROR", {
          carModelId: car.modelId,
          detail: "CAPACITY_FULL",
          context: failureContext({ serverError: data.error }),
        });
        setPostCapacityModal(true);
        return;
      }
      if (isBranchOutsideHoursBookingError(data.error)) {
        trackEvent("CHECKOUT_ERROR", {
          carModelId: car.modelId,
          detail: "BRANCH_HOURS_SERVER",
          context: failureContext({ serverError: data.error }),
        });
        setBranchHoursMessage(stripBranchHoursErrorCodeForDisplay(data.error ?? ""));
        setBranchHoursOpen(true);
        return;
      }
      failWith("SERVER_REJECTED", data.error ?? "تعذّر إرسال الطلب.", {
        serverError: data.error,
      });
    } catch {
      failWith("NETWORK", "تعذّر الاتصال بالخادم.");
    } finally {
      setPending(false);
    }
  }

  const pu = fmtWhen(trip.pickupIso);
  const du = fmtWhen(trip.dropoffIso);
  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );

  const contactNameDefault = editPrefill?.fullName ?? "";
  const contactPhoneDefault = editPrefill?.phoneLocal ?? "";
  const contactEmailDefault =
    editPrefill != null
      ? (editPrefill.email?.trim() || sessionCustomer?.email?.trim() || "")
      : "";
  const contactAgeDefault = editPrefill?.ageRange ?? "25-35";
  /** عند تعديل حجز قائم: الاسم والجوال مرتبطان بالطلب ولا يُسمح بتغييرهما من الواجهة. */
  const identityFieldsReadOnly = editPrefill != null;

  const showCarUnavailableModal =
    (slotBlocked && !unavailableDismissed) || postCapacityModal;

  // «السيارة غير متاحة» يقتل الحجز قبل أن يبدأ الزائر، ولا يترك أثراً في السجل
  // لأنه مودال لا صفحة — فنسجّله صراحةً مرة واحدة لكل ظهور.
  const unavailableTracked = useRef(false);
  useEffect(() => {
    if (!showCarUnavailableModal) {
      unavailableTracked.current = false;
      return;
    }
    if (unavailableTracked.current) return;
    unavailableTracked.current = true;
    trackEvent("CAR_UNAVAILABLE", { carModelId: car.modelId });
  }, [showCarUnavailableModal, car.modelId]);

  /**
   * لقطة حيّة من حقول الهوية — يقرأها مستمع الانسحاب أدناه. المستمع يُسجَّل مرة
   * واحدة فلا يرى الحالة إلا عبر مرجع يُحدَّث في كل رسم.
   */
  const kycSnapshotRef = useRef({ idDocKind, nationalId, passportNumber, licenseNumber, licenseExpiryDdmmyy, idCardUrl, licenseDocUrl });
  kycSnapshotRef.current = { idDocKind, nationalId, passportNumber, licenseNumber, licenseExpiryDdmmyy, idCardUrl, licenseDocUrl };

  /**
   * أعمق مرحلة بلغها الزائر داخل النموذج، بترتيب ظهور الحقول. تُرسَل عند مغادرة
   * الصفحة لمن لم يضغط زر التأكيد أصلاً — وهؤلاء كانوا حتى الآن بلا أثر إطلاقاً.
   */
  function deepestCheckoutStep(): string {
    const k = kycSnapshotRef.current;
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const filled = (field: string) => String(fd?.get(field) ?? "").trim().length > 0;

    if (fd?.get("terms") === "on") return "terms";
    if (k.licenseExpiryDdmmyy.trim()) return "license_expiry";
    if (/^\d{10}$/.test(k.licenseNumber.trim())) return "license_no";
    if (k.licenseNumber.trim()) return "license_no_partial";
    if (k.idDocKind === "VISITOR" ? k.passportNumber.trim() : k.nationalId.trim()) return "id_number";
    if (k.licenseDocUrl) return "license_image";
    if (k.idCardUrl) return "id_image";
    if (filled("email")) return "email";
    if (filled("phone")) return "phone";
    if (filled("name")) return "name";
    return "opened";
  }

  useEffect(() => {
    function reportAbandon() {
      if (submitAttemptedRef.current || abandonSentRef.current) return;
      abandonSentRef.current = true;
      trackEvent("CHECKOUT_ABANDON", {
        carModelId: car.modelId,
        detail: `${deepestCheckoutStep()}:${Math.round((Date.now() - openedAtRef.current) / 1000)}s`,
      });
    }
    // `pagehide` يغطّي إغلاق التبويب والرجوع للخلف، و`visibilitychange` يغطّي
    // تبديل التطبيقات على الجوال — وهو الأشيع هنا لأن أغلب الزوار على الجوال.
    //
    // لكن فتح الكاميرا لتصوير الرخصة يُخفي الصفحة أيضاً وليس انسحاباً: لذلك
    // نتجاهل الإخفاء أثناء الرفع، ونُعيد التسليح عند العودة. النتيجة أن الزائر
    // قد يُنتج أكثر من حدث — **الأخير** هو الحالة النهائية عند التحليل.
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (uploadingRef.current || pickerOpenRef.current) return;
        reportAbandon();
      } else {
        pickerOpenRef.current = false;
        abandonSentRef.current = false;
      }
    }
    window.addEventListener("pagehide", reportAbandon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", reportAbandon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [car.modelId]);

  const prefillBookingRequestIdBanner = sp.get("prefillBookingRequestId")?.trim() ?? "";
  const excludeBookingRequestIdBanner = sp.get("excludeBookingRequestId")?.trim() ?? "";
  const isFreshRebookCheckoutBanner =
    sp.get("rebook") === "1" &&
    /^\d+$/.test(prefillBookingRequestIdBanner) &&
    !/^\d+$/.test(excludeBookingRequestIdBanner);

  /**
   * ويدجت البحث كان يتصدّر صفحة الحجز فيملأ أول شاشة على الجوال — والزائر الذي ضغط
   * «احجز الآن» يقرأها كأنه رُدَّ إلى بداية البحث. سجل النشاط أظهر تنقّلاً متكرراً
   * `/fleet/checkout → /fleet` بلا محاولة إرسال واحدة، فصار الويدجت مطوياً.
   *
   * يُفتح وحده في الحالتين اللتين لا يُكمَل الحجز بدونه: غياب التواريخ، وإعادة حجز
   * سابق حيث المطلوب صراحةً اختيار تواريخ جديدة.
   */
  const [tripEditorOpen, setTripEditorOpen] = useState(
    () => !trip.pickupIso || sp.get("rebook") === "1",
  );
  const tripEditorRef = useRef<HTMLDivElement | null>(null);

  /**
   * «غيّر التواريخ» في مودالات عدم التوفّر ومواعيد الفرع.
   *
   * كانت تنفّذ `router.replace("/fleet/checkout?modelId=X")` فتمسح `pickup` و`dropoff`
   * و`days` والفرع معاً — والنتيجة أن الزائر يعود إلى صفحة بلا تواريخ، فيصبح زرّ
   * التأكيد معطّلاً بلا سبب ظاهر بعد أن يكون قد ملأ بياناته كلها. الصحيح إبقاء
   * السياق كما هو وفتح محرّر التواريخ عنده مباشرة.
   */
  function openTripEditorToChangeDates() {
    setUnavailableDismissed(true);
    setPostCapacityModal(false);
    setBranchHoursOpen(false);
    setTripEditorOpen(true);
    // بعد إغلاق المودال والرسم: المحرّر أعلى الصفحة والزائر غالباً عند الزرّ أسفلها.
    window.setTimeout(() => {
      tripEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  /**
   * سبب تعطّل زرّ التأكيد بالعربية. الزرّ يبهت فقط عند التعطيل، فبدون هذا السطر
   * يبدو «جافاً» بلا تفسير — وهو أكثر ما يوقف الزوّار بعد ملء النموذج كاملاً.
   */
  const submitBlockedReason = !trip.pickupIso
    ? "حدّد تواريخ الحجز أولاً."
    : slotBlocked
      ? "السيارة غير متاحة في الفترة المحددة."
      : uploadingKyc !== null
        ? "جارٍ رفع الصورة… انتظر حتى يكتمل الرفع."
        : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface pb-[76px] lg:pb-0">
      <SiteNav active="fleet" />
      <div className={`pt-24 pb-20 transition-opacity duration-500 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Stepper */}
          <BookingStepper currentStep={2} modelId={car.modelId} />

          <div className="mb-10 space-y-3">
            {/* {sp.get("rebook") === "1" ? (
              <div className="rounded-2xl border border-[#dbb878]/40 bg-[#fffdf9] px-4 py-3 text-center text-[13px] font-semibold leading-relaxed text-[#5c4d2e]">
                {isFreshRebookCheckoutBanner ? (
                  <>
                    حدّدوا <span className="text-[#003749]">تاريخ ووقت الاستلام والتسليم</span> في التقويم أدناه، ثم
                    «تطبيق التواريخ على الحجز» لتحديث السعر والتوفر. الفروع كما في حجزكم السابق.
                  </>
                ) : (
                  <>
                    يمكنكم تغيير <span className="text-[#003749]">الفروع أو طريقة الاستلام أو التواريخ</span> في
                    النموذج أدناه، ثم «تطبيق التواريخ على الحجز» لتحديث السعر والتوفر.
                  </>
                )}
              </div>
            ) : trip.pickupIso ? (
              <p className="text-center text-[13px] font-semibold leading-relaxed text-[#6b5a3b]">
                لتغيير التواريخ أو الفروع: عدّلوا الحقول أدناه ثم «تطبيق التواريخ على الحجز».
              </p>
            ) : null} */}
            <div
              ref={tripEditorRef}
              dir="rtl"
              className="rounded-2xl border border-[#ebe4d3] bg-white/70 scroll-mt-24"
            >
              <button
                type="button"
                onClick={() => setTripEditorOpen((v) => !v)}
                aria-expanded={tripEditorOpen}
                aria-controls="trip-editor"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-[#003749]">
                    تعديل التواريخ أو الفرع
                  </span>
                  {trip.pickupIso ? (
                    <span className="mt-0.5 block truncate text-[12px] font-semibold text-[#6b5a3b]">
                      {pu.date} {pu.time} ← {du.date} {du.time}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[12px] font-bold text-red-600">
                      لم تُحدَّد تواريخ الحجز بعد
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-[#8a7752] transition-transform ${
                    tripEditorOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {tripEditorOpen ? (
                <div id="trip-editor" className="border-t border-[#ebe4d3] p-3">
                  <BookingWidget
                    cities={bookingCities}
                    variant="checkout"
                    checkoutModelId={car.modelId}
                    tabFlags={tabFlags}
                    initialFromUrl={fleetUrlHydrate}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Core Layout */}
          <div dir="rtl" className="grid gap-8 lg:grid-cols-[1fr_360px] xl:gap-12">
            {/* ─── Main Content (Left side in LTR, Right side in RTL) ─── */}
            {/* على الجوال: كارت السيارة والسعر أولاً ثم الفورم (انظر `order` على الطرفين).
                عكسُه كان يضع السيارة المختارة في آخر صفحة طولها خمس شاشات، فيواجه الزائرَ
                طلبُ رفع صورة رخصته قبل أن يرى ما اختاره أو كم سيدفع. على lg يعود الفورم
                لليمين والملخص لعمود جانبي لاصق. */}
            <div className="order-2 space-y-8 lg:order-1">
              {/* Header Title */}
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">
                  بيانات الحجز
                </h1>

              </div>

              {/* KYC — هوية / جواز + رخصة */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-sm font-extrabold text-white shadow-sm">
                    1
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">الهوية والرخصة</h2>
                </div>
                <p className="text-[13px] font-semibold leading-relaxed text-[#6b5a3b]">
                  صورة الرخصة <span className="font-extrabold text-red-600">إلزامية</span> — صورة الهوية أو الجواز اختيارية.
                </p>

                <div className="rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIdDocKind("SAUDI_ID");
                        setPassportNumber("");
                        setKycFieldError(null);
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${idDocKind === "SAUDI_ID"
                        ? "bg-[#003749] text-white ring-2 ring-[#dbb878]/50"
                        : "border border-[#ebe4d3] bg-[#fdfbf6] text-[#003749] hover:border-[#dbb878]/40"
                        }`}
                    >
                      مواطن/مقيم
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIdDocKind("VISITOR");
                        setNationalId("");
                        setKycFieldError(null);
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${idDocKind === "VISITOR"
                        ? "bg-[#003749] text-white ring-2 ring-[#dbb878]/50"
                        : "border border-[#ebe4d3] bg-[#fdfbf6] text-[#003749] hover:border-[#dbb878]/40"
                        }`}
                    >
                      زائر
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {idDocKind === "VISITOR" ? (
                      <div className="group relative sm:col-span-2">
                        <input
                          type="text"
                          autoComplete="off"
                          value={passportNumber}
                          onChange={(e) =>
                            setPassportNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 24))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              document.getElementById("checkout-license-no")?.focus();
                            }
                          }}
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
                    ) : (
                      <div className="group relative sm:col-span-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={10}
                          value={nationalId}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setNationalId(val);
                            if (val.length === 10) {
                              document.getElementById("checkout-license-no")?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              document.getElementById("checkout-license-no")?.focus();
                            }
                          }}
                          id="checkout-national-id"
                          className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                          placeholder=" "
                          dir="ltr"
                        />
                        <label
                          htmlFor="checkout-national-id"
                          className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                        >
                          الهوية الوطنية أو الإقامة
                        </label>
                      </div>
                    )}

                    <div className="group relative sm:col-span-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{10}"
                        maxLength={10}
                        value={licenseNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setLicenseNumber(val);
                          if (val.length === 10) {
                            setTimeout(() => {
                              document.getElementById("checkout-license-expiry")?.focus();
                            }, 150);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            document.getElementById("checkout-license-expiry")?.focus();
                          }
                        }}
                        id="checkout-license-no"
                        className="peer w-full rounded-xl border border-[#ebe4d3] bg-transparent px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                        placeholder=" "
                        dir="ltr"
                      />
                      <label
                        htmlFor="checkout-license-no"
                        className="absolute start-4 top-4 text-[13px] font-bold text-[#aaa08e] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#dbb878] peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-[10px]"
                      >
                        {idDocKind === "VISITOR" ? "رقم الرخصة الدولية" : "رقم رخصة القيادة"}
                      </label>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="checkout-license-expiry"
                        className="mb-1.5 block text-[13px] font-bold text-[#003749]"
                      >
                        تاريخ انتهاء الرخصة
                        <span className="text-red-600"> *</span>
                        <span className="ms-1 font-mono text-[12px] font-semibold text-[#6b5a3b]">
                          (DD-MM-YY)
                        </span>
                      </label>
                      <DdMmYyDateWithPicker
                        id="checkout-license-expiry"
                        value={licenseExpiryDdmmyy}
                        onChange={(e) => setLicenseExpiryDdmmyy(e.target.value)}
                        onBlur={() => {
                          const ymd = parseDdMmYyToYmd(licenseExpiryDdmmyy);
                          if (ymd) setLicenseExpiryDdmmyy(formatYmdAsDdMmYy(ymd));
                        }}
                        nativeYmd={licenseExpiryNativeYmd}
                        onCalendarSelect={(ymd) => {
                          setLicenseExpiryDdmmyy(formatYmdAsDdMmYy(ymd));
                        }}
                        minYmd={rentalLastDayYmdForLicense ?? undefined}
                        required
                        rowClassName="w-full"
                        inputClassName="!rounded-xl !border-[#ebe4d3] !bg-white py-2.5 text-[14px] font-mono tracking-wide text-[#003749]"
                        buttonClassName="!rounded-xl !border-[#ebe4d3]"
                      />
                      {rentalLastDayYmdForLicense ? (
                        <p
                          id="checkout-license-expiry-hint"
                          className="mt-1.5 text-[12px] font-semibold text-[#6b5a3b]"
                        >
                          أقل تاريخ صالح لانتهاء الرخصة (آخر يوم إيجار):{" "}
                          <span dir="ltr" className="font-mono font-bold text-[#003749]">
                            {formatYmdAsDdMmYy(rentalLastDayYmdForLicense)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {/* ID Card Upload */}
                    <div className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-[#dbb878]/40 bg-gradient-to-br from-[#fffef9] to-[#fdf9f0] p-5 transition-all hover:border-[#dbb878]/70 hover:shadow-[0_4px_16px_-6px_rgba(219,184,120,0.25)]">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-[#f4f0ea] text-[#dbb878]">
                          <UserRound className="size-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-[13px] font-extrabold text-[#003749]">صورة الهوية أو الجواز</p>
                          <p className="text-[11px] font-semibold text-[#aaa08e]">اختياري</p>
                        </div>
                      </div>
                      {idCardUrl ? (
                        <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#ebe4d3] bg-white shadow-sm">
                          <Image src={idCardUrl} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw,280px" unoptimized />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-bold text-[#003749]">تغيير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex h-20 items-center justify-center rounded-xl border border-dashed border-[#dbb878]/30 bg-[#fdfbf6]">
                          <div className="text-center">
                            <UserRound className="mx-auto mb-1 size-6 text-[#dbb878]/60" />
                            <p className="text-[11px] font-semibold text-[#aaa08e]">اسحب الصورة هنا أو اضغط للتحديد</p>
                          </div>
                        </div>
                      )}
                      <label className="relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#003749] px-4 py-2.5 text-[12px] font-bold text-white transition-all hover:bg-[#004d63]">
                        <FileImage className="size-3.5" />
                        {uploadingKyc === "id" ? "جاري الرفع…" : (idCardUrl ? "تغيير" : "اختر ملفاً")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          disabled={uploadingKyc !== null}
                          onClick={() => {
                            pickerOpenRef.current = true;
                          }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            pickerOpenRef.current = false;
                            if (f) void uploadKycImage(f, "id");
                          }}
                        />
                      </label>
                    </div>

                    {/* License Upload */}
                    <div className="group relative overflow-hidden rounded-2xl border-2 border-[#dbb878]/60 bg-gradient-to-br from-[#fffef9] to-[#fdf9f0] p-5 shadow-[0_0_0_1px_rgba(219,184,120,0.15)] transition-all hover:border-[#dbb878] hover:shadow-[0_4px_16px_-6px_rgba(219,184,120,0.35)]">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-[#dbb878]/20 text-[#c9a356]">
                          <FileImage className="size-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-[13px] font-extrabold text-[#003749]">صورة رخصة القيادة</p>
                          <p className="text-[11px] font-extrabold text-red-600"></p>
                        </div>
                      </div>
                      {licenseDocUrl ? (
                        <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#dbb878]/30 bg-white shadow-sm">
                          <Image src={licenseDocUrl} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw,280px" unoptimized />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-bold text-[#003749]">تغيير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex h-20 items-center justify-center rounded-xl border border-dashed border-[#dbb878]/50 bg-[#fffdf9]">
                          <div className="text-center">
                            <FileImage className="mx-auto mb-1 size-6 text-[#dbb878]/70" />
                            <p className="text-[11px] font-semibold text-[#aaa08e]">اسحب الصورة هنا أو اضغط للتحديد</p>
                          </div>
                        </div>
                      )}
                      <label className="relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-[12px] font-bold text-white transition-all"
                        style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`, boxShadow: '0 4px 12px -4px rgba(219,184,120,0.5)' }}>
                        <FileImage className="size-3.5" />
                        {uploadingKyc === "license" ? "جاري الرفع…" : (licenseDocUrl ? "تغيير الرخصة" : "ارفع صورة الرخصة")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          disabled={uploadingKyc !== null}
                          onClick={() => {
                            pickerOpenRef.current = true;
                          }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            pickerOpenRef.current = false;
                            if (f) void uploadKycImage(f, "license");
                          }}
                        />
                      </label>
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
                  <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-sm font-extrabold text-white shadow-sm">
                    2
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">إضافات وتأمين</h2>
                  <span className="rounded-full border border-[#ebe4d3] bg-[#fdfbf6] px-2.5 py-0.5 text-[11px] font-bold text-[#aaa08e]">اختياري</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {addons.length === 0 ? (
                    <div className="col-span-2 rounded-2xl border border-dashed border-[#ebe4d3] bg-white p-8 text-center">
                      <p className="text-[14px] font-semibold text-[#aaa08e]">لا توجد إضافات متاحة لهذه المركبة.</p>
                    </div>
                  ) : (
                    addons.map((a) => {
                      const on = selected.has(a.id);
                      const infoOpen = openAddonInfoId === a.id;
                      const infoId = `addon-info-${a.id}`;
                      const infoText = a.info?.trim() || "";
                      return (
                        <label
                          key={a.id}
                          className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_8px_24px_-10px_rgba(219,184,120,0.25)] ${on
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
                            className={`absolute start-4 top-4 flex size-5 items-center justify-center rounded border transition-colors ${on ? `border-[${GOLD}] bg-[${GOLD}]` : "border-[#d1ccbf] bg-white group-hover:border-[#dbb878]"
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
                              <span className="text-[15px] font-extrabold text-[#003749]">{a.title}</span>
                              {infoText ? (
                                <span className="relative inline-flex">
                                  <button
                                    type="button"
                                    aria-expanded={infoOpen}
                                    aria-controls={infoId}
                                    aria-label={`شرح ${a.title}`}
                                    className="inline-flex size-5 items-center justify-center rounded-full border border-[#d9d0bf] text-[#8f8573] transition-colors hover:border-[#dbb878] hover:text-[#dbb878]"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setOpenAddonInfoId((prev) => (prev === a.id ? null : a.id));
                                    }}
                                  >
                                    <Info className="size-3.5" />
                                  </button>
                                  <span
                                    id={infoId}
                                    role="tooltip"
                                    className={`pointer-events-none absolute bottom-full end-0 z-30 mb-1 w-56 rounded-xl border border-[#ebe4d3] bg-white p-3 text-[12px] leading-relaxed text-[#5f5341] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)] transition-all duration-150 ${infoOpen ? "opacity-100" : "opacity-0"
                                      }`}
                                    style={{
                                      transform: `translateY(${infoOpen ? "0" : "4px"})`,
                                    }}
                                  >
                                    {infoText}
                                    <span
                                      aria-hidden
                                      className="absolute end-2 top-full size-2 -translate-y-1/2 rotate-45 border-b border-r border-[#ebe4d3] bg-white"
                                    />
                                  </span>
                                </span>
                              ) : null}
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
                              className={`text-[12px] font-bold transition-colors ${on ? "text-[#dbb878]" : "text-[#aaa08e] group-hover:text-[#003749]"
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
              {/* <section>
                <div className="relative overflow-hidden rounded-2xl border border-[#dbb878]/30 bg-gradient-to-r from-[#003749] to-[#004d63] p-5 shadow-[0_8px_24px_-10px_rgba(0,55,73,0.3)]">
                  <div className="absolute -end-6 -top-6 size-24 rounded-full bg-[#dbb878]/10" />
                  <div className="absolute -bottom-4 end-12 size-16 rounded-full bg-[#dbb878]/8" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#dbb878]/20 text-[#dbb878]">
                      <CreditCard className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-extrabold text-white">قسّمها على 4 دفعات بدون فوائد</h3>
                      <p className="mt-0.5 text-[12px] font-semibold text-white/60">متوفر عبر تابي وتمارا — تختار عند الدفع</p>
                    </div>
                    <div className="ms-auto flex gap-2">
                      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-[#dbb878] backdrop-blur-sm">تابي</span>
                      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-[#dbb878] backdrop-blur-sm">تمارا</span>
                    </div>
                  </div>
                </div>
              </section> */}

              {/* Customer Details Form */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-sm font-extrabold text-white shadow-sm">
                    3
                  </span>
                  <h2 className="text-xl font-extrabold text-[#003749]">بيانات التواصل</h2>
                </div>

                <form
                  key={`checkout-${car.modelId}-${editPrefill?.bookingRequestId ?? "new"}`}
                  ref={formRef}
                  onSubmit={handleSubmit}
                  onKeyDown={handleCheckoutFormKeyDown}
                  className="rounded-3xl border border-[#ebe4d3] bg-white p-6 shadow-sm sm:p-8"
                >
                  {sessionCustomer && !editPrefill ? (
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
                          readOnly={identityFieldsReadOnly}
                          defaultValue={contactNameDefault}
                          className={`peer w-full rounded-xl border border-[#ebe4d3] px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all ${identityFieldsReadOnly
                            ? "cursor-default bg-[#f4f2ec] focus:border-[#ebe4d3] focus:ring-0"
                            : "bg-transparent focus:border-[#dbb878] focus:ring-1 focus:ring-[#dbb878]"
                            }`}
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
                        <div
                          className={`flex w-full overflow-hidden rounded-xl border border-[#ebe4d3] transition-all ${identityFieldsReadOnly
                            ? "bg-[#f4f2ec]"
                            : "focus-within:border-[#dbb878] focus-within:ring-1 focus-within:ring-[#dbb878]"
                            }`}
                        >
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
                              readOnly={identityFieldsReadOnly}
                              defaultValue={contactPhoneDefault}
                              className={`peer w-full px-4 pb-2 pt-6 text-[14px] font-semibold text-[#003749] outline-none ${identityFieldsReadOnly
                                ? "cursor-default bg-transparent focus:ring-0"
                                : "bg-transparent"
                                }`}
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
                          defaultValue={contactAgeDefault}
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
                          defaultValue={contactEmailDefault}
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
                      أوافق على{" "}
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="text-[#dbb878] hover:underline"
                      >
                        الشروط والأحكام
                      </button>{" "}
                      وسياسة التأجير.
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
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-4 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-8px_rgba(219,184,120,0.6)] active:translate-y-0"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                      boxShadow: "0 8px 24px -6px rgba(219,184,120,0.45)",
                    }}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/25 to-white/0 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
                    {pending ? (
                      <Loader2 className="size-5 animate-spin text-white" />
                    ) : (
                      <CheckCircle2 className="size-5 text-white/90" />
                    )}
                    <span className="text-[15px] font-extrabold tracking-wide text-white">
                      {pending ? "جاري المعالجة..." : "تأكيد البيانات والمتابعة"}
                    </span>
                  </button>

                  {submitBlockedReason && !pending ? (
                    <p
                      dir="rtl"
                      role="status"
                      className="mt-3 text-center text-[12.5px] font-bold leading-relaxed text-[#8a7752]"
                    >
                      {submitBlockedReason}
                      {uploadingKyc === null ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={openTripEditorToChangeDates}
                            className="font-extrabold text-[#003749] underline decoration-[#dbb878] underline-offset-4 hover:text-[#dbb878]"
                          >
                            تعديل التواريخ
                          </button>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </form>
              </section>
            </div>

            {/* ─── Sidebar (Checkout Summary) ─── */}
            <aside id="order-summary" className="order-1 scroll-mt-24 lg:order-2">
              <div className="sticky top-24 overflow-hidden rounded-3xl border border-[#ebe4d3] bg-white shadow-[0_24px_60px_-20px_rgba(15,61,71,0.15)]">
                {/* Car Image Area */}
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#fdfbf6] via-[#f7f2e9] to-[#f0ebe0]">
                  <Image
                    src={car.image}
                    alt={car.alt}
                    fill
                    className="object-contain p-6 drop-shadow-2xl transition-transform duration-700 hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                  <div className="absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold text-[#003749] backdrop-blur-sm shadow-md ring-1 ring-[#dbb878]/20">
                    {car.categoryTitle}
                  </div>
                  {/* Subtle shimmer overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
                </div>

                {/* Content Area */}
                <div className="p-6">
                  <h2 className="text-xl font-extrabold leading-tight text-[#003749]">
                    {car.fullTitle}
                  </h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#8a7752]">أو مركبة مشابهة من نفس الفئة</p>

                  <div className="mt-3 rounded-xl border border-[#ebe4d3] bg-[#fdfbf6] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-[#5c4d38]">
                    {car.discountLabelAr && !appliedCoupon ? (
                      <p className="mb-2 text-end">
                        <span className="rounded-md bg-[#c2410c]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#c2410c]">
                          {car.discountLabelAr}
                        </span>
                      </p>
                    ) : null}
                    {rentalPriceDisplayMode === "INCLUSIVE" ? (
                      <p dir="ltr" className="text-end">
                        السعر اليومي:{" "}
                        {car.originalPricePerDayExclTax > car.pricePerDayExclTax ? (
                          <span className="me-2 font-bold text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-80">
                            {formatSarAmount(
                              dailyRentalInclTaxSar(
                                car.originalPricePerDayExclTax,
                                car.vatRatePercent,
                              ),
                            )}{" "}
                            <SarCurrencyGlyph />
                          </span>
                        ) : null}
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
                          {car.originalPricePerDayExclTax > car.pricePerDayExclTax ? (
                            <span className="me-2 font-bold text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-80">
                              {formatSarAmount(car.originalPricePerDayExclTax)} <SarCurrencyGlyph />
                            </span>
                          ) : null}
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
                        السعر اليومي:{" "}
                        {car.originalPricePerDayExclTax > car.pricePerDayExclTax ? (
                          <span className="me-2 font-bold text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-80">
                            {formatSarAmount(car.originalPricePerDayExclTax)} <SarCurrencyGlyph />
                          </span>
                        ) : null}
                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(car.pricePerDayExclTax)} <SarCurrencyGlyph />
                        </span>{" "}
                        <span className="text-[#8a7752]">(غير شامل الضريبة)</span>
                      </p>
                    )}
                    {rentalTab === "weekly" ? (
                      <p dir="ltr" className="mt-2 border-t border-[#ebe4d3] pt-2 text-end">
                        السعر الأسبوعي:{" "}
                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(
                            dailyRentalInclTaxSar(
                              car.pricePerDayExclTax * WEEKLY_TAB_DAYS,
                              car.vatRatePercent,
                            ),
                          )}{" "}
                          <SarCurrencyGlyph />
                        </span>{" "}
                        <span className="text-[#8a7752]">(شامل الضريبة {car.vatRatePercent}%)</span>
                      </p>
                    ) : null}
                    {rentalTab === "monthly" && car.pricePerMonthExclTax != null ? (
                      <p dir="ltr" className="mt-2 border-t border-[#ebe4d3] pt-2 text-end">
                        السعر الشهري:{" "}
                        <span className="font-extrabold text-[#003749]">
                          {formatSarAmount(
                            dailyRentalInclTaxSar(car.pricePerMonthExclTax, car.vatRatePercent),
                          )}{" "}
                          <SarCurrencyGlyph />
                        </span>{" "}
                        <span className="text-[#8a7752]">(شامل الضريبة {car.vatRatePercent}%)</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 space-y-5">
                    {/* Dates block */}
                    <div className="relative ps-5">
                      <div className="absolute bottom-1.5 start-1.5 top-1.5 w-0.5 rounded-full bg-gradient-to-b from-[#dbb878] to-[#003749]/20" />

                      <div className="relative mb-4">
                        <div className="absolute -start-[23px] top-1 size-2.5 rounded-full border-2 border-[#dbb878] bg-white ring-4 ring-white" />
                        <p className="text-[11px] font-bold uppercase text-[#aaa08e]">الاستلام</p>
                        <p className="font-extrabold text-[#003749]">
                          {trip.pickupLabel}
                          {deliveryDistanceKm !== null && (
                            <span className="block mt-0.5 text-[11px] font-bold text-[#c9a356]">
                              يبعد عن الفرع: {deliveryDistanceKm.toFixed(1)} كم
                            </span>
                          )}
                        </p>
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

                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-[#ebe4d3] to-transparent" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#c4b89a]">تفاصيل التسعير</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-[#ebe4d3] to-transparent" />
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-semibold text-[#6b5a3b]">
                          الإيجار ({rentalDurationLabel})
                        </span>
                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.rentalExclTax)} <SarCurrencyGlyph />
                        </span>
                      </div>

                      {selectedRows.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[13px]">
                            <span className="font-semibold text-[#6b5a3b]">
                              الإضافات ({rentalDurationLabel})
                            </span>
                            <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                              {formatSarAmount(totals.addonsExclTax)} <SarCurrencyGlyph />
                            </span>
                          </div>
                          <ul className="space-y-1.5 rounded-lg bg-[#fdfbf6] px-3 py-2 text-[12px] text-[#6b5a3b]">
                            {selectedRows.map((a) => (
                              <li key={a.id} className="flex justify-between gap-3">
                                <span>• {a.title}</span>
                                <span className="tabular-nums font-semibold text-[#003749]" dir="ltr">
                                  {formatSarAmount(a.pricePerDay * trip.days)} <SarCurrencyGlyph />
                                </span>
                              </li>
                            ))}
                          </ul>
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

                      {deliveryFeeSar > 0 && deliveryDistanceKm != null ? (
                        <div className="flex justify-between text-[13px]">
                          <span className="font-semibold text-[#6b5a3b]">
                            رسوم التوصيل ({deliveryDistanceKm.toFixed(1)} كم)
                          </span>
                          <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(deliveryFeeSar)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ) : null}

                      {checkoutOneTimeFees.map((f) => (
                        <div key={f.slug} className="flex justify-between text-[13px]">
                          <span className="max-w-[60%] text-end text-[12px] font-semibold leading-snug text-[#6b5a3b]">
                            {f.label}
                          </span>
                          <span className="shrink-0 font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(f.feeExclVatSar)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ))}

                      {delayPenalty && delayPenaltyExclTax > 0 ? (
                        <div className="flex justify-between text-[13px]">
                          <span className="max-w-[60%] text-end text-[12px] font-semibold leading-snug text-[#6b5a3b]">
                            {delayPenalty.labelAr}
                          </span>
                          <span className="shrink-0 font-bold text-[#003749] tabular-nums" dir="ltr">
                            {formatSarAmount(delayPenaltyExclTax)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ) : null}

                      {/* Coupon Code */}
                      <div className="rounded-lg border border-[#ebe4d3] bg-[#fdfbf6] p-3">
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="font-bold text-[#0f7a3d]">
                              {appliedCoupon.code} — {appliedCoupon.labelAr || "تم تطبيق الخصم"}
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveCoupon}
                              className="shrink-0 text-[12px] font-bold text-[#8a7752] underline underline-offset-2 hover:text-[#c2410c]"
                            >
                              إزالة
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={couponInput}
                              onChange={(e) => {
                                setCouponInput(e.target.value);
                                setCouponError(null);
                              }}
                              placeholder="كود الخصم (إن وُجد)"
                              className="w-full min-w-0 rounded-lg border border-[#ebe4d3] bg-white px-3 py-2 text-[13px] font-semibold text-[#003749] outline-none focus:border-[#dbb878]"
                            />
                            <button
                              type="button"
                              onClick={handleApplyCoupon}
                              disabled={couponChecking || !couponInput.trim()}
                              className="shrink-0 rounded-lg bg-[#003749] px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-50"
                            >
                              {couponChecking ? "..." : "تطبيق"}
                            </button>
                          </div>
                        )}
                        {couponError ? (
                          <p className="mt-1.5 text-[11px] font-bold text-[#c2410c]">{couponError}</p>
                        ) : null}
                      </div>

                      {totals.discountExclTax > 0 ? (
                        <div className="flex justify-between text-[13px]">
                          <span className="font-semibold text-[#0f7a3d]">خصم الكوبون</span>
                          <span className="font-bold text-[#0f7a3d] tabular-nums" dir="ltr">
                            -{formatSarAmount(totals.discountExclTax)} <SarCurrencyGlyph />
                          </span>
                        </div>
                      ) : null}

                      <div className="flex justify-between text-[13px]">
                        <span className="font-semibold text-[#6b5a3b]">ضريبة القيمة المضافة ({car.vatRatePercent}%)</span>
                        <span className="font-bold text-[#003749] tabular-nums" dir="ltr">
                          {formatSarAmount(totals.vatAmount)} <SarCurrencyGlyph />
                        </span>
                      </div>
                    </div>

                    {/* Total Row */}
                    <div className="relative mt-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_8px_24px_-8px_rgba(0,55,73,0.4)]" style={{ background: `linear-gradient(135deg, #003749 0%, #004d63 60%, #005a75 100%)` }}>
                      <div className="absolute -end-4 -top-4 size-20 rounded-full bg-[#dbb878]/10" />
                      <div className="absolute bottom-0 start-0 h-1 w-full" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }} />
                      <div className="relative flex items-end justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">المجموع النهائي</p>
                          <p className="mt-0.5 text-[10px] text-white/40">شامل ضريبة القيمة المضافة</p>
                        </div>
                        <div className="text-end">
                          <p
                            className="text-[28px] font-extrabold tabular-nums tracking-tight leading-none"
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

      {/* شريط الإجمالي الثابت — جوال فقط: يبقي السعر ظاهراً بعد أن يمرّ الزائر
          بكارت الملخص في أعلى الصفحة وينزل إلى الفورم. */}
      <div
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbb878]/30 bg-[#003749]/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
              المجموع النهائي
            </p>
            <p
              className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums text-white"
              dir="ltr"
              aria-label={`${formatSarAmount(totals.totalInclTax)} ريال سعودي`}
            >
              {formatSarAmount(totals.totalInclTax)}{" "}
              <span className="text-[#dbb878]" aria-hidden>
                <SarCurrencyGlyph />
              </span>
            </p>
          </div>
          <a
            href="#order-summary"
            className="shrink-0 rounded-xl border border-[#dbb878]/50 px-3.5 py-2 text-[12px] font-extrabold text-[#dbb878] transition-colors hover:bg-[#dbb878]/10"
          >
            تفاصيل التسعير
          </a>
        </div>
      </div>

      <CarUnavailableModal
        open={showCarUnavailableModal}
        fleetUnits={availability && !availability.loading ? availability.fleetUnits : undefined}
        onClose={() => {
          setUnavailableDismissed(true);
          setPostCapacityModal(false);
        }}
        onChangeDates={openTripEditorToChangeDates}
      />
      <BranchOutsideHoursModal
        open={branchHoursOpen}
        message={branchHoursMessage}
        onClose={() => setBranchHoursOpen(false)}
        onChangeTimes={openTripEditorToChangeDates}
      />
      <RentalTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        terms={rentalTerms}
      />
    </div>
  );
}
