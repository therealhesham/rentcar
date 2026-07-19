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
import { hasBookingPickupPassed } from "@/lib/booking-lifecycle";
import { createNotification } from "@/lib/notification-service";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
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
  /** paymentRedirect: يُملأ عندما ينتج عن التعديل مبلغ مستحق على العميل — يوجَّه لصفحة الدفع لسداده. */
  | { ok: true; paymentRedirect?: string }
  | { ok: false; error: string };

/**
 * تعديل تواريخ حجز مباشر من حساب العميل — يُسمح به فقط قبل موعد الاستلام.
 * بعد بدء الحجز (أو انتهائه) لا يمكن للعميل تعديله ذاتياً بأي شكل.
 * يُعاد فحص التوفر (مع استثناء الطلب نفسه) ويُحدَّث السجل في مكانه؛ فرق السعر يُدفع عند الفرع.
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
      fullName: true,
      pickupDate: true,
      numberOfDays: true,
      addonsJson: true,
      paymentStatus: true,
      balanceDueAtBranchSar: true,
      paidAmountSar: true,
      snapshotTotalAmountSar: true,
      refundDueToCustomerSar: true,
      refundDueSettledAt: true,
      branchId: true,
      returnBranchId: true,
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
  if (hasBookingPickupPassed(booking.pickupDate, now)) {
    return { ok: false, error: "بدأ موعد استلام هذا الحجز، لا يمكن تعديله." };
  }

  const d = new Date(pickupRaw);
  if (!pickupRaw || Number.isNaN(d.getTime())) {
    return { ok: false, error: "تاريخ الاستلام غير صالح." };
  }
  if (d.getTime() < now.getTime() - 60 * 1000) {
    return { ok: false, error: "تاريخ الاستلام يجب أن يكون في المستقبل." };
  }
  const pickupDate = d;

  if (!Number.isFinite(daysRaw) || daysRaw < 1 || daysRaw > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  const numberOfDays = Math.round(daysRaw);

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

  // تسوية فرق السعر بعد التعديل (حجز مدفوع):
  // - العميل عليه فلوس (تمديد) → يُسجَّل رصيد مستحق ويُوجَّه لصفحة الدفع لسداده أونلاين.
  // - العميل له فلوس (تقليص) → تُسجَّل «مستحقات للعميل» وتُسوَّى من لوحة الإدارة (كاش أو نفس وسيلة الدفع).
  const isPaid = booking.paymentStatus.trim().toUpperCase() === "PAID";
  let balanceDueAtBranchSar: number | null = booking.balanceDueAtBranchSar ?? null;
  let refundDueToCustomerSar: number | null | undefined;
  let snapshotTotalAmountSar: number | null = null;
  let redirectToPaymentPage = false;
  let creditForCustomerSar = 0;
  if (booking.carModel) {
    const priceInput = bookingDaysPriceInputFromSnapshot(
      booking.carModel.price,
      booking.carModel.vatRatePercent,
      booking.addonsJson,
    );
    const oldTotal = bookingTotalInclTaxForDays(priceInput, booking.numberOfDays);
    const newTotal = bookingTotalInclTaxForDays(priceInput, numberOfDays);
    const diff = newTotal - oldTotal;

    // استرجاع الإجمالي السابق (للحجوزات القديمة التي لا تملك snapshot، نستنتجه)
    const previousTotal = booking.snapshotTotalAmountSar ??
      (isPaid && typeof booking.paidAmountSar === "number"
        ? booking.paidAmountSar + (booking.balanceDueAtBranchSar ?? 0)
        : oldTotal);

    // snapshot الإجمالي الجديد مجمّد وقت التعديل بإضافة فرق التمديد فقط
    snapshotTotalAmountSar = Math.round((previousTotal + diff) * 100) / 100;

    if (isPaid) {
      // صافي موقف العميل = المستحق عليه سابقاً − المستحق له سابقاً (غير المُسوَّى) + فرق التعديل
      const unsettledCredit =
        booking.refundDueSettledAt == null ? (booking.refundDueToCustomerSar ?? 0) : 0;
      const net =
        Math.round(((booking.balanceDueAtBranchSar ?? 0) - unsettledCredit + diff) * 100) / 100;
      if (net > 0.005) {
        balanceDueAtBranchSar = net;
        refundDueToCustomerSar = null;
        redirectToPaymentPage = true;
      } else if (net < -0.005) {
        balanceDueAtBranchSar = null;
        creditForCustomerSar = Math.round(-net * 100) / 100;
        refundDueToCustomerSar = creditForCustomerSar;
      } else {
        balanceDueAtBranchSar = null;
        refundDueToCustomerSar = null;
      }
    } else {
      // غير مدفوع: الإجمالي الجديد يُدفع كاملاً عند إتمام الدفع — لا رصيد ولا مستحقات.
      const base = booking.balanceDueAtBranchSar ?? 0;
      const rounded = Math.max(0, Math.round((base + diff) * 100) / 100);
      balanceDueAtBranchSar = rounded > 0 ? rounded : null;
    }
  }

  const result = await updateDirectBookingDates({
    bookingRequestId: id,
    customerId: profile.id,
    customerPhone: profile.phone,
    pickupDate,
    numberOfDays,
    addonsJson: newAddonsJson,
    balanceDueAtBranchSar,
    snapshotTotalAmountSar,
    refundDueToCustomerSar,
  });
  if (!result.ok) return result;

  if (creditForCustomerSar > 0) {
    // تنبيه لوحة الإدارة: مستحقات جديدة للعميل تُسوَّى من قسم «مستحقات للعميل».
    await createNotification(
      { branchId: booking.branchId ?? booking.returnBranchId },
      "مستحقات للعميل بعد تعديل حجز",
      `الحجز #${id} (${booking.fullName}) عُدِّل وأصبح للعميل مستحقات ${creditForCustomerSar} ر.س — تُسوَّى من قسم «مستحقات للعميل».`,
    );
    const meta = await currentRequestMeta();
    await logActivity({
      kind: "BOOKING_REFUND",
      path: `/admin/customer-dues`,
      actorLabel: `العميل — تعديل الحجز #${id} أنشأ مستحقات ${creditForCustomerSar} ر.س`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  revalidatePath("/account");
  revalidatePath(`/account/bookings/${id}/edit`);
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/customer-dues");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath(`/fleet/payment/${id}`);

  return {
    ok: true,
    ...(redirectToPaymentPage ? { paymentRedirect: `/fleet/payment/${id}` } : {}),
  };
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
