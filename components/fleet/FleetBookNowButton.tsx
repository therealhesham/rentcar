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
      <Link
        href={href}
        onClick={onBookClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#003749] to-[#004d63] py-3.5 text-center text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:from-[#004d63] hover:to-[#005f7a] hover:shadow-lg active:scale-[0.98]"
      >
        احجز الآن
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
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
      <Link
        href={`/fleet/checkout?modelId=${modelId}`}
        onClick={onBookClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#003749] to-[#004d63] py-3.5 text-center text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:from-[#004d63] hover:to-[#005f7a] hover:shadow-lg active:scale-[0.98]"
      >
        احجز الآن
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
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
