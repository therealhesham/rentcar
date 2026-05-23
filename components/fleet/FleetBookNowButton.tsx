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
        className="block w-full rounded-xl bg-primary-fixed py-3.5 text-center text-sm font-extrabold text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim"
      >
        احجز الآن
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
        className="block w-full rounded-xl bg-primary-fixed py-3.5 text-center text-sm font-extrabold text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim"
      >
        احجز الآن
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
