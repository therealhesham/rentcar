"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  clearCustomerSessionCookie,
  setCustomerSessionCookie,
} from "@/lib/customer-auth";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type AuthFormState = { error?: string } | null;

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
