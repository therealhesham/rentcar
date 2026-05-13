import type { CreateDirectBookingInput } from "@/lib/direct-booking";
import {
  parseAddonIdsFromJsonBody,
  parseCommonBookingFieldsFromJson,
  parseContactEmailFromJson,
  parseDirectBookingKycFromJson,
  parsePickupBranchSlugFromJson,
  parsePickupCitySlugFromJson,
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
  const sid =
    sessionUserId != null && Number.isInteger(sessionUserId) && sessionUserId > 0
      ? sessionUserId
      : undefined;

  return {
    ok: true,
    input: {
      carModelId,
      ...parsed.data,
      addonIds: addonParsed.addonIds,
      customerId: sid,
      ...(pickupCitySlug != null ? { pickupCitySlug } : {}),
      ...(pickupBranchSlug != null ? { pickupBranchSlug } : {}),
      contactEmail: emailParsed.contactEmail,
      kyc: kycParsed.data,
    },
  };
}
