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
import {
  computeCancellationRefundBreakdown,
  paymentStatusAfterCancellationRefund,
} from "@/lib/booking-cancellation-refund";
import { executeCancellationRefundByPaymentMethod } from "@/lib/booking-refund-executor";
import {
  computeCancellationDeductedDays,
  hoursBeforePickup,
} from "@/lib/cancellation-deduct";
import {
  getCustomerCancelMinHoursBeforePickup,
  getCustomerCancellationDeductTiers,
} from "@/lib/site-settings";

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

  const row = await prisma.bookingRequest.findFirst({
    where: {
      id,
      OR: [{ customerId: profile.id }, ...(profile.phone ? [{ phone: profile.phone }] : [])],
    },
    select: {
      id: true,
      status: true,
      pickupDate: true,
      numberOfDays: true,
      kind: true,
      paymentStatus: true,
      paymentMethod: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });

  if (!row) {
    return { ok: false, error: "الطلب غير موجود أو لا يخص حسابك." };
  }

  const st = row.status.trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, error: "الطلب ملغى بالفعل." };
  }

  const minHours = await getCustomerCancelMinHoursBeforePickup();
  if (minHours > 0) {
    const pickup = row.pickupDate;
    const now = new Date();
    if (pickup.getTime() > now.getTime()) {
      const lastMs = pickup.getTime() - minHours * 60 * 60 * 1000;
      if (now.getTime() >= lastMs) {
        return {
          ok: false,
          error: `انتهت مهلة الإلغاء . يجب إلغاء الحجز قبل موعد الاستلام بما لا يقل عن ${minHours} ساعة. للاستفسار تواصل معنا.`,
        };
      }
    }
  }

  const tiers = await getCustomerCancellationDeductTiers();
  const nowCancel = new Date();
  const hoursBefore = hoursBeforePickup(row.pickupDate, nowCancel);
  const deductDays = computeCancellationDeductedDays(
    hoursBefore,
    tiers,
    row.numberOfDays,
  );

  const baseData = {
    status: "CANCELLED" as const,
    cancelledAt: nowCancel,
    cancellationDeductedDays: deductDays > 0 ? deductDays : null,
  };

  let refundInclTaxSar: number | undefined;
  let paymentMethodOut: string | null | undefined;

  const ps = row.paymentStatus.trim().toUpperCase();
  const paidEligible =
    row.kind === "DIRECT" && ps === "PAID" && row.carModel != null;

  let paymentPatch: {
    paymentStatus?: string;
    cancellationRefundAmountSar?: number | null;
    cancellationRefundExternalRef?: string | null;
  } = {};

  if (paidEligible && row.carModel) {
    const br = computeCancellationRefundBreakdown({
      numberOfDays: row.numberOfDays,
      deductDays,
      pricePerDayExclTax: row.carModel.price,
      vatRatePercent: row.carModel.vatRatePercent,
      addonsJson: row.addonsJson,
    });
    if (br) {
      const exec = await executeCancellationRefundByPaymentMethod({
        bookingRequestId: row.id,
        paymentMethod: row.paymentMethod,
        refundAmountInclTaxSar: br.refundInclTax,
      });
      if (exec.ok) {
        paymentPatch = {
          paymentStatus: paymentStatusAfterCancellationRefund(
            br.paidTotalInclTax,
            br.refundInclTax,
          ),
          cancellationRefundAmountSar: br.refundInclTax,
          cancellationRefundExternalRef: exec.externalRef,
        };
        refundInclTaxSar = br.refundInclTax;
        paymentMethodOut = row.paymentMethod;
      } else {
        console.error("[cancelCustomerBooking] refund execution failed:", exec.error);
      }
    }
  }

  await prisma.bookingRequest.update({
    where: { id: row.id },
    data: {
      ...baseData,
      ...paymentPatch,
    },
  });

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/fleet/payment/${row.id}`);

  return { ok: true, refundInclTaxSar, paymentMethod: paymentMethodOut };
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
  redirect("/account");
}

export async function logoutCustomer(): Promise<void> {
  await clearCustomerSessionCookie();
  redirect("/");
}
