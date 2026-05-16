"use client";

import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { resolveDeliveryOriginCitySlug } from "@/lib/delivery-origin-city";
import { useEffect, useMemo } from "react";

type UseDeliveryOriginCityArgs = {
  cities: ReadonlyArray<BookingCityBranchesOption>;
  deliveryLat: number | null;
  deliveryLng: number | null;
  fallbackCitySlug: string;
  detectedSlug: string;
  onDetectedSlugChange: (slug: string) => void;
};

/** مزامنة slug مدينة التوصيل من إحداثيات الخريطة. */
export function useDeliveryOriginCity({
  cities,
  deliveryLat,
  deliveryLng,
  fallbackCitySlug,
  detectedSlug,
  onDetectedSlugChange,
}: UseDeliveryOriginCityArgs) {
  const mapOk =
    deliveryLat != null &&
    deliveryLng != null &&
    Number.isFinite(deliveryLat) &&
    Number.isFinite(deliveryLng);

  const inferredFromMap = useMemo(() => {
    if (!mapOk) return null;
    return resolveDeliveryOriginCitySlug({
      lat: deliveryLat,
      lng: deliveryLng,
      address: "",
      cities,
    });
  }, [cities, deliveryLat, deliveryLng, mapOk]);

  useEffect(() => {
    const next = inferredFromMap ?? fallbackCitySlug;
    if (next && next !== detectedSlug) {
      onDetectedSlugChange(next);
    }
  }, [inferredFromMap, fallbackCitySlug, detectedSlug, onDetectedSlugChange]);

  const cityNameAr = useMemo(() => {
    const slug = inferredFromMap ?? detectedSlug ?? fallbackCitySlug;
    return cities.find((c) => c.slug === slug)?.name ?? "";
  }, [cities, inferredFromMap, detectedSlug, fallbackCitySlug]);

  return {
    showInLabel: mapOk && inferredFromMap != null && cityNameAr.length > 0,
    cityNameAr,
  };
}

/** اسم المدينة بخط صغير بجانب عنوان «موقع التوصيل». */
export function DeliveryOriginCityLabelSuffix({
  cityName,
  show,
}: {
  cityName: string;
  show: boolean;
}) {
  if (!show || !cityName) return null;
  return (
    <span
      className="text-[10px] font-semibold normal-case tracking-normal text-[#6b8f7a]"
      aria-label={`مدينة التوصيل: ${cityName}`}
    >
      · {cityName}
    </span>
  );
}
