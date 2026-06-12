"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearCustomerSessionCookie,
  getCustomerProfile,
  setCustomerSessionCookie,
} from "@/lib/customer-auth";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { cancelBookingWithPolicy } from "@/lib/booking-cancellation-service";
import { safeCustomerReturnPath } from "@/lib/customer-booking-access";
import { updateDirectBookingDates } from "@/lib/direct-booking";
import {
  bookingDaysPriceInputFromSnapshot,
  bookingTotalInclTaxForDays,
  rebuildAddonsJsonForDays,
} from "@/lib/booking-edit";
import { lastInclusiveBookingDayYmd } from "@/lib/booking-calendar-ymd";

export type AuthFormState = { error?: string } | null;

export type CancelBookingResult =
  | { ok: true; refundInclTaxSar?: number; paymentMethod?: string | null }
  | { ok: false; error: string };

/** إلغاء طلب حجز من حساب العميل (ملكية الحساب/الجوال فقط). تفاصيل السياسات تُدار من لوحة الإدارة. */
export async function cancelCustomerBooking(formData: FormData): Promise<CancelBookingResult> {
  const profile = await getCustomerProfile();
  if (!profile) {
    return { ok: false, error: "يجب تسجيل الدخول." };
  }

  const id = Number(formData.get("bookingId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const result = await cancelBookingWithPolicy({
    bookingRequestId: id,
    role: "customer",
    customerId: profile.id,
    customerPhone: profile.phone,
  });

  if (!result.ok) return result;

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath(`/fleet/payment/${id}`);

  return {
    ok: true,
    refundInclTaxSar: result.refundInclTaxSar,
    paymentMethod: result.paymentMethod,
  };
}

export type UpdateBookingDatesResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * تعديل تواريخ حجز مباشر من حساب العميل:
 * - إن بدأ الحجز (مرّ موعد الاستلام) يُقفل تاريخ الاستلام ويُسمح بتمديد العودة فقط.
 * - يُعاد فحص التوفر (مع استثناء الطلب نفسه) ويُحدَّث السجل في مكانه؛ فرق السعر يُدفع عند الفرع.
 */
export async function updateCustomerBookingDates(
  formData: FormData,
): Promise<UpdateBookingDatesResult> {
  const profile = await getCustomerProfile();
  if (!profile) {
    return { ok: false, error: "يجب تسجيل الدخول." };
  }

  const id = Number(formData.get("bookingId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const daysRaw = Number(formData.get("days"));
  const pickupRaw = String(formData.get("pickupDate") ?? "").trim();

  const booking = await prisma.bookingRequest.findFirst({
    where: {
      id,
      kind: "DIRECT",
      OR: [
        { customerId: profile.id },
        ...(profile.phone ? [{ phone: profile.phone }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      pickupDate: true,
      numberOfDays: true,
      addonsJson: true,
      paymentStatus: true,
      balanceDueAtBranchSar: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  if (!booking) {
    return { ok: false, error: "الطلب غير موجود أو لا يخص حسابك." };
  }

  const statusKey = booking.status.trim().toUpperCase();
  if (statusKey === "CANCELLED" || statusKey === "REJECTED" || statusKey === "COMPLETED") {
    return { ok: false, error: "لا يمكن تعديل حجز منتهٍ أو ملغى." };
  }

  const now = new Date();
  const rentalEndMs =
    booking.pickupDate.getTime() + booking.numberOfDays * 24 * 60 * 60 * 1000;
  if (now.getTime() >= rentalEndMs) {
    return { ok: false, error: "انتهت مدة هذا الحجز، لا يمكن تعديله." };
  }
  const started = booking.pickupDate.getTime() <= now.getTime();

  let pickupDate: Date;
  if (started) {
    pickupDate = booking.pickupDate;
  } else {
    const d = new Date(pickupRaw);
    if (!pickupRaw || Number.isNaN(d.getTime())) {
      return { ok: false, error: "تاريخ الاستلام غير صالح." };
    }
    if (d.getTime() < now.getTime() - 60 * 1000) {
      return { ok: false, error: "تاريخ الاستلام يجب أن يكون في المستقبل." };
    }
    pickupDate = d;
  }

  if (!Number.isFinite(daysRaw) || daysRaw < 1 || daysRaw > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  const numberOfDays = Math.round(daysRaw);
  if (started && numberOfDays < booking.numberOfDays) {
    return {
      ok: false,
      error: "بعد بدء الحجز يمكن تمديد العودة فقط (لا يمكن تقليل عدد الأيام).",
    };
  }

  if (profile.licenseExpiryDate && !Number.isNaN(profile.licenseExpiryDate.getTime())) {
    const expYmd = profile.licenseExpiryDate.toISOString().slice(0, 10);
    const lastDayYmd = lastInclusiveBookingDayYmd(pickupDate, numberOfDays);
    if (expYmd < lastDayYmd) {
      return {
        ok: false,
        error: `تاريخ انتهاء رخصتك (${expYmd}) قبل آخر يوم من المدة الجديدة (${lastDayYmd}).`,
      };
    }
  }

  const newAddonsJson = rebuildAddonsJsonForDays(booking.addonsJson, numberOfDays);

  // فرق السعر الناتج عن التمديد/التعديل يُحصَّل عند الفرع وقت الإرجاع.
  // نراكم الفرق على الرصيد المستحق (لا يقل عن صفر). يُصفَّر تلقائياً عند الدفع أونلاين أو إرجاع السيارة.
  let balanceDueAtBranchSar: number | null = booking.balanceDueAtBranchSar ?? null;
  if (booking.carModel) {
    const priceInput = bookingDaysPriceInputFromSnapshot(
      booking.carModel.price,
      booking.carModel.vatRatePercent,
      booking.addonsJson,
    );
    const oldTotal = bookingTotalInclTaxForDays(priceInput, booking.numberOfDays);
    const newTotal = bookingTotalInclTaxForDays(priceInput, numberOfDays);
    const base = booking.balanceDueAtBranchSar ?? 0;
    const next = base + (newTotal - oldTotal);
    const rounded = Math.max(0, Math.round(next * 100) / 100);
    balanceDueAtBranchSar = rounded > 0 ? rounded : null;
  }

  const result = await updateDirectBookingDates({
    bookingRequestId: id,
    customerId: profile.id,
    customerPhone: profile.phone,
    pickupDate,
    numberOfDays,
    addonsJson: newAddonsJson,
    balanceDueAtBranchSar,
  });
  if (!result.ok) return result;

  revalidatePath("/account");
  revalidatePath(`/account/bookings/${id}/edit`);
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${id}`);

  return { ok: true };
}

export async function registerCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("passwordConfirm") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phoneLocal = String(formData.get("phone") ?? "")
    .replace(/\s+/g, "")
    .trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "البريد الإلكتروني غير صالح." };
  }
  if (password.length < 8) {
    return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." };
  }
  if (password !== password2) {
    return { error: "تأكيد كلمة المرور غير متطابق." };
  }
  if (name.length < 2) {
    return { error: "الاسم قصير جداً." };
  }
  const phone = saudiLocalNineToE164(phoneLocal);
  if (!phone) {
    return { error: "رقم الجوال يجب أن يكون 9 أرقام تبدأ بـ 5." };
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, name, phone },
      select: { id: true },
    });
    await setCustomerSessionCookie(user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const t = Array.isArray(target) ? target.join(",") : String(target ?? "");
      if (t.includes("email")) return { error: "البريد مسجّل مسبقاً." };
      if (t.includes("phone")) return { error: "رقم الجوال مسجّل مسبقاً." };
      return { error: "بيانات مكررة — تحقق من البريد أو الجوال." };
    }
    console.error(e);
    return { error: "تعذّر إنشاء الحساب." };
  }

  redirect("/account");
}

export async function loginCustomer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "أدخل البريد وكلمة المرور." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "البريد أو كلمة المرور غير صحيحة." };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "البريد أو كلمة المرور غير صحيحة." };
  }

  await setCustomerSessionCookie(user.id);
  const next = safeCustomerReturnPath(String(formData.get("next") ?? ""));
  redirect(next);
}

export async function logoutCustomer(): Promise<void> {
  await clearCustomerSessionCookie();
  redirect("/");
}
