"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track-event";

/** يرسل مشاهدة صفحة إلى /api/track/view عند كل تنقّل — يُحتسب في سجل النشاط بلوحة التحكم. */
function PageViewTrackerInner() {
  const pathname = usePathname();
  // الـ query جزء من هوية الصفحة هنا: تغيّر تواريخ البحث أو الفرع = مشاهدة جديدة.
  const search = useSearchParams().toString();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const url = search ? `${pathname}?${search}` : pathname;
    if (url === lastTracked.current) return;
    lastTracked.current = url;
    trackEvent("PAGE_VIEW", { path: url });
  }, [pathname, search]);

  return null;
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
}
