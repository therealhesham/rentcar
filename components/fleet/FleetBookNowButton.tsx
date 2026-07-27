"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FleetBookNowHintModal } from "@/components/fleet/FleetBookNowHintModal";
import { OrSimilarModal } from "@/components/fleet/OrSimilarModal";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  validateFleetBookNowSearchParams,
} from "@/lib/fleet-book-now-validation";

const BTN_CLASS =
  "group/btn relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-l from-[#dbb878] to-[#e6be82] px-6 py-2 text-[14px] font-extrabold text-[#003749] shadow-sm transition-all duration-200 active:scale-[0.975]";

const SHINE_CLASS =
  "pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-white/25 transition-transform duration-700 ease-out group-hover/btn:translate-x-[150%]";

function BookNowLink({
  href,
  onClick,
}: {
  href: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useTranslations("Common");
  return (
    <Link href={href} onClick={onClick} className={BTN_CLASS}>
      {/* shine sweep */}
      <span className={SHINE_CLASS} aria-hidden />
      {t("bookNow")}
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
    const branch =
      spObj.get("pickupBranch")?.trim() ||
      spObj.get("returnBranch")?.trim() ||
      spObj.get("branch")?.trim() ||
      firstBranchSlug(cities) ||
      "";
    setDraftBranch(branch);
    setDraftPickup(formatAsDatetimeLocal(spObj.get("pickup")));
    setDraftDropoff(formatAsDatetimeLocal(spObj.get("dropoff")));
  }, [sp, cities]);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setOrSimilarOpen(true);
  }

  function handleOrSimilarConfirm() {
    setOrSimilarOpen(false);
    const check = validateFleetBookNowSearchParams(new URLSearchParams(sp.toString()));
    if (!check.ok) {
      setModalOpen(true);
    } else {
      router.push(`/fleet/checkout?modelId=${modelId}&${sp.toString()}`);
    }
  }

  function handleConfirmModal(draft: { branch: string; pickup: string; dropoff: string }) {
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
        onClose={() => setOrSimilarOpen(false)}
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
    setOrSimilarOpen(true);
  }

  function handleOrSimilarConfirm() {
    setOrSimilarOpen(false);
    setModalOpen(true);
  }

  function handleConfirmModal(draft: { branch: string; pickup: string; dropoff: string }) {
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
        onClose={() => setOrSimilarOpen(false)}
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
