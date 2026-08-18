"use client";

import { CalendarClock, CalendarRange, Clock, MapPin, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { DateRangePickerPopover } from "@/components/home/DateRangePickerPopover";
import { LocationPickerPopover } from "@/components/home/LocationPickerPopover";
import { TimePickerPopover } from "@/components/home/TimePickerPopover";
import {
  DROPOFF_AFTER_PICKUP_ERROR_AR,
  DROPOFF_AFTER_PICKUP_ERROR_EN,
  isDropoffAfterPickup,
} from "@/lib/booking-days";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  composeDatetimeLocal,
  draftFromDatetimeLocal,
  parseDdMmYyToYmd,
  resolveDropoffTimeHm,
} from "@/lib/booking-search-shared";
import { DIALOG_Z } from "@/lib/overlay-z-index";
import {
  isBranchClosedOnDate,
  isDateTimeWithinBranchSchedule,
} from "@/lib/branch-opening-hours";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  open: boolean;
  cities: BookingCityBranchesOption[];
  initialBranch: string;
  initialPickup: string;
  initialDropoff: string;
  onConfirm: (draft: { branch: string; pickup: string; dropoff: string }) => void;
  onClose: () => void;
  /** إذا كان true يُسمح بالحجز في أيام الإجازة (يُتخطَّى فحص المواعيد) */
  allowHolidayBooking?: boolean;
  /** الفروع المتاح فيها هذا الموديل فعلياً بكمية أكبر من صفر */
  availableBranchSlugs?: string[];
};

function localNowPlusHours(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function FleetBookNowHintModal({
  open,
  cities,
  initialBranch,
  initialPickup,
  initialDropoff,
  onConfirm,
  onClose,
  allowHolidayBooking = false,
  availableBranchSlugs,
}: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const dateCities = useMemo(() => {
    const valid = cities.filter((c) => c.branches.length > 0);
    if (!availableBranchSlugs || availableBranchSlugs.length === 0) {
      return valid;
    }
    const slugSet = new Set(availableBranchSlugs.map((s) => s.toLowerCase()));
    return valid
      .map((c) => ({
        ...c,
        branches: c.branches.filter((b) => slugSet.has(b.slug.toLowerCase())),
      }))
      .filter((c) => c.branches.length > 0);
  }, [cities, availableBranchSlugs]);
  const defaultBranchSlug = dateCities[0]?.branches[0]?.slug ?? "";
  const hasBranches = dateCities.length > 0;

  const [branch, setBranch] = useState(defaultBranchSlug);
  const [pickupDateDraft, setPickupDateDraft] = useState("");
  const [pickupTimeDraft, setPickupTimeDraft] = useState("09:00");
  const [dropoffDateDraft, setDropoffDateDraft] = useState("");
  const [dropoffTimeDraft, setDropoffTimeDraft] = useState("09:00");
  const [pickupLocOpen, setPickupLocOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateRangeAnchor, setDateRangeAnchor] = useState<"pickup" | "dropoff">("pickup");
  const [pickupTimeOpen, setPickupTimeOpen] = useState(false);
  const [dropoffTimeOpen, setDropoffTimeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickupLocRef = useRef<HTMLButtonElement>(null);
  const pickupDateRef = useRef<HTMLButtonElement>(null);
  const dropoffDateRef = useRef<HTMLButtonElement>(null);
  const pickupTimeRef = useRef<HTMLButtonElement>(null);
  const dropoffTimeRef = useRef<HTMLButtonElement>(null);

  /** هل هذا الفرع من فروع هذه السيارة فعلاً؟ */
  const isSelectableBranch = useCallback(
    (slug: string) => dateCities.some((c) => c.branches.some((b) => b.slug === slug)),
    [dateCities],
  );

  /**
   * أول مرشّح **صالح** من: اختيار المستخدم، ثم الفرع القادم من الرابط، ثم أول فرع متاح.
   *
   * التحقق من الصلاحية ضروري لا تجميلي: `initialBranch` قد يحمل فرعاً لا تتوفر فيه هذه
   * السيارة (من رابط قديم أو من الفرع الافتراضي العام). حينها كان `branchValue` يبقى
   * غير فارغ فيمرّ من شرط الإرسال، بينما `branchLabel` لا يجده فتعرض الواجهة «اختر
   * الفرع» — فيُرسَل الحجز بفرع لم يره المستخدم ولا تتوفر فيه السيارة.
   */
  const branchValue = useMemo(() => {
    for (const candidate of [branch, initialBranch, defaultBranchSlug]) {
      const slug = candidate?.trim();
      if (slug && isSelectableBranch(slug)) return slug;
    }
    return "";
  }, [branch, initialBranch, defaultBranchSlug, isSelectableBranch]);
  const dateRangeActiveRef = dateRangeAnchor === "pickup" ? pickupDateRef : dropoffDateRef;

  function branchLabel(slug: string): string {
    for (const city of dateCities) {
      const found = city.branches.find((b) => b.slug === slug);
      if (found) return `${city.name}, ${found.name}`;
    }
    return "";
  }

  useEffect(() => {
    if (!open) return;
    const seed = (initialBranch || "").trim();
    setBranch(isSelectableBranch(seed) ? seed : defaultBranchSlug);
    const pickupDraft = draftFromDatetimeLocal((initialPickup || localNowPlusHours(2)).trim());
    const dropoffDraft = draftFromDatetimeLocal((initialDropoff || localNowPlusHours(26)).trim());
    setPickupDateDraft(pickupDraft.dateDdMmYy);
    setPickupTimeDraft(pickupDraft.hm || "09:00");
    setDropoffDateDraft(dropoffDraft.dateDdMmYy);
    setDropoffTimeDraft(dropoffDraft.hm || "09:00");
    setPickupLocOpen(false);
    setDateRangeOpen(false);
    setPickupTimeOpen(false);
    setDropoffTimeOpen(false);
    setError(null);
  }, [open, initialBranch, initialPickup, initialDropoff, defaultBranchSlug, isSelectableBranch]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function applyDateRange(startDdMmYy: string, endDdMmYy: string) {
    setPickupDateDraft(startDdMmYy);
    setDropoffDateDraft(endDdMmYy);
    // تسليم في نفس يوم الاستلام ⇒ ادفع الوقت للأمام حتى لا يتطابق الموعدان
    setDropoffTimeDraft((hm) =>
      resolveDropoffTimeHm(
        parseDdMmYyToYmd(startDdMmYy) ?? "",
        parseDdMmYyToYmd(endDdMmYy) ?? "",
        pickupTimeDraft,
        hm,
      ),
    );
  }

  function applyPickupDateOnly(dateDdMmYy: string) {
    setPickupDateDraft(dateDdMmYy);
    // اختيار تاريخ الذهاب يُعيد بدء النطاق ⇒ يُختار تاريخ الإياب من جديد،
    // والتقويم ينتقل أسفل حقل «تاريخ التسليم» حتى لا يلتبس على المستخدم
    setDropoffDateDraft("");
    setDateRangeAnchor("dropoff");
  }

  function toggleDateRange(anchor: "pickup" | "dropoff") {
    setPickupLocOpen(false);
    setPickupTimeOpen(false);
    setDropoffTimeOpen(false);
    if (dateRangeOpen && dateRangeAnchor === anchor) {
      setDateRangeOpen(false);
      return;
    }
    setDateRangeAnchor(anchor);
    setDateRangeOpen(true);
  }

  function applyPickupTime(hm: string) {
    setPickupTimeDraft(hm);
    setDropoffTimeDraft((prev) =>
      resolveDropoffTimeHm(
        parseDdMmYyToYmd(pickupDateDraft) ?? "",
        parseDdMmYyToYmd(dropoffDateDraft) ?? "",
        hm,
        prev,
      ),
    );
  }

  function applyDropoffTime(hm: string) {
    setDropoffTimeDraft(hm);
  }

  /* التسليم في نفس يوم الاستلام ⇒ لا تُعرض أوقات تسبق وقت الاستلام أو تطابقه */
  const dropoffMinExclusiveHm =
    pickupDateDraft && pickupDateDraft === dropoffDateDraft ? pickupTimeDraft : null;

  // جدول مواعيد الفرع المختار حالياً
  const selectedBranchSchedule = useMemo(() => {
    for (const city of dateCities) {
      const found = city.branches.find((b) => b.slug === branchValue);
      if (found) return found.openingHours ?? null;
    }
    return null;
  }, [dateCities, branchValue]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!hasBranches) {
      setError(
        isRTL
          ? "لا يوجد فرع متاح لهذه السيارة حالياً. اختر سيارة أخرى."
          : "No branch is currently available for this car. Please choose another car.",
      );
      return;
    }

    if (!branchValue) {
      setError(isRTL ? "يرجى اختيار فرع الاستلام." : "Please select a pickup branch.");
      return;
    }

    if (!pickupDateDraft.trim() || !dropoffDateDraft.trim()) {
      setError(
        isRTL
          ? "يرجى تحديد تاريخ ووقت الاستلام والتسليم."
          : "Please select pickup and return date and time.",
      );
      return;
    }

    const pickupYmd = parseDdMmYyToYmd(pickupDateDraft);
    const dropoffYmd = parseDdMmYyToYmd(dropoffDateDraft);
    const pickup = pickupYmd ? composeDatetimeLocal(pickupYmd, pickupTimeDraft) : null;
    const dropoff = dropoffYmd ? composeDatetimeLocal(dropoffYmd, dropoffTimeDraft) : null;
    if (!pickup || !dropoff) {
      setError(isRTL ? "صيغة التاريخ/الوقت غير صالحة." : "Invalid date or time format.");
      return;
    }

    const pickupDate = new Date(pickup);
    const dropoffDate = new Date(dropoff);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(dropoffDate.getTime())) {
      setError(isRTL ? "صيغة التاريخ/الوقت غير صالحة." : "Invalid date or time format.");
      return;
    }
    if (!isDropoffAfterPickup(pickupDate, dropoffDate)) {
      setError(isRTL ? DROPOFF_AFTER_PICKUP_ERROR_AR : DROPOFF_AFTER_PICKUP_ERROR_EN);
      return;
    }

    // فحص مواعيد الفرع (يُتخطَّى إذا كان الأدمن قد سمح بالحجز في الإجازات)
    if (!allowHolidayBooking && selectedBranchSchedule) {
      if (isBranchClosedOnDate(pickupDate, selectedBranchSchedule)) {
        setError(
          isRTL
            ? "الفرع مغلق في يوم الاستلام. يرجى اختيار يوم عمل آخر."
            : "Branch is closed on pickup date. Please choose another working day.",
        );
        return;
      }
      if (isBranchClosedOnDate(dropoffDate, selectedBranchSchedule)) {
        setError(
          isRTL
            ? "الفرع مغلق في يوم التسليم. يرجى اختيار يوم عمل آخر."
            : "Branch is closed on return date. Please choose another working day.",
        );
        return;
      }
      if (!isDateTimeWithinBranchSchedule(pickupDate, selectedBranchSchedule)) {
        setError(
          isRTL
            ? "وقت الاستلام خارج مواعيد عمل الفرع. يرجى اختيار وقت ضمن ساعات العمل."
            : "Pickup time is outside branch operating hours.",
        );
        return;
      }
      if (!isDateTimeWithinBranchSchedule(dropoffDate, selectedBranchSchedule)) {
        setError(
          isRTL
            ? "وقت التسليم خارج مواعيد عمل الفرع. يرجى اختيار وقت ضمن ساعات العمل."
            : "Return time is outside branch operating hours.",
        );
        return;
      }
    }

    onConfirm({ branch: branchValue, pickup: pickup.trim(), dropoff: dropoff.trim() });
  }

  if (!open || typeof document === "undefined") return null;

  const fieldTriggerBase = `field-trigger relative flex w-full flex-col gap-1 rounded-xl border border-[#ebe4d3]/80 bg-[#fdfbf6] p-3.5 ${
    isRTL ? "pe-9 text-right" : "ps-9 text-left"
  } outline-none transition-[border-color,box-shadow,background-color] hover:border-[#dbb878]/55 hover:bg-[#fffdf8] focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25`;

  const closeLabel = isRTL ? "إغلاق" : "Close";

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: DIALOG_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fleet-book-hint-title"
      aria-describedby="fleet-book-hint-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/45 backdrop-blur-[3px] transition-opacity"
        aria-label={closeLabel}
        onClick={onClose}
      />

      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06]">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-[#aaa08e] backdrop-blur-sm transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10" dir={isRTL ? "rtl" : "ltr"}>
          <div
            className="mx-auto mb-4 flex size-[4rem] items-center justify-center rounded-2xl shadow-inner"
            style={{
              background: `linear-gradient(145deg, rgba(219,184,120,0.22) 0%, rgba(0,55,73,0.08) 100%)`,
              color: TEAL,
            }}
          >
            <CalendarClock className="size-9" strokeWidth={1.75} aria-hidden />
          </div>

          <h2
            id="fleet-book-hint-title"
            className="text-center text-[1.35rem] font-extrabold tracking-tight text-[#003749] sm:text-2xl"
          >
            {isRTL ? "أكمل بيانات الحجز" : "Complete Booking Details"}
          </h2>
          <p
            id="fleet-book-hint-desc"
            className="mt-2 text-center text-[14px] font-medium leading-relaxed text-[#4b5563]"
          >
            {isRTL
              ? "حدّد موقع الاستلام ووقت الاستلام والتسليم وسنكمل مباشرة إلى صفحة إتمام الحجز."
              : "Select pickup location, pickup & return date and time to proceed directly to checkout."}
          </p>

          <form className={`mt-5 space-y-2.5 ${isRTL ? "text-right" : "text-left"}`} onSubmit={handleSubmit}>
            {/* ── موقع الاستلام (نفس منتقي الـ widget) ── */}
            <div className="relative min-w-0">
              <button
                ref={pickupLocRef}
                type="button"
                aria-expanded={pickupLocOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setPickupLocOpen((v) => !v);
                  setDateRangeOpen(false);
                  setPickupTimeOpen(false);
                  setDropoffTimeOpen(false);
                }}
                className={`${fieldTriggerBase} ${pickupLocOpen ? "border-[#dbb878] ring-2 ring-[#dbb878]/30" : ""}`}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                  <MapPin className="size-3 text-[#dbb878]" aria-hidden />
                  {isRTL ? "موقع الاستلام" : "Pickup Location"}
                </span>
                <span className="truncate text-[13px] font-bold text-[#0f1923]">
                  {branchLabel(branchValue) || (
                    <span className="font-medium text-[#aaa08e]">
                      {hasBranches
                        ? isRTL
                          ? "اختر الفرع"
                          : "Select Branch"
                        : isRTL
                          ? "لا توجد فروع"
                          : "No Branches"}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${pickupLocOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              <LocationPickerPopover
                isOpen={pickupLocOpen}
                onClose={() => setPickupLocOpen(false)}
                dateCities={dateCities}
                selectedBranchSlug={branchValue}
                defaultBranchSlug={defaultBranchSlug}
                onBranchSelect={(slug) => {
                  setBranch(slug);
                }}
                anchorRef={pickupLocRef}
                label={isRTL ? "موقع الاستلام" : "Pickup Location"}
              />
            </div>

            {/* ── التاريخ والوقت (نفس منتقيات الـ widget) ── */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative min-w-0">
                <button
                  ref={pickupDateRef}
                  type="button"
                  aria-expanded={dateRangeOpen && dateRangeAnchor === "pickup"}
                  aria-haspopup="dialog"
                  onClick={() => toggleDateRange("pickup")}
                  className={`${fieldTriggerBase} ${dateRangeOpen && dateRangeAnchor === "pickup" ? "border-[#dbb878] ring-2 ring-[#dbb878]/30" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                    <CalendarClock className="size-3 text-[#dbb878]" aria-hidden />
                    {isRTL ? "تاريخ الاستلام" : "Pickup Date"}
                  </span>
                  {pickupDateDraft ? (
                    <span className="text-[13px] font-bold text-[#0f1923]">{pickupDateDraft}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-[#aaa08e]">
                      {isRTL ? "اختر التاريخ" : "Select Date"}
                    </span>
                  )}
                  <ChevronDown
                    className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dateRangeOpen && dateRangeAnchor === "pickup" ? "rotate-180" : ""}`}
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
                    setPickupLocOpen(false);
                    setDateRangeOpen(false);
                    setDropoffTimeOpen(false);
                  }}
                  className={`${fieldTriggerBase} ${pickupTimeOpen ? "border-[#dbb878] ring-2 ring-[#dbb878]/30" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                    <Clock className="size-3 text-[#dbb878]" aria-hidden />
                    {isRTL ? "وقت الاستلام" : "Pickup Time"}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                    {pickupTimeDraft}
                  </span>
                  <ChevronDown
                    className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${pickupTimeOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <TimePickerPopover
                  isOpen={pickupTimeOpen}
                  onClose={() => setPickupTimeOpen(false)}
                  label={isRTL ? "وقت الاستلام" : "Pickup Time"}
                  time={pickupTimeDraft}
                  onConfirm={applyPickupTime}
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
                  className={`${fieldTriggerBase} ${dateRangeOpen && dateRangeAnchor === "dropoff" ? "border-[#dbb878] ring-2 ring-[#dbb878]/30" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                    <CalendarRange className="size-3 text-[#dbb878]" aria-hidden />
                    {isRTL ? "تاريخ التسليم" : "Return Date"}
                  </span>
                  {dropoffDateDraft ? (
                    <span className="text-[13px] font-bold text-[#0f1923]">{dropoffDateDraft}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-[#aaa08e]">
                      {isRTL ? "اختر التاريخ" : "Select Date"}
                    </span>
                  )}
                  <ChevronDown
                    className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dateRangeOpen && dateRangeAnchor === "dropoff" ? "rotate-180" : ""}`}
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
                onStartChange={applyPickupDateOnly}
                onRangeChange={applyDateRange}
                anchorRef={dateRangeActiveRef}
                extraAnchorRefs={[pickupDateRef, dropoffDateRef]}
                schedule={allowHolidayBooking ? null : selectedBranchSchedule}
                allowHolidayBooking={allowHolidayBooking}
              />

              <div className="relative min-w-0">
                <button
                  ref={dropoffTimeRef}
                  type="button"
                  aria-expanded={dropoffTimeOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setDropoffTimeOpen((v) => !v);
                    setPickupLocOpen(false);
                    setDateRangeOpen(false);
                    setPickupTimeOpen(false);
                  }}
                  className={`${fieldTriggerBase} ${dropoffTimeOpen ? "border-[#dbb878] ring-2 ring-[#dbb878]/30" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#003749]/55">
                    <Clock className="size-3 text-[#dbb878]" aria-hidden />
                    {isRTL ? "وقت التسليم" : "Return Time"}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f1923]" dir="ltr">
                    {dropoffTimeDraft}
                  </span>
                  <ChevronDown
                    className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 size-3.5 -translate-y-1/2 text-[#dbb878] transition-transform ${dropoffTimeOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <TimePickerPopover
                  isOpen={dropoffTimeOpen}
                  onClose={() => setDropoffTimeOpen(false)}
                  label={isRTL ? "وقت التسليم" : "Return Time"}
                  time={dropoffTimeDraft}
                  minExclusiveHm={dropoffMinExclusiveHm}
                  onConfirm={applyDropoffTime}
                  anchorRef={dropoffTimeRef}
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_28px_-10px_rgba(201,163,86,0.55)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                }}
              >
                {isRTL ? "متابعة الحجز" : "Continue Booking"}
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3.5 text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
            >
              {isRTL ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
