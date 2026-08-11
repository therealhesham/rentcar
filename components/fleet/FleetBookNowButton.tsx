"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/track-event";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import {
  scrollToBookingSearchForm,
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

/**
 * حدث «طُلبت التواريخ» — الاسم يحمل `MODAL` لأنه قيمة مخزَّنة في `ActivityLog` منذ أن
 * كان الطلب يتم عبر مودال؛ تغييره يقطع الجلسات السابقة في لوحة `/admin/logs`. المعنى
 * المعروض هناك («طُلبت التواريخ») ما زال دقيقاً بعد استبدال المودال بالتمرير للنموذج.
 */
const DATES_REQUESTED_EVENT = "DATES_MODAL_SHOWN";

function FleetBookNowButtonInner({ modelId }: FleetBookNowButtonProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const extra = sp.toString();
  const href = `/fleet/checkout?modelId=${modelId}${extra ? `&${extra}` : ""}`;

  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackEvent("BOOK_NOW_CLICK", { carModelId: modelId });

    // بحث ناقص التواريخ أو الفرع: نرفع الزائر إلى نموذج البحث ليختار بنفسه بدل
    // مودال يحجب الصفحة. الاختيار في النموذج يحدّث الرابط، فتصير الضغطة التالية
    // انتقالاً مباشراً إلى صفحة الحجز.
    const check = validateFleetBookNowSearchParams(new URLSearchParams(extra));
    if (!check.ok) {
      trackEvent(DATES_REQUESTED_EVENT, { carModelId: modelId });
      scrollToBookingSearchForm();
      return;
    }

    router.push(href);
  }

  return <BookNowLink href={href} onClick={onBookClick} />;
}

/**
 * بديل `Suspense` — لا يصل إليه `useSearchParams`، فلا سبيل للتحقق من اكتمال البحث.
 * نرفع الزائر إلى النموذج دائماً: أسوأ الحالات خطوة زائدة، لا انتقال إلى صفحة حجز
 * بلا تواريخ ترفضه لاحقاً بـ `NO_DATES`.
 */
function FleetBookNowButtonFallback({ modelId }: FleetBookNowButtonProps) {
  function onBookClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackEvent("BOOK_NOW_CLICK", { carModelId: modelId });
    trackEvent(DATES_REQUESTED_EVENT, { carModelId: modelId });
    scrollToBookingSearchForm();
  }

  return (
    <BookNowLink href={`/fleet/checkout?modelId=${modelId}`} onClick={onBookClick} />
  );
}

export function FleetBookNowButton(props: FleetBookNowButtonProps) {
  return (
    <Suspense fallback={<FleetBookNowButtonFallback {...props} />}>
      <FleetBookNowButtonInner {...props} />
    </Suspense>
  );
}
