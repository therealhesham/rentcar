"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track-event";

/** يسجّل مشاهدة سيارة (CAR_VIEW) عند فتح صفحة إتمام الحجز لموديل معين — يظهر في /admin/logs. */
export function CarViewTracker({ carModelId }: { carModelId: number }) {
  const tracked = useRef<number | null>(null);

  useEffect(() => {
    if (!carModelId || tracked.current === carModelId) return;
    tracked.current = carModelId;
    trackEvent("CAR_VIEW", { carModelId });
  }, [carModelId]);

  return null;
}
