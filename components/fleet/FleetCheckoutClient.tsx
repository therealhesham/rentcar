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
import { formatYmdAsDdMmYy, parseDdMmYyToYmd } from "@/lib/booking-search-shared";
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

  const totals = computeCheckoutTotals(
    car.pricePerDayExclTax,
    trip.days,
    car.vatRatePercent,
    selectedRows.map((a) => ({ pricePerDay: a.pricePerDay })),
    {
      oneTimeFeesExclTax:
        interCityShippingFeeSar + deliveryFeeSar + checkoutFeesSumExclTax + delayPenaltyExclTax,
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
  }, [car.modelId, trip.pickupIso, trip.days, excludeBookingRequestIdFromUrl]);

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
    if (!licenseDocUrl) {
      setError("يرجى رفع صورة الرخصة (إلزامي).");
      return;
    }
    const lic = licenseNumber.trim();
    if (!/^\d{10}$/.test(lic)) {
      setError("رقم الرخصة يجب أن يتكوّن من 10 أرقام فقط.");
      return;
    }
    const expYmd = parseDdMmYyToYmd(licenseExpiryDdmmyy);
    if (!expYmd) {
      setError("أدخل تاريخ انتهاء الرخصة بصيغة يوم-شهر-سنة (DD-MM-YY).");
      return;
    }
    if (!rentalLastDayYmdForLicense) {
      setError("لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (expYmd < rentalLastDayYmdForLicense) {
      setError(
        `يجب أن يكون تاريخ انتهاء الرخصة في أو بعد آخر يوم من الإيجار (أقل تاريخ صالح: ${formatYmdAsDdMmYy(rentalLastDayYmdForLicense)}).`,
      );
      return;
    }
    let idDocumentKindForApi: "CITIZEN" | "RESIDENT" | "VISITOR";
    if (idDocKind === "SAUDI_ID") {
      const nid = nationalId.replace(/\D/g, "");
      if (!/^1\d{9}$/.test(nid) && !/^2\d{9}$/.test(nid)) {
        setError("رقم الهوية أو الإقامة: 10 أرقام؛ يبدأ بـ 1 للمواطن أو بـ 2 للمقيم.");
        return;
      }
      idDocumentKindForApi = nid.startsWith("1") ? "CITIZEN" : "RESIDENT";
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

    if (pickupMode === "BRANCH" && trip.pickupIso) {
      const sch = lookupBranchOpeningSchedule(bookingCities, trip.pickupBranchSlugForHours);
      if (!isDateTimeWithinBranchSchedule(new Date(trip.pickupIso), sch)) {
        setBranchHoursMessage(
          `${trip.pickupLabel}: الفرع غير متاح في الوقت المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.`,
        );
        setBranchHoursOpen(true);
        return;
      }
    }
    if (trip.dropoffIso && trip.branchSlug) {
      const schR = lookupBranchOpeningSchedule(bookingCities, trip.branchSlug);
      if (!isDateTimeWithinBranchSchedule(new Date(trip.dropoffIso), schR)) {
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
        setPostCapacityModal(true);
        return;
      }
      if (isBranchOutsideHoursBookingError(data.error)) {
        setBranchHoursMessage(stripBranchHoursErrorCodeForDisplay(data.error ?? ""));
        setBranchHoursOpen(true);
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

  const prefillBookingRequestIdBanner = sp.get("prefillBookingRequestId")?.trim() ?? "";
  const excludeBookingRequestIdBanner = sp.get("excludeBookingRequestId")?.trim() ?? "";
  const isFreshRebookCheckoutBanner =
    sp.get("rebook") === "1" &&
    /^\d+$/.test(prefillBookingRequestIdBanner) &&
    !/^\d+$/.test(excludeBookingRequestIdBanner);

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfbf6] text-on-surface">
      <SiteNav active="fleet" />
      <div className={`pt-24 pb-20 transition-opacity duration-500 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Stepper */}
          <BookingStepper currentStep={2} modelId={car.modelId} />

          <div className="mb-10 space-y-3">
            {sp.get("rebook") === "1" ? (
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
            ) : null}
            <BookingWidget
              cities={bookingCities}
              variant="checkout"
              checkoutModelId={car.modelId}
              tabFlags={tabFlags}
              initialFromUrl={fleetUrlHydrate}
            />
          </div>

          {/* Core Layout */}
          <div dir="rtl" className="grid gap-8 lg:grid-cols-[1fr_360px] xl:gap-12">
            {/* ─── Main Content (Left side in LTR, Right side in RTL) ─── */}
            <div className="order-2 space-y-8 lg:order-1">
              {/* Header Title */}
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-3xl">
                  بيانات الحجز
                </h1>
                <p className="mt-2 text-[14px] text-[#6b5a3b]">
                  ارفعوا صورة الرخصة (إلزامي)، وصورة الهوية أو الجواز إن وُجدت. ثم راجعوا الإضافات وبيانات التواصل.
                  تُرسل الفاتورة إلى بريدكم بعد الدفع.
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
                  صورة الرخصة <span className="text-red-600">إلزامية</span> — صورة الهوية أو الجواز اختيارية.
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
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${
                        idDocKind === "SAUDI_ID"
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
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-colors ${
                        idDocKind === "VISITOR"
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
                        onChange={(e) =>
                          setLicenseNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
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

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div className="rounded-2xl border border-dashed border-[#dbb878]/50 bg-[#fffdf9] p-4">
                      <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[#003749]">
                        <UserRound className="size-4 text-[#dbb878]" aria-hidden />
                        صورة الهوية أو الجواز
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

                    <div className="rounded-2xl border border-[#ebe4d3] bg-[#fdfbf6] p-4">
                      <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[#003749]">
                        <FileImage className="size-4 text-[#dbb878]" aria-hidden />
                        صورة الرخصة
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
                      const infoOpen = openAddonInfoId === a.id;
                      const infoId = `addon-info-${a.id}`;
                      const infoText = a.info?.trim() || "";
                      return (
                        <label
                          key={a.id}
                          className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_8px_24px_-10px_rgba(219,184,120,0.25)] ${
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
                                    className={`pointer-events-none absolute bottom-full end-0 z-30 mb-1 w-56 rounded-xl border border-[#ebe4d3] bg-white p-3 text-[12px] leading-relaxed text-[#5f5341] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)] transition-all duration-150 ${
                                      infoOpen ? "opacity-100" : "opacity-0"
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
                  key={`checkout-${car.modelId}-${editPrefill?.bookingRequestId ?? "new"}`}
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
                          className={`peer w-full rounded-xl border border-[#ebe4d3] px-4 pb-3 pt-6 text-[14px] font-semibold text-[#003749] outline-none transition-all ${
                            identityFieldsReadOnly
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
                          className={`flex w-full overflow-hidden rounded-xl border border-[#ebe4d3] transition-all ${
                            identityFieldsReadOnly
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
                              className={`peer w-full px-4 pb-2 pt-6 text-[14px] font-semibold text-[#003749] outline-none ${
                                identityFieldsReadOnly
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
                      {pending ? "جاري المعالجة..." : "تأكيد البيانات والمتابعة"}
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
                    {car.discountLabelAr ? (
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
                          <span className="me-2 font-bold text-[#8a7752] line-through opacity-70">
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
                            <span className="me-2 font-bold text-[#8a7752] line-through opacity-70">
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
                          <span className="me-2 font-bold text-[#8a7752] line-through opacity-70">
                            {formatSarAmount(car.originalPricePerDayExclTax)} <SarCurrencyGlyph />
                          </span>
                        ) : null}
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

                    <div className="my-6 border-t border-dashed border-[#ebe4d3]" />

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
      <BranchOutsideHoursModal
        open={branchHoursOpen}
        message={branchHoursMessage}
        onClose={() => setBranchHoursOpen(false)}
        onChangeTimes={() => {
          router.replace(`/fleet/checkout?modelId=${car.modelId}`);
        }}
      />
    </div>
  );
}
