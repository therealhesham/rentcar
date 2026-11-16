"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertBookingRequestInScope, requirePermissionForAction } from "@/lib/admin-access";
import { logBookingEvent } from "@/lib/booking-audit";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type DriverActionState = { ok: boolean; error?: string };

const DRIVERS_PERMISSION = "/admin/delivery-drivers";
const BOOKING_PERMISSION = "/admin/bookings";
const MIN_PASSWORD_LENGTH = 6;

export type DriverLeg = "DELIVERY" | "RETURN";

const LEG_LABEL: Record<DriverLeg, string> = {
  DELIVERY: "تسليم السيارة للعميل",
  RETURN: "استلام السيارة من العميل",
};

/** يقبل 05XXXXXXXX أو 5XXXXXXXX أو +9665XXXXXXXX ويعيد صيغة التخزين +9665XXXXXXXX. */
function normalizeDriverPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return saudiLocalNineToE164(digits);
}

function readId(formData: FormData, key: string): number | null {
  const n = Number(formData.get(key));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function createDeliveryDriver(
  _prev: DriverActionState | null,
  formData: FormData,
): Promise<DriverActionState> {
  const auth = await requirePermissionForAction(DRIVERS_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "أدخل اسم السواق." };

  const phone = normalizeDriverPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "رقم الجوال غير صالح (مثال: 05XXXXXXXX)." };

  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` };
  }

  try {
    await prisma.deliveryDriver.create({
      data: { name, phone, passwordHash: await hashPassword(password) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "رقم الجوال مسجّل لسواق آخر." };
    }
    throw err;
  }

  revalidatePath("/admin/delivery-drivers");
  return { ok: true };
}

export async function setDeliveryDriverActive(
  _prev: DriverActionState | null,
  formData: FormData,
): Promise<DriverActionState> {
  const auth = await requirePermissionForAction(DRIVERS_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = readId(formData, "driverId");
  if (!id) return { ok: false, error: "معرّف السواق غير صالح." };
  const isActive = String(formData.get("isActive")) === "true";

  const res = await prisma.deliveryDriver.updateMany({ where: { id }, data: { isActive } });
  if (res.count === 0) return { ok: false, error: "السواق غير موجود." };

  revalidatePath("/admin/delivery-drivers");
  return { ok: true };
}

export async function resetDeliveryDriverPassword(
  _prev: DriverActionState | null,
  formData: FormData,
): Promise<DriverActionState> {
  const auth = await requirePermissionForAction(DRIVERS_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = readId(formData, "driverId");
  if (!id) return { ok: false, error: "معرّف السواق غير صالح." };

  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` };
  }

  const res = await prisma.deliveryDriver.updateMany({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });
  if (res.count === 0) return { ok: false, error: "السواق غير موجود." };

  revalidatePath("/admin/delivery-drivers");
  return { ok: true };
}

/** تعيين (أو إلغاء تعيين) سواق على رحلة التسليم أو الاستلام لحجز بتوصيل. */
export async function assignBookingDriverAction(
  bookingId: number,
  leg: DriverLeg,
  driverId: number | null,
): Promise<DriverActionState> {
  const auth = await requirePermissionForAction(BOOKING_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "رقم الحجز غير صالح." };
  }
  if (leg !== "DELIVERY" && leg !== "RETURN") {
    return { ok: false, error: "نوع الرحلة غير صالح." };
  }
  if (driverId != null && (!Number.isInteger(driverId) || driverId < 1)) {
    return { ok: false, error: "السواق غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return scope;

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      cancelledAt: true,
      pickupMode: true,
      returnMode: true,
      deliveryDriverId: true,
      returnDriverId: true,
    },
  });
  if (!booking) return { ok: false, error: "الحجز غير موجود." };

  const legApplies =
    leg === "DELIVERY" ? booking.pickupMode === "DELIVERY" : booking.returnMode === "DELIVERY";
  if (!legApplies) {
    return { ok: false, error: "هذه الرحلة غير مطلوبة في الحجز (ليست بتوصيل)." };
  }

  const current = leg === "DELIVERY" ? booking.deliveryDriverId : booking.returnDriverId;
  if (current === driverId) return { ok: true };

  let driverName: string | null = null;
  if (driverId != null) {
    if (booking.cancelledAt || booking.status === "CANCELLED" || booking.status === "REJECTED") {
      return { ok: false, error: "لا يمكن تعيين سواق على حجز ملغي أو مرفوض." };
    }
    const driver = await prisma.deliveryDriver.findUnique({
      where: { id: driverId },
      select: { name: true, isActive: true },
    });
    if (!driver) return { ok: false, error: "السواق غير موجود." };
    if (!driver.isActive) return { ok: false, error: "السواق معطّل. فعّله أولاً أو اختر غيره." };
    driverName = driver.name;
  }

  const assignedAt = driverId != null ? new Date() : null;
  await prisma.bookingRequest.update({
    where: { id: bookingId },
    data:
      leg === "DELIVERY"
        ? { deliveryDriverId: driverId, deliveryDriverAssignedAt: assignedAt }
        : { returnDriverId: driverId, returnDriverAssignedAt: assignedAt },
  });

  await logBookingEvent({
    bookingId,
    event: "DRIVER_ASSIGNED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes:
      driverName != null
        ? `${LEG_LABEL[leg]}: ${driverName}`
        : `${LEG_LABEL[leg]}: إلغاء تعيين السواق`,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/car-bookings");
  return { ok: true };
}
