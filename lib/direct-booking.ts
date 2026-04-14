import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * منطق التوفر: مجموع quantity في Fleet للموديل = أقصى عدد حجوزات DIRECT متزامنة
 * في أي فترة زمنية (ما عدا حالات NON_BLOCKING).
 * يُحسب التداخل بتقاطع [تاريخ البداية، تاريخ البداية + عدد الأيام) بتقويم UTC.
 */

/** حالات لا تستهلك وحدة من أسطول الموديل عند احتساب التداخل */
export const NON_BLOCKING_BOOKING_STATUSES = ["CANCELLED", "REJECTED"] as const;

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
      numberOfDays: safeBookingDays(days),
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
      numberOfDays: safeBookingDays(days),
      termsAccepted,
    },
  };
}

export type CreateDirectBookingInput = DirectBookingCommon & {
  carModelId: number;
};

/**
 * إنشاء حجز مباشر: نفس احتساب التوفر داخل معاملة Serializable مع إعادة المحاولة عند تعارض P2034.
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

  const carType = model.category.slug || model.category.title;
  const days = common.numberOfDays;

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
        const overlapping = countOverlapsFromRows(rows, common.pickupDate, days);
        if (overlapping >= fleetUnits) {
          throw new DirectBookingCapacityError(
            "SLOT_FULL",
            "الفترة ممتلئة بالنسبة لعدد العربيات في الأسطول.",
            fleetUnits,
            overlapping,
          );
        }
        await tx.bookingRequest.create({
          data: {
            kind: "DIRECT",
            carModelId,
            fullName: common.fullName,
            phone: common.phone,
            ageRange: common.ageRange,
            carType,
            branch: common.branch,
            pickupDate: common.pickupDate,
            numberOfDays: days,
            termsAccepted: common.termsAccepted,
          },
        });
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

  return { ok: true };
}

function capacityErrorToResult(
  e: DirectBookingCapacityError,
): { ok: false; error: string } {
  if (e.code === "NO_FLEET") {
    return { ok: false, error: "هذه السيارة غير متاحة للحجز حالياً (لا كمية في الأسطول)." };
  }
  return {
    ok: false,
    error: `السيارة غير متاحة في هذه الفترة: يوجد ${e.overlapping} حجز(وز) متزامن(ة) والحد الأقصى للوحدات في الأسطول هو ${e.fleetUnits}.`,
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
