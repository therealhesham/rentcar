"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FleetBookNowHintModal } from "@/components/fleet/FleetBookNowHintModal";
import { OrSimilarModal } from "@/components/fleet/OrSimilarModal";
import { trackEvent } from "@/lib/track-event";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  validateFleetBookNowSearchParams,
} from "@/lib/fleet-book-now-validation";

const BTN_CLASS =
  "group/btn relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl px-5 py-3.5 text-[15px] font-extrabold text-white shadow-[0_4px_16px_-4px_rgba(0,55,73,0.55)] transition-all duration-200 active:scale-[0.975] active:shadow-none";

const SHINE_CLASS =
  "pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-white/10 transition-transform duration-700 ease-out group-hover/btn:translate-x-[150%]";

/** أيقونة كالندر صغيرة للدلالة على الحجز */
function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover/btn:scale-110"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BookNowLink({
  href,
  onClick,
}: {
  href: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useTranslations("Common");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={BTN_CLASS}
      style={{ background: "linear-gradient(135deg, #003749 0%, #005a6e 100%)" }}
    >
      {/* shine sweep */}
      <span className={SHINE_CLASS} aria-hidden />

      <CalendarIcon />
      {t("bookNow")}

      {/* arrow */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover/btn:-translate-x-0.5"
        aria-hidden
      >
        <path
          d="M19 12H5M12 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

type FleetBookNowButtonProps = {
  modelId: number;
  cities?: BookingCityBranchesOption[];
  carName: string;
  allowHolidayBooking?: boolean;
  availableBranchSlugs?: string[];
};

function formatAsDatetimeLocal(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

const FALLBACK_CITIES: BookingCityBranchesOption[] = [
  {
    slug: "default",
    name: "الفروع",
    branches: [
      { slug: "jeddah", name: "جدة", openingHours: null },
      { slug: "madinah", name: "المدينة المنورة", openingHours: null },
      { slug: "tabuk", name: "تبوك", openingHours: null },
    ],
  },
];

function firstBranchSlug(cities: BookingCityBranchesOption[], availableBranchSlugs?: string[]): string {
  const allowedSet = availableBranchSlugs && availableBranchSlugs.length > 0
    ? new Set(availableBranchSlugs.map(s => s.toLowerCase()))
    : null;
  for (const c of cities) {
    for (const b of c.branches) {
      if (!allowedSet || allowedSet.has(b.slug.toLowerCase())) {
        return b.slug;
      }
    }
  }
  return "";
}

function FleetBookNowButtonInner({ modelId, cities = FALLBACK_CITIES, carName, allowHolidayBooking = false, availableBranchSlugs }: FleetBookNowButtonProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const extra = sp.toString();
  const href = `/fleet/checkout?modelId=${modelId}${extra ? `&${extra}` : ""}`;
  const [orSimilarOpen, setOrSimilarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState(() => firstBranchSlug(cities, availableBranchSlugs));
  const [draftPickup, setDraftPickup] = useState("");
  const [draftDropoff, setDraftDropoff] = useState("");

  useEffect(() => {
    setModalOpen(false);
  }, [extra]);

  useEffect(() => {
    const spRaw = sp.toString();
    const spObj = new URLSearchParams(spRaw);
    // الاحتياطي مقيّد بفروع هذه السيارة — الفرع الافتراضي العام قد لا تتوفر فيه،
    // فيصل للمودال كقيمة أولية لا يعرفها ولا يعرضها.
    const branch =
      spObj.get("pickupBranch")?.trim() ||
      spObj.get("returnBranch")?.trim() ||
      spObj.get("branch")?.trim() ||
      firstBranchSlug(cities, availableBranchSlugs) ||
      "";
    setDraftBranch(branch);
    setDraftPickup(formatAsDatetimeLocal(spObj.get("pickup")));
    setDraftDropoff(formatAsDatetimeLocal(spObj.get("dropoff")));
  }, [sp, cities, availableBranchSlugs]);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackEvent("BOOK_NOW_CLICK", { carModelId: modelId });
    setOrSimilarOpen(true);
  }

  function handleOrSimilarConfirm() {
    setOrSimilarOpen(false);
    trackEvent("OR_SIMILAR_CONFIRM", { carModelId: modelId });
    const check = validateFleetBookNowSearchParams(new URLSearchParams(sp.toString()));
    if (!check.ok) {
      trackEvent("DATES_MODAL_SHOWN", { carModelId: modelId });
      setModalOpen(true);
    } else {
      router.push(`/fleet/checkout?modelId=${modelId}&${sp.toString()}`);
    }
  }

  function handleConfirmModal(draft: { branch: string; pickup: string; dropoff: string }) {
    trackEvent("DATES_MODAL_CONFIRM", { carModelId: modelId });
    const next = new URLSearchParams(sp.toString());
    next.set("mode", "pickup");
    next.set("rental", next.get("rental")?.trim() || "daily");
    next.delete("dlat");
    next.delete("dlng");
    next.delete("daddr");
    next.set("pickup", draft.pickup);
    next.set("dropoff", draft.dropoff);
    next.set("pickupBranch", draft.branch);
    next.set("returnBranch", draft.branch);
    next.set("branch", draft.branch);
    setModalOpen(false);
    router.push(`/fleet/checkout?modelId=${modelId}&${next.toString()}`);
  }

  return (
    <>
      <BookNowLink href={href} onClick={onBookClick} />
      <OrSimilarModal
        open={orSimilarOpen}
        carName={carName}
        onConfirm={handleOrSimilarConfirm}
        onClose={() => {
          trackEvent("OR_SIMILAR_DISMISS", { carModelId: modelId });
          setOrSimilarOpen(false);
        }}
      />
      <FleetBookNowHintModal
        open={modalOpen}
        cities={cities}
        initialBranch={draftBranch}
        initialPickup={draftPickup}
        initialDropoff={draftDropoff}
        allowHolidayBooking={allowHolidayBooking}
        availableBranchSlugs={availableBranchSlugs}
        onConfirm={handleConfirmModal}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function FleetBookNowButtonFallback({
  modelId,
  cities = FALLBACK_CITIES,
  carName,
  allowHolidayBooking = false,
  availableBranchSlugs,
}: FleetBookNowButtonProps) {
  const router = useRouter();
  const [orSimilarOpen, setOrSimilarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState(() => firstBranchSlug(cities, availableBranchSlugs));
  const [draftPickup, setDraftPickup] = useState("");
  const [draftDropoff, setDraftDropoff] = useState("");

  useEffect(() => {
    setDraftBranch(firstBranchSlug(cities, availableBranchSlugs));
  }, [cities, availableBranchSlugs]);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackEvent("BOOK_NOW_CLICK", { carModelId: modelId });
    setOrSimilarOpen(true);
  }

  function handleOrSimilarConfirm() {
    setOrSimilarOpen(false);
    trackEvent("OR_SIMILAR_CONFIRM", { carModelId: modelId });
    trackEvent("DATES_MODAL_SHOWN", { carModelId: modelId });
    setModalOpen(true);
  }

  function handleConfirmModal(draft: { branch: string; pickup: string; dropoff: string }) {
    trackEvent("DATES_MODAL_CONFIRM", { carModelId: modelId });
    const next = new URLSearchParams();
    next.set("mode", "pickup");
    next.set("rental", "daily");
    next.set("pickup", draft.pickup);
    next.set("dropoff", draft.dropoff);
    next.set("pickupBranch", draft.branch);
    next.set("returnBranch", draft.branch);
    next.set("branch", draft.branch);
    setModalOpen(false);
    router.push(`/fleet/checkout?modelId=${modelId}&${next.toString()}`);
  }

  return (
    <>
      <BookNowLink
        href={`/fleet/checkout?modelId=${modelId}`}
        onClick={onBookClick}
      />
      <OrSimilarModal
        open={orSimilarOpen}
        carName={carName}
        onConfirm={handleOrSimilarConfirm}
        onClose={() => {
          trackEvent("OR_SIMILAR_DISMISS", { carModelId: modelId });
          setOrSimilarOpen(false);
        }}
      />
      <FleetBookNowHintModal
        open={modalOpen}
        cities={cities}
        initialBranch={draftBranch}
        initialPickup={draftPickup}
        initialDropoff={draftDropoff}
        allowHolidayBooking={allowHolidayBooking}
        availableBranchSlugs={availableBranchSlugs}
        onConfirm={handleConfirmModal}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

export function FleetBookNowButton({ modelId, cities = FALLBACK_CITIES, carName, allowHolidayBooking = false, availableBranchSlugs }: FleetBookNowButtonProps) {
  return (
    <Suspense fallback={<FleetBookNowButtonFallback modelId={modelId} cities={cities} carName={carName} allowHolidayBooking={allowHolidayBooking} availableBranchSlugs={availableBranchSlugs} />}>
      <FleetBookNowButtonInner modelId={modelId} cities={cities} carName={carName} allowHolidayBooking={allowHolidayBooking} availableBranchSlugs={availableBranchSlugs} />
    </Suspense>
  );
}