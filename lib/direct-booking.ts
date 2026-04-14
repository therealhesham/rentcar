import { prisma } from "@/lib/prisma";

/** حالات لا تستهلك وحدة من أسطول الموديل عند احتساب التداخل */
const NON_BLOCKING_STATUSES = ["CANCELLED", "REJECTED"] as const;

export type DirectBookingCommon = {
  fullName: string;
  phone: string;
  ageRange: string;
  branch: string;
  pickupDate: Date;
  numberOfDays: number;
  termsAccepted: boolean;
};

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);
const BRANCH_OPTIONS = new Set(["jeddah", "madinah", "tabuk"]);

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

export async function getFleetUnitsForModel(carModelId: number): Promise<number> {
  const agg = await prisma.fleet.aggregate({
    where: { modelId: carModelId },
    _sum: { quantity: true },
  });
  return Math.max(0, agg._sum.quantity ?? 0);
}

/**
 * عدد الحجوزات المباشرة النشطة التي تتداخل مع الفترة المطلوبة لنفس الموديل.
 */
export async function countOverlappingDirectBookings(
  carModelId: number,
  pickupDate: Date,
  numberOfDays: number,
  excludeBookingRequestId?: number,
): Promise<number> {
  const { startYmd, endExclusiveYmd } = bookingRangeYmd(pickupDate, numberOfDays);

  const rows = await prisma.bookingRequest.findMany({
    where: {
      kind: "DIRECT",
      carModelId,
      NOT: { status: { in: [...NON_BLOCKING_STATUSES] } },
      ...(excludeBookingRequestId
        ? { id: { not: excludeBookingRequestId } }
        : {}),
    },
    select: {
      id: true,
      pickupDate: true,
      numberOfDays: true,
    },
  });

  let count = 0;
  for (const row of rows) {
    const other = bookingRangeYmd(row.pickupDate, row.numberOfDays);
    if (
      ymdRangesOverlap(startYmd, endExclusiveYmd, other.startYmd, other.endExclusiveYmd)
    ) {
      count += 1;
    }
  }
  return count;
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
  const fleetUnits = await getFleetUnitsForModel(input.carModelId);
  if (fleetUnits <= 0) {
    return { available: false, fleetUnits: 0, overlapping: 0 };
  }
  const overlapping = await countOverlappingDirectBookings(
    input.carModelId,
    input.pickupDate,
    input.numberOfDays,
    input.excludeBookingRequestId,
  );
  return {
    available: overlapping < fleetUnits,
    fleetUnits,
    overlapping,
  };
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
  if (!BRANCH_OPTIONS.has(branch)) {
    return { ok: false, error: "الفرع غير صالح." };
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

  return {
    ok: true,
    data: {
      fullName,
      phone,
      ageRange,
      branch,
      pickupDate,
      numberOfDays: Math.round(days),
      termsAccepted,
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
  if (!BRANCH_OPTIONS.has(branch)) {
    return { ok: false, error: "الفرع غير صالح." };
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

  return {
    ok: true,
    data: {
      fullName,
      phone,
      ageRange,
      branch,
      pickupDate,
      numberOfDays: Math.round(days),
      termsAccepted,
    },
  };
}

export type CreateDirectBookingInput = DirectBookingCommon & {
  carModelId: number;
};

/**
 * إنشاء حجز مباشر بعد التحقق من الموديل والأسطول والتوفر في التواريخ.
 */
export async function createDirectBooking(
  input: CreateDirectBookingInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { carModelId, ...common } = input;

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

  const fleetUnits = await getFleetUnitsForModel(carModelId);
  if (fleetUnits <= 0) {
    return { ok: false, error: "هذه السيارة غير متاحة للحجز حالياً." };
  }

  const { available, overlapping } = await getDirectBookingAvailability({
    carModelId,
    pickupDate: common.pickupDate,
    numberOfDays: common.numberOfDays,
  });

  if (!available) {
    return {
      ok: false,
      error: `السيارة غير متاحة في هذه الفترة: يوجد ${overlapping} حجز(وز) متزامن(ة) والحد الأقصى للوحدات هو ${fleetUnits}.`,
    };
  }

  const carType = model.category.slug || model.category.title;

  try {
    await prisma.bookingRequest.create({
      data: {
        kind: "DIRECT",
        carModelId,
        fullName: common.fullName,
        phone: common.phone,
        ageRange: common.ageRange,
        carType,
        branch: common.branch,
        pickupDate: common.pickupDate,
        numberOfDays: common.numberOfDays,
        termsAccepted: common.termsAccepted,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  return { ok: true };
}
