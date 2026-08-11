import {
  computeBookingDays,
  DROPOFF_AFTER_PICKUP_ERROR_AR,
  isDropoffAfterPickup,
} from "@/lib/booking-days";
import type { CreateDirectBookingInput } from "@/lib/direct-booking";
import {
  parseAddonIdsFromJsonBody,
  parseCommonBookingFieldsFromJson,
  parseContactEmailFromJson,
  parseDirectBookingKycFromJson,
  parseDropoffDateFromJson,
  parseExcludeBlockingBookingRequestIdFromJson,
  parsePickupBranchSlugFromJson,
  parsePickupCitySlugFromJson,
  parseRentalTabFromJson,
} from "@/lib/direct-booking";

/**
 * تحليل جسم طلب إتمام الحجز من الموقع (نفس سلسلة التحقق في واجهات API الإتمام).
 */
export function parseCreateDirectBookingInputFromCheckoutJson(
  obj: Record<string, unknown>,
  sessionUserId: number | null | undefined,
): { ok: true; input: CreateDirectBookingInput } | { ok: false; error: string } {
  const carModelId = Number(obj.carModelId);
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "معرّف السيارة غير صالح." };
  }

  const parsed = parseCommonBookingFieldsFromJson(obj);
  if (!parsed.ok) {
    return parsed;
  }

  const dropoffParsed = parseDropoffDateFromJson(obj);
  if (!dropoffParsed.ok) {
    return dropoffParsed;
  }
  if (
    dropoffParsed.dropoffDate &&
    !isDropoffAfterPickup(parsed.data.pickupDate, dropoffParsed.dropoffDate)
  ) {
    return { ok: false, error: DROPOFF_AFTER_PICKUP_ERROR_AR };
  }

  /*
   * `days` هو **المضاعِف الوحيد** للسعر (`pricePerDayExclTax × days`) وهو أيضاً أساس
   * حجز التوفّر. لذلك لا يجوز قبوله من العميل كما هو: طلب مباشر إلى الـ API يستطيع
   * إرسال `days: 1` مع تسليم بعد أسبوع فيدفع يوماً ويحتجز السيارة سبعة، وتظهر
   * السيارة متاحة بعد اليوم الأول فتُحجز مرتين.
   *
   * غرامة التأخير لا تلتقط هذا: `computeDelayPenaltySnap` تعود بـ `null` لأي تبويب
   * غير `daily`، والتبويب نفسه يأتي من العميل.
   *
   * الواجهة تحسب `days` بنفس `computeBookingDays` (FleetCheckoutClient)، فأي طلب
   * شرعي يطابق تماماً. الاختلاف = تلاعب ⇒ نرفض ولا نصحّح بصمت، حتى لا يُنشأ حجز
   * بمدة أو سعر لم يرهما العميل.
   */
  if (dropoffParsed.dropoffDate) {
    const daysFromDates = computeBookingDays(
      parsed.data.pickupDate,
      dropoffParsed.dropoffDate,
    );
    if (daysFromDates !== parsed.data.numberOfDays) {
      return {
        ok: false,
        error: "عدد أيام الحجز لا يطابق تاريخي الاستلام والتسليم. أعد تحميل الصفحة وحاول مجدداً.",
      };
    }
  }

  const emailParsed = parseContactEmailFromJson(obj);
  if (!emailParsed.ok) {
    return emailParsed;
  }

  const kycParsed = parseDirectBookingKycFromJson(obj);
  if (!kycParsed.ok) {
    return kycParsed;
  }

  const addonParsed = parseAddonIdsFromJsonBody(obj);
  if (!addonParsed.ok) {
    return addonParsed;
  }

  const pickupCitySlug = parsePickupCitySlugFromJson(obj);
  const pickupBranchSlug = parsePickupBranchSlugFromJson(obj);
  const excludeBlockingBookingRequestId = parseExcludeBlockingBookingRequestIdFromJson(obj);
  const couponCodeRaw = obj.couponCode;
  const couponCode =
    typeof couponCodeRaw === "string" && couponCodeRaw.trim() ? couponCodeRaw.trim() : undefined;
  const sid =
    sessionUserId != null && Number.isInteger(sessionUserId) && sessionUserId > 0
      ? sessionUserId
      : undefined;

  const rentalTab = parseRentalTabFromJson(obj);

  return {
    ok: true,
    input: {
      carModelId,
      ...parsed.data,
      ...(dropoffParsed.dropoffDate ? { dropoffDate: dropoffParsed.dropoffDate } : {}),
      ...(rentalTab ? { rentalTab } : {}),
      addonIds: addonParsed.addonIds,
      customerId: sid,
      ...(pickupCitySlug != null ? { pickupCitySlug } : {}),
      ...(pickupBranchSlug != null ? { pickupBranchSlug } : {}),
      contactEmail: emailParsed.contactEmail,
      kyc: kycParsed.data,
      ...(excludeBlockingBookingRequestId != null
        ? { excludeBlockingBookingRequestId }
        : {}),
      ...(couponCode != null ? { couponCode } : {}),
    },
  };
}
