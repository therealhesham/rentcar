/** التحقق من اكتمال بحث الأسطول قبل «احجز الآن» (من معاملات الرابط). */
export type FleetBookNowValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateFleetBookNowSearchParams(
  sp: URLSearchParams,
): FleetBookNowValidationResult {
  const pickupRaw = sp.get("pickup")?.trim() ?? "";
  const dropoffRaw = sp.get("dropoff")?.trim() ?? "";

  if (!pickupRaw || !dropoffRaw) {
    return {
      ok: false,
      message:
        "يرجى تحديد تاريخ ووقت الاستلام والتسليم من النموذج أعلاه، ثم اضغط «ابحث عن السيارات» قبل «احجز الآن».",
    };
  }

  const pickupDate = new Date(pickupRaw);
  const dropoffDate = new Date(dropoffRaw);
  if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(dropoffDate.getTime())) {
    return {
      ok: false,
      message: "صيغة التواريخ غير صالحة — راجع الاستلام والتسليم في النموذج أعلاه.",
    };
  }
  if (dropoffDate.getTime() < pickupDate.getTime()) {
    return {
      ok: false,
      message: "تاريخ التسليم يجب أن يكون بعد وقت الاستلام.",
    };
  }

  const mode = (sp.get("mode")?.trim() || "pickup").toLowerCase();

  if (mode === "delivery") {
    const dlat = sp.get("dlat")?.trim();
    const dlng = sp.get("dlng")?.trim();
    if (!dlat || !dlng || Number.isNaN(Number(dlat)) || Number.isNaN(Number(dlng))) {
      return {
        ok: false,
        message: "يرجى تحديد موقع التوصيل على الخريطة في النموذج أعلاه.",
      };
    }
    if (!sp.get("returnBranch")?.trim()) {
      return {
        ok: false,
        message: "يرجى اختيار فرع التسليم (إرجاع السيارة) في النموذج أعلاه.",
      };
    }
    return { ok: true };
  }

  const pickupBranch =
    sp.get("pickupBranch")?.trim() ||
    sp.get("returnBranch")?.trim() ||
    sp.get("branch")?.trim();
  if (!pickupBranch) {
    return {
      ok: false,
      message: "يرجى اختيار فرع الاستلام في النموذج أعلاه.",
    };
  }

  return { ok: true };
}

export function scrollToBookingSearchForm(): void {
  const el =
    document.getElementById("fleet-booking") ?? document.getElementById("home-booking");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
