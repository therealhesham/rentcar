/**
 * تتبع الكيلومترات على الحجز: قراءة العداد عند التسليم وعند الإرجاع.
 * القراءتان اختياريتان، فكل الحسابات تتعامل مع الغياب الجزئي بأمان.
 */

/** أعلى قراءة عداد مقبولة — حاجز ضد الأخطاء المطبعية (مثل زيادة صفر). */
export const MAX_ODOMETER_KM = 2_000_000;

export type BookingOdometerInput = {
  odometerAtPickupKm: number | null;
  odometerAtReturnKm: number | null;
  numberOfDays: number;
};

export type BookingOdometerSummary = {
  pickupKm: number | null;
  returnKm: number | null;
  /** المسافة المقطوعة — null إن غابت إحدى القراءتين. */
  distanceKm: number | null;
  /** متوسط الاستخدام اليومي (مقرَّب لأقرب كيلومتر) — null إن غابت المسافة. */
  avgPerDayKm: number | null;
  /** قراءة الإرجاع أقل من التسليم — بيانات غير منطقية تستحق تنبيه الموظف. */
  hasInconsistentReadings: boolean;
};

export function summarizeBookingOdometer(b: BookingOdometerInput): BookingOdometerSummary {
  const pickupKm = b.odometerAtPickupKm ?? null;
  const returnKm = b.odometerAtReturnKm ?? null;

  const bothPresent = pickupKm != null && returnKm != null;
  const hasInconsistentReadings = bothPresent && returnKm < pickupKm;
  const distanceKm = bothPresent && !hasInconsistentReadings ? returnKm - pickupKm : null;

  const days = b.numberOfDays > 0 ? b.numberOfDays : 1;

  return {
    pickupKm,
    returnKm,
    distanceKm,
    avgPerDayKm: distanceKm == null ? null : Math.round(distanceKm / days),
    hasInconsistentReadings,
  };
}

/** تحويل مُدخل نصّي لقراءة عداد صالحة، أو رسالة خطأ عربية. الفراغ = غير مُدخل. */
export function parseOdometerInput(
  raw: FormDataEntryValue | string | null | undefined,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: null };

  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "قراءة العداد يجب أن تكون رقماً موجباً." };
  }
  if (n > MAX_ODOMETER_KM) {
    return {
      ok: false,
      error: `قراءة العداد كبيرة بشكل غير منطقي (الحد ${MAX_ODOMETER_KM.toLocaleString("en-US")} كم).`,
    };
  }
  return { ok: true, value: Math.round(n) };
}

/** تنسيق قراءة/مسافة للعرض. */
export function formatKm(km: number | null): string {
  return km == null ? "—" : `${km.toLocaleString("en-US")} كم`;
}
