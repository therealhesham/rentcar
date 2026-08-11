import { DROPOFF_AFTER_PICKUP_ERROR_AR, isDropoffAfterPickup } from "@/lib/booking-days";

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
  if (!isDropoffAfterPickup(pickupDate, dropoffDate)) {
    return {
      ok: false,
      message: DROPOFF_AFTER_PICKUP_ERROR_AR,
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

/**
 * ينقل الزائر إلى نموذج البحث أعلى الصفحة ليختار التواريخ والفرع بنفسه.
 * يغطي مضيفَي بطاقات السيارات: صفحة الأسطول (`fleet-booking`) والرئيسية (`home-booking`).
 */
export function scrollToBookingSearchForm(): void {
  const el =
    document.getElementById("fleet-booking") ?? document.getElementById("home-booking");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // التمرير وحده يترك الزائر أمام نموذج لا يعرف لماذا قفزت به الصفحة إليه. تركيز أول
  // عنصر تفاعلي يوجّه نظره — و`preventScroll` كي لا يُلغي التركيزُ التمريرَ الناعم.
  el.querySelector<HTMLElement>(
    "button, input, select, [tabindex]:not([tabindex='-1'])",
  )?.focus({ preventScroll: true });
}
