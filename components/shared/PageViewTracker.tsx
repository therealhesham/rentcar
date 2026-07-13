"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** يرسل مشاهدة صفحة إلى /api/track/view عند كل تنقّل — يُحتسب في سجل النشاط بلوحة التحكم. */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return;
    lastTracked.current = pathname;
    const payload = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/track/view",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        void fetch("/api/track/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* التتبع لا يجب أن يكسر التصفح */
    }
  }, [pathname]);

  return null;
}
