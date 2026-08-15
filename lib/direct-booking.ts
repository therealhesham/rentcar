import "server-only";
import { Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification-service";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
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
  resolveRentalDiscountForPeriod,
  type RentalDiscountPriceSnap,
} from "@/lib/rental-discount";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot, type CouponCodeSnap } from "@/lib/booking-pricing-snapshot";
import { computeBookingReturnAt } from "@/lib/booking-return-schedule";
import {
  DEFAULT_FLEET_TURNAROUND_MINUTES,
  getFleetTurnaroundMinutes,
} from "@/lib/site-settings";
import { logBookingEvent } from "@/lib/booking-audit";
import {
  computeCouponDiscountOnSubtotal,
  computeCouponDiscountForPeriod,
  resolveCouponCode,
} from "@/lib/coupon-code";
import {
  applyPriceFloorPerDay,
  capFullTotalDiscountToFloor,
  resolvePriceFloorForModel,
  NO_PRICE_FLOOR,
  type RentalPeriodKind,
} from "@/lib/min-price-floor";
import {
  recordMinPriceFloorApplied,
  recordMinPriceFloorBypassed,
} from "@/lib/min-price-floor-audit";

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

/**
 * أقصى مدة تُقبل بالتسعير الشهري — حدّ **مؤقت** لأن الإجمالي الشهري لا يتأثر بعدد
 * الأيام إطلاقاً. التفاصيل والبدائل: `docs/monthly-booking-days-limit.md`.
 */
export const MONTHLY_BOOKING_MAX_DAYS = 31;

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

// أُزيلت `bookingRangeYmd` و`ymdRangesOverlap`: كانتا تحجزان أياماً تقويمية كاملة
// فتتحرّر العربية منتصف ليل آخر يوم بينما هي مع العميل حتى ساعة الاستلام من ذلك
// اليوم (أو بعدها لو حجز ساعات إضافية). البديل مقارنة بالتوقيت في
// `countOverlapsFromRows` مع فترة تجهيز.

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

type OverlapRow = {
  pickupDate: Date;
  numberOfDays: number;
  /** لقطة التسعير — منها تُقرأ ساعات الإرجاع المتفق عليها بعد حدّ اليوم الكامل. */
  addonsJson?: string | null;
};

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
    select: { pickupDate: true, numberOfDays: true, addonsJson: true },
  });
}

function safeBookingDays(days: number): number {
  const n = Math.round(Number(days));
  return Math.max(1, Math.min(60, Number.isFinite(n) ? n : 1));
}

/**
 * لحظة تحرّر العربية فعلياً: موعد الإرجاع المتفق عليه إن كان العميل قد حجز ساعات
 * بعد حدّ اليوم الكامل (ودفع فرقها)، وإلا الاستلام + عدد الأيام.
 */
export function bookingOccupiedUntil(row: OverlapRow): Date {
  const snap = parseBookingPricingSnapshot(row.addonsJson ?? null);
  const agreed = snap.delayPenalty?.actualDropoffAt;
  if (agreed) {
    const d = new Date(agreed);
    if (!Number.isNaN(d.getTime()) && d.getTime() > row.pickupDate.getTime()) return d;
  }
  return computeBookingReturnAt(row.pickupDate, safeBookingDays(row.numberOfDays));
}

/**
 * عدد الحجوزات المباشرة النشطة التي تتداخل مع الفترة المطلوبة لنفس الموديل.
 *
 * المقارنة بالتوقيت لا باليوم التقويمي: الحجز باليوم كان يحرّر العربية منتصف ليل
 * آخر يوم بينما هي مع العميل حتى ساعة الاستلام من ذلك اليوم (أو بعدها لو حجز
 * ساعات إضافية)، فتظهر متاحة لعميل آخر في نفس النافذة.
 *
 * كل حجز يحجز `[الاستلام, التحرّر + فترة التجهيز)` — فترة التجهيز تغطي الفحص
 * والنظافة بين عميلين، وتسمح بتسليم نفس اليوم بعد انقضائها.
 */
export function countOverlapsFromRows(
  rows: OverlapRow[],
  pickupDate: Date,
  numberOfDays: number,
  opts?: {
    /** لقطة تسعير الحجز المرشَّح — لقراءة ساعاته الإضافية المتفق عليها. */
    addonsJson?: string | null;
    /** دقائق التجهيز بين حجزين على نفس العربية. */
    turnaroundMinutes?: number;
  },
): number {
  const bufferMs =
    Math.max(0, Math.round(opts?.turnaroundMinutes ?? DEFAULT_FLEET_TURNAROUND_MINUTES)) *
    60_000;
  const aStart = pickupDate.getTime();
  const aEnd =
    bookingOccupiedUntil({
      pickupDate,
      numberOfDays,
      addonsJson: opts?.addonsJson ?? null,
    }).getTime() + bufferMs;
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) return 0;

  let count = 0;
  for (const row of rows) {
    const bStart = row.pickupDate.getTime();
    const bEnd = bookingOccupiedUntil(row).getTime() + bufferMs;
    if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) continue;
    if (aStart < bEnd && bStart < aEnd) count += 1;
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
  return countOverlapsFromRows(rows, pickupDate, numberOfDays, {
    turnaroundMinutes: await getFleetTurnaroundMinutes(),
  });
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
  const { getBookingWidgetTabFlags } = await import("@/lib/site-settings");
  const tabFlags = await getBookingWidgetTabFlags();

  const branchSlug = input.branchSlug.trim().toLowerCase();
  const fleetUnits = await sumFleetQuantityForModelAtBranch(prisma, input.carModelId, {
    branchSlug,
  });

  if (tabFlags.allowOverbooking) {
    return { available: true, fleetUnits: Math.max(1, fleetUnits), overlapping: 0 };
  }

  if (fleetUnits <= 0) {
    return { available: false, fleetUnits: 0, overlapping: 0 };
  }
  const rows = await loadBlockingDirectBookings(
    prisma,
    input.carModelId,
    input.excludeBookingRequestId,
    branchSlug,
  );
  const overlapping = countOverlapsFromRows(rows, input.pickupDate, input.numberOfDays, {
    turnaroundMinutes: await getFleetTurnaroundMinutes(),
  });
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
  const { getBookingWidgetTabFlags } = await import("@/lib/site-settings");
  const tabFlags = await getBookingWidgetTabFlags();

  const safeDays = safeBookingDays(input.numberOfDays);
  const branchSlug = input.branchSlug.trim().toLowerCase();

  if (tabFlags.allowOverbooking) {
    const allRows = await prisma.fleet.findMany({
      where: {
        isVisible: true,
        branch: { slug: branchSlug, isActive: true },
      },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    return allRows.map((r) => r.modelId);
  }

  const rows = await prisma.fleet.findMany({
    where: {
      isVisible: true,
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

/** يُرمى داخل ترانزاكشن الحجز لو كود الخصم استُهلك بالكامل بين لحظة المعاينة ولحظة التأكيد. */
export class CouponUnavailableError extends Error {
  constructor(readonly userMessage: string) {
    super("COUPON_UNAVAILABLE");
    this.name = "CouponUnavailableError";
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

const PICKUP_SLOT_STEP_MS = 30 * 60 * 1000;

/** يقرّب لأسفل لأقرب سلوت 30 دقيقة — نفس خطوة السلوتات في منتقي الوقت بالواجهة (TimePickerPopover). */
function floorToPickupSlot(d: Date): Date {
  return new Date(Math.floor(d.getTime() / PICKUP_SLOT_STEP_MS) * PICKUP_SLOT_STEP_MS);
}

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
  if (pickupDate.getTime() < floorToPickupSlot(new Date()).getTime()) {
    return { ok: false, error: "موعد الاستلام المختار فات. يرجى اختيار موعد قادم." };
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
  /** كود خصم يدخله العميل عند الإتمام — يحل محل الخصم التلقائي (RentalDiscount) عند صلاحيته. */
  couponCode?: string | null;
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
  couponCode?: CouponCodeSnap | null,
  rentalFloorPerDayExclTax?: number | null,
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
    rentalFloorPerDayExclTax?: number;
    couponCode?: CouponCodeSnap;
  } = { items, rentalPricePerDayExclTax: pricePerDayExclTax };
  // الأرضية تُجمَّد مع السعر: أي إعادة حساب بعدد أيام مختلف لازم تقدر تعيد فرضها.
  if (rentalFloorPerDayExclTax != null && rentalFloorPerDayExclTax > 0) {
    payload.rentalFloorPerDayExclTax = rentalFloorPerDayExclTax;
  }
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
  if (couponCode) {
    payload.couponCode = couponCode;
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

    // فحص الجدول الزمني للفرع — يُتخطَّى إذا كان الأدمن قد سمح بالحجز في الإجازات
    const { getBookingWidgetTabFlags } = await import("@/lib/site-settings");
    const tabFlags = await getBookingWidgetTabFlags();
    if (!tabFlags.allowHolidayBooking) {
      const pickupSch = parseBranchOpeningHoursJson(pickupRow.openingHoursJson);
      if (!isDateTimeWithinBranchSchedule(common.pickupDate, pickupSch)) {
        return { ok: false, error: formatBranchOutsideHoursError(pickupRow.name) };
      }
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
  const periodKind: RentalPeriodKind = isMonthlyBooking ? "MONTHLY" : "DAILY";

  /*
   * حدّ **مؤقت** — الشرح الكامل والبدائل في docs/monthly-booking-days-limit.md
   *
   * التسعير الشهري يقسم إجمالي الشهر على الأيام (`toPerDay` أدناه) ثم يضربه
   * `computeCheckoutTotals` في الأيام مجدداً، فيُختصر `days` ويصير الإجمالي = سعر
   * الشهر مهما بلغت المدة. حجز ٤٥ أو ٦٠ يوماً بتواريخ صحيحة تماماً يدفع سعر شهر واحد.
   *
   * المنطق سليم لشهر واحد (الحساب على الإجمالي يمنع ضياع فروق التقريب) لكنه يفترض
   * ضمناً أن المدة ≈ شهر. نمنع ما فوقها ريثما يُحسم تسعير المدد الأطول: رفض الحجز
   * أهون من بيعه بنصف سعره.
   */
  if (isMonthlyBooking && days > MONTHLY_BOOKING_MAX_DAYS) {
    return {
      ok: false,
      error: `الحجز الشهري متاح حتى ${MONTHLY_BOOKING_MAX_DAYS} يوماً. للمدد الأطول اختر الإيجار اليومي أو تواصل معنا.`,
    };
  }

  // أرضية السعر الأدنى (دون ضريبة): تجاوز الفرع إن وُجد وإلا حد الموديل.
  const priceFloor = await resolvePriceFloorForModel(model.id, returnBranchRow?.id ?? null, {
    minPricePerDayExclTax: model.minPricePerDayExclTax,
    minPriceMonthlyExclTax: model.minPriceMonthlyExclTax,
  });

  // مبلغ الفترة قبل أي خصم: إجمالي الشهر للشهري، وسعر اليوم لليومي.
  // الحساب الشهري يتم على الإجمالي ثم يُقسم على الأيام في الآخر — القسمة أولاً
  // ثم التقريب لريال كامل كانت تضيّع فروقاً ملموسة على مدى شهر.
  const basePeriodAmountExclTax = isMonthlyBooking ? branchMonthlyPrice! : branchBasePrice;
  const toPerDay = (periodAmount: number) =>
    isMonthlyBooking ? periodAmount / days : periodAmount;

  let discountedPeriodAmountExclTax = basePeriodAmountExclTax;
  let rentalDiscountSnap: ReturnType<typeof rentalDiscountSnapFromResolved> | null = null;
  let couponApplication:
    | { id: number; maxUses: number | null; kind: "PERCENT" | "FIXED"; value: number; snap: CouponCodeSnap }
    | null = null;
  // كود مصرَّح له إدارياً بتجاوز الحد الأدنى → نلغي الأرضية لهذا الحجز.
  let bypassMinPrice = false;

  // الخصم التلقائي يُحسب **دائماً** — حتى مع وجود كود خصم. الكود يُطبَّق فوق
  // السعر الظاهر للعميل (بعد الخصم التلقائي)، مش على السعر الأساسي؛ وإلا كود
  // ضعيف يستبدل عرضاً أقوى فيرفع السعر بدل ما ينزّله.
  const rentalDiscountResolved = await resolveRentalDiscountForPeriod(
    basePeriodAmountExclTax,
    {
      brandId: model.brandId,
      carModelId: model.id,
      branchId: returnBranchRow?.id ?? null,
      referenceDate: commonNormalized.pickupDate,
      periodKind,
      days,
      // يحتاجها نوع `TO_MIN_PRICE` ليعرف لأي رقم ينزّل.
      priceFloor,
    },
  );
  const afterRentalDiscountExclTax =
    rentalDiscountResolved?.discountedAmountExclTax ?? basePeriodAmountExclTax;
  discountedPeriodAmountExclTax = afterRentalDiscountExclTax;

  const couponCodeRaw = prepared.couponCode?.trim();
  if (couponCodeRaw) {
    // `periodKind` يمنع الأكواد خارج نطاق نوع التأجير المطلوب.
    const resolvedCoupon = await resolveCouponCode(couponCodeRaw, {
      customerPhone: commonNormalized.phone,
      periodKind,
    });
    if (!resolvedCoupon.ok) {
      return { ok: false, error: resolvedCoupon.error };
    }
    const c = resolvedCoupon.coupon;
    bypassMinPrice = c.canBypassMinPrice;
    if (c.scope === "RENTAL_ONLY") {
      const { discountedAmountExclTax } = computeCouponDiscountForPeriod(
        afterRentalDiscountExclTax,
        c.kind,
        c.value,
        periodKind,
      );
      discountedPeriodAmountExclTax = discountedAmountExclTax;
    }
    couponApplication = {
      id: c.id,
      maxUses: c.maxUses,
      kind: c.kind,
      value: c.value,
      // discountExclTax يبدأ صفر ويُملأ لاحقاً لنطاق FULL_TOTAL بعد معرفة الإجمالي الفرعي.
      snap: { code: c.code, kind: c.kind, scope: c.scope, discountExclTax: 0 },
    };
  }

  // الأرضية تُقارَن قبل الضريبة دائماً — `computeCheckoutTotals` تحسب الضريبة
  // على الناتج النهائي بعدها.
  const floorOutcome = applyPriceFloorPerDay(
    toPerDay(discountedPeriodAmountExclTax),
    toPerDay(basePeriodAmountExclTax),
    bypassMinPrice ? NO_PRICE_FLOOR : priceFloor,
    periodKind,
    days,
  );
  const effectivePricePerDay = floorOutcome.finalPricePerDayExclTax;

  // مع التصريح بالتجاوز نحسب الأرضية «الظلّية» — مش لتغيير السعر، بس عشان
  // نعرف هل نزل الحجز تحتها فعلاً فنسجّله للمحاسبة.
  const shadowFloorOutcome = bypassMinPrice
    ? applyPriceFloorPerDay(
        toPerDay(discountedPeriodAmountExclTax),
        toPerDay(basePeriodAmountExclTax),
        priceFloor,
        periodKind,
        days,
      )
    : null;

  // لقطة الخصم التلقائي = الجزء الذي حقّقه وحده (السعر الأساسي ← ما بعده)، بمعزل
  // عن الكوبون. مقصوصة بالسعر النهائي حتى لا يتجاوز مجموع الخصمين المعروض ما
  // دفعه العميل فعلاً بعد الأرضية.
  {
    const perDayBase = floorOutcome.basePricePerDayExclTax;
    const perDayAfterRental = Math.min(
      Math.max(toPerDay(afterRentalDiscountExclTax), effectivePricePerDay),
      perDayBase,
    );
    const actualDiscountPerDay = Math.round((perDayBase - perDayAfterRental) * 100) / 100;
    rentalDiscountSnap =
      actualDiscountPerDay > 0
        ? {
            originalPricePerDayExclTax: perDayBase,
            discountedPricePerDayExclTax: Math.round(perDayAfterRental * 100) / 100,
            discountPerDayExclTax: actualDiscountPerDay,
          }
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
    couponApplication?.snap ?? null,
    floorOutcome.floorPerDayExclTax,
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
  const oneTimeFeesExclTaxSum = shipFeeForTotals + checkoutFeesSum + delayFeeForTotals;

  // كوبون FULL_TOTAL: يُطرح من الإجمالي الفرعي (إيجار+إضافات+رسوم) بعد ما بقى معروف.
  let couponDiscountExclTax = 0;
  let fullTotalFloorApplied = false;
  let fullTotalWithheldExclTax = 0;
  let fullTotalGrantedBelowFloorExclTax = 0;
  if (couponApplication && couponApplication.snap.scope === "FULL_TOTAL") {
    const preDiscountTotals = computeCheckoutTotals(
      effectivePricePerDay,
      days,
      model.vatRatePercent,
      addonsForTotals.map((a: { pricePerDayExclTax: number }) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax: oneTimeFeesExclTaxSum },
    );
    const requestedDiscount = computeCouponDiscountOnSubtotal(
      preDiscountTotals.subtotalExclTax,
      couponApplication.kind,
      couponApplication.value,
    );
    // الأرضية تحمي بند الإيجار: الإضافات والرسوم قابلة للخصم بالكامل لكن
    // المتبقي لا ينزل تحت أرضية الإيجار لكامل المدة.
    const capped = capFullTotalDiscountToFloor(
      requestedDiscount,
      preDiscountTotals.subtotalExclTax,
      floorOutcome.floorPerDayExclTax,
      days,
    );
    couponDiscountExclTax = capped.discountExclTax;
    fullTotalFloorApplied = capped.floorApplied;
    fullTotalWithheldExclTax = capped.withheldDiscountExclTax;

    // نفس فكرة الأرضية الظلّية: كم كان القصّ لولا التصريح؟
    if (shadowFloorOutcome?.floorPerDayExclTax != null) {
      fullTotalGrantedBelowFloorExclTax = capFullTotalDiscountToFloor(
        requestedDiscount,
        preDiscountTotals.subtotalExclTax,
        shadowFloorOutcome.floorPerDayExclTax,
        days,
      ).withheldDiscountExclTax;
    }
  }

  const bookingTotals = computeCheckoutTotals(
    effectivePricePerDay,
    days,
    model.vatRatePercent,
    addonsForTotals.map((a: { pricePerDayExclTax: number }) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: oneTimeFeesExclTaxSum, discountExclTax: couponDiscountExclTax },
  );

  // مبلغ التوفير الإجمالي (دون ضريبة) لتسجيله في CouponRedemption — موحّد الوحدة بين النطاقين.
  const couponDiscountAmountSar = couponApplication
    ? couponApplication.snap.scope === "FULL_TOTAL"
      ? couponDiscountExclTax
      : Math.max(0, branchBasePrice - effectivePricePerDay) * days
    : 0;

  // نلصق القيمة النهائية لـ discountExclTax داخل اللقطة المخزَّنة (كانت صفر مؤقتاً وقت البناء
  // لأنها تعتمد على الإجمالي الفرعي الذي لا يُعرف إلا بعد جمع الإضافات والرسوم).
  let finalAddonsJson = addonsSnap.json;
  if (couponApplication && couponApplication.snap.scope === "FULL_TOTAL" && finalAddonsJson) {
    const rawSnap = JSON.parse(finalAddonsJson) as Record<string, unknown>;
    rawSnap.couponCode = { ...couponApplication.snap, discountExclTax: couponDiscountExclTax };
    finalAddonsJson = JSON.stringify(rawSnap);
  }

  const carType = model.category.slug || model.category.title;

  const turnaroundMinutes = await getFleetTurnaroundMinutes();

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const { getBookingWidgetTabFlags } = await import("@/lib/site-settings");
        const tabFlags = await getBookingWidgetTabFlags();

        if (!tabFlags.allowOverbooking) {
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
          const overlapping = countOverlapsFromRows(
            rows,
            commonNormalized.pickupDate,
            days,
            { addonsJson: finalAddonsJson, turnaroundMinutes },
          );
          if (overlapping >= fleetUnits) {
            throw new DirectBookingCapacityError(
              "SLOT_FULL",
              "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
              fleetUnits,
              overlapping,
            );
          }
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
            addonsJson: finalAddonsJson,
            status: cashPayNow ? "UNDER_REVIEW" : undefined,
            paymentStatus: electronicPayNow ? "PAID" : "PENDING",
            paymentMethod: paymentMethodStored,
            paidAt: electronicPayNow ? new Date() : null,
            paidAmountSar: electronicPayNow ? bookingTotals.totalInclTax : null,
            snapshotTotalAmountSar: bookingTotals.totalInclTax,
            rentalPeriodKind: periodKind,
          },
          select: { id: true },
        });

        if (couponApplication) {
          if (couponApplication.maxUses != null) {
            const updated = await tx.couponCode.updateMany({
              where: { id: couponApplication.id, usesCount: { lt: couponApplication.maxUses } },
              data: { usesCount: { increment: 1 } },
            });
            if (updated.count === 0) {
              throw new CouponUnavailableError("نفد الحد الأقصى لاستخدام كود الخصم. أعد المحاولة بدون الكود.");
            }
          } else {
            await tx.couponCode.update({
              where: { id: couponApplication.id },
              data: { usesCount: { increment: 1 } },
            });
          }
          await tx.couponRedemption.create({
            data: {
              couponCodeId: couponApplication.id,
              bookingRequestId: created.id,
              customerPhone: commonNormalized.phone,
              discountAmountSar: couponDiscountAmountSar,
            },
          });
        }

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
        if (e2 instanceof CouponUnavailableError) {
          return { ok: false, error: e2.userMessage };
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
    } else if (e instanceof CouponUnavailableError) {
      return { ok: false, error: e.userMessage };
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

  await sendNewBookingNotificationEmails(bookingRequestId);

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_CREATED",
    actorKind: customerId ? "CUSTOMER" : "ADMIN",
    actorName: common.fullName,
    toStatus: payNow ? "CONFIRMED" : "NEW",
    notes: payNow ? `${paymentMethodStored}${cashPayNow ? " (كاش)" : ""}` : undefined,
  });

  // الحد الأدنى ألغى جزءاً من الخصم → أثر تدقيق + تنبيه المحاسبة والمشرفين.
  if (floorOutcome.floorApplied || fullTotalFloorApplied) {
    await recordMinPriceFloorApplied({
      bookingId: bookingRequestId,
      branchId: returnBranchRow?.id ?? null,
      carLabel: `${model.name} ${model.year}`.trim(),
      periodKind,
      basePricePerDayExclTax: floorOutcome.basePricePerDayExclTax,
      discountedPricePerDayExclTax: floorOutcome.discountedPricePerDayExclTax,
      floorPerDayExclTax: floorOutcome.floorPerDayExclTax ?? 0,
      finalPricePerDayExclTax: floorOutcome.finalPricePerDayExclTax,
      withheldDiscountExclTax:
        floorOutcome.withheldDiscountExclTax + fullTotalWithheldExclTax,
      days,
      discountSource: couponApplication
        ? { kind: "COUPON", code: couponApplication.snap.code }
        : { kind: "RENTAL_DISCOUNT" },
      floorExceedsBasePrice: floorOutcome.floorExceedsBasePrice,
    });
  }

  // كود مصرَّح له نزل بالسعر فعلاً تحت الحد الأدنى → أثر تدقيق صامت (بلا إشعار).
  const grantedBelowFloor =
    (shadowFloorOutcome?.withheldDiscountExclTax ?? 0) + fullTotalGrantedBelowFloorExclTax;
  if (couponApplication && grantedBelowFloor > 0 && shadowFloorOutcome?.floorPerDayExclTax != null) {
    await recordMinPriceFloorBypassed({
      bookingId: bookingRequestId,
      carLabel: `${model.name} ${model.year}`.trim(),
      periodKind,
      couponCode: couponApplication.snap.code,
      basePricePerDayExclTax: floorOutcome.basePricePerDayExclTax,
      finalPricePerDayExclTax: effectivePricePerDay,
      floorPerDayExclTax: shadowFloorOutcome.floorPerDayExclTax,
      grantedBelowFloorExclTax: grantedBelowFloor,
      days,
    });
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
  const turnaroundMinutes = await getFleetTurnaroundMinutes();

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
          { turnaroundMinutes },
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
  vehiclePlateNumber?: string | null;
};

export async function updateBookingRequestByAdmin(
  bookingRequestId: number,
  input: AdminBookingUpdateInput,
): Promise<
  | {
      ok: true;
      /** مستحقات جديدة للعميل نتجت عن التعديل — تُسوَّى من قسم «مستحقات للعميل». */
      creditForCustomerSar?: number;
      /** بيانات قبل/بعد لتسجيلها في سجل الحجز. */
      changes?: { numberOfDays: [number, number]; snapshotTotalAmountSar?: number | null };
    }
  | { ok: false; error: string }
> {
  const statusTrim = input.status.trim();
  if (!statusTrim || statusTrim.length > 50) {
    return { ok: false, error: "الحالة غير صالحة (حتى 50 حرفاً)." };
  }

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      carModelId: true,
      numberOfDays: true,
      paymentStatus: true,
      balanceDueAtBranchSar: true,
      paidAmountSar: true,
      snapshotTotalAmountSar: true,
      refundDueToCustomerSar: true,
      refundDueSettledAt: true,
      rentalPeriodKind: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  if (!booking) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  const days = safeBookingDays(input.numberOfDays);

  // الحجز الشهري سعره إجمالي الشهر مقسوماً على أيامه، فتغيير المدة يجعل الإجمالي
  // نسبةً من سعر الشهر بدل سعر الشهر نفسه. تغيير الموعد مسموح، المدة لا.
  if (
    booking.rentalPeriodKind?.trim().toUpperCase() === "MONTHLY" &&
    days !== booking.numberOfDays
  ) {
    return {
      ok: false,
      error:
        "الحجز الشهري بمدة ثابتة — لا يمكن تغيير عدد أيامه. ألغِ الحجز وأنشئ حجزاً جديداً بالمدة المطلوبة.",
    };
  }

  const branchIds = await branchIdsFromReturnSlug({
    returnBranchSlug: input.returnBranchSlug,
    pickupMode: input.pickupMode,
  });
  if (!branchIds.returnBranchId) {
    return { ok: false, error: "فرع الإرجاع غير متاح." };
  }

  // ─── تسوية السعر بعد التعديل ──────────────────────────────────────────────
  // مطابِقة لمسار العميل (app/[locale]/account/actions.ts) حرفياً: الرصيد يُشتق من
  // (إجمالي الحجز بعد التعديل − المدفوع فعلياً) لا بالتراكم على الرصيد القديم، فيصحّح
  // ذاتياً أي رصيد متراكم بشكل غير متسق؛ والتقليص يسجّل «مستحقات للعميل» بدل ضياعها.
  let updatedBalanceDueAtBranchSar: number | null | undefined = undefined; // undefined = لا تغيير
  let updatedSnapshotTotalAmountSar: number | null | undefined = undefined;
  let updatedRefundDueToCustomerSar: number | null | undefined = undefined;
  let repricedAddonsJson: string | null | undefined = undefined; // إعادة تسعير على موديل جديد
  let delayAdjustedAddonsJson: string | null | undefined = undefined; // ساعات تأخير من وقت تسليم صريح
  let creditForCustomerSar = 0;

  if (booking.kind === "DIRECT" && booking.carModel) {
    const {
      bookingDaysPriceInputFromSnapshot,
      bookingTotalInclTaxForDays,
      repriceAddonsJsonForModel,
    } = await import("@/lib/booking-edit");

    // الإجمالي الحالي يُحسب دائماً من اللقطة الأصلية (السعر والأيام قبل التعديل).
    const oldPriceInput = bookingDaysPriceInputFromSnapshot(
      booking.carModel.price,
      booking.carModel.vatRatePercent,
      booking.addonsJson,
    );
    const oldTotal = bookingTotalInclTaxForDays(oldPriceInput, booking.numberOfDays);

    // تبديل موديل السيارة يستوجب إعادة تسعير كاملة على سعر الفرع + الخصم + الأرضية
    // للموديل الجديد؛ بدونها يبقى الحجز على سعر السيارة القديمة.
    let newAddonsForPricing = booking.addonsJson;
    let newVatRatePercent = booking.carModel.vatRatePercent;
    const modelChanged =
      input.directCarModelId != null && input.directCarModelId !== booking.carModelId;

    if (modelChanged) {
      const periodKind = booking.rentalPeriodKind?.trim().toUpperCase();
      if (periodKind !== "DAILY" && periodKind !== "MONTHLY") {
        return {
          ok: false,
          error:
            "هذا الحجز أقدم من حفظ نوع فترة التسعير، فلا يمكن إعادة تسعيره على موديل آخر. ألغِ الحجز وأنشئ حجزاً جديداً بالسيارة المطلوبة.",
        };
      }
      const { couponCode } = parseBookingPricingSnapshot(booking.addonsJson);
      if (couponCode?.scope === "RENTAL_ONLY") {
        return {
          ok: false,
          error:
            "الحجز عليه كود خصم على الإيجار مدموج في سعر السيارة الحالية، فلا يمكن نقله لموديل آخر. ألغِ الحجز وأنشئ حجزاً جديداً بالكود نفسه.",
        };
      }

      const newModel = await prisma.carModel.findUnique({
        where: { id: input.directCarModelId! },
        select: {
          id: true,
          brandId: true,
          price: true,
          priceMonthlyExclTax: true,
          vatRatePercent: true,
          minPricePerDayExclTax: true,
          minPriceMonthlyExclTax: true,
        },
      });
      if (!newModel) {
        return { ok: false, error: "الموديل غير موجود." };
      }
      newVatRatePercent = newModel.vatRatePercent;

      const isMonthly = periodKind === "MONTHLY";
      const branchBase = await resolveBranchBasePriceForModel(
        newModel.id,
        branchIds.returnBranchId,
        newModel.price,
      );
      const branchMonthly = isMonthly
        ? await resolveBranchMonthlyPriceForModel(
            newModel.id,
            branchIds.returnBranchId,
            newModel.priceMonthlyExclTax,
          )
        : null;
      if (isMonthly && (branchMonthly == null || branchMonthly <= 0)) {
        return {
          ok: false,
          error: "الموديل الجديد لا يملك سعراً شهرياً في فرع الإرجاع — اختر سيارة أخرى.",
        };
      }
      const priceFloor = await resolvePriceFloorForModel(
        newModel.id,
        branchIds.returnBranchId,
        {
          minPricePerDayExclTax: newModel.minPricePerDayExclTax,
          minPriceMonthlyExclTax: newModel.minPriceMonthlyExclTax,
        },
      );
      const basePeriodAmountExclTax = isMonthly ? branchMonthly! : branchBase;
      const resolvedDiscount = await resolveRentalDiscountForPeriod(
        basePeriodAmountExclTax,
        {
          brandId: newModel.brandId,
          carModelId: newModel.id,
          branchId: branchIds.returnBranchId,
          referenceDate: input.pickupDate,
          periodKind: isMonthly ? "MONTHLY" : "DAILY",
          days,
          // يحتاجها نوع `TO_MIN_PRICE` ليعرف لأي رقم ينزّل.
          priceFloor,
        },
      );
      const toPerDay = (periodAmount: number) =>
        isMonthly ? periodAmount / days : periodAmount;
      const floorOutcome = applyPriceFloorPerDay(
        toPerDay(resolvedDiscount?.discountedAmountExclTax ?? basePeriodAmountExclTax),
        toPerDay(basePeriodAmountExclTax),
        priceFloor,
        isMonthly ? "MONTHLY" : "DAILY",
        days,
      );
      repricedAddonsJson = repriceAddonsJsonForModel(
        booking.addonsJson,
        floorOutcome.finalPricePerDayExclTax,
        floorOutcome.floorPerDayExclTax,
      );
      newAddonsForPricing = repricedAddonsJson;
    }

    // مودال الإدارة صار يختار وقت التسليم صراحةً مثل إتمام العميل، فساعات ما بعد آخر
    // يوم كامل تُعاد تسعيرها منه قبل حساب الإجمالي — وإلا ظهرت في المودال ولم تُحصَّل.
    if (input.dropoffDate && booking.rentalPeriodKind?.trim().toUpperCase() === "DAILY") {
      const { applyDropoffDelayPenaltyToAddonsJson } = await import("@/lib/booking-edit");
      delayAdjustedAddonsJson = applyDropoffDelayPenaltyToAddonsJson({
        addonsJson: newAddonsForPricing,
        pickupDate: input.pickupDate,
        numberOfDays: days,
        actualDropoffDate: input.dropoffDate,
        modelPricePerDayExclTax: modelChanged ? 0 : booking.carModel.price,
      }).addonsJson;
      newAddonsForPricing = delayAdjustedAddonsJson;
    }

    const newPriceInput = bookingDaysPriceInputFromSnapshot(
      modelChanged ? 0 : booking.carModel.price,
      newVatRatePercent,
      newAddonsForPricing,
    );
    const newTotal = bookingTotalInclTaxForDays(newPriceInput, days);
    const diff = newTotal - oldTotal;

    const isPaid = booking.paymentStatus.trim().toUpperCase() === "PAID";
    // استرجاع الإجمالي السابق (للحجوزات القديمة التي لا تملك snapshot، نستنتجه)
    const previousTotal =
      booking.snapshotTotalAmountSar ??
      (isPaid && typeof booking.paidAmountSar === "number"
        ? booking.paidAmountSar + (booking.balanceDueAtBranchSar ?? 0)
        : oldTotal);

    updatedSnapshotTotalAmountSar = Math.round((previousTotal + diff) * 100) / 100;

    if (isPaid) {
      const unsettledCredit =
        booking.refundDueSettledAt == null ? (booking.refundDueToCustomerSar ?? 0) : 0;
      const net =
        typeof booking.paidAmountSar === "number"
          ? Math.round((updatedSnapshotTotalAmountSar - booking.paidAmountSar) * 100) / 100
          : Math.round(
              ((booking.balanceDueAtBranchSar ?? 0) - unsettledCredit + diff) * 100,
            ) / 100;
      if (net > 0.005) {
        updatedBalanceDueAtBranchSar = net;
        updatedRefundDueToCustomerSar = null;
      } else if (net < -0.005) {
        updatedBalanceDueAtBranchSar = null;
        creditForCustomerSar = Math.round(-net * 100) / 100;
        updatedRefundDueToCustomerSar = creditForCustomerSar;
      } else {
        updatedBalanceDueAtBranchSar = null;
        updatedRefundDueToCustomerSar = null;
      }
    } else {
      // غير مدفوع: الإجمالي الجديد يُدفع كاملاً عند إتمام الدفع، وهو يُشتق من اللقطة
      // نفسها (`computeBookingOutstanding`). ضمّ فرق التعديل إلى الرصيد كان يطالب
      // العميل به مرتين: مرة داخل الإجمالي ومرة كرصيد عند الفرع.
      //
      // والرصيد لا يُصفَّر أيضاً: قد يحمل رسوماً إضافية أو غرامة تأخير سُجّلت قبل
      // التحصيل، وتقليص المدة كان يبتلعها. فلا يُمسّ هنا إطلاقاً.
      updatedBalanceDueAtBranchSar = undefined;
    }
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
    ...(input.vehiclePlateNumber !== undefined ? { vehiclePlateNumber: input.vehiclePlateNumber?.trim() || null } : {}),
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

  const turnaroundMinutes = await getFleetTurnaroundMinutes();
  // اللقطة بعد ضبط ساعات التأخير وإعادة التسعير إن بُدِّل الموديل، وإلا لقطة الحجز
  // الحالية. مهمّة هنا لأن `bookingOccupiedUntil` يقرأ منها الساعات الإضافية ليعرف
  // متى تُفرَّغ العربية فعلاً.
  const candidateAddonsJson =
    delayAdjustedAddonsJson !== undefined
      ? delayAdjustedAddonsJson
      : repricedAddonsJson !== undefined
        ? repricedAddonsJson
        : booking.addonsJson;

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
          const overlapping = countOverlapsFromRows(rows, input.pickupDate, days, {
            addonsJson: candidateAddonsJson,
            turnaroundMinutes,
          });
          if (overlapping >= fleetUnits) {
            throw new DirectBookingCapacityError(
              "SLOT_FULL",
              "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
              fleetUnits,
              overlapping,
            );
          }
        }

        // إعادة بناء addonsJson لتعكس عدد الأيام الجديد (وسعر الموديل الجديد إن بُدِّل)
        let newAddonsJson: string | null | undefined = undefined;
        const addonsBase =
          delayAdjustedAddonsJson !== undefined
            ? delayAdjustedAddonsJson
            : repricedAddonsJson !== undefined
              ? repricedAddonsJson
              : booking.addonsJson;
        if (
          days !== booking.numberOfDays ||
          repricedAddonsJson !== undefined ||
          delayAdjustedAddonsJson !== undefined
        ) {
          const { rebuildAddonsJsonForDays } = await import("@/lib/booking-edit");
          newAddonsJson = rebuildAddonsJsonForDays(addonsBase, days, input.pickupDate);
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
            // تمريرها (ولو null) يعيد ضبط حقول التسوية — القيمة الجديدة مستحقات قائمة.
            ...(updatedRefundDueToCustomerSar !== undefined
              ? {
                  refundDueToCustomerSar: updatedRefundDueToCustomerSar,
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

  return {
    ok: true,
    ...(creditForCustomerSar > 0 ? { creditForCustomerSar } : {}),
    changes: {
      numberOfDays: [booking.numberOfDays, days] as [number, number],
      snapshotTotalAmountSar: updatedSnapshotTotalAmountSar ?? null,
    },
  };
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

  // فترة التجهيز تُقرأ قبل المعاملة حتى لا تُبقيها مفتوحة على استعلام إضافي.
  const turnaroundMinutes = await getFleetTurnaroundMinutes();
  const candidateAddonsJson = input.addonsJson;

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
          const overlapping = countOverlapsFromRows(rows, input.pickupDate, days, {
            addonsJson: candidateAddonsJson,
            turnaroundMinutes,
          });
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
