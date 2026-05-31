"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FleetBookNowHintModal } from "@/components/fleet/FleetBookNowHintModal";
import {
  scrollToBookingSearchForm,
  validateFleetBookNowSearchParams,
} from "@/lib/fleet-book-now-validation";

const DEFAULT_HINT =
  "يرجى تحديد الموقع والتواريخ من نموذج البحث أعلاه، ثم اضغط «ابحث عن السيارات» قبل «احجز الآن».";

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

function FleetBookNowButtonInner({ modelId }: { modelId: number }) {
  const sp = useSearchParams();
  const extra = sp.toString();
  const href = `/fleet/checkout?modelId=${modelId}${extra ? `&${extra}` : ""}`;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState(DEFAULT_HINT);

  useEffect(() => {
    setModalOpen(false);
  }, [extra]);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const check = validateFleetBookNowSearchParams(new URLSearchParams(sp.toString()));
    if (!check.ok) {
      e.preventDefault();
      setModalMessage(check.message);
      setModalOpen(true);
      return;
    }
    setModalOpen(false);
  }

  return (
    <>
      <BookNowLink href={href} onClick={onBookClick} />
      <FleetBookNowHintModal
        open={modalOpen}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
        onGoToSearch={scrollToBookingSearchForm}
      />
    </>
  );
}

function FleetBookNowButtonFallback({ modelId }: { modelId: number }) {
  const [modalOpen, setModalOpen] = useState(false);

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setModalOpen(true);
  }

  return (
    <>
      <BookNowLink
        href={`/fleet/checkout?modelId=${modelId}`}
        onClick={onBookClick}
      />
      <FleetBookNowHintModal
        open={modalOpen}
        message={DEFAULT_HINT}
        onClose={() => setModalOpen(false)}
        onGoToSearch={scrollToBookingSearchForm}
      />
    </>
  );
}

export function FleetBookNowButton({ modelId }: { modelId: number }) {
  return (
    <Suspense fallback={<FleetBookNowButtonFallback modelId={modelId} />}>
      <FleetBookNowButtonInner modelId={modelId} />
    </Suspense>
  );
}
