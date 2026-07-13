"use client";

import { useEffect, useRef } from "react";

/** يسجّل مشاهدة سيارة (CAR_VIEW) عند فتح صفحة إتمام الحجز لموديل معين — يظهر في /admin/logs. */
export function CarViewTracker({ carModelId }: { carModelId: number }) {
  const tracked = useRef<number | null>(null);

  useEffect(() => {
    if (!carModelId || tracked.current === carModelId) return;
    tracked.current = carModelId;
    const payload = JSON.stringify({
      path: window.location.pathname,
      carModelId,
    });
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
  }, [carModelId]);

  return null;
}
