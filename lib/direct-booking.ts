import { Prisma } from "@prisma/client";
import {
  DIRECT_BOOKING_MSG_NO_FLEET,
  DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD,
} from "@/lib/direct-booking-user-messages";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import { resolveInterCityShippingSnap } from "@/lib/inter-city-shipping";
import { prisma } from "@/lib/prisma";
import {
  DELIVERY_ADDRESS_MAX_CHARS,
  DELIVERY_ADDRESS_MIN_CHARS,
} from "@/lib/delivery-address";

/**
 * منطق التوفر: مجموع quantity في Fleet للموديل = أقصى عدد حجوزات DIRECT متزامنة
 * في أي فترة زمنية (ما عدا حالات NON_BLOCKING).
 * يُحسب التداخل بتقاطع [تاريخ البداية، تاريخ البداية + عدد الأيام) بتقويم UTC.
 */

export const NON_BLOCKING_BOOKING_STATUSES = ["CANCELLED", "REJECTED"] as const;

export type DirectBookingCommon = {
  fullName: string;
  phone: string;
  ageRange: string;
  branch: string;
  pickupDate: Date;
  numberOfDays: number;
  termsAccepted: boolean;
  /** استلام من فرع أو توصيل للعنوان */
  pickupMode: "BRANCH" | "DELIVERY";
  deliveryLat: number | null;
  deliveryLng: number | null;
  /** عنوان توصيل نصّي إن وُجد (بدون إحداثيات أو معها). */
  deliveryAddress: string | null;
};

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);

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

function dateOnlyYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** نهاية الفترة (حصرية): أول يوم بعد آخر يوم محجوز */
export function addDaysToYmd(ymd: string, days: number): string {
  const u = new Date(`${ymd}T12:00:00.000Z`);
  u.setUTCDate(u.getUTCDate() + days);
  return u.toISOString().slice(0, 10);
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
): Promise<OverlapRow[]> {
  return client.bookingRequest.findMany({
    where: {
      kind: "DIRECT",
      carModelId,
      NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
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
}): Promise<DirectAvailabilityResult> {
  const fleetUnits = await sumFleetQuantityForModel(prisma, input.carModelId);
  if (fleetUnits <= 0) {
    return { available: false, fleetUnits: 0, overlapping: 0 };
  }
  const rows = await loadBlockingDirectBookings(
    prisma,
    input.carModelId,
    input.excludeBookingRequestId,
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
}): Promise<number[]> {
  const safeDays = safeBookingDays(input.numberOfDays);
  const rows = await prisma.fleet.findMany({
    where: { quantity: { gt: 0 } },
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
      branch: branch.trim().toLowerCase(),
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
      branch: branch.trim().toLowerCase(),
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
  /** معرفات إضافات نشطة من جدول RentalAddon */
  addonIds?: number[];
  /** slug مدينة الاستلام أو مدينة عنوان التوصيل (لرسوم الشحن بين المدن) */
  pickupCitySlug?: string | null;
  /** عميل مسجّل مرتبط بالطلب عند تطابق الجوال */
  customerId?: number | null;
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

async function buildBookingAddonsJsonSnapshot(
  addonIds: number[] | undefined,
  numberOfDays: number,
  interCityShipping: InterCityShippingSnap | null,
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
    });
    if (addons.length !== uniqueIds.length) {
      return { ok: false, error: "إحدى الإضافات المختارة غير متاحة." };
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

  if (items.length === 0 && !hasShip) {
    return { ok: true, json: null };
  }

  const payload: {
    items: typeof items;
    interCityShipping?: InterCityShippingSnap;
  } = { items };
  if (hasShip && interCityShipping) {
    payload.interCityShipping = interCityShipping;
  }
  return { ok: true, json: JSON.stringify(payload) };
}

/**
 * إنشاء حجز مباشر: نفس احتساب التوفر داخل معاملة Serializable مع إعادة المحاولة عند تعارض P2034.
 */
export async function createDirectBooking(
  input: CreateDirectBookingInput,
): Promise<{ ok: true; bookingRequestId: number } | { ok: false; error: string }> {
  const { carModelId, addonIds, customerId: customerIdRaw, pickupCitySlug, ...common } = input;

  let customerId: number | null =
    customerIdRaw != null &&
    Number.isInteger(customerIdRaw) &&
    customerIdRaw > 0
      ? customerIdRaw
      : null;

  if (customerId != null) {
    const linked = await prisma.user.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });
    const bookingPhone = common.phone.trim();
    if (!linked?.phone || linked.phone !== bookingPhone) {
      customerId = null;
    }
  }

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

  const branchSlug = common.branch.trim().toLowerCase();
  const activeBranch = await prisma.branch.findFirst({
    where: { slug: branchSlug, isActive: true },
    select: { id: true },
  });
  if (!activeBranch) {
    return { ok: false, error: "الفرع غير متاح أو غير مفعّل." };
  }

  const commonNormalized = { ...common, branch: branchSlug };

  const shippingSnap = await resolveInterCityShippingSnap({
    originCitySlug: pickupCitySlug,
    returnBranchSlug: branchSlug,
  });

  const days = commonNormalized.numberOfDays;

  const addonsSnap = await buildBookingAddonsJsonSnapshot(
    addonIds,
    days,
    shippingSnap,
  );
  if (!addonsSnap.ok) {
    return { ok: false, error: addonsSnap.error };
  }

  const carType = model.category.slug || model.category.title;

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        const fleetUnits = await sumFleetQuantityForModel(tx, carModelId);
        if (fleetUnits <= 0) {
          throw new DirectBookingCapacityError(
            "NO_FLEET",
            "لا توجد وحدات لهذا الموديل في الأسطول.",
            0,
            0,
          );
        }
        const rows = await loadBlockingDirectBookings(tx, carModelId);
        const overlapping = countOverlapsFromRows(rows, commonNormalized.pickupDate, days);
        if (overlapping >= fleetUnits) {
          throw new DirectBookingCapacityError(
            "SLOT_FULL",
            "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
            fleetUnits,
            overlapping,
          );
        }
        const created = await tx.bookingRequest.create({
          data: {
            kind: "DIRECT",
            carModelId,
            customerId,
            fullName: commonNormalized.fullName,
            phone: commonNormalized.phone,
            ageRange: commonNormalized.ageRange,
            carType,
            branch: commonNormalized.branch,
            pickupMode: commonNormalized.pickupMode,
            deliveryLat: commonNormalized.deliveryLat,
            deliveryLng: commonNormalized.deliveryLng,
            deliveryAddress: commonNormalized.deliveryAddress,
            pickupDate: commonNormalized.pickupDate,
            numberOfDays: days,
            termsAccepted: commonNormalized.termsAccepted,
            addonsJson: addonsSnap.json,
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

        const fleetUnits = await sumFleetQuantityForModel(tx, carModelId);
        if (fleetUnits <= 0) {
          throw new DirectBookingCapacityError(
            "NO_FLEET",
            "لا توجد وحدات لهذا الموديل في الأسطول.",
            0,
            0,
          );
        }

        const rows = await loadBlockingDirectBookings(tx, carModelId);
        const overlapping = countOverlapsFromRows(
          rows,
          booking.pickupDate,
          booking.numberOfDays,
        );
        if (overlapping >= fleetUnits) {
          throw new DirectBookingCapacityError(
            "SLOT_FULL",
            "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
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
    select: { id: true, kind: true },
  });
  if (!booking) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  const days = safeBookingDays(input.numberOfDays);
  const commonData = {
    fullName: input.fullName.trim(),
    phone: input.phone,
    ageRange: input.ageRange,
    branch: input.branch.trim().toLowerCase(),
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
          select: { id: true, kind: true },
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

        if (isBlockingBookingStatus(statusTrim)) {
          const fleetUnits = await sumFleetQuantityForModel(tx, carModelId);
          if (fleetUnits <= 0) {
            throw new DirectBookingCapacityError(
              "NO_FLEET",
              "لا توجد وحدات لهذا الموديل في الأسطول.",
              0,
              0,
            );
          }
          const rows = await loadBlockingDirectBookings(tx, carModelId, bookingRequestId);
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
          where: { id: bookingRequestId, kind: "DIRECT" },
          data: {
            ...commonData,
            carModelId,
            carType,
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
