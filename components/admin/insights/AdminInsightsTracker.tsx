"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * يرسل فتحة صفحة لوحة التحكم إلى `/api/admin-insights/track` عند كل تنقّل.
 *
 * مستقل عن `PageViewTracker` الخاص بالموقع العام: ذاك يكتب في `ActivityLog` الذي
 * تُبنى منه إحصاءات العملاء، وخلط حركة الموظفين به كان سيفسدها.
 */
function AdminInsightsTrackerInner() {
  const pathname = usePathname();
  // الفلاتر والتبويبات كلها في الـ query — فتح «الحجوزات» مفلترة بفرع هو فتحة مستقلة.
  const search = useSearchParams().toString();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/admin")) return;
    const url = search ? `${pathname}?${search}` : pathname;
    // React يشغّل التأثير مرتين في التطوير، وNext يعيد التصيير عند تحديث الـ router —
    // بدون هذا الحارس تتضاعف كل فتحة.
    if (url === lastSent.current) return;
    lastSent.current = url;

    const payload = JSON.stringify({ path: url });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/admin-insights/track",
          new Blob([payload], { type: "application/json" }),
        );
        return;
      }
      void fetch("/api/admin-insights/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      /* القياس لا يجب أن يكسر تصفّح الموظف */
    }
  }, [pathname, search]);

  return null;
}

export function AdminInsightsTracker() {
  return (
    <Suspense fallback={null}>
      <AdminInsightsTrackerInner />
    </Suspense>
  );
}
