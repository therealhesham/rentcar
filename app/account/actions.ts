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

export type AuthFormState = { error?: string } | null;

export type CancelBookingResult = { ok: true } | { ok: false; error: string };

/** إلغاء طلب حجز من حساب العميل (ملكية الجوال/الحساب + قيود الحالة والدفع). */
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
      kind: true,
      paymentStatus: true,
    },
  });

  if (!row) {
    return { ok: false, error: "الطلب غير موجود أو لا يخص حسابك." };
  }

  const st = row.status.trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, error: "الطلب ملغى بالفعل." };
  }
  if (st === "COMPLETED" || st === "REJECTED") {
    return { ok: false, error: "لا يمكن إلغاء هذا الطلب في حالته الحالية." };
  }
  if (row.kind === "DIRECT" && row.paymentStatus === "PAID") {
    return {
      ok: false,
      error: "حجز مدفوع لا يُلغى من هنا. تواصل مع خدمة العملاء.",
    };
  }

  await prisma.bookingRequest.update({
    where: { id: row.id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");

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
  redirect("/account");
}

export async function logoutCustomer(): Promise<void> {
  await clearCustomerSessionCookie();
  redirect("/");
}
