"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FleetBookNowHintModal } from "@/components/fleet/FleetBookNowHintModal";
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
      احجز الآن

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

function firstBranchSlug(cities: BookingCityBranchesOption[]): string {
  for (const c of cities) {
    if (c.branches.length > 0) return c.branches[0]!.slug;
  }
  return "";
}

function FleetBookNowButtonInner({ modelId, cities = FALLBACK_CITIES }: FleetBookNowButtonProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const extra = sp.toString();
  const href = `/fleet/checkout?modelId=${modelId}${extra ? `&${extra}` : ""}`;
  const [modalOpen, setModalOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState(() => firstBranchSlug(cities));
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
    const check = validateFleetBookNowSearchParams(new URLSearchParams(sp.toString()));
    if (!check.ok) {
      e.preventDefault();
      setModalOpen(true);
      return;
    }
    setModalOpen(false);
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
      <FleetBookNowHintModal
        open={modalOpen}
        cities={cities}
        initialBranch={draftBranch}
        initialPickup={draftPickup}
        initialDropoff={draftDropoff}
        onConfirm={handleConfirmModal}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function FleetBookNowButtonFallback({
  modelId,
  cities = FALLBACK_CITIES,
}: FleetBookNowButtonProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState(() => firstBranchSlug(cities));
  const [draftPickup, setDraftPickup] = useState("");
  const [draftDropoff, setDraftDropoff] = useState("");

  useEffect(() => {
    setDraftBranch(firstBranchSlug(cities));
  }, [cities]);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
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
      <FleetBookNowHintModal
        open={modalOpen}
        cities={cities}
        initialBranch={draftBranch}
        initialPickup={draftPickup}
        initialDropoff={draftDropoff}
        onConfirm={handleConfirmModal}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

export function FleetBookNowButton({ modelId, cities = FALLBACK_CITIES }: FleetBookNowButtonProps) {
  return (
    <Suspense fallback={<FleetBookNowButtonFallback modelId={modelId} cities={cities} />}>
      <FleetBookNowButtonInner modelId={modelId} cities={cities} />
    </Suspense>
  );
}
