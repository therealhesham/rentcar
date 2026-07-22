import { Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification-service";
import {
  DIRECT_BOOKING_MSG_NO_FLEET,
  DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD,
} from "@/lib/direct-booking-user-messages";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import { resolveInterCityShippingSnap } from "@/lib/inter-city-shipping";
import type { CheckoutOneTimeFeeLine } from "@/lib/checkout-one-time-fees";
import { getActiveCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";
import { prisma } from "@/lib/prisma";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { isTrustedSpacesImageUrl } from "@/lib/spaces-upload";
import {
  parseBranchOpeningHoursJson,
  isDateTimeWithinBranchSchedule,
} from "@/lib/branch-opening-hours";
import {
  DELIVERY_ADDRESS_MAX_CHARS,
  DELIVERY_ADDRESS_MIN_CHARS,
} from "@/lib/delivery-address";
import { formatBranchOutsideHoursError } from "@/lib/direct-booking-user-messages";
import { validateRentalAddonExclusiveSelection } from "@/lib/rental-addon-exclusive";
import {
  branchIdsFromReturnSlug,
  resolveBranchIdsFromSlugs,
} from "@/lib/booking-branches";
import {
  resolveBranchBasePriceForModel,
  resolveBranchMonthlyPriceForModel,
  sumFleetQuantityForModelAtBranch,
} from "@/lib/fleet-branch-stock";
import {
  addDaysToYmd,
  dateOnlyYmd,
  lastInclusiveBookingDayYmd,
} from "@/lib/booking-calendar-ymd";
import {
  computeDelayPenaltySnap,
  isDailyRentalTab,
  type DelayPenaltySnap,
} from "@/lib/booking-delay-penalty";
import { formatDailyBookingDurationFromIso } from "@/lib/booking-duration-display";
import {
  rentalDiscountSnapFromResolved,
  resolveRentalDiscountForModel,
  type RentalDiscountPriceSnap,
} from "@/lib/rental-discount";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot } from "@/lib/booking-pricing-snapshot";

export { addDaysToYmd, lastInclusiveBookingDayYmd } from "@/lib/booking-calendar-ymd";

/**
 * منطق التوفر: مجموع quantity في Fleet للموديل = أقصى عدد حجوزات DIRECT متزامنة
 * في أي فترة زمنية (ما عدا حالات NON_BLOCKING).
 * يُحسب التداخل بتقاطع [تاريخ البداية، تاريخ البداية + عدد الأيام) بتقويم UTC.
 */

export const NON_BLOCKING_BOOKING_STATUSES = [
  "CANCELLED",
  "REJECTED",
  "RETURNED",
  "COMPLETED",
] as const;

function normalizeDirectBookingFullNameForCompare(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** مطابقة جوال الطلب المخزّن (+966…) مع الجوال المُرسَل من الإتمام */
function directBookingPhonesMatchForLock(a: string, b: string): boolean {
  const la = e164ToLocalNine(a);
  const lb = e164ToLocalNine(b);
  if (la && lb) return la === lb;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  const tailA = da.length >= 9 ? da.slice(-9) : "";
  const tailB = db.length >= 9 ? db.slice(-9) : "";
  return /^5\d{8}$/.test(tailA) && tailA === tailB;
}

export type DirectBookingCommon = {
  fullName: string;
  phone: string;
  ageRange: string;
  /** فرع إرجاع المركبة — في API/النماذج يُرسل كحقل `branch` */
  returnBranchSlug: string;
  pickupDate: Date;
  numberOfDays: number;
  /** وقت التسليم المختار (إتمام الأسطول) — لغرامة التأخير اليومي */
  dropoffDate?: Date | null;
  /** نوع الإيجار من البحث: daily | weekly | … */
  rentalTab?: string | null;
  termsAccepted: boolean;
  /** استلام من فرع أو توصيل للعنوان */
  pickupMode: "BRANCH" | "DELIVERY";
  deliveryLat: number | null;
  deliveryLng: number | null;
  /** عنوان توصيل نصّي إن وُجد (بدون إحداثيات أو معها). */
  deliveryAddress: string | null;
};

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);

const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRentalTabFromJson(body: JsonBody): string | null {
  const raw = String(body.rental ?? body.rentalTab ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "daily" || raw === "weekly" || raw === "monthly" || raw === "monthly_packages") {
    return raw;
  }
  return null;
}

export function parseDropoffDateFromJson(
  body: JsonBody,
): { ok: true; dropoffDate: Date | null } | { ok: false; error: string } {
  const raw = String(body.dropoffDate ?? body.dropoff ?? "").trim();
  if (!raw) {
    return { ok: true, dropoffDate: null };
  }
  const dropoffDate = new Date(raw);
  if (Number.isNaN(dropoffDate.getTime())) {
    return { ok: false, error: "تاريخ التسليم غير صالح." };
  }
  return { ok: true, dropoffDate };
}

export function parseContactEmailFromJson(
  body: Record<string, unknown>,
): { ok: true; contactEmail: string } | { ok: false; error: string } {
  const raw = String(body.email ?? body.contactEmail ?? "").trim();
  if (!raw) {
    return { ok: false, error: "البريد الإلكتروني مطلوب لإرسال الفاتورة بعد الدفع." };
  }
  if (raw.length > 254 || !CONTACT_EMAIL_RE.test(raw)) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صالحة." };
  }
  return { ok: true, contactEmail: raw.toLowerCase() };
}

function isBranchSlugFormat(branch: string): boolean {
  const s = branch.trim().toLowerCase();
  return /^[a-z0-9-]{1,64}$/.test(s);
}

type DeliveryParsed =
  | {
      pickupMode: "BRANCH";
      deliveryLat: null;
      deliveryLng: null;
      deliveryAddress: null;
    }
  | {
      pickupMode: "DELIVERY";
      deliveryLat: number | null;
      deliveryLng: number | null;
      deliveryAddress: string | null;
    };

function normalizeDeliveryAddressInput(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** null = غير مُدخَل؛ رفض الإحداثيات الناقصة عبر hasLat !== hasLng */
function parseOptionalCoord(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDeliveryPayload(
  pickupMode: "BRANCH" | "DELIVERY",
  latRaw: unknown,
  lngRaw: unknown,
  addrRaw: unknown,
): { ok: true; value: DeliveryParsed } | { ok: false; error: string } {
  if (pickupMode === "BRANCH") {
    return {
      ok: true,
      value: {
        pickupMode: "BRANCH",
        deliveryLat: null,
        deliveryLng: null,
        deliveryAddress: null,
      },
    };
  }

  const latOpt = parseOptionalCoord(latRaw);
  const lngOpt = parseOptionalCoord(lngRaw);
  const hasLat = latOpt !== null;
  const hasLng = lngOpt !== null;

  if (hasLat !== hasLng) {
    return {
      ok: false,
      error:
        "حدد موقع التوصيل بالكامل على الخريطة (خطّي الطول والعرض)، أو امسح الإحداثيات وأدخل عنواناً تفصيلياً.",
    };
  }

  const addr = normalizeDeliveryAddressInput(addrRaw);
  if (addr.length > DELIVERY_ADDRESS_MAX_CHARS) {
    return {
      ok: false,
      error: `عنوان التوصيل طويل جداً (بحد أقصى ${DELIVERY_ADDRESS_MAX_CHARS} حرفاً).`,
    };
  }

  if (hasLat && hasLng) {
    const latVal = latOpt as number;
    const lngVal = lngOpt as number;
    if (latVal < -90 || latVal > 90 || lngVal < -180 || lngVal > 180) {
      return { ok: false, error: "إحداثيات التوصيل خارج النطاق المسموح." };
    }
  }

  const hasCoords = Boolean(hasLat && hasLng);

  const hasMeaningfulAddress = addr.length >= DELIVERY_ADDRESS_MIN_CHARS;

  if (!hasCoords && !hasMeaningfulAddress) {
    if (addr.length > 0) {
      return {
        ok: false,
        error: `أدخل عنواناً أوضح (على الأقل ${DELIVERY_ADDRESS_MIN_CHARS} أحرف)، أو حدّد الموقع على الخريطة.`,
      };
    }
    return {
      ok: false,
      error:
        "حدد موقع التوصيل على الخريطة، أو اكتب عنوان التوصيل التفصيلي (الحي، الشارع، معلم قريب).",
    };
  }

  if (hasCoords && !hasMeaningfulAddress) {
    return {
      ok: true,
      value: {
        pickupMode: "DELIVERY",
        deliveryLat: latOpt,
        deliveryLng: lngOpt,
        deliveryAddress: null,
      },
    };
  }

  if (!hasCoords && hasMeaningfulAddress) {
    return {
      ok: true,
      value: {
        pickupMode: "DELIVERY",
        deliveryLat: null,
        deliveryLng: null,
        deliveryAddress: addr,
      },
    };
  }

  return {
    ok: true,
    value: {
      pickupMode: "DELIVERY",
      deliveryLat: latOpt,
      deliveryLng: lngOpt,
      deliveryAddress: addr.length > 0 ? addr : null,
    },
  };
}

function parseDeliveryPartFromJson(
  body: Record<string, unknown>,
):
  | ({ ok: true } & DeliveryParsed)
  | { ok: false; error: string } {
  const raw = body.pickupMode;
  const pickupMode: "BRANCH" | "DELIVERY" =
    raw === "DELIVERY" || raw === "delivery" ? "DELIVERY" : "BRANCH";

  const p = parseDeliveryPayload(
    pickupMode,
    body.deliveryLat,
    body.deliveryLng,
    body.deliveryAddress,
  );
  if (!p.ok) return p;
  return { ok: true, ...p.value };
}

function parseDeliveryPartFromFormData(
  formData: FormData,
):
  | ({ ok: true } & DeliveryParsed)
  | { ok: false; error: string } {
  const modeRaw = String(formData.get("pickupMode") ?? "BRANCH").trim().toUpperCase();
  const pickupMode: "BRANCH" | "DELIVERY" = modeRaw === "DELIVERY" ? "DELIVERY" : "BRANCH";

  const p = parseDeliveryPayload(
    pickupMode,
    formData.get("deliveryLat"),
    formData.get("deliveryLng"),
    formData.get("deliveryAddress"),
  );
  if (!p.ok) return p;
  return { ok: true, ...p.value };
}

function bookingRangeYmd(pickupDate: Date, numberOfDays: number): {
  startYmd: string;
  endExclusiveYmd: string;
} {
  const startYmd = dateOnlyYmd(pickupDate);
  return {
    startYmd,
    endExclusiveYmd: addDaysToYmd(startYmd, numberOfDays),
  };
}

function ymdRangesOverlap(
  startA: string,
  endExclusiveA: string,
  startB: string,
  endExclusiveB: string,
): boolean {
  return startA < endExclusiveB && startB < endExclusiveA;
}

/** عميل DB يدعم جداول Fleet و BookingRequest (للمعاملات التفاعلية). */
type FleetBookingClient = {
  fleet: typeof prisma.fleet;
  bookingRequest: typeof prisma.bookingRequest;
};

export async function sumFleetQuantityForModel(
  client: Pick<FleetBookingClient, "fleet">,
  carModelId: number,
): Promise<number> {
  const agg = await client.fleet.aggregate({
    where: { modelId: carModelId },
    _sum: { quantity: true },
  });
  return Math.max(0, agg._sum.quantity ?? 0);
}

/** @deprecated استخدم sumFleetQuantityForModel — اسم أوضح للدمج من صفوف متعددة */
export async function getFleetUnitsForModel(carModelId: number): Promise<number> {
  return sumFleetQuantityForModel(prisma, carModelId);
}

type OverlapRow = { pickupDate: Date; numberOfDays: number };

async function loadBlockingDirectBookings(
  client: Pick<FleetBookingClient, "bookingRequest">,
  carModelId: number,
  excludeBookingRequestId?: number,
  branchSlug?: string,
): Promise<OverlapRow[]> {
  return client.bookingRequest.findMany({
    where: {
      kind: "DIRECT",
      carModelId,
      NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
      ...(branchSlug ? { returnBranch: { slug: branchSlug } } : {}),
      ...(excludeBookingRequestId
        ? { id: { not: excludeBookingRequestId } }
        : {}),
    },
    select: { pickupDate: true, numberOfDays: true },
  });
}

function safeBookingDays(days: number): number {
  const n = Math.round(Number(days));
  return Math.max(1, Math.min(60, Number.isFinite(n) ? n : 1));
}

/**
 * عدد الحجوزات المباشرة النشطة التي تتداخل مع الفترة المطلوبة لنفس الموديل.
 */
export function countOverlapsFromRows(
  rows: OverlapRow[],
  pickupDate: Date,
  numberOfDays: number,
): number {
  const safeDays = safeBookingDays(numberOfDays);
  const { startYmd, endExclusiveYmd } = bookingRangeYmd(pickupDate, safeDays);
  let count = 0;
  for (const row of rows) {
    const rowDays = safeBookingDays(row.numberOfDays);
    const other = bookingRangeYmd(row.pickupDate, rowDays);
    if (
      ymdRangesOverlap(startYmd, endExclusiveYmd, other.startYmd, other.endExclusiveYmd)
    ) {
      count += 1;
    }
  }
  return count;
}

export async function countOverlappingDirectBookings(
  carModelId: number,
  pickupDate: Date,
  numberOfDays: number,
  excludeBookingRequestId?: number,
): Promise<number> {
  const rows = await loadBlockingDirectBookings(
    prisma,
    carModelId,
    excludeBookingRequestId,
  );
  return countOverlapsFromRows(rows, pickupDate, numberOfDays);
}

export type DirectAvailabilityResult = {
  available: boolean;
  fleetUnits: number;
  overlapping: number;
};

export async function getDirectBookingAvailability(input: {
  carModelId: number;
  pickupDate: Date;
  numberOfDays: number;
  excludeBookingRequestId?: number;
  /** فرع الإرجاع (مطلوب لاحتساب مخزون الفرع والحجوزات المتزامنة) */
  branchSlug: string;
}): Promise<DirectAvailabilityResult> {
  const branchSlug = input.branchSlug.trim().toLowerCase();
  const fleetUnits = await sumFleetQuantityForModelAtBranch(prisma, input.carModelId, {
    branchSlug,
  });
  if (fleetUnits <= 0) {
    return { available: false, fleetUnits: 0, overlapping: 0 };
  }
  const rows = await loadBlockingDirectBookings(
    prisma,
    input.carModelId,
    input.excludeBookingRequestId,
    branchSlug,
  );
  const overlapping = countOverlapsFromRows(
    rows,
    input.pickupDate,
    input.numberOfDays,
  );
  return {
    available: overlapping < fleetUnits,
    fleetUnits,
    overlapping,
  };
}

/** معرفات الموديلات التي لديها أسطول وتتوفر في الفترة المطلوبة (حجز مباشر). */
export async function listAvailableCarModelIds(input: {
  pickupDate: Date;
  numberOfDays: number;
  /** فرع الإرجاع — يُعرض فقط الموديلات المتوفرة في هذا الفرع */
  branchSlug: string;
}): Promise<number[]> {
  const safeDays = safeBookingDays(input.numberOfDays);
  const branchSlug = input.branchSlug.trim().toLowerCase();
  const rows = await prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      branch: { slug: branchSlug, isActive: true },
    },
    select: { modelId: true },
    distinct: ["modelId"],
  });
  const modelIds = rows.map((r) => r.modelId);
  const available: number[] = [];
  for (const modelId of modelIds) {
    const res = await getDirectBookingAvailability({
      carModelId: modelId,
      pickupDate: input.pickupDate,
      numberOfDays: safeDays,
      branchSlug,
    });
    if (res.available) {
      available.push(modelId);
    }
  }
  return available;
}

export class DirectBookingCapacityError extends Error {
  readonly code: "NO_FLEET" | "SLOT_FULL";

  constructor(
    code: "NO_FLEET" | "SLOT_FULL",
    message: string,
    readonly fleetUnits: number,
    readonly overlapping: number,
  ) {
    super(message);
    this.name = "DirectBookingCapacityError";
    this.code = code;
  }
}

function isSerializationConflict(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
}

export function parseCommonBookingFieldsFromFormData(
  formData: FormData,
): { ok: true; data: DirectBookingCommon } | { ok: false; error: string } {
  const fullName = String(formData.get("name") ?? "").trim();
  const localPhone = String(formData.get("phone") ?? "")
    .replace(/\s+/g, "")
    .trim();
  const ageRange = String(formData.get("age") ?? "");
  const branch = String(formData.get("branch") ?? "");
  const pickupDateRaw = String(formData.get("pickupDate") ?? "");
  const days = Number(formData.get("days"));
  const termsAccepted = formData.get("terms") === "on";

  if (fullName.length < 3) {
    return { ok: false, error: "يرجى إدخال الاسم الكامل بشكل صحيح." };
  }
  if (!/^5\d{8}$/.test(localPhone)) {
    return { ok: false, error: "يرجى إدخال رقم الجوال بدون 966 وبصيغة صحيحة." };
  }
  const phone = `+966${localPhone}`;
  if (!AGE_OPTIONS.has(ageRange)) {
    return { ok: false, error: "الفئة العمرية غير صالحة." };
  }
  if (!isBranchSlugFormat(branch)) {
    return { ok: false, error: "معرّف الفرع غير صالح." };
  }

  const pickupDate = new Date(pickupDateRaw);
  if (!pickupDateRaw || Number.isNaN(pickupDate.getTime())) {
    return { ok: false, error: "يرجى اختيار تاريخ بداية الحجز." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  if (!termsAccepted) {
    return { ok: false, error: "يجب الموافقة على الشروط والأحكام." };
  }

  const delivery = parseDeliveryPartFromFormData(formData);
  if (!delivery.ok) {
    return delivery;
  }

  return {
    ok: true,
    data: {
      fullName,
      phone,
      ageRange,
      returnBranchSlug: branch.trim().toLowerCase(),
      pickupDate,
      numberOfDays: safeBookingDays(days),
      termsAccepted,
      pickupMode: delivery.pickupMode,
      deliveryLat: delivery.pickupMode === "BRANCH" ? null : delivery.deliveryLat,
      deliveryLng: delivery.pickupMode === "BRANCH" ? null : delivery.deliveryLng,
      deliveryAddress:
        delivery.pickupMode === "BRANCH" ? null : delivery.deliveryAddress,
    },
  };
}

type JsonBody = Record<string, unknown>;

export function parseCommonBookingFieldsFromJson(
  body: JsonBody,
): { ok: true; data: DirectBookingCommon } | { ok: false; error: string } {
  const fullName = String(body.name ?? "").trim();
  const localPhone = String(body.phone ?? "")
    .replace(/\s+/g, "")
    .trim();
  const ageRange = String(body.age ?? "");
  const branch = String(body.branch ?? "");
  const pickupDateRaw = String(body.pickupDate ?? "");
  const days = Number(body.days);
  const termsAccepted = body.terms === true || body.terms === "true" || body.terms === "on";

  if (fullName.length < 3) {
    return { ok: false, error: "يرجى إدخال الاسم الكامل بشكل صحيح." };
  }
  if (!/^5\d{8}$/.test(localPhone)) {
    return { ok: false, error: "يرجى إدخال رقم الجوال بدون 966 وبصيغة صحيحة." };
  }
  const phone = `+966${localPhone}`;
  if (!AGE_OPTIONS.has(ageRange)) {
    return { ok: false, error: "الفئة العمرية غير صالحة." };
  }
  if (!isBranchSlugFormat(branch)) {
    return { ok: false, error: "معرّف الفرع غير صالح." };
  }

  const pickupDate = new Date(pickupDateRaw);
  if (!pickupDateRaw || Number.isNaN(pickupDate.getTime())) {
    return { ok: false, error: "يرجى اختيار تاريخ بداية الحجز." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  if (!termsAccepted) {
    return { ok: false, error: "يجب الموافقة على الشروط والأحكام." };
  }

  const delivery = parseDeliveryPartFromJson(body);
  if (!delivery.ok) {
    return delivery;
  }

  return {
    ok: true,
    data: {
      fullName,
      phone,
      ageRange,
      returnBranchSlug: branch.trim().toLowerCase(),
      pickupDate,
      numberOfDays: safeBookingDays(days),
      termsAccepted,
      pickupMode: delivery.pickupMode,
      deliveryLat: delivery.pickupMode === "BRANCH" ? null : delivery.deliveryLat,
      deliveryLng: delivery.pickupMode === "BRANCH" ? null : delivery.deliveryLng,
      deliveryAddress:
        delivery.pickupMode === "BRANCH" ? null : delivery.deliveryAddress,
    },
  };
}

export type CreateDirectBookingInput = DirectBookingCommon & {
  carModelId: number;
  /** عند الاستلام من فرع — slug فرع الاستلام إن وُجد (وإلا نفس فرع الإرجاع). */
  pickupBranchSlug?: string | null;
  /** معرفات إضافات نشطة من جدول RentalAddon */
  addonIds?: number[];
  /** slug مدينة الاستلام أو مدينة عنوان التوصيل (لرسوم الشحن بين المدن) */
  pickupCitySlug?: string | null;
  /** عميل مسجّل مرتبط بالطلب عند تطابق الجوال */
  customerId?: number | null;
  /** بريد إرسال الفاتورة (من واجهة الإتمام) */
  contactEmail?: string | null;
  /** مستندات الهوية والرخصة (واجهة الإتمام) — اختياري لحجز المكتب من الإدارة */
  kyc?: DirectBookingKycInput | null;
  /**
   * عند تعديل حجز من الحساب: يُستثنى هذا الطلب من احتساب التداخل داخل المعاملة (بعد التحقق من الملكية).
   */
  excludeBlockingBookingRequestId?: number | null;
  /** تسجيل دفع فوري من المكتب (إدارة) عند إنشاء الحجز. */
  officePayment?:
    | { recordNow: false }
    | { recordNow: true; method: string };
};

export function parsePickupCitySlugFromJson(
  body: JsonBody,
): string | undefined {
  const raw = body.pickupCity ?? body.pickupCitySlug;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase();
  if (!s || !/^[a-z0-9-]{1,64}$/.test(s)) return undefined;
  return s;
}

/** فرع الاستلام عند الاستلام من الفرع (قد يختلف عن `returnBranchSlug`). */
export function parsePickupBranchSlugFromJson(body: JsonBody): string | undefined {
  const raw = body.pickupBranch ?? body.pickupBranchSlug;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase();
  if (!s || !isBranchSlugFormat(s)) return undefined;
  return s;
}

/** معرف طلب يُستثنى من التداخل عند الإتمام — يُتحقق من ملكيته داخل `createDirectBooking`. */
export function parseExcludeBlockingBookingRequestIdFromJson(body: JsonBody): number | undefined {
  const raw = body.excludeBookingRequestId ?? body.excludeBlockingBookingRequestId;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

export function parseAddonIdsFromJsonBody(
  body: JsonBody,
): { ok: true; addonIds: number[] | undefined } | { ok: false; error: string } {
  const raw = body.addonIds;
  if (raw === undefined || raw === null) {
    return { ok: true, addonIds: undefined };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "صيغة قائمة الإضافات غير صالحة." };
  }
  const ids = [
    ...new Set(
      raw
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (ids.length > 25) {
    return { ok: false, error: "عدد الإضافات غير مسموح." };
  }
  return { ok: true, addonIds: ids.length ? ids : undefined };
}

export const DIRECT_BOOKING_ID_KIND_CITIZEN = "CITIZEN" as const;
/** مقيم — رقم الإقامة (10 أرقام يبدأ بـ 2). */
export const DIRECT_BOOKING_ID_KIND_RESIDENT = "RESIDENT" as const;
/** زائر — جواز السفر فقط. */
export const DIRECT_BOOKING_ID_KIND_VISITOR = "VISITOR" as const;
/** @deprecated استخدم `VISITOR`؛ ما زال يُقبل للتوافق مع طلبات قديمة. */
export const DIRECT_BOOKING_ID_KIND_RESIDENT_VISITOR = "RESIDENT_VISITOR" as const;

export type DirectBookingIdDocumentKind =
  | typeof DIRECT_BOOKING_ID_KIND_CITIZEN
  | typeof DIRECT_BOOKING_ID_KIND_RESIDENT
  | typeof DIRECT_BOOKING_ID_KIND_VISITOR;

export type DirectBookingKycInput = {
  idDocumentKind: DirectBookingIdDocumentKind;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string;
  licenseExpiryDate: Date;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string;
};

/**
 * تحقق من بيانات الهوية/الجواز والرخصة وروابط الصور (روابط Spaces موثوقة فقط).
 */
export function parseDirectBookingKycFromJson(
  body: JsonBody,
): { ok: true; data: DirectBookingKycInput } | { ok: false; error: string } {
  const kindRaw = String(body.idDocumentKind ?? "")
    .trim()
    .toUpperCase();
  let idDocumentKind: DirectBookingIdDocumentKind | null = null;
  if (kindRaw === DIRECT_BOOKING_ID_KIND_CITIZEN) {
    idDocumentKind = DIRECT_BOOKING_ID_KIND_CITIZEN;
  } else if (kindRaw === DIRECT_BOOKING_ID_KIND_RESIDENT) {
    idDocumentKind = DIRECT_BOOKING_ID_KIND_RESIDENT;
  } else if (kindRaw === DIRECT_BOOKING_ID_KIND_VISITOR || kindRaw === DIRECT_BOOKING_ID_KIND_RESIDENT_VISITOR) {
    idDocumentKind = DIRECT_BOOKING_ID_KIND_VISITOR;
  }
  if (!idDocumentKind) {
    return { ok: false, error: "نوع المستند غير صالح (مواطن أو مقيم أو زائر)." };
  }

  const nationalIdNumber =
    String(body.nationalIdNumber ?? "")
      .trim()
      .replace(/\D/g, "") || null;
  const passportNumber = String(body.passportNumber ?? "").trim().toUpperCase() || null;
  const licenseNumber = String(body.licenseNumber ?? "").trim();
  const idCardRaw = String(body.idCardImageUrl ?? "").trim();
  const licenseImgRaw = String(body.driverLicenseImageUrl ?? "").trim();

  if (!/^\d{10}$/.test(licenseNumber)) {
    return { ok: false, error: "رقم الرخصة يجب أن يتكوّن من 10 أرقام فقط." };
  }

  const licenseExpiryRaw = String(body.licenseExpiryDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiryRaw)) {
    return { ok: false, error: "تاريخ انتهاء الرخصة مطلوب بصيغة سنة-شهر-يوم." };
  }
  const expParts = licenseExpiryRaw.split("-").map((x) => Number(x));
  const [ey, em, ed] = expParts;
  if (!ey || !em || !ed || em < 1 || em > 12 || ed < 1 || ed > 31) {
    return { ok: false, error: "تاريخ انتهاء الرخصة غير صالح." };
  }
  const licenseExpiryDate = new Date(Date.UTC(ey, em - 1, ed));
  if (Number.isNaN(licenseExpiryDate.getTime())) {
    return { ok: false, error: "تاريخ انتهاء الرخصة غير صالح." };
  }

  const pickupDateRaw = String(body.pickupDate ?? "");
  const pickupDate = new Date(pickupDateRaw);
  if (!pickupDateRaw.trim() || Number.isNaN(pickupDate.getTime())) {
    return { ok: false, error: "يرجى اختيار تاريخ بداية الحجز." };
  }
  const daysNum = Number(body.days);
  if (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  const rentalLastDayYmd = lastInclusiveBookingDayYmd(pickupDate, daysNum);
  if (licenseExpiryRaw < rentalLastDayYmd) {
    return {
      ok: false,
      error: `تاريخ انتهاء الرخصة يجب ألا يكون قبل آخر يوم من مدة الحجز (${rentalLastDayYmd}).`,
    };
  }

  let idCardImageUrl: string | null = null;
  if (idCardRaw) {
    if (!isTrustedSpacesImageUrl(idCardRaw)) {
      return { ok: false, error: "رابط صورة الهوية أو الجواز غير موثوق." };
    }
    idCardImageUrl = idCardRaw;
  }

  if (!licenseImgRaw || !isTrustedSpacesImageUrl(licenseImgRaw)) {
    return {
      ok: false,
      error: "صورة الرخصة مطلوبة ويجب رفعها من النظام (رابط غير موثوق).",
    };
  }
  const driverLicenseImageUrl = licenseImgRaw;

  if (idDocumentKind === DIRECT_BOOKING_ID_KIND_CITIZEN) {
    if (!nationalIdNumber || !/^\d{10}$/.test(nationalIdNumber)) {
      return { ok: false, error: "رقم الهوية الوطنية مطلوب ويجب أن يكون 10 أرقام." };
    }
    if (!nationalIdNumber.startsWith("1")) {
      return { ok: false, error: "رقم الهوية الوطنية للمواطن يجب أن يبدأ بالرقم 1." };
    }
    if (passportNumber) {
      return { ok: false, error: "لا تُدخل رقم جواز عند اختيار مواطن سعودي." };
    }
  } else if (idDocumentKind === DIRECT_BOOKING_ID_KIND_RESIDENT) {
    if (!nationalIdNumber || !/^\d{10}$/.test(nationalIdNumber)) {
      return { ok: false, error: "رقم الإقامة مطلوب ويجب أن يكون 10 أرقاماً." };
    }
    if (!nationalIdNumber.startsWith("2")) {
      return { ok: false, error: "رقم الإقامة للمقيم يجب أن يبدأ بالرقم 2." };
    }
    if (passportNumber) {
      return { ok: false, error: "لا تُدخل رقم جواز عند اختيار مقيم (أدخل رقم الإقامة فقط)." };
    }
  } else {
    if (!passportNumber || passportNumber.length < 6 || passportNumber.length > 24) {
      return { ok: false, error: "رقم الجواز مطلوب للزائر (6–24 حرفاً)." };
    }
    if (!/^[A-Z0-9\-]+$/.test(passportNumber)) {
      return { ok: false, error: "صيغة رقم الجواز غير صالحة (أحرف إنجليزية وأرقام وشرطة)." };
    }
    if (nationalIdNumber) {
      return { ok: false, error: "لا تُدخل رقم هوية أو إقامة عند اختيار زائر (أدخل رقم الجواز فقط)." };
    }
  }

  return {
    ok: true,
    data: {
      idDocumentKind,
      nationalIdNumber:
        idDocumentKind === DIRECT_BOOKING_ID_KIND_CITIZEN ||
        idDocumentKind === DIRECT_BOOKING_ID_KIND_RESIDENT
          ? nationalIdNumber
          : null,
      passportNumber:
        idDocumentKind === DIRECT_BOOKING_ID_KIND_VISITOR ? passportNumber : null,
      licenseNumber,
      licenseExpiryDate,
      idCardImageUrl,
      driverLicenseImageUrl,
    },
  };
}

async function buildBookingAddonsJsonSnapshot(
  addonIds: number[] | undefined,
  numberOfDays: number,
  interCityShipping: InterCityShippingSnap | null,
  checkoutOneTimeFees: ReadonlyArray<CheckoutOneTimeFeeLine>,
  delayPenalty: DelayPenaltySnap | null,
  pricePerDayExclTax: number,
  pickupDate: Date,
  dropoffDate: Date | null | undefined,
  rentalTab: string | null | undefined,
  rentalDiscount?: RentalDiscountPriceSnap | null,
): Promise<{ ok: true; json: string | null } | { ok: false; error: string }> {
  const days = safeBookingDays(numberOfDays);
  let items: Array<{
    id: number;
    slug: string;
    titleAr: string;
    pricePerDayExclTax: number;
    days: number;
    lineTotalExclTax: number;
  }> = [];

  if (addonIds?.length) {
    const uniqueIds = [...new Set(addonIds)];
    const addons = await prisma.rentalAddon.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        pricePerDay: true,
        exclusiveGroup: true,
      },
    });
    if (addons.length !== uniqueIds.length) {
      return { ok: false, error: "إحدى الإضافات المختارة غير متاحة." };
    }
    const exclusiveCheck = validateRentalAddonExclusiveSelection(addons);
    if (!exclusiveCheck.ok) {
      return { ok: false, error: exclusiveCheck.error };
    }
    items = addons.map((a) => ({
      id: a.id,
      slug: a.slug,
      titleAr: a.titleAr,
      pricePerDayExclTax: a.pricePerDay,
      days,
      lineTotalExclTax: a.pricePerDay * days,
    }));
  }

  const hasShip =
    interCityShipping != null &&
    typeof interCityShipping.feeExclVatSar === "number" &&
    interCityShipping.feeExclVatSar > 0;

  const coSnap = checkoutOneTimeFees
    .filter((x) => x.feeExclVatSar > 0)
    .map((x) => ({
      slug: x.slug,
      labelAr: x.label,
      feeExclVatSar: Math.round(x.feeExclVatSar),
    }));
  const hasCheckout = coSnap.length > 0;

  const delaySnap =
    delayPenalty ??
    computeDelayPenaltySnap({
      rentalTab,
      pricePerDayExclTax,
      pickupDate,
      numberOfDays: days,
      actualDropoffDate: dropoffDate ?? null,
    });
  const hasDelay = delaySnap != null && delaySnap.feeExclVatSar > 0;

  let tripDurationLabelAr: string | null = null;
  if (
    isDailyRentalTab(rentalTab) &&
    dropoffDate &&
    !Number.isNaN(dropoffDate.getTime()) &&
    !Number.isNaN(pickupDate.getTime())
  ) {
    tripDurationLabelAr = formatDailyBookingDurationFromIso(
      pickupDate.toISOString(),
      dropoffDate.toISOString(),
    );
  }
  const hasDurationLabel = Boolean(tripDurationLabelAr);
  const hasDiscount =
    rentalDiscount != null && rentalDiscount.discountPerDayExclTax > 0;

  // سعر الإيجار اليومي دائماً يُجمَّد في اللقطة — بمعزل عن أي تغيير لاحق في
  // سعر الموديل الحالي (حتى للحجوزات بلا إضافات/رسوم/خصم إطلاقاً).
  const payload: {
    items: typeof items;
    interCityShipping?: InterCityShippingSnap;
    checkoutOneTimeFees?: typeof coSnap;
    delayPenalty?: DelayPenaltySnap;
    tripDurationLabelAr?: string;
    rentalDiscount?: RentalDiscountPriceSnap;
    rentalPricePerDayExclTax: number;
  } = { items, rentalPricePerDayExclTax: pricePerDayExclTax };
  if (hasShip && interCityShipping) {
    payload.interCityShipping = interCityShipping;
  }
  if (hasCheckout) {
    payload.checkoutOneTimeFees = coSnap;
  }
  if (hasDelay && delaySnap) {
    payload.delayPenalty = delaySnap;
  }
  if (tripDurationLabelAr) {
    payload.tripDurationLabelAr = tripDurationLabelAr;
  }
  if (hasDiscount && rentalDiscount) {
    payload.rentalDiscount = rentalDiscount;
  }
  return { ok: true, json: JSON.stringify(payload) };
}

export async function assertBranchesAndPickupHoursForDirectBooking(
  input: CreateDirectBookingInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    pickupBranchSlug,
    carModelId: _cm,
    addonIds: _ad,
    pickupCitySlug: _pcs,
    customerId: _cu,
    contactEmail: _ce,
    kyc: _ky,
    ...common
  } = input;

  const branchSlug = common.returnBranchSlug.trim().toLowerCase();
  const returnBranchRow = await prisma.branch.findFirst({
    where: { slug: branchSlug, isActive: true },
    select: { id: true, name: true, openingHoursJson: true },
  });
  if (!returnBranchRow) {
    return { ok: false, error: "الفرع غير متاح أو غير مفعّل." };
  }

  if (common.pickupMode === "BRANCH") {
    const pickupSlug = (pickupBranchSlug?.trim() || branchSlug).toLowerCase();
    const pickupRow =
      pickupSlug === branchSlug
        ? returnBranchRow
        : await prisma.branch.findFirst({
            where: { slug: pickupSlug, isActive: true },
            select: { id: true, name: true, openingHoursJson: true },
          });
    if (!pickupRow) {
      return { ok: false, error: "فرع الاستلام غير متاح أو غير مفعّل." };
    }
    const pickupSch = parseBranchOpeningHoursJson(pickupRow.openingHoursJson);
    if (!isDateTimeWithinBranchSchedule(common.pickupDate, pickupSch)) {
      return { ok: false, error: formatBranchOutsideHoursError(pickupRow.name) };
    }
  }

  return { ok: true };
}

export type EnforceEditLockedIdentityResult =
  | { ok: true; prepared: CreateDirectBookingInput; verifiedExcludeBlockingId: number | undefined }
  | { ok: false; error: string };

/**
 * يضبط customerId عند تطابق جوال الحساب مع الطلب، ويتحقق من ملكية طلب الاستثناء من التداخل،
 * ويثبّت الاسم والجوال من الطلب الأصلي عند تعديل حجز قائم (رفض أي تلاعب من الواجهة).
 */
export async function enforceEditLockedIdentityOnInput(
  input: CreateDirectBookingInput,
): Promise<EnforceEditLockedIdentityResult> {
  const excludeBlockingRaw = input.excludeBlockingBookingRequestId;
  const carModelId = input.carModelId;
  let customerId: number | null =
    input.customerId != null &&
    Number.isInteger(input.customerId) &&
    input.customerId > 0
      ? input.customerId
      : null;

  if (customerId != null) {
    const linked = await prisma.user.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });
    const bookingPhone = input.phone.trim();
    if (!linked?.phone || linked.phone !== bookingPhone) {
      customerId = null;
    }
  }

  let verifiedExcludeBlockingId: number | undefined;
  let lockedBookingIdentity: { fullName: string; phone: string } | null = null;
  if (
    excludeBlockingRaw != null &&
    Number.isInteger(excludeBlockingRaw) &&
    excludeBlockingRaw >= 1
  ) {
    const bookingPhone = input.phone.trim();
    const owned = await prisma.bookingRequest.findFirst({
      where: {
        id: excludeBlockingRaw,
        kind: "DIRECT",
        carModelId,
        OR: [
          ...(customerId != null ? [{ customerId }] : []),
          { phone: bookingPhone },
        ],
      },
      select: { id: true, fullName: true, phone: true },
    });
    if (owned) {
      verifiedExcludeBlockingId = owned.id;
      lockedBookingIdentity = {
        fullName: owned.fullName,
        phone: owned.phone,
      };
    }
  }

  let prepared: CreateDirectBookingInput = { ...input, customerId };

  if (verifiedExcludeBlockingId != null && lockedBookingIdentity != null) {
    const subName = normalizeDirectBookingFullNameForCompare(prepared.fullName);
    const lockName = normalizeDirectBookingFullNameForCompare(lockedBookingIdentity.fullName);
    const subPhone = prepared.phone.trim();
    const lockPhone = lockedBookingIdentity.phone.trim();
    if (subName !== lockName || !directBookingPhonesMatchForLock(subPhone, lockPhone)) {
      return {
        ok: false,
        error:
          "لا يُسمح بتغيير الاسم أو رقم الجوال عند تعديل حجز قائم. استخدم بيانات الطلب الأصلية كما في الحساب.",
      };
    }
    prepared = {
      ...prepared,
      fullName: lockName,
      phone: lockPhone,
      customerId,
    };
  }

  return { ok: true, prepared, verifiedExcludeBlockingId };
}

/**
 * إنشاء حجز مباشر: نفس احتساب التوفر داخل معاملة Serializable مع إعادة المحاولة عند تعارض P2034.
 */
export async function createDirectBooking(
  input: CreateDirectBookingInput,
): Promise<{ ok: true; bookingRequestId: number } | { ok: false; error: string }> {
  const enforced = await enforceEditLockedIdentityOnInput(input);
  if (!enforced.ok) return enforced;

  const { prepared, verifiedExcludeBlockingId } = enforced;
  const {
    carModelId,
    addonIds,
    customerId,
    pickupCitySlug,
    pickupBranchSlug,
    contactEmail,
    kyc: _kyc,
    excludeBlockingBookingRequestId: _excludeIgnored,
    officePayment,
    ...common
  } = prepared;

  const payNow = officePayment?.recordNow === true;
  const paymentMethodStored = payNow ? officePayment.method.trim().toUpperCase() : null;
  const cashPayNow =
    payNow && paymentMethodStored != null && paymentMethodStored === "CASH";
  const electronicPayNow = payNow && !cashPayNow;

  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "معرّف السيارة غير صالح." };
  }

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    include: { category: true },
  });
  if (!model) {
    return { ok: false, error: "السيارة غير موجودة." };
  }

  const branchAssert = await assertBranchesAndPickupHoursForDirectBooking(prepared);
  if (!branchAssert.ok) {
    return branchAssert;
  }

  const returnBranchSlug = common.returnBranchSlug.trim().toLowerCase();
  const commonNormalized = { ...common, returnBranchSlug };

  const shippingSnap = await resolveInterCityShippingSnap({
    originCitySlug: pickupCitySlug,
    returnBranchSlug,
  });

  const days = commonNormalized.numberOfDays;

  const checkoutFeeLines = await getActiveCheckoutOneTimeFees();

  const returnBranchRow = await prisma.branch.findFirst({
    where: { slug: returnBranchSlug, isActive: true },
    select: { id: true },
  });

  // سعر الفرع (فرع الإرجاع — نفس فرع تسعير الخصومات وصفحة الإتمام) وإلا سعر الموديل
  const branchBasePrice = await resolveBranchBasePriceForModel(
    model.id,
    returnBranchRow?.id ?? null,
    model.price,
  );

  // تبويب «شهري»: سعر شهري ثابت (منفصل عن نظام خصومات اليومي) — يُحوَّل لسعر يومي
  // مكافئ (السعر الشهري ÷ عدد الأيام) بحيث يبقى الإجمالي = السعر الشهري بالضبط
  // دون تغيير معادلة computeCheckoutTotals نفسها.
  const branchMonthlyPrice = await resolveBranchMonthlyPriceForModel(
    model.id,
    returnBranchRow?.id ?? null,
    model.priceMonthlyExclTax,
  );
  const isMonthlyBooking =
    commonNormalized.rentalTab?.trim().toLowerCase() === "monthly" && branchMonthlyPrice != null;

  let effectivePricePerDay: number;
  let rentalDiscountSnap: ReturnType<typeof rentalDiscountSnapFromResolved> | null;
  if (isMonthlyBooking) {
    effectivePricePerDay = branchMonthlyPrice! / days;
    rentalDiscountSnap = null;
  } else {
    const rentalDiscountResolved = await resolveRentalDiscountForModel(branchBasePrice, {
      brandId: model.brandId,
      carModelId: model.id,
      branchId: returnBranchRow?.id ?? null,
      referenceDate: commonNormalized.pickupDate,
    });
    effectivePricePerDay = rentalDiscountResolved?.discountedPricePerDayExclTax ?? branchBasePrice;
    rentalDiscountSnap = rentalDiscountResolved
      ? rentalDiscountSnapFromResolved(rentalDiscountResolved)
      : null;
  }

  const addonsSnap = await buildBookingAddonsJsonSnapshot(
    addonIds,
    days,
    shippingSnap,
    checkoutFeeLines,
    null,
    effectivePricePerDay,
    commonNormalized.pickupDate,
    commonNormalized.dropoffDate,
    commonNormalized.rentalTab,
    rentalDiscountSnap,
  );
  if (!addonsSnap.ok) {
    return { ok: false, error: addonsSnap.error };
  }

  // حساب المبلغ الإجمالي المدفوع (شامل الضريبة) لحفظه لحظة الدفع الإلكتروني
  const {
    addons: addonsForTotals,
    interCityShipping: shipForTotals,
    checkoutOneTimeFees: feesForTotals,
    delayPenalty: delayForTotals,
  } = parseBookingPricingSnapshot(addonsSnap.json);
  const shipFeeForTotals = shipForTotals?.feeExclVatSar ?? 0;
  const checkoutFeesSum = feesForTotals.reduce((s: number, x: { feeExclVatSar: number }) => s + x.feeExclVatSar, 0);
  // بند ساعات التأخير/الساعات الإضافية جزء من الإجمالي — إسقاطه كان يجعل
  // snapshotTotalAmountSar أقل من «تفاصيل المبلغ» المحسوبة حياً.
  const delayFeeForTotals = delayForTotals?.feeExclVatSar ?? 0;
  const bookingTotals = computeCheckoutTotals(
    effectivePricePerDay,
    days,
    model.vatRatePercent,
    addonsForTotals.map((a: { pricePerDayExclTax: number }) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: shipFeeForTotals + checkoutFeesSum + delayFeeForTotals },
  );

  const carType = model.category.slug || model.category.title;

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const fleetUnits = await sumFleetQuantityForModelAtBranch(tx, carModelId, {
          branchSlug: returnBranchSlug,
        });
        if (fleetUnits <= 0) {
          throw new DirectBookingCapacityError(
            "NO_FLEET",
            "لا توجد وحدات لهذا الموديل في فرع الإرجاع.",
            0,
            0,
          );
        }
        const rows = await loadBlockingDirectBookings(
          tx,
          carModelId,
          verifiedExcludeBlockingId,
          returnBranchSlug,
        );
        const overlapping = countOverlapsFromRows(rows, commonNormalized.pickupDate, days);
        if (overlapping >= fleetUnits) {
          throw new DirectBookingCapacityError(
            "SLOT_FULL",
            "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
            fleetUnits,
            overlapping,
          );
        }
        const pickupSlugForStore =
          commonNormalized.pickupMode === "BRANCH"
            ? (pickupBranchSlug?.trim().toLowerCase() || returnBranchSlug)
            : null;
        const branchIds = await resolveBranchIdsFromSlugs({
          pickupSlug: pickupSlugForStore,
          returnSlug: returnBranchSlug,
        });
        if (!branchIds.returnBranchId) {
          throw Object.assign(new Error("NO_RETURN_BRANCH"), {
            userMessage: "فرع الإرجاع غير متاح.",
          });
        }
        if (commonNormalized.pickupMode === "BRANCH" && !branchIds.pickupBranchId) {
          throw Object.assign(new Error("NO_PICKUP_BRANCH"), {
            userMessage: "فرع الاستلام غير متاح.",
          });
        }

        const created = await tx.bookingRequest.create({
          data: {
            kind: "DIRECT",
            carModelId,
            customerId,
            fullName: commonNormalized.fullName,
            phone: commonNormalized.phone,
            contactEmail:
              typeof contactEmail === "string" && contactEmail.trim()
                ? contactEmail.trim().toLowerCase()
                : null,
            ageRange: commonNormalized.ageRange,
            carType,
            branchId: branchIds.pickupBranchId,
            returnBranchId: branchIds.returnBranchId,
            pickupMode: commonNormalized.pickupMode,
            deliveryLat: commonNormalized.deliveryLat,
            deliveryLng: commonNormalized.deliveryLng,
            deliveryAddress: commonNormalized.deliveryAddress,
            pickupDate: commonNormalized.pickupDate,
            numberOfDays: days,
            termsAccepted: commonNormalized.termsAccepted,
            addonsJson: addonsSnap.json,
            status: cashPayNow ? "UNDER_REVIEW" : undefined,
            paymentStatus: electronicPayNow ? "PAID" : "PENDING",
            paymentMethod: paymentMethodStored,
            paidAt: electronicPayNow ? new Date() : null,
            paidAmountSar: electronicPayNow ? bookingTotals.totalInclTax : null,
            snapshotTotalAmountSar: bookingTotals.totalInclTax,
          },
          select: { id: true },
        });
        return created.id;
      },
      {
        maxWait: 8000,
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

  let bookingRequestId: number | null = null;
  try {
    bookingRequestId = await runOnce();
  } catch (e) {
    if (isSerializationConflict(e)) {
      try {
        bookingRequestId = await runOnce();
      } catch (e2) {
        if (e2 instanceof DirectBookingCapacityError) {
          return capacityErrorToResult(e2);
        }
        if (isSerializationConflict(e2)) {
          return {
            ok: false,
            error:
              "ازدحام مؤقت عند تأكيد الحجز. عدّد العربيات المتاحة تغيّرت؛ أعد المحاولة بعد لحظات.",
          };
        }
        console.error(e2);
        return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
      }
    } else if (e instanceof DirectBookingCapacityError) {
      return capacityErrorToResult(e);
    } else {
      console.error(e);
      return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
    }
  }

  if (!bookingRequestId) {
    return { ok: false, error: "تعذّر تسجيل الطلب." };
  }

  // Trigger real-time notification
  try {
    const pickupSlugForStore =
      common.pickupMode === "BRANCH"
        ? (pickupBranchSlug?.trim().toLowerCase() || common.returnBranchSlug.trim().toLowerCase())
        : null;
    const branchIds = await resolveBranchIdsFromSlugs({
      pickupSlug: pickupSlugForStore,
      returnSlug: common.returnBranchSlug.trim().toLowerCase(),
    });
    const targetBranchId = branchIds.pickupBranchId ?? branchIds.returnBranchId;

    await createNotification(
      { branchId: targetBranchId },
      "حجز مباشر جديد",
      `تم تسجيل حجز جديد للعميل ${common.fullName}`
    );
  } catch (err) {
    console.error("[createDirectBooking] Notification trigger error:", err);
  }

  return { ok: true, bookingRequestId };
}

function capacityErrorToResult(
  e: DirectBookingCapacityError,
): { ok: false; error: string } {
  if (e.code === "NO_FLEET") {
    return { ok: false, error: DIRECT_BOOKING_MSG_NO_FLEET };
  }
  return {
    ok: false,
    error: DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD,
  };
}

function mapConvertInquiryError(e: unknown): { ok: false; error: string } {
  if (e instanceof DirectBookingCapacityError) {
    return capacityErrorToResult(e);
  }
  if (e && typeof e === "object" && "userMessage" in e) {
    return { ok: false, error: String((e as { userMessage: unknown }).userMessage) };
  }
  if (isSerializationConflict(e)) {
    return {
      ok: false,
      error: "ازدحام مؤقت؛ أعد المحاولة بعد لحظات أو حدّث الصفحة.",
    };
  }
  console.error(e);
  return { ok: false, error: "تعذّر تحديث الطلب." };
}

/**
 * تحويل طلب استفسار إلى حجز مباشر: نفس قواعد الأسطول والتداخل داخل معاملة Serializable.
 */
export async function convertInquiryBookingToDirect(
  bookingRequestId: number,
  carModelId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const booking = await tx.bookingRequest.findUnique({
          where: { id: bookingRequestId },
          select: {
            id: true,
            kind: true,
            returnBranch: { select: { slug: true } },
            pickupDate: true,
            numberOfDays: true,
          },
        });
        if (!booking) {
          throw Object.assign(new Error("NOT_FOUND"), {
            userMessage: "الطلب غير موجود.",
          });
        }
        if (booking.kind !== "INQUIRY") {
          throw Object.assign(new Error("NOT_INQUIRY"), {
            userMessage: "يمكن تحويل طلبات الاستفسار فقط.",
          });
        }

        const model = await tx.carModel.findUnique({
          where: { id: carModelId },
          include: { category: true },
        });
        if (!model) {
          throw Object.assign(new Error("NO_MODEL"), {
            userMessage: "الموديل غير موجود.",
          });
        }

        const branchSlug = booking.returnBranch?.slug?.trim().toLowerCase();
        if (!branchSlug) {
          throw Object.assign(new Error("NO_BRANCH"), {
            userMessage: "فرع الإرجاع غير محدد في الطلب.",
          });
        }
        const fleetUnits = await sumFleetQuantityForModelAtBranch(tx, carModelId, {
          branchSlug,
        });
        if (fleetUnits <= 0) {
          throw new DirectBookingCapacityError(
            "NO_FLEET",
            "لا توجد وحدات لهذا الموديل في فرع الإرجاع.",
            0,
            0,
          );
        }

        const rows = await loadBlockingDirectBookings(tx, carModelId, undefined, branchSlug);
        const overlapping = countOverlapsFromRows(
          rows,
          booking.pickupDate,
          booking.numberOfDays,
        );
        if (overlapping >= fleetUnits) {
          throw new DirectBookingCapacityError(
            "SLOT_FULL",
            "الفترة ممتلئة في فرع الإرجاع لهذه الفترة.",
            fleetUnits,
            overlapping,
          );
        }

        const carType = model.category.slug || model.category.title;
        const updated = await tx.bookingRequest.updateMany({
          where: { id: bookingRequestId, kind: "INQUIRY" },
          data: {
            kind: "DIRECT",
            carModelId,
            carType,
          },
        });
        if (updated.count === 0) {
          throw Object.assign(new Error("RACE"), {
            userMessage:
              "تعذّر التحويل: حالة الطلب تغيّرت (ربما تم تحويله). حدّث الصفحة.",
          });
        }
      },
      {
        maxWait: 8000,
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

  try {
    await runOnce();
  } catch (e) {
    if (isSerializationConflict(e)) {
      try {
        await runOnce();
      } catch (e2) {
        return mapConvertInquiryError(e2);
      }
    } else {
      return mapConvertInquiryError(e);
    }
  }

  return { ok: true };
}

function isBlockingBookingStatus(status: string): boolean {
  return !(NON_BLOCKING_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** تعديل طلب حجز من لوحة الإدارة — للاستفسار: فئة السيارة؛ للمباشر: التحقق من الأسطول عند الحالات المستهلكة للموعد. */
export type AdminBookingUpdateInput = DirectBookingCommon & {
  status: string;
  inquiryCarTypeSlug: string | null;
  directCarModelId: number | null;
};

export async function updateBookingRequestByAdmin(
  bookingRequestId: number,
  input: AdminBookingUpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const statusTrim = input.status.trim();
  if (!statusTrim || statusTrim.length > 50) {
    return { ok: false, error: "الحالة غير صالحة (حتى 50 حرفاً)." };
  }

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      numberOfDays: true,
      paymentStatus: true,
      balanceDueAtBranchSar: true,
      paidAmountSar: true,
      snapshotTotalAmountSar: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  if (!booking) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  const days = safeBookingDays(input.numberOfDays);

  // ─── حساب فرق السعر عند تغيير عدد الأيام بعد الدفع ───────────────────────
  // إذا كان الحجز مدفوعاً وتغيّر عدد الأيام، نراكم الفرق في balanceDueAtBranchSar
  // ليطالب به الموظف عند تسليم أو إرجاع السيارة في الفرع.
  let updatedBalanceDueAtBranchSar: number | null | undefined = undefined; // undefined = لا تغيير
  let updatedSnapshotTotalAmountSar: number | null | undefined = undefined; // undefined = لا تغيير
  if (
    booking.kind === "DIRECT" &&
    booking.carModel &&
    days !== booking.numberOfDays
  ) {
    const { bookingDaysPriceInputFromSnapshot, bookingTotalInclTaxForDays } =
      await import("@/lib/booking-edit");
    const priceInput = bookingDaysPriceInputFromSnapshot(
      booking.carModel.price,
      booking.carModel.vatRatePercent,
      booking.addonsJson,
    );
    const oldTotal = bookingTotalInclTaxForDays(priceInput, booking.numberOfDays);
    const newTotal = bookingTotalInclTaxForDays(priceInput, days);
    const diff = newTotal - oldTotal;

    // استرجاع الإجمالي السابق (للحجوزات القديمة التي لا تملك snapshot، نستنتجه)
    const previousTotal = booking.snapshotTotalAmountSar ?? 
      (booking.paymentStatus.trim().toUpperCase() === "PAID" && typeof booking.paidAmountSar === "number" 
        ? booking.paidAmountSar + (booking.balanceDueAtBranchSar ?? 0) 
        : oldTotal);

    // snapshot الإجمالي الجديد مجمّد وقت التعديل بإضافة فرق التمديد فقط
    updatedSnapshotTotalAmountSar = Math.round((previousTotal + diff) * 100) / 100;

    // فرق مستحق عند الفرع (للحجوزات المدفوعة مسبقاً فقط)
    if (booking.paymentStatus.trim().toUpperCase() === "PAID") {
      const base = booking.balanceDueAtBranchSar ?? 0;
      const next = base + diff;
      const rounded = Math.round(next * 100) / 100;
      updatedBalanceDueAtBranchSar = rounded > 0 ? rounded : null;
    }
  }
  const branchIds = await branchIdsFromReturnSlug({
    returnBranchSlug: input.returnBranchSlug,
    pickupMode: input.pickupMode,
  });
  if (!branchIds.returnBranchId) {
    return { ok: false, error: "فرع الإرجاع غير متاح." };
  }
  const commonData = {
    fullName: input.fullName.trim(),
    phone: input.phone,
    ageRange: input.ageRange,
    branchId: branchIds.branchId,
    returnBranchId: branchIds.returnBranchId,
    pickupMode: input.pickupMode,
    deliveryLat: input.deliveryLat,
    deliveryLng: input.deliveryLng,
    deliveryAddress: input.deliveryAddress,
    pickupDate: input.pickupDate,
    numberOfDays: days,
    termsAccepted: input.termsAccepted,
    status: statusTrim,
  };

  if (booking.kind === "INQUIRY") {
    const slug = input.inquiryCarTypeSlug?.trim();
    if (!slug) {
      return { ok: false, error: "اختر فئة السيارة." };
    }
    const cat = await prisma.fleetCategory.findUnique({ where: { slug } });
    if (!cat) {
      return { ok: false, error: "فئة السيارة غير صالحة." };
    }
    try {
      const updated = await prisma.bookingRequest.updateMany({
        where: { id: bookingRequestId, kind: "INQUIRY" },
        data: {
          ...commonData,
          carType: cat.slug,
        },
      });
      if (updated.count === 0) {
        return {
          ok: false,
          error: "تعذّر التحديث: نوع الطلب تغيّر. حدّث الصفحة.",
        };
      }
    } catch (e) {
      console.error(e);
      return { ok: false, error: "تعذّر حفظ التعديلات." };
    }
    return { ok: true };
  }

  const carModelId = input.directCarModelId;
  if (!carModelId || carModelId < 1 || !Number.isInteger(carModelId)) {
    return { ok: false, error: "اختر موديل السيارة." };
  }

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const row = await tx.bookingRequest.findUnique({
          where: { id: bookingRequestId },
          select: {
            id: true,
            kind: true,
            branchId: true,
            returnBranch: { select: { slug: true } },
          },
        });
        if (!row || row.kind !== "DIRECT") {
          throw Object.assign(new Error("NOT_DIRECT"), {
            userMessage: "الطلب ليس حجزاً مباشراً أو غير موجود.",
          });
        }

        const model = await tx.carModel.findUnique({
          where: { id: carModelId },
          include: { category: true },
        });
        if (!model) {
          throw Object.assign(new Error("NO_MODEL"), {
            userMessage: "الموديل غير موجود.",
          });
        }

        const carType = model.category.slug || model.category.title;
        const returnSlug = input.returnBranchSlug.trim().toLowerCase();
        const updatedBranchIds = await branchIdsFromReturnSlug({
          returnBranchSlug: returnSlug,
          pickupMode: input.pickupMode,
          preservePickupBranchId: row.branchId,
        });
        if (!updatedBranchIds.returnBranchId) {
          throw Object.assign(new Error("NO_RETURN_BRANCH"), {
            userMessage: "فرع الإرجاع غير متاح.",
          });
        }

        if (isBlockingBookingStatus(statusTrim)) {
          const branchSlug = returnSlug;
          const fleetUnits = await sumFleetQuantityForModelAtBranch(tx, carModelId, {
            branchSlug,
          });
          if (fleetUnits <= 0) {
            throw new DirectBookingCapacityError(
              "NO_FLEET",
              "لا توجد وحدات لهذا الموديل في فرع الإرجاع.",
              0,
              0,
            );
          }
          const rows = await loadBlockingDirectBookings(
            tx,
            carModelId,
            bookingRequestId,
            branchSlug,
          );
          const overlapping = countOverlapsFromRows(rows, input.pickupDate, days);
          if (overlapping >= fleetUnits) {
            throw new DirectBookingCapacityError(
              "SLOT_FULL",
              "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
              fleetUnits,
              overlapping,
            );
          }
        }

        // إعادة بناء addonsJson لتعكس عدد الأيام الجديد
        let newAddonsJson: string | null | undefined = undefined;
        if (days !== booking.numberOfDays) {
          const { rebuildAddonsJsonForDays } = await import("@/lib/booking-edit");
          newAddonsJson = rebuildAddonsJsonForDays(booking.addonsJson, days);
        }

        const updated = await tx.bookingRequest.updateMany({
          where: { id: bookingRequestId, kind: "DIRECT" },
          data: {
            ...commonData,
            branchId: updatedBranchIds.branchId,
            returnBranchId: updatedBranchIds.returnBranchId,
            carModelId,
            carType,
            ...(newAddonsJson !== undefined ? { addonsJson: newAddonsJson } : {}),
            ...(updatedBalanceDueAtBranchSar !== undefined
              ? { balanceDueAtBranchSar: updatedBalanceDueAtBranchSar }
              : {}),
            ...(updatedSnapshotTotalAmountSar !== undefined
              ? { snapshotTotalAmountSar: updatedSnapshotTotalAmountSar }
              : {}),
          },
        });
        if (updated.count === 0) {
          throw Object.assign(new Error("RACE"), {
            userMessage: "تعذّر التحديث. حدّث الصفحة.",
          });
        }
      },
      {
        maxWait: 8000,
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

  try {
    await runOnce();
  } catch (e) {
    if (isSerializationConflict(e)) {
      try {
        await runOnce();
      } catch (e2) {
        return mapConvertInquiryError(e2);
      }
    } else {
      return mapConvertInquiryError(e);
    }
  }

  return { ok: true };
}

/**
 * إرجاع حجز مباشر إلى طلب استفسار: يُلغى ربط الموديل (يُفرَّج موعد من الأسطول) ويُعاد النوع إلى INQUIRY.
 */
export async function convertDirectBookingToInquiry(
  bookingRequestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const booking = await tx.bookingRequest.findUnique({
          where: { id: bookingRequestId },
          select: { id: true, kind: true },
        });
        if (!booking) {
          throw Object.assign(new Error("NOT_FOUND"), {
            userMessage: "الطلب غير موجود.",
          });
        }
        if (booking.kind !== "DIRECT") {
          throw Object.assign(new Error("NOT_DIRECT"), {
            userMessage: "يمكن إرجاع الحجوزات المباشرة فقط إلى طلب استفسار.",
          });
        }

        const updated = await tx.bookingRequest.updateMany({
          where: { id: bookingRequestId, kind: "DIRECT" },
          data: {
            kind: "INQUIRY",
            carModelId: null,
            status: "NEW",
          },
        });
        if (updated.count === 0) {
          throw Object.assign(new Error("RACE"), {
            userMessage:
              "تعذّر التحديث: حالة الطلب تغيّرت (ربما أُعيد مسبقاً). حدّث الصفحة.",
          });
        }
      },
      {
        maxWait: 8000,
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

  try {
    await runOnce();
  } catch (e) {
    if (isSerializationConflict(e)) {
      try {
        await runOnce();
      } catch (e2) {
        return mapConvertInquiryError(e2);
      }
    } else {
      return mapConvertInquiryError(e);
    }
  }

  return { ok: true };
}

/**
 * تعديل تواريخ حجز مباشر من حساب العميل (تاريخ الاستلام/عدد الأيام) مع التحقق من الملكية
 * وإعادة فحص السعة داخل معاملة Serializable (مع استثناء الطلب نفسه من التداخل).
 * يحدّث أيضاً لقطة الإضافات (addonsJson) لتعكس عدد الأيام الجديد.
 */
export async function updateDirectBookingDates(input: {
  bookingRequestId: number;
  customerId: number | null;
  customerPhone: string | null;
  pickupDate: Date;
  numberOfDays: number;
  addonsJson: string | null;
  /** مبلغ مستحق يُحصَّل عند الفرع بعد التعديل (فرق السعر). null = لا يُغيَّر. */
  balanceDueAtBranchSar?: number | null;
  /** snapshot الإجمالي الجديد بعد التعديل (شامل الضريبة) — مجمَّد وقت التعديل. */
  snapshotTotalAmountSar?: number | null;
  /**
   * مستحقات للعميل بعد التعديل (شامل الضريبة). تمريرها (ولو null) يعيد ضبط
   * حقول التسوية — القيمة الجديدة تمثل مستحقات قائمة غير مُسوَّاة.
   */
  refundDueToCustomerSar?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { bookingRequestId } = input;
  const days = safeBookingDays(input.numberOfDays);
  const ownerOr = [
    ...(input.customerId != null && input.customerId >= 1
      ? [{ customerId: input.customerId }]
      : []),
    ...(input.customerPhone ? [{ phone: input.customerPhone }] : []),
  ];
  if (ownerOr.length === 0) {
    return { ok: false, error: "تعذّر التحقق من ملكية الطلب." };
  }

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const row = await tx.bookingRequest.findFirst({
          where: { id: bookingRequestId, kind: "DIRECT", OR: ownerOr },
          select: {
            id: true,
            carModelId: true,
            status: true,
            returnBranch: { select: { slug: true } },
          },
        });
        if (!row) {
          throw Object.assign(new Error("NOT_FOUND"), {
            userMessage: "الطلب غير موجود أو لا يخص حسابك.",
          });
        }
        if (row.carModelId == null) {
          throw Object.assign(new Error("NO_MODEL"), {
            userMessage: "موديل السيارة غير محدد في الطلب.",
          });
        }
        const statusKey = row.status.trim().toUpperCase();
        if (
          statusKey === "CANCELLED" ||
          statusKey === "REJECTED" ||
          statusKey === "COMPLETED"
        ) {
          throw Object.assign(new Error("TERMINAL"), {
            userMessage: "لا يمكن تعديل حجز منتهٍ أو ملغى.",
          });
        }
        const branchSlug = row.returnBranch?.slug?.trim().toLowerCase();
        if (!branchSlug) {
          throw Object.assign(new Error("NO_BRANCH"), {
            userMessage: "فرع الإرجاع غير محدد في الطلب.",
          });
        }

        if (isBlockingBookingStatus(row.status)) {
          const fleetUnits = await sumFleetQuantityForModelAtBranch(tx, row.carModelId, {
            branchSlug,
          });
          if (fleetUnits <= 0) {
            throw new DirectBookingCapacityError(
              "NO_FLEET",
              "لا توجد وحدات لهذا الموديل في فرع الإرجاع.",
              0,
              0,
            );
          }
          const rows = await loadBlockingDirectBookings(
            tx,
            row.carModelId,
            bookingRequestId,
            branchSlug,
          );
          const overlapping = countOverlapsFromRows(rows, input.pickupDate, days);
          if (overlapping >= fleetUnits) {
            throw new DirectBookingCapacityError(
              "SLOT_FULL",
              "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
              fleetUnits,
              overlapping,
            );
          }
        }

        const updated = await tx.bookingRequest.updateMany({
          where: { id: bookingRequestId, kind: "DIRECT", OR: ownerOr },
          data: {
            pickupDate: input.pickupDate,
            numberOfDays: days,
            addonsJson: input.addonsJson,
            ...(input.balanceDueAtBranchSar !== undefined
              ? { balanceDueAtBranchSar: input.balanceDueAtBranchSar }
              : {}),
            ...(input.snapshotTotalAmountSar !== undefined
              ? { snapshotTotalAmountSar: input.snapshotTotalAmountSar }
              : {}),
            ...(input.refundDueToCustomerSar !== undefined
              ? {
                  refundDueToCustomerSar: input.refundDueToCustomerSar,
                  refundDueSettledAt: null,
                  refundDueSettledMethod: null,
                  refundDueSettledRef: null,
                  refundDueSettledBy: null,
                }
              : {}),
          },
        });
        if (updated.count === 0) {
          throw Object.assign(new Error("RACE"), {
            userMessage: "تعذّر التحديث. حدّث الصفحة.",
          });
        }
      },
      {
        maxWait: 8000,
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

  try {
    await runOnce();
  } catch (e) {
    if (isSerializationConflict(e)) {
      try {
        await runOnce();
      } catch (e2) {
        return mapConvertInquiryError(e2);
      }
    } else {
      return mapConvertInquiryError(e);
    }
  }

  return { ok: true };
}
